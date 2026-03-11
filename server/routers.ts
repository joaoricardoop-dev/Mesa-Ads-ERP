import { systemRouter } from "./_core/systemRouter";
import { financialRouter } from "./financialRouter";
import { quotationRouter } from "./quotationRouter";
import { leadRouter } from "./leadRouter";
import { serviceOrderRouter } from "./serviceOrderRouter";
import { termRouter } from "./termRouter";
import { libraryRouter } from "./libraryRouter";
import { batchRouter } from "./batchRouter";
import { publicProcedure, protectedProcedure, adminProcedure, operacoesProcedure, comercialProcedure, internalProcedure, anuncianteProcedure, restauranteProcedure, router } from "./_core/trpc";
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

    updateProfile: protectedProcedure
      .input(z.object({
        firstName: z.string().min(1),
        lastName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user?.id;
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

        try {
          await clerkClient.users.updateUser(userId, {
            firstName: input.firstName,
            lastName: input.lastName || "",
          });
        } catch (err: any) {
          console.error("Failed to update Clerk profile:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao atualizar perfil no Clerk." });
        }

        const user = await authStorage.upsertUser({
          id: userId,
          email: ctx.user!.email,
          firstName: input.firstName,
          lastName: input.lastName || null,
          profileImageUrl: ctx.user!.profileImageUrl,
          role: ctx.user!.role,
          clientId: ctx.user!.clientId,
        });

        const { passwordHash: _, ...safe } = user;
        return safe;
      }),
  }),

  // ─── Members (Admin) ────────────────────────────────────────────────────
  members: router({
    list: adminProcedure.query(async () => {
        const { createClerkClient } = await import("@clerk/express");
        let clerkClient;
        try {
          clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Clerk não configurado corretamente." });
        }

        const allClerkUsers: any[] = [];
        let offset = 0;
        const pageSize = 100;

        try {
          while (true) {
            const page = await clerkClient.users.getUserList({ limit: pageSize, offset });
            allClerkUsers.push(...page.data);
            if (page.data.length < pageSize) break;
            offset += pageSize;
          }
        } catch (err: any) {
          console.error("Failed to fetch Clerk users:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao buscar usuários do Clerk." });
        }

        const mapped = allClerkUsers.map((cu) => {
          const meta = cu.publicMetadata as any;
          return {
            id: cu.id,
            email: cu.emailAddresses?.[0]?.emailAddress || null,
            firstName: cu.firstName || null,
            lastName: cu.lastName || null,
            profileImageUrl: cu.imageUrl || null,
            role: meta?.role || "anunciante",
            isActive: !cu.banned,
            clientId: meta?.clientId ? Number(meta.clientId) : null,
            lastLoginAt: cu.lastSignInAt ? new Date(cu.lastSignInAt).toISOString() : null,
            createdAt: cu.createdAt ? new Date(cu.createdAt).toISOString() : null,
            updatedAt: cu.updatedAt ? new Date(cu.updatedAt).toISOString() : null,
          };
        });

        for (const u of mapped) {
          try {
            await authStorage.upsertUser({
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              profileImageUrl: u.profileImageUrl,
              role: u.role,
              clientId: u.clientId,
              isActive: u.isActive,
            });
          } catch {}
        }

        return mapped;
      }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.string(), role: z.string() }))
      .mutation(async ({ input }) => {
        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

        try {
          const clerkUser = await clerkClient.users.getUser(input.userId);
          await clerkClient.users.updateUser(input.userId, {
            publicMetadata: {
              ...clerkUser.publicMetadata,
              role: input.role,
            },
          });
        } catch (err: any) {
          console.error("Failed to update Clerk metadata:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao atualizar papel no Clerk." });
        }

        const user = await authStorage.updateUserRole(input.userId, input.role);
        if (!user) return undefined;
        const { passwordHash: _, ...safe } = user;
        return safe;
      }),

    toggleActive: adminProcedure
      .input(z.object({ userId: z.string(), isActive: z.boolean() }))
      .mutation(async ({ input }) => {
        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

        try {
          if (input.isActive) {
            await clerkClient.users.unbanUser(input.userId);
          } else {
            await clerkClient.users.banUser(input.userId);
          }
        } catch (err: any) {
          console.error("Failed to ban/unban Clerk user:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao alterar status no Clerk." });
        }

        const user = await authStorage.updateUserActive(input.userId, input.isActive);
        if (!user) return undefined;
        const { passwordHash: _, ...safe } = user;
        return safe;
      }),

    listInvitations: adminProcedure.query(async () => {
      const { createClerkClient } = await import("@clerk/express");
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

      try {
        const allInvitations: any[] = [];
        let offset = 0;
        const pageSize = 100;

        while (true) {
          const page = await clerkClient.invitations.getInvitationList({ limit: pageSize, offset });
          allInvitations.push(...page.data);
          if (page.data.length < pageSize) break;
          offset += pageSize;
        }

        return allInvitations.map((inv) => {
          const meta = inv.publicMetadata as any;
          return {
            id: inv.id,
            email: inv.emailAddress,
            status: inv.status,
            role: meta?.role || "anunciante",
            firstName: meta?.firstName || null,
            lastName: meta?.lastName || null,
            createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : null,
            updatedAt: inv.updatedAt ? new Date(inv.updatedAt).toISOString() : null,
          };
        });
      } catch (err: any) {
        console.error("Failed to fetch invitations:", err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao buscar convites do Clerk." });
      }
    }),

    revokeInvitation: adminProcedure
      .input(z.object({ invitationId: z.string() }))
      .mutation(async ({ input }) => {
        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

        try {
          await clerkClient.invitations.revokeInvitation(input.invitationId);
          return { success: true };
        } catch (err: any) {
          console.error("Failed to revoke invitation:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao revogar convite." });
        }
      }),

    inviteUser: adminProcedure
      .input(z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().optional(),
        role: z.string().default("comercial"),
        clientId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.role === "anunciante" && !input.clientId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anunciantes devem ser vinculados a um cliente." });
        }

        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        const email = input.email.toLowerCase().trim();

        try {
          const invitation = await clerkClient.invitations.createInvitation({
            emailAddress: email,
            publicMetadata: {
              role: input.role,
              clientId: input.role === "anunciante" ? input.clientId : null,
              firstName: input.firstName,
              lastName: input.lastName || null,
            },
            redirectUrl: undefined,
          });

          return {
            id: invitation.id,
            email,
            firstName: input.firstName,
            lastName: input.lastName || null,
            role: input.role,
            status: invitation.status,
          };
        } catch (err: any) {
          if (err?.errors?.[0]?.code === "form_identifier_exists") {
            throw new TRPCError({ code: "CONFLICT", message: "Já existe um convite pendente ou usuário com este e-mail." });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message || "Erro ao convidar usuário." });
        }
      }),
  }),

  // ─── CNPJ Lookup ────────────────────────────────────────────────────────
  cnpj: router({
    lookup: publicProcedure
      .input(z.object({ cnpj: z.string().min(14) }))
      .query(async ({ input }) => {
        const cleanCnpj = input.cnpj.replace(/\D/g, "");
        if (cleanCnpj.length !== 14) throw new Error("CNPJ inválido");

        try {
          const res = await fetch(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`, {
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
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
              municipio: est.cidade?.nome || "",
              uf: est.estado?.sigla || "",
              cep: est.cep || "",
              telefone1: est.ddd1 && est.telefone1 ? `(${est.ddd1}) ${est.telefone1}` : "",
              telefone2: est.ddd2 && est.telefone2 ? `(${est.ddd2}) ${est.telefone2}` : "",
              email: est.email || "",
              socios,
            };
          }
          if (res.status === 429) {
            console.warn("CNPJ WS rate limited, trying fallback...");
          } else {
            console.warn(`CNPJ WS returned ${res.status}, trying fallback...`);
          }
        } catch (err) {
          console.warn("CNPJ WS failed, trying fallback:", err instanceof Error ? err.message : err);
        }

        try {
          const fallbackRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (!fallbackRes.ok) {
            if (fallbackRes.status === 404) throw new Error("CNPJ não encontrado");
            throw new Error(`Erro ao consultar CNPJ (status ${fallbackRes.status})`);
          }
          const fb = await fallbackRes.json();
          return {
            cnpj: cleanCnpj,
            razaoSocial: fb.razao_social || "",
            nomeFantasia: fb.nome_fantasia || "",
            porte: fb.porte || "",
            naturezaJuridica: fb.natureza_juridica || "",
            capitalSocial: fb.capital_social || "",
            atividadePrincipal: fb.cnae_fiscal_descricao ? `${fb.cnae_fiscal} - ${fb.cnae_fiscal_descricao}` : "",
            atividadesSecundarias: (fb.cnaes_secundarios || []).map((a: any) => ({
              id: String(a.codigo),
              descricao: a.descricao,
            })),
            dataAbertura: fb.data_inicio_atividade || "",
            situacaoCadastral: fb.situacao_cadastral || "",
            tipoEstabelecimento: fb.identificador_matriz_filial === 1 ? "Matriz" : "Filial",
            logradouro: fb.logradouro || "",
            numero: fb.numero || "",
            complemento: fb.complemento || "",
            bairro: fb.bairro || "",
            cidade: fb.municipio || "",
            municipio: fb.municipio || "",
            uf: fb.uf || "",
            cep: fb.cep || "",
            telefone1: fb.ddd_telefone_1 || "",
            telefone2: fb.ddd_telefone_2 || "",
            email: fb.email || "",
            socios: (fb.qsa || []).map((s: any) => ({
              nome: s.nome_socio,
              qualificacao: s.qual_socio || "",
              dataEntrada: s.data_entrada_sociedade,
              faixaEtaria: s.faixa_etaria,
            })),
          };
        } catch (fallbackErr) {
          console.error("Both CNPJ APIs failed:", fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
          if (fallbackErr instanceof Error && fallbackErr.message.includes("CNPJ")) throw fallbackErr;
          throw new Error("Não foi possível consultar o CNPJ. Tente novamente em alguns segundos.");
        }
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

    getLinkedUsers: internalProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db.select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.restaurantId, input.restaurantId));
        return rows;
      }),

    linkUser: internalProcedure
      .input(z.object({ userId: z.string(), restaurantId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { users } = await import("../drizzle/schema");
        const { activeRestaurants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const [restaurant] = await db.select({ id: activeRestaurants.id }).from(activeRestaurants).where(eq(activeRestaurants.id, input.restaurantId));
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado" });

        const [existing] = await db.select().from(users).where(eq(users.id, input.userId));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });

        const blockedRoles = ["admin", "comercial", "operacoes", "financeiro", "anunciante", "manager"];
        if (blockedRoles.includes(existing.role || "")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível vincular um usuário com papel privilegiado. Altere o papel primeiro." });
        }

        const [updated] = await db.update(users).set({
          restaurantId: input.restaurantId,
          role: "restaurante",
          updatedAt: new Date(),
        }).where(eq(users.id, input.userId)).returning();

        try {
          const { createClerkClient } = await import("@clerk/express");
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
          const clerkUser = await clerkClient.users.getUser(input.userId);
          await clerkClient.users.updateUserMetadata(input.userId, {
            publicMetadata: { ...clerkUser.publicMetadata, role: "restaurante", restaurantId: input.restaurantId },
          });
        } catch (err) {
          console.error("Failed to update Clerk metadata:", err);
        }

        return updated;
      }),

    listAvailableUsers: internalProcedure.query(async () => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { users } = await import("../drizzle/schema");
        const { isNull, or, eq } = await import("drizzle-orm");
        const rows = await db.select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        }).from(users).where(
          isNull(users.restaurantId)
        );
        return rows.filter(u => !["admin", "comercial", "operacoes", "financeiro", "manager"].includes(u.role || ""));
      }),

    unlinkUser: internalProcedure
      .input(z.object({ userId: z.string(), restaurantId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { users } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");

        const [existing] = await db.select().from(users).where(eq(users.id, input.userId));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        if (existing.restaurantId !== input.restaurantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não está vinculado a este restaurante" });
        }

        const [updated] = await db.update(users).set({
          restaurantId: null,
          role: "restaurante",
          updatedAt: new Date(),
        }).where(and(eq(users.id, input.userId), eq(users.restaurantId, input.restaurantId))).returning();

        try {
          const { createClerkClient } = await import("@clerk/express");
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
          const clerkUser = await clerkClient.users.getUser(input.userId);
          const meta = { ...clerkUser.publicMetadata } as any;
          delete meta.restaurantId;
          meta.role = "restaurante";
          await clerkClient.users.updateUserMetadata(input.userId, { publicMetadata: meta });
        } catch (err) {
          console.error("Failed to update Clerk metadata:", err);
        }

        return updated;
      }),

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

    generateAccountInvite: internalProcedure
      .input(z.object({
        restaurantId: z.number(),
        email: z.string().email(),
      }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { restaurantTerms, activeRestaurants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const { randomUUID } = await import("crypto");

        const [restaurant] = await db.select({ id: activeRestaurants.id, name: activeRestaurants.name }).from(activeRestaurants).where(eq(activeRestaurants.id, input.restaurantId));
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado" });

        const token = randomUUID();
        const year = new Date().getFullYear();
        const { sql: sqlFn } = await import("drizzle-orm");
        const pattern = `TRM-${year}-%`;
        const countResult = await db
          .select({ count: sqlFn<number>`COUNT(*)` })
          .from(restaurantTerms)
          .where(sqlFn`${restaurantTerms.termNumber} LIKE ${pattern}`);
        const seqNum = Number(countResult[0]?.count || 0) + 1;
        const termNumber = `TRM-${year}-${String(seqNum).padStart(4, "0")}`;

        const [created] = await db.insert(restaurantTerms).values({
          termNumber,
          restaurantId: input.restaurantId,
          inviteToken: token,
          inviteEmail: input.email,
          status: "enviado",
        }).returning();

        const inviteUrl = `/parceiro/convite/${token}`;
        return { ...created, inviteToken: token, inviteUrl };
      }),

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

    getCampaigns: internalProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const allCampaigns = await listCampaigns();
        return allCampaigns.filter((c: any) => c.clientId === input.clientId);
      }),

    getQuotations: internalProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { quotations } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        return db.select().from(quotations).where(eq(quotations.clientId, input.clientId)).orderBy(desc(quotations.createdAt));
      }),

    getInvoices: internalProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { invoices, campaigns } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        return db.select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          campaignId: invoices.campaignId,
          campaignName: campaigns.name,
          clientId: invoices.clientId,
          amount: invoices.amount,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          paymentDate: invoices.paymentDate,
          status: invoices.status,
          createdAt: invoices.createdAt,
        }).from(invoices)
          .leftJoin(campaigns, eq(invoices.campaignId, campaigns.id))
          .where(eq(invoices.clientId, input.clientId))
          .orderBy(desc(invoices.issueDate));
      }),

    getLinkedUsers: internalProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        return db.select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.clientId, input.clientId));
      }),

    linkUser: internalProcedure
      .input(z.object({ userId: z.string(), clientId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { users, clients: clientsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [client] = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.id, input.clientId));
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        const [existing] = await db.select().from(users).where(eq(users.id, input.userId));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        const blockedRoles = ["admin", "comercial", "operacoes", "financeiro", "restaurante", "manager"];
        if (blockedRoles.includes(existing.role || "")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível vincular um usuário com papel privilegiado." });
        }
        const [updated] = await db.update(users).set({
          clientId: input.clientId,
          role: "anunciante",
          updatedAt: new Date(),
        }).where(eq(users.id, input.userId)).returning();
        try {
          const { createClerkClient } = await import("@clerk/express");
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
          const clerkUser = await clerkClient.users.getUser(input.userId);
          await clerkClient.users.updateUserMetadata(input.userId, {
            publicMetadata: { ...clerkUser.publicMetadata, role: "anunciante", clientId: input.clientId },
          });
        } catch (err) {
          console.error("Failed to update Clerk metadata:", err);
        }
        return updated;
      }),

    listAvailableUsers: internalProcedure.query(async () => {
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { users } = await import("../drizzle/schema");
      const { isNull } = await import("drizzle-orm");
      const rows = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      }).from(users).where(isNull(users.clientId));
      return rows.filter(u => !["admin", "comercial", "operacoes", "financeiro", "manager", "restaurante"].includes(u.role || ""));
    }),
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
          isBonificada: z.boolean().optional(),
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
          isBonificada: z.boolean().optional(),
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
          material: z.string().optional(),
          format: z.string().optional(),
          productSize: z.string().optional(),
          printType: z.string().optional(),
          colors: z.string().optional(),
          layoutType: z.string().optional(),
          paymentTerms: z.string().optional(),
          productionLeadDays: z.string().optional(),
          validUntil: z.string().optional(),
          status: z.enum(["active", "expired", "rejected"]).default("active"),
          notes: z.string().optional(),
          items: z.array(
            z.object({
              quantity: z.number().int().min(1),
              unitPrice: z.string(),
              totalPrice: z.string(),
              numModels: z.number().int().min(1).optional(),
              qtyPerModel: z.number().int().min(1).optional(),
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
          material: z.string().optional(),
          format: z.string().optional(),
          productSize: z.string().optional(),
          printType: z.string().optional(),
          colors: z.string().optional(),
          layoutType: z.string().optional(),
          paymentTerms: z.string().optional(),
          productionLeadDays: z.string().optional(),
          validUntil: z.string().optional(),
          status: z.enum(["active", "expired", "rejected"]).optional(),
          notes: z.string().optional(),
          items: z
            .array(
              z.object({
                quantity: z.number().int().min(1),
                unitPrice: z.string(),
                totalPrice: z.string(),
                numModels: z.number().int().min(1).optional(),
                qtyPerModel: z.number().int().min(1).optional(),
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

  termTemplate: router({
    list: adminProcedure.query(async () => {
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { termTemplates } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      return db.select().from(termTemplates).orderBy(desc(termTemplates.createdAt));
    }),

    listActive: publicProcedure
      .input(z.object({ role: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { termTemplates } = await import("../drizzle/schema");
        const { eq, desc } = await import("drizzle-orm");
        const all = await db.select().from(termTemplates).where(eq(termTemplates.isActive, true)).orderBy(desc(termTemplates.createdAt));
        if (input?.role) {
          return all.filter((t) => {
            try {
              const roles = JSON.parse(t.requiredFor);
              return Array.isArray(roles) && roles.includes(input.role);
            } catch { return false; }
          });
        }
        return all;
      }),

    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        requiredFor: z.array(z.string()),
        isActive: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { termTemplates } = await import("../drizzle/schema");
        const [created] = await db.insert(termTemplates).values({
          title: input.title,
          content: input.content,
          requiredFor: JSON.stringify(input.requiredFor),
          isActive: input.isActive,
        }).returning();
        return created;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        requiredFor: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { termTemplates } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const existing = await db.select().from(termTemplates).where(eq(termTemplates.id, input.id));
        if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado" });

        const updates: Record<string, any> = { updatedAt: new Date() };
        if (input.title !== undefined) updates.title = input.title;
        if (input.requiredFor !== undefined) updates.requiredFor = JSON.stringify(input.requiredFor);
        if (input.isActive !== undefined) updates.isActive = input.isActive;
        if (input.content !== undefined && input.content !== existing[0].content) {
          updates.content = input.content;
          updates.version = existing[0].version + 1;
        }

        const [updated] = await db.update(termTemplates).set(updates).where(eq(termTemplates.id, input.id)).returning();
        return updated;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { termTemplates } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(termTemplates).where(eq(termTemplates.id, input.id));
        return { success: true };
      }),
  }),

  restaurantePortal: router({
    myRestaurant: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return null;
      return getActiveRestaurant(user.restaurantId);
    }),

    myCampaigns: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return [];
      return getRestaurantCampaigns(user.restaurantId);
    }),

    myTerms: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { restaurantTerms } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      return db.select().from(restaurantTerms).where(eq(restaurantTerms.restaurantId, user.restaurantId)).orderBy(desc(restaurantTerms.createdAt));
    }),

    updateContact: restauranteProcedure
      .input(z.object({
        contactName: z.string().optional(),
        whatsapp: z.string().optional(),
        email: z.string().optional(),
        financialEmail: z.string().optional(),
        instagram: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.restaurantId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem restaurante vinculado" });
        return updateActiveRestaurant(user.restaurantId, input);
      }),

    pendingTerms: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return { templates: [], terms: [] };
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return { templates: [], terms: [] };
      const { termTemplates, termAcceptances, restaurantTerms } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      const allActive = await db.select().from(termTemplates).where(eq(termTemplates.isActive, true));
      const restaurantTemplates = allActive.filter((t) => {
        try {
          const roles = JSON.parse(t.requiredFor);
          return Array.isArray(roles) && roles.includes("restaurante");
        } catch { return false; }
      });

      const acceptedTemplates = await db.select({ templateId: termAcceptances.templateId })
        .from(termAcceptances)
        .where(eq(termAcceptances.restaurantId, user.restaurantId));
      const acceptedTemplateIds = new Set(acceptedTemplates.map(a => a.templateId).filter(Boolean));

      const pendingTemplates = restaurantTemplates.filter(t => !acceptedTemplateIds.has(t.id));

      const pendingTerms = await db.select().from(restaurantTerms)
        .where(eq(restaurantTerms.restaurantId, user.restaurantId))
        .orderBy(desc(restaurantTerms.createdAt));
      const sentTerms = pendingTerms.filter(t => t.status === "enviado");

      return { templates: pendingTemplates, terms: sentTerms };
    }),

    acceptTerm: restauranteProcedure
      .input(z.object({
        termId: z.number().optional(),
        templateId: z.number().optional(),
        acceptedByName: z.string().min(1),
        acceptedByCpf: z.string().min(11),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.restaurantId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem restaurante vinculado" });
        if (!input.termId && !input.templateId) throw new TRPCError({ code: "BAD_REQUEST", message: "termId ou templateId é obrigatório" });

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { termAcceptances, restaurantTerms, termTemplates } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const { createHash } = await import("crypto");

        let termContent = "";
        let termId: number | null = null;
        let templateId: number | null = null;

        if (input.termId) {
          const term = await db.select().from(restaurantTerms).where(eq(restaurantTerms.id, input.termId)).limit(1);
          if (!term[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Termo não encontrado" });
          if (term[0].restaurantId !== user.restaurantId) throw new TRPCError({ code: "FORBIDDEN", message: "Termo não pertence ao seu restaurante" });
          termContent = JSON.stringify({
            conditions: term[0].conditions,
            remunerationRule: term[0].remunerationRule,
            allowedCategories: term[0].allowedCategories,
            blockedCategories: term[0].blockedCategories,
            restaurantObligations: term[0].restaurantObligations,
            mesaObligations: term[0].mesaObligations,
          });
          termId = input.termId;
        } else if (input.templateId) {
          const template = await db.select().from(termTemplates).where(eq(termTemplates.id, input.templateId)).limit(1);
          if (!template[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Template não encontrado" });
          termContent = template[0].content;
          templateId = input.templateId;
        }

        const termHash = createHash("sha256").update(termContent).digest("hex");

        const ipAddress = (ctx as any).req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
          || (ctx as any).req?.headers?.["x-real-ip"]
          || (ctx as any).req?.socket?.remoteAddress
          || null;
        const userAgent = (ctx as any).req?.headers?.["user-agent"] || null;

        const [acceptance] = await db.insert(termAcceptances).values({
          restaurantId: user.restaurantId,
          termId,
          templateId,
          termContent,
          termHash,
          acceptedByName: input.acceptedByName,
          acceptedByCpf: input.acceptedByCpf,
          acceptedByEmail: user.email || "",
          ipAddress,
          userAgent,
        }).returning();

        if (input.termId) {
          await db.update(restaurantTerms)
            .set({ status: "assinado", updatedAt: new Date() })
            .where(eq(restaurantTerms.id, input.termId));
        }

        return acceptance;
      }),

    myAcceptances: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { termAcceptances, termTemplates, restaurantTerms } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const acceptances = await db.select().from(termAcceptances)
        .where(eq(termAcceptances.restaurantId, user.restaurantId))
        .orderBy(desc(termAcceptances.acceptedAt));

      const enriched = [];
      for (const a of acceptances) {
        let title = "Termo de Parceria";
        if (a.templateId) {
          const tmpl = await db.select({ title: termTemplates.title }).from(termTemplates).where(eq(termTemplates.id, a.templateId)).limit(1);
          if (tmpl[0]) title = tmpl[0].title;
        } else if (a.termId) {
          const term = await db.select({ termNumber: restaurantTerms.termNumber }).from(restaurantTerms).where(eq(restaurantTerms.id, a.termId)).limit(1);
          if (term[0]) title = `Termo ${term[0].termNumber}`;
        }
        enriched.push({ ...a, title });
      }
      return enriched;
    }),
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
        isBonificada: quotations.isBonificada,
        publicToken: quotations.publicToken,
        signedAt: quotations.signedAt,
        createdAt: quotations.createdAt,
      }).from(quotations).where(eq(quotations.clientId, user.clientId)).orderBy(desc(quotations.createdAt));
      return results;
    }),

    myServiceOrders: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { serviceOrders, quotations, quotationRestaurants, restaurants } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");
      const results = await db.select({
        id: serviceOrders.id,
        orderNumber: serviceOrders.orderNumber,
        description: serviceOrders.description,
        periodStart: serviceOrders.periodStart,
        periodEnd: serviceOrders.periodEnd,
        totalValue: serviceOrders.totalValue,
        status: serviceOrders.status,
        signedByName: serviceOrders.signedByName,
        signedByCpf: serviceOrders.signedByCpf,
        signedAt: serviceOrders.signedAt,
        signatureHash: serviceOrders.signatureHash,
        quotationId: serviceOrders.quotationId,
        coasterVolume: serviceOrders.coasterVolume,
        batchSelectionJson: serviceOrders.batchSelectionJson,
        quotationPublicToken: quotations.publicToken,
        quotationNumber: quotations.quotationNumber,
        quotationName: quotations.quotationName,
      }).from(serviceOrders)
        .leftJoin(quotations, eq(serviceOrders.quotationId, quotations.id))
        .where(eq(serviceOrders.clientId, user.clientId))
        .orderBy(desc(serviceOrders.createdAt));

      const enriched = await Promise.all(results.map(async (os) => {
        if (!os.quotationId) return { ...os, restaurantNames: [] as string[] };
        const allocs = await db.select({
          name: restaurants.name,
        }).from(quotationRestaurants)
          .innerJoin(restaurants, eq(quotationRestaurants.restaurantId, restaurants.id))
          .where(eq(quotationRestaurants.quotationId, os.quotationId));
        return { ...os, restaurantNames: allocs.map(a => a.name) };
      }));

      return enriched;
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

    completeOnboarding: anuncianteProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (user.onboardingComplete || user.clientId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Onboarding já foi concluído." });
        }

        const newClient = await createClient({
          ...input,
          selfRegistered: true,
          status: "active",
        });

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        await db.update(users).set({
          clientId: newClient.id,
          onboardingComplete: true,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));

        try {
          const { createClerkClient } = await import("@clerk/express");
          const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
          const clerkUser = await clerkClient.users.getUser(user.id);
          const existingMeta = (clerkUser.publicMetadata || {}) as any;
          await clerkClient.users.updateUserMetadata(user.id, {
            publicMetadata: { ...existingMeta, clientId: newClient.id },
          });
        } catch (err) {
          console.error("Failed to update Clerk metadata with clientId:", err);
        }

        return newClient;
      }),
  }),
});

export type AppRouter = typeof appRouter;
