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
          address: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
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
          address: z.string().optional(),
          neighborhood: z.string().optional(),
          city: z.string().optional(),
          contactName: z.string().optional(),
          contactPhone: z.string().optional(),
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
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
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
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
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
          cpm: z.string().default("50.00"),
          startDate: z.string(),
          endDate: z.string(),
          status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => createCampaign(input)),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          clientId: z.number().optional(),
          name: z.string().min(1).optional(),
          cpm: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          status: z.enum(["draft", "active", "paused", "completed"]).optional(),
          notes: z.string().optional(),
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
          { ...data, validUntil: validUntil ? new Date(validUntil) : null },
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
