import { systemRouter } from "./_core/systemRouter";
import { financialRouter } from "./financialRouter";
import { quotationRouter } from "./quotationRouter";
import { leadRouter } from "./leadRouter";
import { contactRouter } from "./contactRouter";
import { serviceOrderRouter } from "./serviceOrderRouter";
import { termRouter } from "./termRouter";
import { libraryRouter } from "./libraryRouter";
import { batchRouter } from "./batchRouter";
import { productRouter } from "./productRouter";
import { partnerRouter } from "./partnerRouter";
import { vipProviderRouter } from "./vipProviderRouter";
import { campaignPhaseRouter } from "./campaignPhaseRouter";
import { parceiroPortalRouter } from "./parceiroPortalRouter";
import { notificationRouter } from "./notificationRouter";
import { melhorEnvioRouter } from "./melhorEnvioRouter";
import { campaignReportRouter } from "./campaignReportRouter";
import { mediaKitRouter } from "./mediaKitRouter";
import { anunciantePortalRouter } from "./anunciantePortalRouter";
import { seasonalMultiplierRouter } from "./seasonalMultiplierRouter";
import { bankRouter } from "./bankRouter";
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
  listClientsPaged,
  getClientStats,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  listCampaigns,
  listCampaignsPaged,
  getCampaignKpiStats,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignRestaurants,
  setCampaignRestaurants,
  getCampaignHistory,
  addCampaignHistory,
  getRecentHistory,
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
  contact: contactRouter,
  serviceOrder: serviceOrderRouter,
  term: termRouter,
  library: libraryRouter,
  batch: batchRouter,
  product: productRouter,
  partner: partnerRouter,
  vipProvider: vipProviderRouter,
  campaignPhase: campaignPhaseRouter,
  parceiroPortal: parceiroPortalRouter,
  notification: notificationRouter,
  melhorEnvio: melhorEnvioRouter,
  campaignReport: campaignReportRouter,
  mediaKit: mediaKitRouter,
  anunciantePortal: anunciantePortalRouter,
  seasonalMultiplier: seasonalMultiplierRouter,
  bank: bankRouter,
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
            partnerId: meta?.partnerId ? Number(meta.partnerId) : null,
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
              partnerId: u.partnerId,
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

    updatePartner: adminProcedure
      .input(z.object({
        userId: z.string(),
        partnerId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

        const db = await (await import("./db")).getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, input.userId)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

        const newRole = input.partnerId !== null ? "parceiro" : existing.role ?? "anunciante";

        try {
          const clerkUser = await clerkClient.users.getUser(input.userId);
          await clerkClient.users.updateUser(input.userId, {
            publicMetadata: {
              ...clerkUser.publicMetadata,
              role: newRole,
              partnerId: input.partnerId,
            },
          });
        } catch (err: any) {
          console.error("Failed to update Clerk metadata for partner:", err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao atualizar parceiro no Clerk." });
        }

        const [updated] = await db
          .update(usersTable)
          .set({ partnerId: input.partnerId, role: newRole, updatedAt: new Date() })
          .where(eq(usersTable.id, input.userId))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        const { passwordHash: _, ...safe } = updated;
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
        partnerId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        if (input.role === "anunciante" && !input.clientId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anunciantes devem ser vinculados a um cliente." });
        }
        if (input.role === "parceiro" && !input.partnerId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Parceiros devem ser vinculados a um parceiro cadastrado." });
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
              partnerId: input.role === "parceiro" ? input.partnerId : null,
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

    listUserRestaurants: adminProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { userRestaurants, activeRestaurants } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await db
          .select({
            id: userRestaurants.id,
            restaurantId: userRestaurants.restaurantId,
            restaurantName: activeRestaurants.name,
            createdAt: userRestaurants.createdAt,
          })
          .from(userRestaurants)
          .innerJoin(activeRestaurants, eq(userRestaurants.restaurantId, activeRestaurants.id))
          .where(eq(userRestaurants.userId, input.userId));
        return rows;
      }),

    linkRestaurant: adminProcedure
      .input(z.object({ userId: z.string(), restaurantId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { userRestaurants } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const existing = await db
          .select()
          .from(userRestaurants)
          .where(and(eq(userRestaurants.userId, input.userId), eq(userRestaurants.restaurantId, input.restaurantId)))
          .limit(1);
        if (existing.length > 0) return existing[0];
        const [row] = await db.insert(userRestaurants).values({
          userId: input.userId,
          restaurantId: input.restaurantId,
        }).returning();
        return row;
      }),

    unlinkRestaurant: adminProcedure
      .input(z.object({ userId: z.string(), restaurantId: z.number() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
        const { userRestaurants } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        await db.delete(userRestaurants).where(
          and(eq(userRestaurants.userId, input.userId), eq(userRestaurants.restaurantId, input.restaurantId))
        );
        return { success: true };
      }),

    listRestaurantUsers: adminProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { userRestaurants } = await import("../drizzle/schema");
        const { users } = await import("../shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const rows = await db
          .select({
            id: userRestaurants.id,
            userId: userRestaurants.userId,
            userEmail: users.email,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            createdAt: userRestaurants.createdAt,
          })
          .from(userRestaurants)
          .innerJoin(users, eq(userRestaurants.userId, users.id))
          .where(eq(userRestaurants.restaurantId, input.restaurantId));
        return rows;
      }),

    listAllRestauranteUsers: adminProcedure.query(async () => {
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { users } = await import("../shared/models/auth");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        restaurantId: users.restaurantId,
      }).from(users).where(eq(users.role, "restaurante"));
      return rows;
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
          venueType: z.number().int().min(1).max(6).optional(),
          digitalPresence: z.number().int().min(1).max(5).optional(),
          primaryDrink: z.string().optional(),
          coastersAllocated: z.number().int().optional(),
          commissionPercent: z.string().optional(),
          logoUrl: z.string().optional(),
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
          venueType: z.number().int().min(1).max(6).optional(),
          digitalPresence: z.number().int().min(1).max(5).optional(),
          primaryDrink: z.string().optional(),
          coastersAllocated: z.number().int().optional(),
          commissionPercent: z.string().optional(),
          logoUrl: z.string().nullable().optional(),
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

    saveCoordinates: protectedProcedure
      .input(z.object({ id: z.number(), lat: z.number(), lng: z.number() }))
      .mutation(({ input }) => updateActiveRestaurant(input.id, { lat: String(input.lat), lng: String(input.lng) } as any)),

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
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Local não encontrado" });

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
          const { userRestaurants } = await import("../drizzle/schema");
          const { and } = await import("drizzle-orm");
          const existingLink = await db.select().from(userRestaurants).where(
            and(eq(userRestaurants.userId, input.userId), eq(userRestaurants.restaurantId, input.restaurantId))
          ).limit(1);
          if (existingLink.length === 0) {
            await db.insert(userRestaurants).values({ userId: input.userId, restaurantId: input.restaurantId });
          }
        } catch (err) {
          console.error("Failed to insert into user_restaurants:", err);
        }

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

        try {
          const { ensureContact } = await import("./contactSync");
          const fullName = [existing.firstName, existing.lastName].filter(Boolean).join(" ").trim();
          await ensureContact({ restaurantId: input.restaurantId, name: fullName || undefined, email: existing.email || undefined });
        } catch (err) {
          console.error("Failed to sync contact on restaurant linkUser:", err);
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
        if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Local não encontrado" });

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
    list: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        search: z.string().optional(),
      }).optional())
      .query(({ input }) => listClients(input ?? undefined)),

    listByPartner: protectedProcedure
      .input(z.object({ partnerId: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { clients: clientsTable } = await import("../drizzle/schema");
        const { eq, asc } = await import("drizzle-orm");
        const userRole = ctx.user.role || "user";
        let partnerId: number | null = null;
        if (userRole === "parceiro") {
          partnerId = ctx.user.partnerId ?? null;
          if (!partnerId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a um parceiro." });
          }
        } else if (["admin", "comercial", "manager", "operacoes", "financeiro"].includes(userRole)) {
          partnerId = input?.partnerId ?? null;
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão." });
        }
        if (partnerId == null) {
          return db.select().from(clientsTable).orderBy(asc(clientsTable.name));
        }
        return db
          .select()
          .from(clientsTable)
          .where(eq(clientsTable.partnerId, partnerId))
          .orderBy(asc(clientsTable.name));
      }),

    // Keep listPaged as backward-compatible alias
    listPaged: protectedProcedure
      .input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(200).default(25), search: z.string().optional() }))
      .query(({ input }) => listClientsPaged(input)),

    stats: protectedProcedure.query(() => getClientStats()),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getClient(input.id)),

    listEnriched: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 };
        const { clients: clientsTable, campaigns: campaignsTable, invoices } = await import("../drizzle/schema");
        const { eq, ilike, or, count, desc, max, sql: sqlExpr } = await import("drizzle-orm");
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 25;
        const offset = (page - 1) * pageSize;
        const search = input?.search?.trim();
        const whereConditions = search
          ? or(
              ilike(clientsTable.name, `%${search}%`),
              ilike(clientsTable.company, `%${search}%`),
              ilike(clientsTable.razaoSocial, `%${search}%`),
            )
          : undefined;
        const [totalResult, items] = await Promise.all([
          db.select({ value: count() }).from(clientsTable).where(whereConditions),
          db.select().from(clientsTable).where(whereConditions).orderBy(desc(clientsTable.createdAt)).limit(pageSize).offset(offset),
        ]);
        const total = totalResult[0]?.value ?? 0;
        if (items.length === 0) return { items: [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
        const clientIds = items.map((c) => c.id);
        const { inArray } = await import("drizzle-orm");
        const [lastCampaigns, totalRevenue] = await Promise.all([
          db.select({
            clientId: campaignsTable.clientId,
            lastCampaignName: sqlExpr<string>`(SELECT name FROM campaigns WHERE "clientId" = campaigns."clientId" ORDER BY "createdAt" DESC LIMIT 1)`,
            lastCampaignDate: sqlExpr<string>`MAX(campaigns."createdAt")`,
          }).from(campaignsTable).where(inArray(campaignsTable.clientId, clientIds)).groupBy(campaignsTable.clientId),
          db.select({
            clientId: invoices.clientId,
            total: sqlExpr<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`,
          }).from(invoices).where(inArray(invoices.clientId, clientIds)).groupBy(invoices.clientId),
        ]);
        const lastCampaignMap = new Map(lastCampaigns.map((r) => [r.clientId, r.lastCampaignDate]));
        const revenueMap = new Map(totalRevenue.map((r) => [r.clientId, r.total]));
        return {
          items: items.map((c) => ({
            ...c,
            lastCampaignDate: lastCampaignMap.get(c.id) ?? null,
            totalRevenue: revenueMap.get(c.id) ?? "0",
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      }),

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
          parentId: z.number().nullable().optional(),
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
          partnerId: z.number().nullable().optional(),
          showAgencyPricing: z.boolean().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateClient(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteClient(input.id)),


    inviteUser: internalProcedure
      .input(z.object({
        clientId: z.number(),
        email: z.string().email(),
        firstName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const client = await getClient(input.clientId);
        if (!client) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        }

        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        const email = input.email.toLowerCase().trim();
        const firstName = input.firstName?.trim() || client.name;

        const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}` || "";

        try {
          await clerkClient.invitations.createInvitation({
            emailAddress: email,
            publicMetadata: {
              role: "anunciante",
              clientId: input.clientId,
              firstName,
            },
            redirectUrl: appUrl ? `${appUrl}/` : undefined,
          });
          return { success: true as const, message: `Convite enviado para ${email}.` };
        } catch (err: any) {
          if (err?.errors?.[0]?.code === "form_identifier_exists") {
            throw new TRPCError({ code: "CONFLICT", message: "Já existe um convite pendente ou usuário com este e-mail." });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message || "Erro ao enviar convite." });
        }
      }),

    getCampaigns: internalProcedure
      .input(z.object({ clientId: z.number(), includeChildren: z.boolean().optional() }))
      .query(async ({ input }) => {
        const allCampaigns = await listCampaigns();
        if (!input.includeChildren) {
          return allCampaigns.filter((c: any) => c.clientId === input.clientId);
        }
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return allCampaigns.filter((c: any) => c.clientId === input.clientId);
        const { clients: clientsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const children = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.parentId, input.clientId));
        const ids = new Set([input.clientId, ...children.map(c => c.id)]);
        return allCampaigns.filter((c: any) => ids.has(c.clientId));
      }),

    getQuotations: internalProcedure
      .input(z.object({ clientId: z.number(), includeChildren: z.boolean().optional() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { quotations, clients: clientsTable } = await import("../drizzle/schema");
        const { eq, desc, inArray } = await import("drizzle-orm");
        if (!input.includeChildren) {
          return db.select().from(quotations).where(eq(quotations.clientId, input.clientId)).orderBy(desc(quotations.createdAt));
        }
        const children = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.parentId, input.clientId));
        const ids = [input.clientId, ...children.map(c => c.id)];
        return db.select().from(quotations).where(inArray(quotations.clientId, ids)).orderBy(desc(quotations.createdAt));
      }),

    getInvoices: internalProcedure
      .input(z.object({ clientId: z.number(), includeChildren: z.boolean().optional() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { invoices, campaigns, clients: clientsTable } = await import("../drizzle/schema");
        const { eq, desc, inArray } = await import("drizzle-orm");
        const baseSelect = db.select({
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
          .leftJoin(campaigns, eq(invoices.campaignId, campaigns.id));
        if (!input.includeChildren) {
          return baseSelect.where(eq(invoices.clientId, input.clientId)).orderBy(desc(invoices.issueDate));
        }
        const children = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.parentId, input.clientId));
        const ids = [input.clientId, ...children.map(c => c.id)];
        return baseSelect.where(inArray(invoices.clientId, ids)).orderBy(desc(invoices.issueDate));
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

        try {
          const { ensureContact } = await import("./contactSync");
          const fullName = [existing.firstName, existing.lastName].filter(Boolean).join(" ").trim();
          await ensureContact({ clientId: input.clientId, name: fullName || undefined, email: existing.email || undefined });
        } catch (err) {
          console.error("Failed to sync contact on advertiser linkUser:", err);
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

    getChildren: internalProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { clients: clientsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        return db.select().from(clientsTable).where(eq(clientsTable.parentId, input.clientId));
      }),

    getParent: internalProcedure
      .input(z.object({ parentId: z.number() }))
      .query(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return null;
        const { clients: clientsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [parent] = await db.select().from(clientsTable).where(eq(clientsTable.id, input.parentId));
        return parent || null;
      }),

    setParent: internalProcedure
      .input(z.object({ clientId: z.number(), parentId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const { clients: clientsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        if (input.parentId === input.clientId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Um cliente não pode ser pai de si mesmo." });
        }
        if (input.parentId !== null) {
          const [parent] = await db.select({ id: clientsTable.id, parentId: clientsTable.parentId }).from(clientsTable).where(eq(clientsTable.id, input.parentId));
          if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente pai não encontrado." });
          if (parent.parentId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível vincular a um cliente que já é filial. Apenas clientes de nível superior podem ser matriz." });
          }
          const existingChildren = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.parentId, input.clientId)).limit(1);
          if (existingChildren.length > 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Este cliente já possui filiais. Não é possível torná-lo filial de outro." });
          }
        }
        const [updated] = await db.update(clientsTable).set({
          parentId: input.parentId,
          updatedAt: new Date(),
        }).where(eq(clientsTable.id, input.clientId)).returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        return updated;
      }),
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────
  campaign: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        search: z.string().optional(),
        status: z.string().optional(),
        filterAtrasadas: z.boolean().optional(),
        filterBonificada: z.boolean().optional(),
        filterRiscoSla: z.boolean().optional(),
        filterAssignedTo: z.string().optional(),
      }).optional())
      .query(({ input }) => listCampaigns(input ?? undefined)),

    // Keep listPaged as backward-compatible alias
    listPaged: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(25),
        search: z.string().optional(),
        status: z.string().optional(),
        filterAtrasadas: z.boolean().optional(),
        filterBonificada: z.boolean().optional(),
        filterRiscoSla: z.boolean().optional(),
      }))
      .query(({ input }) => listCampaignsPaged(input)),

    kpiStats: protectedProcedure.query(() => getCampaignKpiStats()),

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
          status: z.enum(["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa", "briefing", "design", "aprovacao", "distribuicao"]).default("quotation"),
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
          assignedTo: z.string().nullable().optional(),
          assignedToName: z.string().nullable().optional(),
          assignedToAvatar: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const campaign = await createCampaign(input);
        if (campaign) {
          try {
            const { accountsPayable } = await import("../drizzle/schema");
            const db = await (await import("./db")).getDb();
            if (db) {
              const toInsert: any[] = [];
              const prodCost = Number(input.batchCost || "1200.00");
              const freightCost = Number((input as any).freightCost || 0);
              const dur = input.contractDuration || 6;
              if (prodCost > 0) {
                for (let m = 0; m < dur; m++) {
                  toInsert.push({
                    campaignId: campaign.id,
                    type: "producao",
                    description: `Produção Gráfica - Mês ${m + 1}/${dur}`,
                    amount: prodCost.toFixed(2),
                    recipientType: "fornecedor",
                    status: "pendente",
                  });
                }
              }
              if (freightCost > 0) {
                for (let m = 0; m < dur; m++) {
                  toInsert.push({
                    campaignId: campaign.id,
                    type: "frete",
                    description: `Frete/Logística - Mês ${m + 1}/${dur}`,
                    amount: freightCost.toFixed(2),
                    recipientType: "transportadora",
                    status: "pendente",
                  });
                }
              }
              if (toInsert.length > 0) await db.insert(accountsPayable).values(toInsert);
            }
          } catch (err) { console.warn("[campaign.create] Auto-generate payables failed:", err); }
        }
        return campaign;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          clientId: z.number().optional(),
          name: z.string().min(1).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.enum(["draft", "active", "paused", "completed", "quotation", "archived", "producao", "transito", "executar", "veiculacao", "inativa", "briefing", "design", "aprovacao", "distribuicao"]).optional(),
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
          freightCost: z.string().optional(),
          budgetId: z.number().nullable().optional(),
          isBonificada: z.boolean().optional(),
          partnerId: z.number().nullable().optional(),
          hasAgencyBv: z.boolean().optional(),
          agencyBvPercent: z.string().optional(),
          assignedTo: z.string().nullable().optional(),
          assignedToName: z.string().nullable().optional(),
          assignedToAvatar: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        await updateCampaign(id, rest);
        const NOTIFIABLE_STATUSES: Record<string, string> = {
          briefing: "Sua campanha foi aprovada e está em fase de briefing.",
          design: "Sua campanha está em produção de design.",
          aprovacao: "O design da sua campanha foi enviado para aprovação.",
          producao: "Sua campanha está em produção gráfica.",
          distribuicao: "O material da sua campanha está sendo distribuído.",
          veiculacao: "Sua campanha está em veiculação.",
          inativa: "Sua campanha foi concluída e arquivada.",
        };
        if (rest.status && rest.status in NOTIFIABLE_STATUSES) {
          try {
            const notifCampaign = await getCampaign(id);
            if (notifCampaign?.clientId) {
              const { createCampaignStatusNotification } = await import("./notificationRouter");
              await createCampaignStatusNotification({
                campaignId: id,
                clientId: notifCampaign.clientId,
                status: rest.status,
                message: `${NOTIFIABLE_STATUSES[rest.status].replace("Sua campanha", `A campanha "${notifCampaign.name}"`)}`,
              });
            }
          } catch (err) { console.warn("[campaign.update] notification failed:", err); }
        }
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

    getRecentHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(({ input }) => getRecentHistory(input.limit ?? 20)),

    addHistory: protectedProcedure
      .input(z.object({ campaignId: z.number(), action: z.string(), details: z.string().optional() }))
      .mutation(({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        return addCampaignHistory(input.campaignId, input.action, input.details, u?.id, uName);
      }),

    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, { status: "active" });
        await addCampaignHistory(input.id, "approved", "Cotação aprovada — campanha ativada", u?.id, uName);
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, { status: "archived" });
        await addCampaignHistory(input.id, "archived", "Cotação arquivada", u?.id, uName);
      }),

    completeBriefing: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, { status: "design", designEnteredAt: new Date() });
        await addCampaignHistory(input.id, "briefing_complete", "Briefing concluído — campanha em produção de design", u?.id, uName);
        try {
          const notifCampaign = await getCampaign(input.id);
          if (notifCampaign?.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: notifCampaign.clientId,
              status: "design",
              message: `Sua campanha "${notifCampaign.name}" está em produção de design.`,
            });
          }
        } catch (err) { console.warn("[completeBriefing] notification failed:", err); }
      }),

    submitDesign: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, { status: "aprovacao", aprovacaoEnteredAt: new Date() });
        await addCampaignHistory(input.id, "design_submitted", "Design enviado para aprovação", u?.id, uName);
        try {
          const notifCampaign = await getCampaign(input.id);
          if (notifCampaign?.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: notifCampaign.clientId,
              status: "aprovacao",
              message: `O design da campanha "${notifCampaign.name}" foi enviado para sua aprovação.`,
            });
          }
        } catch (err) { console.warn("[submitDesign] notification failed:", err); }
      }),

    approveDesign: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        await updateCampaign(input.id, { status: "producao", producaoEnteredAt: new Date() });
        await addCampaignHistory(input.id, "design_approved", "Design aprovado — campanha em produção gráfica", u?.id, uName);
        try {
          if (campaign.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: campaign.clientId,
              status: "producao",
              message: `O design da campanha "${campaign.name}" foi aprovado e está em produção gráfica.`,
            });
          }
          if (campaign.status !== "producao") {
            const { createCampaignRestaurantStatusNotifications } = await import("./notificationRouter");
            await createCampaignRestaurantStatusNotifications({
              campaignId: input.id,
              status: "producao",
              message: `O material da campanha "${campaign.name}" entrou em produção e em breve será enviado ao seu restaurante.`,
            });
          }
        } catch (err) { console.warn("[approveDesign] notification failed:", err); }

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        let productionCostRegistered = false;
        if (db) {
          const { serviceOrders: soTable, operationalCosts: ocTable } = await import("../drizzle/schema");
          const { sql: sqlFn, eq: eqFn } = await import("drizzle-orm");
          const year = new Date().getFullYear();
          const pattern = `OS-PROD-${year}-%`;
          const maxResult = await db
            .select({ maxSeq: sqlFn<string>`MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS INTEGER))` })
            .from(soTable)
            .where(sqlFn`${soTable.orderNumber} LIKE ${pattern}`);
          const seqNum = Number(maxResult[0]?.maxSeq || 0) + 1;
          const orderNumber = `OS-PROD-${year}-${String(seqNum).padStart(4, "0")}`;
          await db.insert(soTable).values({
            orderNumber,
            type: "producao" as const,
            campaignId: input.id,
            clientId: campaign.clientId,
            description: `OS de produção gráfica para campanha ${campaign.name}`,
            coasterVolume: campaign.batchSize || (campaign.coastersPerRestaurant * campaign.activeRestaurants),
            status: "execucao" as const,
            productId: campaign.productId,
          });
          // Auto-create operational cost for production if configured (atomic upsert)
          const productionCost = parseFloat(String(campaign.productionCost || "0"));
          if (productionCost > 0) {
            const priorOc = await db.select({ productionCost: ocTable.productionCost })
              .from(ocTable).where(eqFn(ocTable.campaignId, input.id)).limit(1);
            const alreadyRegistered = priorOc.length > 0 && parseFloat(priorOc[0].productionCost) > 0;
            if (!alreadyRegistered) {
              await db.insert(ocTable)
                .values({ campaignId: input.id, productionCost: String(productionCost), freightCost: "0" })
                .onConflictDoUpdate({
                  target: ocTable.campaignId,
                  set: { productionCost: String(productionCost), updatedAt: new Date() },
                });
              productionCostRegistered = true;
            }
          }
        }
        return { productionCostRegistered };
      }),

    receiveMaterial: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        await updateCampaign(input.id, {
          status: "distribuicao",
          materialReceivedDate: new Date().toISOString().split("T")[0],
          distribuicaoEnteredAt: new Date(),
        });
        await addCampaignHistory(input.id, "material_received", "Material recebido — campanha em distribuição", u?.id, uName);
        try {
          if (campaign.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: campaign.clientId,
              status: "distribuicao",
              message: `O material da campanha "${campaign.name}" foi recebido e está em distribuição.`,
            });
          }
          const { createCampaignRestaurantStatusNotifications } = await import("./notificationRouter");
          await createCampaignRestaurantStatusNotifications({
            campaignId: input.id,
            status: "distribuicao",
            message: `O material da campanha "${campaign.name}" está em trânsito/distribuição para o seu restaurante. Acompanhe na aba OS.`,
          });
        } catch (err) { console.warn("[receiveMaterial] notification failed:", err); }

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        let freightCostRegistered = false;
        if (db) {
          const { serviceOrders: soTable, campaignRestaurants: crTable, operationalCosts: ocTable } = await import("../drizzle/schema");
          const { sql: sqlFn, eq: eqFn } = await import("drizzle-orm");
          const year = new Date().getFullYear();
          const pattern = `OS-DIST-${year}-%`;
          const maxResult = await db
            .select({ maxSeq: sqlFn<string>`MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS INTEGER))` })
            .from(soTable)
            .where(sqlFn`${soTable.orderNumber} LIKE ${pattern}`);
          const seqNum = Number(maxResult[0]?.maxSeq || 0) + 1;
          const orderNumber = `OS-DIST-${year}-${String(seqNum).padStart(4, "0")}`;
          const restaurants = await db.select().from(crTable).where(eqFn(crTable.campaignId, input.id));
          await db.insert(soTable).values({
            orderNumber,
            type: "distribuicao" as const,
            campaignId: input.id,
            clientId: campaign.clientId,
            description: `OS de distribuição para campanha ${campaign.name} (${restaurants.length} restaurante${restaurants.length !== 1 ? "s" : ""})`,
            coasterVolume: restaurants.reduce((s: number, r: any) => s + (r.coastersCount || 0), 0) || campaign.batchSize,
            status: "execucao" as const,
            productId: campaign.productId,
          });
          // Auto-create operational cost for freight if configured (atomic upsert)
          const freightCost = parseFloat(String(campaign.freightCost || "0"));
          if (freightCost > 0) {
            const priorOc = await db.select({ freightCost: ocTable.freightCost })
              .from(ocTable).where(eqFn(ocTable.campaignId, input.id)).limit(1);
            const alreadyRegistered = priorOc.length > 0 && parseFloat(priorOc[0].freightCost) > 0;
            if (!alreadyRegistered) {
              await db.insert(ocTable)
                .values({ campaignId: input.id, productionCost: "0", freightCost: String(freightCost) })
                .onConflictDoUpdate({
                  target: ocTable.campaignId,
                  set: { freightCost: String(freightCost), updatedAt: new Date() },
                });
              freightCostRegistered = true;
            }
          }
        }
        return { freightCostRegistered };
      }),

    completeDistribution: operacoesProcedure
      .input(z.object({
        id: z.number(),
        veiculacaoStartDate: z.string(),
        veiculacaoEndDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, {
          status: "veiculacao",
          veiculacaoStartDate: input.veiculacaoStartDate,
          veiculacaoEndDate: input.veiculacaoEndDate,
        });
        await addCampaignHistory(input.id, "distribution_complete", `Distribuição concluída — veiculação iniciada: ${input.veiculacaoStartDate} a ${input.veiculacaoEndDate}`, u?.id, uName);

        try {
          const notifCampaign = await getCampaign(input.id);
          if (notifCampaign?.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: notifCampaign.clientId,
              status: "veiculacao",
              message: `A campanha "${notifCampaign.name}" entrou em veiculação de ${input.veiculacaoStartDate} a ${input.veiculacaoEndDate}.`,
            });
          }
        } catch (err) { console.warn("[completeDistribution] notification failed:", err); }

        try {
          const campaign = await getCampaign(input.id);
          if (campaign) {
            const restaurantList = await getCampaignRestaurants(input.id);
            if (restaurantList.length > 0) {
              const { getDb: getDatabase } = await import("./db");
              const db = await getDatabase();
              if (db) {
                const { quotations } = await import("../drizzle/schema");
                const { eq } = await import("drizzle-orm");
                let totalValue = 0;
                if (campaign.quotationId) {
                  const qRows = await db.select({ totalValue: quotations.totalValue }).from(quotations).where(eq(quotations.id, campaign.quotationId)).limit(1);
                  totalValue = parseFloat(qRows[0]?.totalValue || "0");
                }
                const taxRateDecimal = parseFloat(String(campaign.taxRate || "0")) / 100;
                const netValue = totalValue * (1 - taxRateDecimal);
                const commissionRate = parseFloat(String(campaign.restaurantCommission || "20")) / 100;
                const totalCoasters = restaurantList.reduce((sum: number, r: any) => sum + (r.coastersCount || 0), 0);
                const referenceMonth = input.veiculacaoStartDate.slice(0, 7);
                const paymentDueDate = new Date(new Date(input.veiculacaoEndDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                for (const rest of restaurantList) {
                  const share = totalCoasters > 0 ? (rest.coastersCount || 0) / totalCoasters : 1 / restaurantList.length;
                  const base = totalValue > 0 ? netValue : parseFloat(String(campaign.batchCost || "0"));
                  const amount = (base * commissionRate * share).toFixed(2);
                  await addRestaurantPayment({
                    restaurantId: rest.restaurantId,
                    campaignId: campaign.id,
                    amount,
                    referenceMonth,
                    paymentDate: paymentDueDate,
                    periodStart: input.veiculacaoStartDate,
                    periodEnd: input.veiculacaoEndDate,
                    status: "pending",
                  });
                }
              }
            }
          }
        } catch (err) {
          console.warn("[completeDistribution] Failed to auto-create restaurant payments:", err);
        }
      }),

    uploadArt: operacoesProcedure
      .input(z.object({
        id: z.number(),
        artPdfUrl: z.string().optional(),
        artImageUrls: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        const { id, ...artData } = input;
        const prev = await getCampaign(id);
        const wasAlreadyProducao = prev?.status === "producao";
        await updateCampaign(id, { ...artData, status: "producao" });
        await addCampaignHistory(id, "art_uploaded", "Arte enviada — campanha em produção", u?.id, uName);

        try {
          const notifCampaign = await getCampaign(id);
          if (notifCampaign?.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: id,
              clientId: notifCampaign.clientId,
              status: "producao",
              message: `A arte da campanha "${notifCampaign.name}" foi enviada e está em produção.`,
            });
          }
          if (notifCampaign && !wasAlreadyProducao) {
            const { createCampaignRestaurantStatusNotifications } = await import("./notificationRouter");
            await createCampaignRestaurantStatusNotifications({
              campaignId: id,
              status: "producao",
              message: `O material da campanha "${notifCampaign.name}" entrou em produção e em breve será enviado ao seu restaurante.`,
            });
          }
        } catch (err) { console.warn("[uploadArt] notification failed:", err); }

        // Create production OS automatically when entering producao status
        const campaign = await getCampaign(id);
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        let productionCostRegistered = false;
        if (db && campaign) {
          const { serviceOrders: soTable, operationalCosts: ocTable } = await import("../drizzle/schema");
          const { sql: sqlFn, eq: eqFn, and: andFn } = await import("drizzle-orm");
          const existing = await db.select({ id: soTable.id }).from(soTable)
            .where(andFn(eqFn(soTable.campaignId, id), eqFn(soTable.type, "producao" as const)))
            .limit(1);
          if (existing.length === 0) {
            const year = new Date().getFullYear();
            const pattern = `OS-PROD-${year}-%`;
            const maxResult = await db.select({ maxSeq: sqlFn<string>`MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS INTEGER))` }).from(soTable).where(sqlFn`${soTable.orderNumber} LIKE ${pattern}`);
            const seqNum = Number(maxResult[0]?.maxSeq || 0) + 1;
            const orderNumber = `OS-PROD-${year}-${String(seqNum).padStart(4, "0")}`;
            await db.insert(soTable).values({
              orderNumber,
              type: "producao" as const,
              campaignId: id,
              clientId: campaign.clientId,
              description: `OS de produção para campanha ${campaign.name}`,
              coasterVolume: campaign.coastersPerRestaurant * campaign.activeRestaurants,
              status: "execucao" as const,
              productId: campaign.productId,
            });
          }
          // Auto-create operational cost for production if configured (atomic upsert)
          const productionCost = parseFloat(String(campaign.productionCost || "0"));
          if (productionCost > 0) {
            const priorOc = await db.select({ productionCost: ocTable.productionCost })
              .from(ocTable).where(eqFn(ocTable.campaignId, id)).limit(1);
            const alreadyRegistered = priorOc.length > 0 && parseFloat(priorOc[0].productionCost) > 0;
            if (!alreadyRegistered) {
              await db.insert(ocTable)
                .values({ campaignId: id, productionCost: String(productionCost), freightCost: "0" })
                .onConflictDoUpdate({
                  target: ocTable.campaignId,
                  set: { productionCost: String(productionCost), updatedAt: new Date() },
                });
              productionCostRegistered = true;
            }
          }
        }
        return { productionCostRegistered };
      }),

    ensureProductionOS: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new Error("Database not available");
        const { serviceOrders: soTable } = await import("../drizzle/schema");
        const { sql: sqlFn, eq: eqFn, and: andFn } = await import("drizzle-orm");
        const existing = await db.select({ id: soTable.id }).from(soTable)
          .where(andFn(eqFn(soTable.campaignId, input.id), eqFn(soTable.type, "producao" as const)))
          .limit(1);
        if (existing.length > 0) return { id: existing[0].id, alreadyExisted: true };
        const year = new Date().getFullYear();
        const pattern = `OS-PROD-${year}-%`;
        const maxResult = await db.select({ maxSeq: sqlFn<string>`MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS INTEGER))` }).from(soTable).where(sqlFn`${soTable.orderNumber} LIKE ${pattern}`);
        const seqNum = Number(maxResult[0]?.maxSeq || 0) + 1;
        const orderNumber = `OS-PROD-${year}-${String(seqNum).padStart(4, "0")}`;
        const [created] = await db.insert(soTable).values({
          orderNumber,
          type: "producao" as const,
          campaignId: input.id,
          clientId: campaign.clientId,
          description: `OS de produção para campanha ${campaign.name}`,
          coasterVolume: campaign.coastersPerRestaurant * campaign.activeRestaurants,
          status: "execucao" as const,
          productId: campaign.productId,
        }).returning();
        return { id: created.id, alreadyExisted: false };
      }),

    completeProduction: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        await updateCampaign(input.id, { status: "transito" });
        await addCampaignHistory(input.id, "production_complete", "Produção concluída — material em trânsito", u?.id, uName);

        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (db) {
          const { serviceOrders: soTable } = await import("../drizzle/schema");
          const { sql: sqlFn, eq: eqFn, and: andFn } = await import("drizzle-orm");
          // Only create if one doesn't already exist (uploadArt may have created it)
          const existing = await db.select({ id: soTable.id }).from(soTable)
            .where(andFn(eqFn(soTable.campaignId, input.id), eqFn(soTable.type, "producao" as const)))
            .limit(1);
          if (existing.length === 0) {
            const year = new Date().getFullYear();
            const pattern = `OS-PROD-${year}-%`;
            const maxResult = await db
              .select({ maxSeq: sqlFn<string>`MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS INTEGER))` })
              .from(soTable)
              .where(sqlFn`${soTable.orderNumber} LIKE ${pattern}`);
            const seqNum = Number(maxResult[0]?.maxSeq || 0) + 1;
            const orderNumber = `OS-PROD-${year}-${String(seqNum).padStart(4, "0")}`;
            await db.insert(soTable).values({
              orderNumber,
              type: "producao" as const,
              campaignId: input.id,
              clientId: campaign.clientId,
              description: `OS de produção para campanha ${campaign.name}`,
              coasterVolume: campaign.coastersPerRestaurant * campaign.activeRestaurants,
              status: "execucao" as const,
              productId: campaign.productId,
            });
          }
        }
      }),

    confirmMaterial: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, { status: "executar", materialReceivedDate: new Date().toISOString().split("T")[0] });
        await addCampaignHistory(input.id, "material_received", "Material recebido — pronto para execução", u?.id, uName);
      }),

    startVeiculacao: operacoesProcedure
      .input(z.object({
        id: z.number(),
        veiculacaoStartDate: z.string(),
        veiculacaoEndDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        await updateCampaign(input.id, {
          status: "veiculacao",
          veiculacaoStartDate: input.veiculacaoStartDate,
          veiculacaoEndDate: input.veiculacaoEndDate,
        });
        await addCampaignHistory(input.id, "veiculacao_started", `Veiculação iniciada: ${input.veiculacaoStartDate} a ${input.veiculacaoEndDate}`, u?.id, uName);

        try {
          const notifCampaign2 = await getCampaign(input.id);
          if (notifCampaign2?.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: notifCampaign2.clientId,
              status: "veiculacao",
              message: `A campanha "${notifCampaign2.name}" entrou em veiculação de ${input.veiculacaoStartDate} a ${input.veiculacaoEndDate}.`,
            });
          }
        } catch (err) { console.warn("[startVeiculacao] notification failed:", err); }

        try {
          const campaign = await getCampaign(input.id);
          if (campaign) {
            const restaurantList = await getCampaignRestaurants(input.id);
            if (restaurantList.length > 0) {
              const { getDb: getDatabase } = await import("./db");
              const db = await getDatabase();
              if (db) {
                const { quotations } = await import("../drizzle/schema");
                const { eq } = await import("drizzle-orm");

                let totalValue = 0;
                if (campaign.quotationId) {
                  const qRows = await db.select({ totalValue: quotations.totalValue }).from(quotations).where(eq(quotations.id, campaign.quotationId)).limit(1);
                  totalValue = parseFloat(qRows[0]?.totalValue || "0");
                }

                const taxRateDecimal = parseFloat(String(campaign.taxRate || "0")) / 100;
                const netValue = totalValue * (1 - taxRateDecimal);
                const commissionRate = parseFloat(String(campaign.restaurantCommission || "20")) / 100;
                const totalCoasters = restaurantList.reduce((sum: number, r: any) => sum + (r.coastersCount || 0), 0);
                const referenceMonth = input.veiculacaoStartDate.slice(0, 7);
                const paymentDueDate = new Date(new Date(input.veiculacaoEndDate).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

                for (const rest of restaurantList) {
                  const share = totalCoasters > 0 ? (rest.coastersCount || 0) / totalCoasters : 1 / restaurantList.length;
                  const base = totalValue > 0 ? netValue : parseFloat(String(campaign.batchCost || "0"));
                  const amount = (base * commissionRate * share).toFixed(2);

                  await addRestaurantPayment({
                    restaurantId: rest.restaurantId,
                    campaignId: campaign.id,
                    amount,
                    referenceMonth,
                    paymentDate: paymentDueDate,
                    periodStart: input.veiculacaoStartDate,
                    periodEnd: input.veiculacaoEndDate,
                    status: "pending",
                  });
                }
              }
            }
          }
        } catch (err) {
          console.warn("[startVeiculacao] Failed to auto-create restaurant payments:", err);
        }
      }),

    finalizeCampaign: operacoesProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        const campaign = await getCampaign(input.id);
        if (!campaign) throw new Error("Campanha não encontrada");
        await updateCampaign(input.id, { status: "inativa" });
        await addCampaignHistory(input.id, "finalized", "Campanha finalizada e arquivada", u?.id, uName);

        try {
          if (campaign.clientId) {
            const { createCampaignStatusNotification } = await import("./notificationRouter");
            await createCampaignStatusNotification({
              campaignId: input.id,
              clientId: campaign.clientId,
              status: "inativa",
              message: `A campanha "${campaign.name}" foi concluída e arquivada.`,
            });
          }
        } catch (err) { console.warn("[finalizeCampaign] notification failed:", err); }

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
      .mutation(async ({ ctx, input }) => {
        const u = ctx.user;
        const uName = u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Sistema" : "Sistema";
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new Error("Database not available");
        const { campaignProofs } = await import("../drizzle/schema");
        const [created] = await db.insert(campaignProofs).values(input).returning();
        await addCampaignHistory(input.campaignId, "proof_added", `Comprovante semana ${input.week} adicionado`, u?.id, uName);
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

    myRestaurants: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { userRestaurants, activeRestaurants } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const linked = await db
        .select({
          id: activeRestaurants.id,
          name: activeRestaurants.name,
          logoUrl: activeRestaurants.logoUrl,
          city: activeRestaurants.city,
          state: activeRestaurants.state,
        })
        .from(userRestaurants)
        .innerJoin(activeRestaurants, eq(userRestaurants.restaurantId, activeRestaurants.id))
        .where(eq(userRestaurants.userId, user.id));

      const primary = user.restaurantId
        ? await db
            .select({ id: activeRestaurants.id, name: activeRestaurants.name, logoUrl: activeRestaurants.logoUrl, city: activeRestaurants.city, state: activeRestaurants.state })
            .from(activeRestaurants)
            .where(eq(activeRestaurants.id, user.restaurantId))
            .limit(1)
        : [];

      const allMap = new Map<number, typeof linked[0]>();
      for (const r of [...primary, ...linked]) {
        allMap.set(r.id, r);
      }
      return Array.from(allMap.values());
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

    myOccupancyCalendar: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return { campaigns: [], phases: [] };
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return { campaigns: [], phases: [] };
      const { campaignRestaurants, campaigns: campaignsTbl, campaignPhases, clients } = await import("../drizzle/schema");
      const { eq, inArray, asc } = await import("drizzle-orm");

      const linked = await db.select({ campaignId: campaignRestaurants.campaignId })
        .from(campaignRestaurants)
        .where(eq(campaignRestaurants.restaurantId, user.restaurantId));
      const campaignIds = linked.map(r => r.campaignId);
      if (campaignIds.length === 0) return { campaigns: [], phases: [] };

      const camps = await db.select({
        id: campaignsTbl.id,
        campaignNumber: campaignsTbl.campaignNumber,
        name: campaignsTbl.name,
        status: campaignsTbl.status,
        startDate: campaignsTbl.startDate,
        endDate: campaignsTbl.endDate,
        veiculacaoStartDate: campaignsTbl.veiculacaoStartDate,
        veiculacaoEndDate: campaignsTbl.veiculacaoEndDate,
        clientId: campaignsTbl.clientId,
        clientName: clients.name,
        clientCompany: clients.company,
      })
        .from(campaignsTbl)
        .leftJoin(clients, eq(clients.id, campaignsTbl.clientId))
        .where(inArray(campaignsTbl.id, campaignIds))
        .orderBy(asc(campaignsTbl.startDate));

      const phases = await db.select({
        id: campaignPhases.id,
        campaignId: campaignPhases.campaignId,
        sequence: campaignPhases.sequence,
        label: campaignPhases.label,
        periodStart: campaignPhases.periodStart,
        periodEnd: campaignPhases.periodEnd,
        status: campaignPhases.status,
      })
        .from(campaignPhases)
        .where(inArray(campaignPhases.campaignId, campaignIds))
        .orderBy(asc(campaignPhases.periodStart));

      return {
        campaigns: camps.map(c => ({
          ...c,
          clientLabel: c.clientCompany ? `${c.clientName} (${c.clientCompany})` : (c.clientName || ""),
        })),
        phases,
      };
    }),

    myCommissions: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) {
        return { totalAmount: 0, totalPaid: 0, totalPending: 0, paymentCount: 0, byCampaign: [], payments: [] };
      }
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return { totalAmount: 0, totalPaid: 0, totalPending: 0, paymentCount: 0, byCampaign: [], payments: [] };
      const { restaurantPayments, campaigns: campaignsTbl, clients } = await import("../drizzle/schema");
      const { eq, desc } = await import("drizzle-orm");

      const rows = await db.select({
        id: restaurantPayments.id,
        amount: restaurantPayments.amount,
        referenceMonth: restaurantPayments.referenceMonth,
        paymentDate: restaurantPayments.paymentDate,
        status: restaurantPayments.status,
        notes: restaurantPayments.notes,
        proofUrl: restaurantPayments.proofUrl,
        periodStart: restaurantPayments.periodStart,
        periodEnd: restaurantPayments.periodEnd,
        campaignId: restaurantPayments.campaignId,
        campaignNumber: campaignsTbl.campaignNumber,
        campaignName: campaignsTbl.name,
        clientName: clients.name,
        clientCompany: clients.company,
      })
        .from(restaurantPayments)
        .leftJoin(campaignsTbl, eq(campaignsTbl.id, restaurantPayments.campaignId))
        .leftJoin(clients, eq(clients.id, campaignsTbl.clientId))
        .where(eq(restaurantPayments.restaurantId, user.restaurantId))
        .orderBy(desc(restaurantPayments.referenceMonth), desc(restaurantPayments.createdAt));

      const payments = rows.map(r => ({
        ...r,
        amountNumber: parseFloat(r.amount || "0"),
      }));

      let totalAmount = 0;
      let totalPaid = 0;
      let totalPending = 0;
      const byCampaignMap = new Map<string, {
        campaignId: number | null;
        campaignNumber: string | null;
        campaignName: string;
        clientLabel: string;
        totalAmount: number;
        paidAmount: number;
        pendingAmount: number;
        paymentCount: number;
        payments: typeof payments;
      }>();

      for (const p of payments) {
        const isPaid = p.status === "pago" || p.status === "paid";
        totalAmount += p.amountNumber;
        if (isPaid) totalPaid += p.amountNumber;
        else totalPending += p.amountNumber;

        const key = p.campaignId ? `c${p.campaignId}` : "none";
        const existing = byCampaignMap.get(key);
        const clientLabel = p.clientCompany ? `${p.clientName} (${p.clientCompany})` : (p.clientName || "");
        if (existing) {
          existing.totalAmount += p.amountNumber;
          if (isPaid) existing.paidAmount += p.amountNumber;
          else existing.pendingAmount += p.amountNumber;
          existing.paymentCount += 1;
          existing.payments.push(p);
        } else {
          byCampaignMap.set(key, {
            campaignId: p.campaignId,
            campaignNumber: p.campaignNumber,
            campaignName: p.campaignName || "Sem campanha vinculada",
            clientLabel,
            totalAmount: p.amountNumber,
            paidAmount: isPaid ? p.amountNumber : 0,
            pendingAmount: isPaid ? 0 : p.amountNumber,
            paymentCount: 1,
            payments: [p],
          });
        }
      }

      return {
        totalAmount,
        totalPaid,
        totalPending,
        paymentCount: payments.length,
        byCampaign: Array.from(byCampaignMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
        payments,
      };
    }),

    myServiceOrders: restauranteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.restaurantId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { campaignRestaurants, campaigns: campaignsTbl, serviceOrders, serviceOrderTrackings } = await import("../drizzle/schema");
      const { eq, inArray, desc, asc } = await import("drizzle-orm");

      const linked = await db.select({ campaignId: campaignRestaurants.campaignId })
        .from(campaignRestaurants)
        .where(eq(campaignRestaurants.restaurantId, user.restaurantId));
      const campaignIds = linked.map(r => r.campaignId);
      if (campaignIds.length === 0) return [];

      const orders = await db.select({
        id: serviceOrders.id,
        orderNumber: serviceOrders.orderNumber,
        type: serviceOrders.type,
        status: serviceOrders.status,
        description: serviceOrders.description,
        periodStart: serviceOrders.periodStart,
        periodEnd: serviceOrders.periodEnd,
        estimatedDeadline: serviceOrders.estimatedDeadline,
        trackingCode: serviceOrders.trackingCode,
        freightProvider: serviceOrders.freightProvider,
        freightExpectedDate: serviceOrders.freightExpectedDate,
        coasterVolume: serviceOrders.coasterVolume,
        campaignId: serviceOrders.campaignId,
        campaignName: campaignsTbl.name,
        campaignNumber: campaignsTbl.campaignNumber,
        materialReceivedDate: campaignsTbl.materialReceivedDate,
        createdAt: serviceOrders.createdAt,
      })
        .from(serviceOrders)
        .leftJoin(campaignsTbl, eq(campaignsTbl.id, serviceOrders.campaignId))
        .where(inArray(serviceOrders.campaignId, campaignIds))
        .orderBy(desc(serviceOrders.createdAt));

      if (orders.length === 0) return [];

      const orderIds = orders.map(o => o.id);
      const trackings = await db.select()
        .from(serviceOrderTrackings)
        .where(inArray(serviceOrderTrackings.serviceOrderId, orderIds))
        .orderBy(asc(serviceOrderTrackings.createdAt));

      const trackByOs: Record<number, typeof trackings> = {};
      for (const t of trackings) {
        if (!trackByOs[t.serviceOrderId]) trackByOs[t.serviceOrderId] = [];
        trackByOs[t.serviceOrderId].push(t);
      }

      return orders.map(o => ({ ...o, trackings: trackByOs[o.id] || [] }));
    }),

    confirmMaterialReceived: restauranteProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.restaurantId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem restaurante vinculado" });
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { campaignRestaurants, campaigns: campaignsTbl, campaignHistory } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");

        const link = await db.select().from(campaignRestaurants)
          .where(and(eq(campaignRestaurants.campaignId, input.campaignId), eq(campaignRestaurants.restaurantId, user.restaurantId)))
          .limit(1);
        if (!link.length) throw new TRPCError({ code: "FORBIDDEN", message: "Campanha não pertence ao seu local" });

        const today = new Date().toISOString().split("T")[0];
        const [updated] = await db.update(campaignsTbl)
          .set({ materialReceivedDate: today, updatedAt: new Date() })
          .where(eq(campaignsTbl.id, input.campaignId))
          .returning();

        if (updated) {
          await db.insert(campaignHistory).values({
            campaignId: input.campaignId,
            action: "material_received_confirmed",
            details: `Local confirmou recebimento do material em ${today}`,
            userId: user.id,
            userName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Restaurante",
          });
        }
        return updated;
      }),

    updateProfile: restauranteProcedure
      .input(z.object({
        monthlyCustomers: z.number().int().min(0).optional(),
        monthlyDrinksSold: z.number().int().min(0).optional(),
        tableCount: z.number().int().min(0).optional(),
        seatCount: z.number().int().min(0).optional(),
        excludedCategories: z.array(z.string()).optional(),
        excludedOther: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.restaurantId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem restaurante vinculado" });
        const data: Record<string, any> = {};
        if (input.monthlyCustomers !== undefined) data.monthlyCustomers = input.monthlyCustomers;
        if (input.monthlyDrinksSold !== undefined) data.monthlyDrinksSold = input.monthlyDrinksSold;
        if (input.tableCount !== undefined) data.tableCount = input.tableCount;
        if (input.seatCount !== undefined) data.seatCount = input.seatCount;
        if (input.excludedCategories !== undefined) data.excludedCategories = JSON.stringify(input.excludedCategories);
        if (input.excludedOther !== undefined) data.excludedOther = input.excludedOther;
        return updateActiveRestaurant(user.restaurantId, data);
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
        documentUrl: invoices.documentUrl,
        documentLabel: invoices.documentLabel,
      }).from(invoices)
        .leftJoin(campaigns, eq(invoices.campaignId, campaigns.id))
        .where(eq(invoices.clientId, user.clientId))
        .orderBy(desc(invoices.issueDate));
      return results;
    }),

    dashboard: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) {
        return { totalSpent: 0, totalImpressions: 0, activeCampaigns: 0, pendingAmount: 0 };
      }
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return { totalSpent: 0, totalImpressions: 0, activeCampaigns: 0, pendingAmount: 0 };
      const { invoices, campaigns, campaignReports } = await import("../drizzle/schema");
      const { eq, and, sql, ne, inArray } = await import("drizzle-orm");

      const [spentRow] = await db
        .select({
          totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paga' THEN ${invoices.amount}::numeric ELSE 0 END), 0)`,
          pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} IN ('emitida','vencida') THEN ${invoices.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(invoices)
        .where(eq(invoices.clientId, user.clientId));

      const clientCampaigns = await db
        .select({ id: campaigns.id, status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.clientId, user.clientId));

      const activeStatuses = new Set([
        "veiculacao", "active", "executar", "producao", "transito",
        "distribuicao", "briefing", "design", "aprovacao",
      ]);
      const activeCampaigns = clientCampaigns.filter((c) => activeStatuses.has(c.status as string)).length;

      const campaignIds = clientCampaigns.map((c) => c.id);
      let totalImpressions = 0;
      if (campaignIds.length > 0) {
        const [impRow] = await db
          .select({ total: sql<string>`COALESCE(SUM(${campaignReports.totalImpressions}), 0)` })
          .from(campaignReports)
          .where(inArray(campaignReports.campaignId, campaignIds));
        totalImpressions = parseInt(impRow?.total ?? "0", 10) || 0;
      }

      return {
        totalSpent: parseFloat(spentRow?.totalSpent ?? "0") || 0,
        pendingAmount: parseFloat(spentRow?.pendingAmount ?? "0") || 0,
        totalImpressions,
        activeCampaigns,
      };
    }),

    myDocuments: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) return [];
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) return [];
      const { invoices, campaigns } = await import("../drizzle/schema");
      const { eq, and, isNotNull, ne, desc, sql } = await import("drizzle-orm");
      const results = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        campaignName: campaigns.name,
        documentUrl: invoices.documentUrl,
        documentLabel: invoices.documentLabel,
        issueDate: invoices.issueDate,
        amount: invoices.amount,
        status: invoices.status,
      }).from(invoices)
        .leftJoin(campaigns, eq(invoices.campaignId, campaigns.id))
        .where(and(
          eq(invoices.clientId, user.clientId),
          isNotNull(invoices.documentUrl),
          sql`${invoices.documentUrl} <> ''`,
        ))
        .orderBy(desc(invoices.issueDate));
      return results;
    }),

    myCampaignServiceOrders: anuncianteProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.clientId) return [];
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { serviceOrders, campaigns } = await import("../drizzle/schema");
        const { eq, and } = await import("drizzle-orm");
        const camp = await db.select({ id: campaigns.id }).from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.clientId, user.clientId)))
          .limit(1);
        if (!camp.length) return [];
        const results = await db.select({
          id: serviceOrders.id,
          orderNumber: serviceOrders.orderNumber,
          type: serviceOrders.type,
          status: serviceOrders.status,
          trackingCode: serviceOrders.trackingCode,
          freightProvider: serviceOrders.freightProvider,
          freightExpectedDate: serviceOrders.freightExpectedDate,
          periodStart: serviceOrders.periodStart,
          periodEnd: serviceOrders.periodEnd,
        }).from(serviceOrders)
          .where(eq(serviceOrders.campaignId, input.campaignId));
        return results;
      }),

    myCampaignProofs: anuncianteProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.clientId) return [];
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return [];
        const { campaignProofs, campaigns, restaurants } = await import("../drizzle/schema");
        const { eq, and, asc } = await import("drizzle-orm");
        const camp = await db.select({ id: campaigns.id }).from(campaigns)
          .where(and(eq(campaigns.id, input.campaignId), eq(campaigns.clientId, user.clientId)))
          .limit(1);
        if (!camp.length) return [];
        const results = await db.select({
          id: campaignProofs.id,
          week: campaignProofs.week,
          photoUrl: campaignProofs.photoUrl,
          restaurantId: campaignProofs.restaurantId,
          restaurantName: restaurants.name,
          createdAt: campaignProofs.createdAt,
        }).from(campaignProofs)
          .leftJoin(restaurants, eq(campaignProofs.restaurantId, restaurants.id))
          .where(eq(campaignProofs.campaignId, input.campaignId))
          .orderBy(asc(campaignProofs.week), asc(campaignProofs.createdAt));
        return results;
      }),

    updateProfile: anuncianteProcedure
      .input(z.object({
        company: z.string().optional(),
        razaoSocial: z.string().optional(),
        cnpj: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        instagram: z.string().optional(),
        segment: z.string().optional(),
        address: z.string().optional(),
        addressNumber: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        cep: z.string().optional(),
        contactName: z.string().optional(),
        contactRole: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user || !user.clientId) throw new TRPCError({ code: "FORBIDDEN", message: "Sem perfil vinculado" });

        const { contactName, contactRole, ...clientFields } = input;
        await updateClient(user.clientId, clientFields);

        const trimmedName = (contactName || "").trim();
        const trimmedRole = (contactRole || "").trim();
        const trimmedEmail = (input.contactEmail || "").trim();
        const trimmedPhone = (input.contactPhone || "").trim();

        if (trimmedName || trimmedEmail || trimmedPhone || trimmedRole) {
          const { getDb: getDatabase } = await import("./db");
          const db = await getDatabase();
          if (db) {
            const { contacts } = await import("../drizzle/schema");
            const { eq, and } = await import("drizzle-orm");

            const existing = await db
              .select({ id: contacts.id, name: contacts.name, role: contacts.role, email: contacts.email, phone: contacts.phone })
              .from(contacts)
              .where(and(eq(contacts.clientId, user.clientId), eq(contacts.isPrimary, true)))
              .limit(1);

            if (existing.length > 0) {
              const updates: Partial<typeof contacts.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
              if (trimmedName) updates.name = trimmedName;
              if (trimmedRole) updates.role = trimmedRole;
              if (trimmedEmail) updates.email = trimmedEmail;
              if (trimmedPhone) updates.phone = trimmedPhone;
              await db.update(contacts).set(updates).where(eq(contacts.id, existing[0].id));
            } else if (trimmedName || trimmedEmail) {
              await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.clientId, user.clientId));
              await db.insert(contacts).values({
                clientId: user.clientId,
                name: trimmedName || trimmedEmail || "Sem nome",
                email: trimmedEmail || undefined,
                phone: trimmedPhone || undefined,
                role: trimmedRole || undefined,
                isPrimary: true,
              });
            }
          }
        }

        return { ok: true };
      }),

    profileCompletionStatus: anuncianteProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      if (!user || !user.clientId) {
        return { hasQuotation: false, isComplete: true, missing: { address: false, contact: false, contactPerson: false, segment: false }, primaryContact: null };
      }
      const { getDb: getDatabase } = await import("./db");
      const db = await getDatabase();
      if (!db) {
        return { hasQuotation: false, isComplete: true, missing: { address: false, contact: false, contactPerson: false, segment: false }, primaryContact: null };
      }
      const { quotations, contacts, clients } = await import("../drizzle/schema");
      const { eq, and, sql } = await import("drizzle-orm");

      const [client] = await db.select().from(clients).where(eq(clients.id, user.clientId)).limit(1);
      if (!client) {
        return { hasQuotation: false, isComplete: true, missing: { address: false, contact: false, contactPerson: false, segment: false }, primaryContact: null };
      }

      const [{ count: quotationCount } = { count: 0 }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(quotations)
        .where(eq(quotations.clientId, user.clientId));

      const [primary] = await db
        .select({ name: contacts.name, role: contacts.role, email: contacts.email, phone: contacts.phone })
        .from(contacts)
        .where(and(eq(contacts.clientId, user.clientId), eq(contacts.isPrimary, true)))
        .limit(1);

      const hasAddress = !!(client.address && client.city && client.state);
      const hasContact = !!(client.contactPhone || client.contactEmail || primary?.phone || primary?.email);
      const hasContactPerson = !!(primary?.name && primary.name.trim().length > 0);
      const hasSegment = !!(client.segment && client.segment.trim().length > 0);

      const missing = {
        address: !hasAddress,
        contact: !hasContact,
        contactPerson: !hasContactPerson,
        segment: !hasSegment,
      };
      const isComplete = !missing.address && !missing.contact && !missing.contactPerson && !missing.segment;

      return {
        hasQuotation: Number(quotationCount) > 0,
        isComplete,
        missing,
        primaryContact: primary ?? null,
      };
    }),

    getPriceTable: anuncianteProcedure
      .query(async ({ ctx }) => {
        const user = ctx.user;
        if (!user || !user.clientId) return { hasPartner: false, products: [] };
        const { getDb: getDatabase } = await import("./db");
        const db = await getDatabase();
        if (!db) return { hasPartner: false, products: [] };
        const { clients, products: productsTable, productPricingTiers, productDiscountPriceTiers } = await import("../drizzle/schema");
        const { eq, asc, and } = await import("drizzle-orm");

        const [client] = await db.select({ partnerId: clients.partnerId, showAgencyPricing: clients.showAgencyPricing }).from(clients).where(eq(clients.id, user.clientId)).limit(1);
        const hasPartner = client?.showAgencyPricing === true
          ? true
          : client?.showAgencyPricing === false
          ? false
          : !!client?.partnerId;

        const visibleProducts = await db
          .select()
          .from(productsTable)
          .where(and(eq(productsTable.isActive, true), eq(productsTable.visibleToAdvertisers, true)))
          .orderBy(asc(productsTable.name));

        const productsWithTiers = await Promise.all(
          visibleProducts.map(async (p) => {
            const [tiers, discountTiers] = await Promise.all([
              db.select().from(productPricingTiers).where(eq(productPricingTiers.productId, p.id)).orderBy(asc(productPricingTiers.volumeMin)),
              db.select().from(productDiscountPriceTiers).where(eq(productDiscountPriceTiers.productId, p.id)).orderBy(asc(productDiscountPriceTiers.priceMin)),
            ]);
            return { ...p, tiers, discountTiers };
          })
        );

        return { hasPartner, products: productsWithTiers };
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
        tracking: z.object({
          utmSource: z.string().max(255).optional(),
          utmMedium: z.string().max(255).optional(),
          utmCampaign: z.string().max(255).optional(),
          utmContent: z.string().max(255).optional(),
          utmTerm: z.string().max(255).optional(),
          referrer: z.string().max(500).optional(),
          landingPath: z.string().max(255).optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = ctx.user;
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (user.onboardingComplete || user.clientId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Onboarding já foi concluído." });
        }

        const { tracking, ...clientFields } = input;
        const newClient = await createClient({
          ...clientFields,
          ...(tracking || {}),
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

        try {
          const { ensureContact } = await import("./contactSync");
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || input.name;
          await ensureContact({
            clientId: newClient.id,
            name: fullName,
            email: user.email || input.contactEmail || undefined,
            phone: input.contactPhone || undefined,
            isPrimary: true,
          });
        } catch (err) {
          console.error("Failed to sync contact on completeOnboarding:", err);
        }

        return newClient;
      }),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const lastUserMessage = input.messages.filter((m) => m.role === "user").pop();
        return `Olá! Sou o assistente interno da mesa.ads. Recebi sua mensagem: "${lastUserMessage?.content || ""}". Esta é uma resposta de demonstração — a integração com IA estará disponível em breve.`;
      }),
  }),
});

export type AppRouter = typeof appRouter;
