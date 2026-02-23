import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
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
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
    list: publicProcedure.query(() => listRestaurants()),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getRestaurant(input.id)),

    create: publicProcedure
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

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteRestaurant(input.id)),
  }),

  // ─── Active Restaurants (Restaurantes Ativos) ────────────────────────
  activeRestaurant: router({
    list: publicProcedure.query(() => listActiveRestaurants()),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getActiveRestaurant(input.id)),

    create: publicProcedure
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
          socialClass: z.enum(["A", "B", "C", "misto_ab", "misto_bc", "nao_sei"]).optional(),
          tableCount: z.number().int().min(0),
          seatCount: z.number().int().min(0),
          monthlyCustomers: z.number().int().min(0),
          busyDays: z.string().optional(),
          busyHours: z.string().optional(),
          excludedCategories: z.string().optional(),
          excludedOther: z.string().optional(),
          photoAuthorization: z.string().optional(),
          photoUrls: z.string().optional(),
          pixKey: z.string().optional(),
          coastersAllocated: z.number().int().optional(),
          commissionPercent: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(({ input }) => createActiveRestaurant(input)),

    update: publicProcedure
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
          socialClass: z.enum(["A", "B", "C", "misto_ab", "misto_bc", "nao_sei"]).optional(),
          tableCount: z.number().int().optional(),
          seatCount: z.number().int().optional(),
          monthlyCustomers: z.number().int().optional(),
          busyDays: z.string().optional(),
          busyHours: z.string().optional(),
          excludedCategories: z.string().optional(),
          excludedOther: z.string().optional(),
          photoAuthorization: z.string().optional(),
          photoUrls: z.string().optional(),
          pixKey: z.string().optional(),
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

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteActiveRestaurant(input.id)),

    getCampaigns: publicProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => getRestaurantCampaigns(input.restaurantId)),

    getBranches: publicProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => getRestaurantBranches(input.restaurantId)),

    linkBranch: publicProcedure
      .input(z.object({ parentId: z.number(), branchId: z.number() }))
      .mutation(({ input }) => linkBranch(input.parentId, input.branchId)),

    unlinkBranch: publicProcedure
      .input(z.object({ branchId: z.number() }))
      .mutation(({ input }) => unlinkBranch(input.branchId)),

    getPhotos: publicProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => listRestaurantPhotos(input.restaurantId)),

    addPhoto: publicProcedure
      .input(z.object({ restaurantId: z.number(), url: z.string(), caption: z.string().optional(), photoType: z.string().optional() }))
      .mutation(({ input }) => addRestaurantPhoto(input)),

    deletePhoto: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteRestaurantPhoto(input.id)),

    getPayments: publicProcedure
      .input(z.object({ restaurantId: z.number() }))
      .query(({ input }) => listRestaurantPayments(input.restaurantId)),

    addPayment: publicProcedure
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

    updatePayment: publicProcedure
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

    deletePayment: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteRestaurantPayment(input.id)),
  }),

  // ─── Clients (Anunciantes) ────────────────────────────────────────────
  advertiser: router({
    list: publicProcedure.query(() => listClients()),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getClient(input.id)),

    create: publicProcedure
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

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteClient(input.id)),
  }),

  // ─── Campaigns ────────────────────────────────────────────────────────
  campaign: router({
    list: publicProcedure.query(() => listCampaigns()),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCampaign(input.id)),

    create: publicProcedure
      .input(
        z.object({
          clientId: z.number(),
          name: z.string().min(1),
          startDate: z.string(),
          endDate: z.string(),
          status: z.enum(["draft", "active", "paused", "completed", "quotation", "archived"]).default("quotation"),
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

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          clientId: z.number().optional(),
          name: z.string().min(1).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.enum(["draft", "active", "paused", "completed", "quotation", "archived"]).optional(),
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

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCampaign(input.id)),

    getRestaurants: publicProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(({ input }) => getCampaignRestaurants(input.campaignId)),

    setRestaurants: publicProcedure
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

    getHistory: publicProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(({ input }) => getCampaignHistory(input.campaignId)),

    addHistory: publicProcedure
      .input(z.object({ campaignId: z.number(), action: z.string(), details: z.string().optional() }))
      .mutation(({ input }) => addCampaignHistory(input.campaignId, input.action, input.details)),

    approve: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCampaign(input.id, { status: "active" });
        await addCampaignHistory(input.id, "approved", "Cotação aprovada — campanha ativada");
      }),

    archive: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateCampaign(input.id, { status: "archived" });
        await addCampaignHistory(input.id, "archived", "Cotação arquivada");
      }),
  }),

  // ─── Client History ─────────────────────────────────────────────────
  clientHistory: router({
    get: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(({ input }) => getClientHistory(input.clientId)),
  }),

  // ─── Economics ────────────────────────────────────────────────────────
  economics: router({
    monthly: publicProcedure
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
    list: publicProcedure.query(() => listSuppliers()),

    create: publicProcedure
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

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteSupplier(input.id)),
  }),

  // ─── Budgets (Orçamentos de Produção) ─────────────────────────────────
  budget: router({
    list: publicProcedure.query(() => listBudgets()),

    listActiveWithItems: publicProcedure.query(() => listActiveBudgetsWithItems()),

    getItems: publicProcedure
      .input(z.object({ budgetId: z.number() }))
      .query(({ input }) => getBudgetItems(input.budgetId)),

    create: publicProcedure
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

    update: publicProcedure
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

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBudget(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
