// Marketplace v2 — Backend de disponibilidade de locais e produtos.
// Estes endpoints alimentam o novo fluxo /montar-campanha (locais → shares →
// checkout) e o calendário operacional Ops. Não fazem reserva: a regra é
// first-come-first-served no checkout.

import { anuncianteProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  activeRestaurants,
  products,
  productLocations,
  campaignItems,
  campaignPhases,
  campaigns,
  campaignDrafts,
} from "../drizzle/schema";
import { and, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  computeShareAvailability,
  parseExcludedCategories,
  hasCategoryConflict,
  NON_OCCUPYING_PHASE_STATUSES,
  NON_OCCUPYING_CAMPAIGN_STATUSES,
  type ProductLocationRow,
  type OccupationRow,
} from "./utils/marketplaceAvailability";

// Listas tipadas para os filtros NOT IN das queries (status que não devem
// reservar inventário no marketplace).
const NON_OCCUPYING_PHASE_STATUS_LIST = Array.from(NON_OCCUPYING_PHASE_STATUSES) as Array<
  (typeof campaignPhases.status.enumValues)[number]
>;
const NON_OCCUPYING_CAMPAIGN_STATUS_LIST = Array.from(NON_OCCUPYING_CAMPAIGN_STATUSES) as Array<
  (typeof campaigns.status.enumValues)[number]
>;

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD");

const productTipoSchema = z.enum([
  "coaster",
  "display",
  "cardapio",
  "totem",
  "adesivo",
  "porta_guardanapo",
  "outro",
  "impressos",
  "eletronicos",
  "telas",
  "janelas_digitais",
]);

