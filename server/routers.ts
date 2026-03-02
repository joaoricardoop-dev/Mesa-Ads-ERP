import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { financialRouter } from "./financialRouter";
import { quotationRouter } from "./quotationRouter";
import { leadRouter } from "./leadRouter";
import { serviceOrderRouter } from "./serviceOrderRouter";
import { termRouter } from "./termRouter";
import { libraryRouter } from "./libraryRouter";
import { batchRouter } from "./batchRouter";
import { publicProcedure, protectedProcedure, adminProcedure, operacoesProcedure, comercialProcedure, internalProcedure, anuncianteProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authStorage } from "./replit_integrations/auth";
import {
  listRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignRestaurants,
  setCampaignRestaurants,
  getCampaignHistory,
  addCampaignHistory,
  getClientHistory,
  getMonthlyEconomics,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetItems,
  listActiveBudgetsWithItems,
  listActiveRestaurants,
  getActiveRestaurant,
  createActiveRestaurant,
  updateActiveRestaurant,
  deleteActiveRestaurant,
  getRestaurantCampaigns,
  getRestaurantBranches,
  linkBranch,
  unlinkBranch,
  listRestaurantPhotos,
  addRestaurantPhoto,
  deleteRestaurantPhoto,
  listRestaurantPayments,
  addRestaurantPayment,
  updateRestaurantPayment,
  deleteRestaurantPayment,
  recalculateAllRatings,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  financial: financialRouter,
  quotation: quotationRouter,
  lead: leadRouter,
  serviceOrder: serviceOrderRouter,
  term: termRouter,
  library: libraryRouter,
  batch: batchRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Dev Role Switcher (dev only) ───────────────────────────────────────
  dev: router({
    switchRole: protectedProcedure
      .input(z.object({ role: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (process.env.NODE_ENV === "production") {
          throw new Error("Not available in production");
        }
        const updated = await authStorage.updateUserRole(ctx.user!.id, input.role);
        return updated;
      }),
  }),

  // ─── Members (Admin) ────────────────────────────────────────────────────
  members: router({
    list: adminProcedure.query(async () => {
        const allUsers = await authStorage.listUsers();
        return allUsers.map(({ passwordHash: _, ...u }) => u);
      }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.string(), role: z.string() }))
      .mutation(async ({ input }) => {
        const user = await authStorage.updateUserRole(input.userId, input.role);
        if (!user) return undefined;
        const { passwordHash: _, ...safe } = user;
        return safe;
      }),

    toggleActive: adminProcedure
      .input(z.object({ userId: z.string(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const user = await authStorage.updateUserActive(input.userId, input.isActive);
        if (!user) return undefined;
        const { passwordHash: _, ...safe } = user;
        return safe;
      }),

    createUser: adminProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        role: z.string().default("user"),
        tempPassword: z.string().min(6),
        clientId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const bcrypt = await import("bcryptjs");
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const { users: usersTable } = await import("../shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const existing = await db.select().from(usersTable).where(eq(usersTable.email, input.email.toLowerCase().trim()));
        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este e-mail." });
        }

        if (input.role === "anunciante" && !input.clientId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anunciantes devem ser vinculados a um cliente." });
        }

        const hash = await bcrypt.hash(input.tempPassword, 10);
        const [user] = await db.insert(usersTable).values({
          email: input.email.toLowerCase().trim(),
          firstName: input.firstName,
          lastName: input.lastName || null,
          role: input.role,
          isActive: true,
          passwordHash: hash,
          mustChangePassword: true,
          clientId: input.role === "anunciante" ? input.clientId : null,
        }).returning();
        const { passwordHash: _ph, ...safeUser } = user;
        return safeUser;
      }),

    resetPassword: adminProcedure
      .input(z.object({
        userId: z.string(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        const bcrypt = await import("bcryptjs");
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const { users: usersTable } = await import("../shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const hash = await bcrypt.hash(input.newPassword, 10);
        const [updated] = await db.update(usersTable).set({
          passwordHash: hash,
          mustChangePassword: true,
          updatedAt: new Date(),
        }).where(eq(usersTable.id, input.userId)).returning();

        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        return { success: true };
      }),
  }),

  // ─── CNPJ Lookup ────────────────────────────────────────────────────────
  cnpj: router({
    lookup: publicProcedure
      .input(z.object({ cnpj: z.string().min(14) }))
      .query(async ({ input }) => {
        const cleanCnpj = input.cnpj.replace(/\D/g, "");
        if (cleanCnpj.length !== 14) throw new Error("CNPJ inválido");

        const res = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`);
        if (!res.ok) {
          if (res.status === 429) throw new Error("Muitas consultas. Aguarde alguns segundos.");
          throw new Error("CNPJ não encontrado");
        }
        const data = await res.json();

        const est = data.estabelecimento || {};
        const socios = (data.socios || []).map((s: any) => ({
          nome: s.nome,
          qualificacao: s.qualificacao_socio?.descricao || "",
          dataEntrada: s.data_entrada,
          faixaEtaria: s.faixa_etaria,
        }));

        const atividadesSecundarias = (est.atividades_secundarias || []).map((a: any) => ({
          id: a.id,
          descricao: a.descricao,
        }));

        return {
          cnpj: cleanCnpj,
          razaoSocial: data.razao_social || "",
          nomeFantasia: est.nome_fantasia || "",
          porte: data.porte?.descricao || "",
          naturezaJuridica: data.natureza_juridica?.descricao || "",
          capitalSocial: data.capital_social || "",
          atividadePrincipal: est.atividade_principal ? `${est.atividade_principal.id} - ${est.atividade_principal.descricao}` : "",
          atividadesSecundarias,
          dataAbertura: est.data_inicio_atividade || "",
          situacaoCadastral: est.situacao_cadastral || "",
          tipoEstabelecimento: est.tipo || "",
          logradouro: est.logradouro || "",
          numero: est.numero || "",
          complemento: est.complemento || "",
          bairro: est.bairro || "",
          cidade: est.cidade?.nome || "",
          uf: est.estado?.sigla || "",
          cep: est.cep || "",
          telefone1: est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : "",
          telefone2: est.ddd2 && est.telefone2 ? `(${est.ddd2}) ${est.telefone2}` : "",
          email: est.email || "",
          socios,
        };
      }),
  }),

  // ─── Restaurants ────────────────────────────────────────────────────────
  restaurant: router({
    list: protectedProcedure.query(() => listRestaurants()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getRestaurant(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          razaoSocial: z.string().optional(),
          cnpj: z.string().optional(),
          address: z.string().optional(),
          addressNumber: z.string().optional(),
          complemento: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          cep: z.string().optional(),
          email: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
          whatsapp: z.string().optional(),
          instagram: z.string().optional(),
          porte: z.string().optional(),
          naturezaJuridica: z.string().optional(),
          atividadePrincipal: z.string().optional(),
          atividadesSecundarias: z.string().optional(),
          capitalSocial: z.string().optional(),
          dataAbertura: z.string().optional(),
          situacaoCadastral: z.string().optional(),
          tipoEstabelecimento: z.string().optional(),
          socios: z.string().optional(),
          coastersAllocated: z.number().int().min(1).default(500),
          commissionPercent: z.string().default("20.00"),
          status: z.enum(["active", "inactive"]).default("active"),
        })
      )
      .mutation(({ input }) => createRestaurant(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          razaoSocial: z.string().optional(),
          cnpj: z.string().optional(),
          address: z.string().optional(),
          addressNumber: z.string().optional(),
          complemento: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          cep: z.string().optional(),
          email: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
          whatsapp: z.string().optional(),
          instagram: z.string().optional(),
          porte: z.string().optional(),
          naturezaJuridica: z.string().optional(),
          atividadePrincipal: z.string().optional(),
          atividadesSecundarias: z.string().optional(),
          capitalSocial: z.string().optional(),
          dataAbertura: z.string().optional(),
          situacaoCadastral: z.string().optional(),
          tipoEstabelecimento: z.string().optional(),
          socios: z.string().optional(),
          coastersAllocated: z.number().int().min(1).optional(),
          commissionPercent: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateRestaurant(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteRestaurant(input.id)),
  }),

  // ─── Active Restaurants (Restaurantes Ativos) ────────────────────────
  activeRestaurant: router({
    list: protectedProcedure.query(() => listActiveRestaurants()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getActiveRestaurant(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          address: z.string().min(1),
          neighborhood: z.string().min(1),
          googleMapsLink: z.string().optional(),
          instagram: z.string().optional(),
          contactType: z.enum(["proprietario", "gerente", "marketing", "outro"]).optional(),
          contactName: z.string().min(1),
          contactRole: z.string().min(1),
          whatsapp: z.string().min(1),
          email: z.string().optional(),
          financialEmail: z.string().optional(),
          socialClass: z.string().optional(),
          tableCount: z.number().int().min(0),
          seatCount: z.number().int().min(0),
          monthlyCustomers: z.number().int().min(0),
          monthlyDrinksSold: z.number().int().min(0).optional().nullable(),
          busyDays: z.string().optional(),
          busyHours: z.string().optional(),
          excludedCategories: z.string().optional(),
          excludedOther: z.string().optional(),
          photoAuthorization: z.string().optional(),
          photoUrls: z.string().optional(),
          pixKey: z.string().optional(),
          cnpj: z.string().optional(),
          razaoSocial: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          cep: z.string().optional(),
          porte: z.string().optional(),
          naturezaJuridica: z.string().optional(),
          atividadePrincipal: z.string().optional(),
          atividadesSecundarias: z.string().optional(),
          capitalSocial: z.string().optional(),
          dataAbertura: z.string().optional(),
          situacaoCadastral: z.string().optional(),
          socios: z.string().optional(),
          ticketMedio: z.string().optional(),
          avgStayMinutes: z.number().int().optional(),
          locationRating: z.number().int().min(1).max(5).optional(),
          venueType: z.number().int().min(1).max(5).optional(),
          digitalPresence: z.number().int().min(1).max(5).optional(),
          primaryDrink: z.string().optional(),
          coastersAllocated: z.number().int().optional(),
          commissionPercent: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => createActiveRestaurant(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          address: z.string().optional(),
          neighborhood: z.string().optional(),
          googleMapsLink: z.string().optional(),
          instagram: z.string().optional(),
          contactType: z.enum(["proprietario", "gerente", "marketing", "outro"]).optional(),
          contactName: z.string().optional(),
          contactRole: z.string().optional(),
          whatsapp: z.string().optional(),
          email: z.string().optional(),
          financialEmail: z.string().optional(),
          socialClass: z.string().optional(),
          tableCount: z.number().int().optional(),
          seatCount: z.number().int().optional(),
          monthlyCustomers: z.number().int().optional(),
          monthlyDrinksSold: z.number().int().optional().nullable(),
          busyDays: z.string().optional(),
          busyHours: z.string().optional(),
          excludedCategories: z.string().optional(),
          excludedOther: z.string().optional(),
          photoAuthorization: z.string().optional(),
          photoUrls: z.string().optional(),
          pixKey: z.string().optional(),
          cnpj: z.string().optional(),
          razaoSocial: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          cep: z.string().optional(),
          porte: z.string().optional(),
          naturezaJuridica: z.string().optional(),
          atividadePrincipal: z.string().optional(),
          atividadesSecundarias: z.string().optional(),
          capitalSocial: z.string().optional(),
          dataAbertura: z.string().optional(),
          situacaoCadastral: z.string().optional(),
          socios: z.string().optional(),
          ticketMedio: z.string().optional(),
          avgStayMinutes: z.number().int().optional(),
          locationRating: z.number().int().min(1).max(5).optional(),
          venueType: z.number().int().min(1).max(5).optional(),
          digitalPresence: z.number().int().min(1).max(5).optional(),
          primaryDrink: z.string().optional(),
          coastersAllocated: z.number().int().optional(),
          commissionPercent: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateActiveRestaurant(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteActiveRestaurant(input.id)),

    getCampaigns: protectedProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => getRestaurantCampaigns(input.restaurantId)),

    getBranches: protectedProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => getRestaurantBranches(input.restaurantId)),

    linkBranch: protectedProcedure
      .input(z.object({ parentId: z.number(), branchId: z.number() }))
      .mutation(({ input }) => linkBranch(input.parentId, input.branchId)),

    unlinkBranch: protectedProcedure
      .input(z.object({ branchId: z.number() }))
      .mutation(({ input }) => unlinkBranch(input.branchId)),

    getPhotos: protectedProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => listRestaurantPhotos(input.restaurantId)),

    addPhoto: protectedProcedure
      .input(z.object({ restaurantId: z.number(), url: z.string(), caption: z.string().optional(), photoType: z.string().optional() }))
      .mutation(({ input }) => addRestaurantPhoto(input)),

    deletePhoto: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteRestaurantPhoto(input.id)),

    getPayments: protectedProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => listRestaurantPayments(input.restaurantId)),

    addPayment: protectedProcedure
      .input(z.object({
        restaurantId: z.number(),
        campaignId: z.number().optional(),
        amount: z.string(),
        referenceMonth: z.string(),
        paymentDate: z.string().optional(),
        status: z.string().optional(),
        pixKey: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => addRestaurantPayment(input)),

    updatePayment: protectedProcedure
      .input(z.object({
        id: z.number(),
        amount: z.string().optional(),
        paymentDate: z.string().optional(),
        status: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateRestaurantPayment(id, data);
      }),

    deletePayment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteRestaurantPayment(input.id)),

    recalculateRatings: adminProcedure
      .mutation(() => recalculateAllRatings()),
  }),

  // ─── Clients (Anunciantes) ────────────────────────────────────────────
  advertiser: router({
    list: protectedProcedure.query(() => listClients()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getClient(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          company: z.string().optional(),
          razaoSocial: z.string().optional(),
          cnpj: z.string().optional(),
          instagram: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
          addressNumber: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          cep: z.string().optional(),
          segment: z.string().optional(),
          status: z.enum(["active", "inactive"]).default("active"),
        })
      )
      .mutation(({ input }) => createClient(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          company: z.string().optional(),
          razaoSocial: z.string().optional(),
          cnpj: z.string().optional(),
          instagram: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          address: z.string().optional(),
          addressNumber: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          cep: z.string().optional(),
          segment: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateClient(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteClient(input.id)),
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────
  campaign: router({
    list: protectedProcedure.query(() => listCampaigns()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCampaign(input.id)),

    create: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          name: z.string().min(1),
          startDate: z.string(),
          endDate: z.string(),
          status: z.enum(["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa"]).default("quotation"),
          notes: z.string().optional(),
          coastersPerRestaurant: z.number().int().default(500),
          usagePerDay: z.number().int().default(3),
          daysPerMonth: z.number().int().default(26),
          activeRestaurants: z.number().int().default(10),
          pricingType: z.string().default("variable"),
          markupPercent: z.string().default("30.00"),
          fixedPrice: z.string().default("0.00"),
          commissionType: z.string().default("variable"),
          restaurantCommission: z.string().default("20.00"),
          fixedCommission: z.string().default("0.0500"),
          sellerCommission: z.string().default("10.00"),
          taxRate: z.string().default("15.00"),
          contractDuration: z.number().int().default(6),
          batchSize: z.number().int().default(10000),
          batchCost: z.string().default("1200.00"),
          budgetId: z.number().nullable().optional(),
        })
      )
      .mutation(({ input }) => createCampaign(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          clientId: z.number().optional(),
          name: z.string().min(1).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.enum(["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa"]).optional(),
          notes: z.string().optional(),
          coastersPerRestaurant: z.number().int().optional(),
          usagePerDay: z.number().int().optional(),
          daysPerMonth: z.number().int().optional(),
          activeRestaurants: z.number().int().optional(),
          pricingType: z.string().optional(),
          markupPercent: z.string().optional(),
          fixedPrice: z.string().optional(),
          commissionType: z.string().optional(),
          restaurantCommission: z.string().optional(),
          fixedCommission: z.string().optional(),
          sellerCommission: z.string().optional(),
          taxRate: z.string().optional(),
          contractDuration: z.number().int().optional(),
          batchSize: z.number().int().optional(),
          batchCost: z.string().optional(),
          budgetId: z.number().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...rest } = input;
        return updateCampaign(id, rest);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCampaign(input.id)),

    getRestaurants: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(({ input }) => getCampaignRestaurants(input.campaignId)),

    setRestaurants: protectedProcedure
      .input(
        z.object({
          campaignId: z.number(),
          restaurants: z.array(
            z.object({
              restaurantId: z.number(),
              coastersCount: z.number().int().min(1).default(500),
              usagePerDay: z.number().int().min(1).default(5),
            })
          ),
        })
      )
      .mutation(({ input }) =>
        setCampaignRestaurants(input.campaignId, input.restaurants)
      ),

    getHistory: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(({ input }) => getCampaignHistory(input.campaignId)),

    addHistory: protectedProcedure
      .input(z.object({ campaignId: z.number(), action: z.string(), details: z.string().optional() }))
      .mutation(({ input }) => addCampaignHistory(input.campaignId, input.action, input.details)),

    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCampaign(input.id, { status: "active" });
        await addCampaignHistory(input.id, "approved", "Cotação aprovada — campanha ativada");
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCampaign(input.id, { status: "archived" });
        await addCampaignHistory(input.id, "archived", "Cotação arquivada");
      }),

    uploadArt: operacoesProcedure
      .input(z.object({
        id: z.number(),
        artPdfUrl: z.string().optional(),
        artImageUrls: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...artData } = input;
        await updateCampaign(id, { ...artData, status: "producao" } as any);
        await addCampaignHistory(id, "art_uploaded", "Arte enviada — campanha em produção");
      }),

    completeProduction: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        await updateCampaign(input.id, { status: "transito" } as any);
        await addCampaignHistory(input.id, "production_complete", "Produção concluída — material em trânsito");

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (db) {
          const { serviceOrders: soTable } = await import("../drizzle/schema");
          const { sql: sqlFn } = await import("drizzle-orm");
          const year = new Date().getFullYear();
          const pattern = `OS-PROD-${year}-%`;
          const countResult = await db
            .select({ count: sqlFn<number>`COUNT(*)` })
            .from(soTable)
            .where(sqlFn`${soTable.orderNumber} LIKE ${pattern}`);
          const seqNum = Number(countResult[0]?.count || 0) + 1;
          const orderNumber = `OS-PROD-${year}-${String(seqNum).padStart(4, "0")}`;
          await db.insert(soTable).values({
            orderNumber,
            type: "producao" as const,
            campaignId: input.id,
            clientId: campaign.clientId,
            description: `OS de produção para campanha ${campaign.name}`,
            coasterVolume: campaign.coastersPerRestaurant * campaign.activeRestaurants,
            status: "execucao" as const,
          });
        }
      }),

    confirmMaterial: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCampaign(input.id, { status: "executar", materialReceivedDate: new Date().toISOString().split("T")[0] } as any);
        await addCampaignHistory(input.id, "material_received", "Material recebido — pronto para execução");
      }),

    startVeiculacao: operacoesProcedure
      .input(z.object({
        id: z.number(),
        veiculacaoStartDate: z.string(),
        veiculacaoEndDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        await updateCampaign(input.id, {
          status: "veiculacao",
          veiculacaoStartDate: input.veiculacaoStartDate,
          veiculacaoEndDate: input.veiculacaoEndDate,
        } as any);
        await addCampaignHistory(input.id, "veiculacao_started", `Veiculação iniciada: ${input.veiculacaoStartDate} a ${input.veiculacaoEndDate}`);
      }),

    finalizeCampaign: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        await updateCampaign(input.id, { status: "inativa" } as any);
        await addCampaignHistory(input.id, "finalized", "Campanha finalizada e arquivada");

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (db) {
          const { libraryItems } = await import("../drizzle/schema");
          await db.insert(libraryItems).values({
            campaignId: input.id,
            clientId: campaign.clientId,
            title: campaign.name,
            artPdfUrl: campaign.artPdfUrl,
            artImageUrls: campaign.artImageUrls,
            status: "arquivado",
            archivedAt: new Date(),
          });
        }
      }),

    addProof: operacoesProcedure
      .input(z.object({
        campaignId: z.number(),
        restaurantId: z.number(),
        week: z.number().min(1).max(4),
        photoUrl: z.string(),
        uploadedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new Error("Database not available");
        const { campaignProofs } = await import("../drizzle/schema");
        const [created] = await db.insert(campaignProofs).values(input).returning();
        await addCampaignHistory(input.campaignId, "proof_added", `Comprovante semana ${input.week} adicionado`);
        return created;
      }),

    getProofs: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { campaignProofs } = await import("../drizzle/schema");
        const { eq: eqFn, desc: descFn } = await import("drizzle-orm");
        return db.select().from(campaignProofs).where(eqFn(campaignProofs.campaignId, input.campaignId)).orderBy(descFn(campaignProofs.createdAt));
      }),
  }),

  // ─── Client History ─────────────────────────────────────────────────
  clientHistory: router({
    get: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getClientHistory(input.clientId)),
  }),

  // ─── Economics ────────────────────────────────────────────────────────
  economics: router({
    monthly: protectedProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number().min(1).max(12),
        })
      )
      .query(({ input }) => getMonthlyEconomics(input.year, input.month)),
  }),

  // ─── Suppliers (Fornecedores) ─────────────────────────────────────────
  supplier: router({
    list: protectedProcedure.query(() => listSuppliers()),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          cnpj: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
          contactEmail: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          status: z.enum(["active", "inactive"]).default("active"),
        })
      )
      .mutation(({ input }) => createSupplier(input)),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          cnpj: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
          contactEmail: z.string().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateSupplier(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteSupplier(input.id)),
  }),

  // ─── Budgets (Orçamentos de Produção) ─────────────────────────────────
  budget: router({
    list: protectedProcedure.query(() => listBudgets()),

    listActiveWithItems: protectedProcedure.query(() => listActiveBudgetsWithItems()),

    getItems: protectedProcedure
      .input(z.object({ budgetId: z.number() }))
      .query(({ input }) => getBudgetItems(input.budgetId)),

    create: protectedProcedure
      .input(
        z.object({
          supplierId: z.number(),
          code: z.string().optional(),
          description: z.string().min(1),
          productSpec: z.string().optional(),
          validUntil: z.string().optional(),
          status: z.enum(["active", "expired", "rejected"]).default("active"),
          notes: z.string().optional(),
          items: z.array(
            z.object({
              quantity: z.number().int().min(1),
              unitPrice: z.string(),
              totalPrice: z.string(),
            })
          ),
        })
      )
      .mutation(({ input }) => {
        const { items, validUntil, ...data } = input;
        return createBudget(
          { ...data, validUntil: validUntil ? validUntil : null },
          items
        );
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          supplierId: z.number().optional(),
          code: z.string().optional(),
          description: z.string().min(1).optional(),
          productSpec: z.string().optional(),
          validUntil: z.string().optional(),
          status: z.enum(["active", "expired", "rejected"]).optional(),
          notes: z.string().optional(),
          items: z
            .array(
              z.object({
                quantity: z.number().int().min(1),
                unitPrice: z.string(),
                totalPrice: z.string(),
              })
            )
            .optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, items, validUntil, ...rest } = input;
        const data: Record<string, unknown> = { ...rest };
        if (validUntil !== undefined) data.validUntil = validUntil ? new Date(validUntil) : null;
        return updateBudget(id, data, items);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBudget(input.id)),
  }),

  portal: router({
    myProfile: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) return null;
      return getClient(user.clientId);
    }),

    myCampaigns: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) return [];
      const allCampaigns = await listCampaigns();
      return allCampaigns.filter((c: any) => c.clientId === user.clientId);
    }),

    myQuotations: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { quotations } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const results = await db.select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        quotationName: quotations.quotationName,
        coasterVolume: quotations.coasterVolume,
        totalValue: quotations.totalValue,
        status: quotations.status,
        validUntil: quotations.validUntil,
        createdAt: quotations.createdAt,
      }).from(quotations).where(eq(quotations.clientId, user.clientId)).orderBy(desc(quotations.createdAt));
      return results;
    }),

    myInvoices: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { invoices, campaigns } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const results = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        campaignName: campaigns.name,
        amount: invoices.amount,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        paymentDate: invoices.paymentDate,
        status: invoices.status,
      }).from(invoices)
        .leftJoin(campaigns, eq(invoices.campaignId, campaigns.id))
        .where(eq(invoices.clientId, user.clientId))
        .orderBy(desc(invoices.issueDate));
      return results;
    }),

    updateProfile: anuncianteProcedure
      .input(z.object({
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        instagram: z.string().optional(),
        address: z.string().optional(),
        addressNumber: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        cep: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem perfil vinculado" });
        return updateClient(user.clientId, input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