export const anunciantePortalRouter = router({
  // Lista locais ativos com seus shares disponíveis no período. Filtros
  // opcionais por tipo de produto, bairro e janela de datas. Retorna também
  // rating, audiência estimada e categorias excluídas (alerta de conflito).
  listAvailableLocations: anuncianteProcedure
    .input(
      z
        .object({
          productType: productTipoSchema.optional(),
          neighborhood: z.string().trim().min(1).optional(),
          startDate: isoDateSchema.optional(),
          endDate: isoDateSchema.optional(),
          category: z.string().trim().min(1).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = await getDatabase();
      const { productType, neighborhood, startDate, endDate, category } = input ?? {};
      if (startDate && endDate && startDate > endDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "startDate deve ser <= endDate" });
      }

      // 1. Locais (productLocations) cruzados com produtos ativos visíveis a
      // anunciantes. Aplicar filtro por tipo de produto se fornecido.
      const productConditions: SQL[] = [
        eq(products.isActive, true),
        eq(products.visibleToAdvertisers, true),
      ];
      if (productType) productConditions.push(eq(products.tipo, productType));

      const slotRows = await db
        .select({
          productId: productLocations.productId,
          restaurantId: productLocations.restaurantId,
          maxShares: productLocations.maxShares,
          cycleWeeks: productLocations.cycleWeeks,
          productName: products.name,
          productTipo: products.tipo,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
        })
        .from(productLocations)
        .innerJoin(products, eq(products.id, productLocations.productId))
        .where(and(...productConditions));

      if (slotRows.length === 0) return [];

      const restaurantIds = Array.from(new Set(slotRows.map((s) => s.restaurantId)));

      // 2. Restaurantes ativos (com filtro opcional de bairro).
      const restaurantConditions: SQL[] = [
        eq(activeRestaurants.status, "active"),
        inArray(activeRestaurants.id, restaurantIds),
      ];
      if (neighborhood) restaurantConditions.push(eq(activeRestaurants.neighborhood, neighborhood));

      const restaurantRows = await db
        .select({
          id: activeRestaurants.id,
          name: activeRestaurants.name,
          neighborhood: activeRestaurants.neighborhood,
          city: activeRestaurants.city,
          state: activeRestaurants.state,
          monthlyCustomers: activeRestaurants.monthlyCustomers,
          ticketMedio: activeRestaurants.ticketMedio,
          ratingScore: activeRestaurants.ratingScore,
          ratingTier: activeRestaurants.ratingTier,
          ratingMultiplier: activeRestaurants.ratingMultiplier,
          excludedCategories: activeRestaurants.excludedCategories,
          logoUrl: activeRestaurants.logoUrl,
        })
        .from(activeRestaurants)
        .where(and(...restaurantConditions));

      if (restaurantRows.length === 0) return [];

      const allowedRestaurantIds = new Set(restaurantRows.map((r) => r.id));

      // 3. Ocupação real: campaignItems vinculados a (productId, restaurantId)
      // cujas fases intersectam o período. Filtramos no SQL quando possível.
      const occupationConditions: SQL[] = [
        inArray(campaignItems.restaurantId, Array.from(allowedRestaurantIds)),
        notInArray(campaignPhases.status, NON_OCCUPYING_PHASE_STATUS_LIST),
        notInArray(campaigns.status, NON_OCCUPYING_CAMPAIGN_STATUS_LIST),
      ];
      if (startDate) occupationConditions.push(sql`${campaignPhases.periodEnd} >= ${startDate}`);
      if (endDate) occupationConditions.push(sql`${campaignPhases.periodStart} <= ${endDate}`);

      const occRows = await db
        .select({
          productId: campaignItems.productId,
          restaurantId: campaignItems.restaurantId,
          phaseStart: campaignPhases.periodStart,
          phaseEnd: campaignPhases.periodEnd,
          phaseStatus: campaignPhases.status,
          campaignStatus: campaigns.status,
        })
        .from(campaignItems)
        .innerJoin(campaignPhases, eq(campaignPhases.id, campaignItems.campaignPhaseId))
        .innerJoin(campaigns, eq(campaigns.id, campaignPhases.campaignId))
        .where(and(...occupationConditions));

      const slotsScoped: ProductLocationRow[] = slotRows
        .filter((s) => allowedRestaurantIds.has(s.restaurantId))
        .map((s) => ({
          productId: s.productId,
          restaurantId: s.restaurantId,
          maxShares: s.maxShares,
          cycleWeeks: s.cycleWeeks,
        }));

      const occupations: OccupationRow[] = occRows
        .filter((o) => o.restaurantId != null)
        .map((o) => ({
          productId: o.productId,
          restaurantId: o.restaurantId as number,
          phaseStart: o.phaseStart,
          phaseEnd: o.phaseEnd,
          phaseStatus: o.phaseStatus,
          campaignStatus: o.campaignStatus,
        }));

      const availability = computeShareAvailability(slotsScoped, occupations, startDate, endDate);

      // 4. Monta payload final agrupado por restaurante.
      const slotsByRestaurant = new Map<number, typeof slotRows>();
      for (const s of slotRows) {
        if (!allowedRestaurantIds.has(s.restaurantId)) continue;
        const arr = slotsByRestaurant.get(s.restaurantId) ?? [];
        arr.push(s);
        slotsByRestaurant.set(s.restaurantId, arr);
      }

      const payload = restaurantRows.map((r) => {
        const excluded = parseExcludedCategories(r.excludedCategories);
        const productSlots = (slotsByRestaurant.get(r.id) ?? []).map((s) => {
          const cell = availability.get(`${s.productId}:${s.restaurantId}`);
          return {
            productId: s.productId,
            productName: s.productName,
            productTipo: s.productTipo,
            unitLabel: s.productUnitLabel,
            unitLabelPlural: s.productUnitLabelPlural,
            maxShares: s.maxShares,
            cycleWeeks: s.cycleWeeks,
            occupiedShares: cell?.occupiedShares ?? 0,
            availableShares: cell?.availableShares ?? s.maxShares,
          };
        });

        const totalAvailable = productSlots.reduce((sum, p) => sum + p.availableShares, 0);
        const estimatedAudience = (r.monthlyCustomers ?? 0);

        return {
          restaurantId: r.id,
          name: r.name,
          neighborhood: r.neighborhood,
          city: r.city,
          state: r.state,
          logoUrl: r.logoUrl,
          monthlyCustomers: r.monthlyCustomers,
          ticketMedio: r.ticketMedio,
          estimatedAudience,
          rating: {
            score: r.ratingScore != null ? parseFloat(r.ratingScore) : null,
            tier: r.ratingTier,
            multiplier: r.ratingMultiplier != null ? parseFloat(r.ratingMultiplier) : null,
          },
          excludedCategories: excluded,
          categoryConflict: hasCategoryConflict(excluded, category),
          productSlots,
          totalAvailableShares: totalAvailable,
          hasAvailability: totalAvailable > 0,
        };
      });

      return payload;
    }),

  // Para um conjunto de restaurantes selecionados, retorna os produtos
  // ofertados em cada um com a ocupação (shares ocupados vs disponíveis) no
  // intervalo informado. Usado pelo passo "produtos por local" do builder.
  getProductsForLocations: anuncianteProcedure
    .input(
      z.object({
        restaurantIds: z.array(z.number().int()).min(1),
        startDate: isoDateSchema,
        endDate: isoDateSchema,
        category: z.string().trim().min(1).optional(),
      }),
    )
    .query(async ({ input }) => {
      if (input.startDate > input.endDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "startDate deve ser <= endDate" });
      }
      const db = await getDatabase();
      const ids = Array.from(new Set(input.restaurantIds));

      const restaurantRows = await db
        .select({
          id: activeRestaurants.id,
          name: activeRestaurants.name,
          neighborhood: activeRestaurants.neighborhood,
          city: activeRestaurants.city,
          excludedCategories: activeRestaurants.excludedCategories,
          monthlyCustomers: activeRestaurants.monthlyCustomers,
          ratingScore: activeRestaurants.ratingScore,
          ratingTier: activeRestaurants.ratingTier,
        })
        .from(activeRestaurants)
        .where(and(eq(activeRestaurants.status, "active"), inArray(activeRestaurants.id, ids)));

      if (restaurantRows.length === 0) return [];
      const allowedIds = new Set(restaurantRows.map((r) => r.id));

      const slotRows = await db
        .select({
          productId: productLocations.productId,
          restaurantId: productLocations.restaurantId,
          maxShares: productLocations.maxShares,
          cycleWeeks: productLocations.cycleWeeks,
          productName: products.name,
          productTipo: products.tipo,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
          temDistribuicaoPorLocal: products.temDistribuicaoPorLocal,
        })
        .from(productLocations)
        .innerJoin(products, eq(products.id, productLocations.productId))
        .where(
          and(
            eq(products.isActive, true),
            eq(products.visibleToAdvertisers, true),
            inArray(productLocations.restaurantId, Array.from(allowedIds)),
          ),
        );

      const occRows = await db
        .select({
          productId: campaignItems.productId,
          restaurantId: campaignItems.restaurantId,
          phaseStart: campaignPhases.periodStart,
          phaseEnd: campaignPhases.periodEnd,
          phaseStatus: campaignPhases.status,
          campaignStatus: campaigns.status,
        })
        .from(campaignItems)
        .innerJoin(campaignPhases, eq(campaignPhases.id, campaignItems.campaignPhaseId))
        .innerJoin(campaigns, eq(campaigns.id, campaignPhases.campaignId))
        .where(
          and(
            inArray(campaignItems.restaurantId, Array.from(allowedIds)),
            notInArray(campaignPhases.status, NON_OCCUPYING_PHASE_STATUS_LIST),
            notInArray(campaigns.status, NON_OCCUPYING_CAMPAIGN_STATUS_LIST),
            sql`${campaignPhases.periodEnd} >= ${input.startDate}`,
            sql`${campaignPhases.periodStart} <= ${input.endDate}`,
          ),
        );

      const slotsForCalc: ProductLocationRow[] = slotRows.map((s) => ({
        productId: s.productId,
        restaurantId: s.restaurantId,
        maxShares: s.maxShares,
        cycleWeeks: s.cycleWeeks,
      }));
      const occupations: OccupationRow[] = occRows
        .filter((o) => o.restaurantId != null)
        .map((o) => ({
          productId: o.productId,
          restaurantId: o.restaurantId as number,
          phaseStart: o.phaseStart,
          phaseEnd: o.phaseEnd,
          phaseStatus: o.phaseStatus,
          campaignStatus: o.campaignStatus,
        }));
      const availability = computeShareAvailability(
        slotsForCalc,
        occupations,
        input.startDate,
        input.endDate,
      );

      const slotsByRestaurant = new Map<number, typeof slotRows>();
      for (const s of slotRows) {
        const arr = slotsByRestaurant.get(s.restaurantId) ?? [];
        arr.push(s);
        slotsByRestaurant.set(s.restaurantId, arr);
      }

      return restaurantRows.map((r) => {
        const excluded = parseExcludedCategories(r.excludedCategories);
        const productList = (slotsByRestaurant.get(r.id) ?? []).map((s) => {
          const cell = availability.get(`${s.productId}:${s.restaurantId}`);
          const occupied = cell?.occupiedShares ?? 0;
          const available = cell?.availableShares ?? s.maxShares;
          return {
            productId: s.productId,
            productName: s.productName,
            productTipo: s.productTipo,
            unitLabel: s.productUnitLabel,
            unitLabelPlural: s.productUnitLabelPlural,
            temDistribuicaoPorLocal: s.temDistribuicaoPorLocal,
            maxShares: s.maxShares,
            cycleWeeks: s.cycleWeeks,
            occupiedShares: occupied,
            availableShares: available,
            isFullyBooked: available <= 0,
          };
        });
        return {
          restaurantId: r.id,
          name: r.name,
          neighborhood: r.neighborhood,
          city: r.city,
          monthlyCustomers: r.monthlyCustomers,
          rating: {
            score: r.ratingScore != null ? parseFloat(r.ratingScore) : null,
            tier: r.ratingTier,
          },
          excludedCategories: excluded,
          categoryConflict: hasCategoryConflict(excluded, input.category),
          products: productList,
        };
      });
    }),

  // ── Cart Draft (Marketplace v2) ────────────────────────────────────────────
  // Persiste o carrinho do fluxo /montar-campanha por cliente. Sobrescreve o
  // draft anterior — só mantemos o snapshot mais recente. Expira em 30 dias.
  saveCartDraft: anuncianteProcedure
    .input(
      z.object({
        clientId: z.number().int(),
        cart: z.any(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      if (ctx.user.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence a este usuário." });
      }
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ id: campaignDrafts.id })
        .from(campaignDrafts)
        .where(eq(campaignDrafts.clientId, input.clientId))
        .limit(1);
      if (existing[0]) {
        await db
          .update(campaignDrafts)
          .set({ cartJson: input.cart, expiresAt, updatedAt: new Date() })
          .where(eq(campaignDrafts.id, existing[0].id));
        return { id: existing[0].id, savedAt: new Date().toISOString() };
      }
      const [created] = await db
        .insert(campaignDrafts)
        .values({ clientId: input.clientId, cartJson: input.cart, expiresAt })
        .returning();
      return { id: created.id, savedAt: created.createdAt.toISOString() };
    }),

  loadCartDraft: anuncianteProcedure
    .input(z.object({ clientId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await getDatabase();
      if (ctx.user.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence a este usuário." });
      }
      const [row] = await db
        .select()
        .from(campaignDrafts)
        .where(eq(campaignDrafts.clientId, input.clientId))
        .limit(1);
      if (!row) return null;
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;
      return { id: row.id, cart: row.cartJson, updatedAt: row.updatedAt };
    }),

  clearCartDraft: anuncianteProcedure
    .input(z.object({ clientId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      if (ctx.user.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não pertence a este usuário." });
      }
      await db.delete(campaignDrafts).where(eq(campaignDrafts.clientId, input.clientId));
      return { ok: true };
    }),
});
