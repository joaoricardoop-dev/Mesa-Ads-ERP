import { internalProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  campaigns,
  campaignPhases,
  campaignItems,
  campaignRestaurants,
  clients,
  products,
  activeRestaurants,
  restaurants as restaurantsTable,
} from "../drizzle/schema";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const PHASE_STATUSES = ["planejada", "ativa", "concluida", "cancelada"] as const;

// Calendário operacional Ops — agrega campaign_phases (linha do tempo)
// + dados da campanha + cliente + locais/produtos por fase, para alimentar
// o Gantt nas 4 visões (Global / Anunciante / Produto / Local).
//
// `globalCalendar` aceita filtros opcionais (clientId, productId, restaurantId)
// e cobre as visões Global, Anunciante e Produto.
// `locationCalendar` é um atalho para a visão Local: traz fases que envolvem
// um restaurante específico tanto via campaign_items.restaurantId quanto via
// junction campaign_restaurants (campanhas legadas/rede inteira).
export const opsRouter = router({
  globalCalendar: internalProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        clientId: z.number().int().optional(),
        productId: z.number().int().optional(),
        restaurantId: z.number().int().optional(),
        phaseStatus: z.enum(PHASE_STATUSES).optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDatabase();
      const f = input ?? {};

      const conds: any[] = [];
      if (f.from) conds.push(gte(campaignPhases.periodEnd, f.from));
      if (f.to) conds.push(lte(campaignPhases.periodStart, f.to));
      if (f.clientId) conds.push(eq(campaigns.clientId, f.clientId));
      if (f.phaseStatus) conds.push(eq(campaignPhases.status, f.phaseStatus));

      const baseRows = await db
        .select({
          phaseId: campaignPhases.id,
          campaignId: campaignPhases.campaignId,
          sequence: campaignPhases.sequence,
          label: campaignPhases.label,
          periodStart: campaignPhases.periodStart,
          periodEnd: campaignPhases.periodEnd,
          phaseStatus: campaignPhases.status,
          phaseNotes: campaignPhases.notes,
          campaignName: campaigns.name,
          campaignStatus: campaigns.status,
          campaignNumber: campaigns.campaignNumber,
          isBonificada: campaigns.isBonificada,
          clientId: campaigns.clientId,
          clientName: clients.name,
        })
        .from(campaignPhases)
        .innerJoin(campaigns, eq(campaigns.id, campaignPhases.campaignId))
        .leftJoin(clients, eq(clients.id, campaigns.clientId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(campaignPhases.periodStart));

      if (baseRows.length === 0) return [];

      const phaseIds = baseRows.map((r) => r.phaseId);
      const campaignIds = Array.from(new Set(baseRows.map((r) => r.campaignId)));

      // Itens por fase (produtos + locais opcionais via restaurantId)
      const itemRows = await db
        .select({
          phaseId: campaignItems.campaignPhaseId,
          itemId: campaignItems.id,
          productId: campaignItems.productId,
          productName: products.name,
          productTipo: products.tipo,
          quantity: campaignItems.quantity,
          restaurantId: campaignItems.restaurantId,
          restaurantName: activeRestaurants.name,
          shareIndex: campaignItems.shareIndex,
        })
        .from(campaignItems)
        .leftJoin(products, eq(products.id, campaignItems.productId))
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, campaignItems.restaurantId))
        .where(inArray(campaignItems.campaignPhaseId, phaseIds));

      // Locais (campanhas legadas usam junction campaign_restaurants → restaurants)
      const restRows = await db
        .select({
          campaignId: campaignRestaurants.campaignId,
          restaurantId: campaignRestaurants.restaurantId,
          restaurantName: restaurantsTable.name,
        })
        .from(campaignRestaurants)
        .leftJoin(restaurantsTable, eq(restaurantsTable.id, campaignRestaurants.restaurantId))
        .where(inArray(campaignRestaurants.campaignId, campaignIds));

      const itemsByPhase = new Map<number, typeof itemRows>();
      for (const r of itemRows) {
        if (!itemsByPhase.has(r.phaseId)) itemsByPhase.set(r.phaseId, []);
        itemsByPhase.get(r.phaseId)!.push(r);
      }
      const restsByCampaign = new Map<number, typeof restRows>();
      for (const r of restRows) {
        if (!restsByCampaign.has(r.campaignId)) restsByCampaign.set(r.campaignId, []);
        restsByCampaign.get(r.campaignId)!.push(r);
      }

      // Aplica filtros productId / restaurantId em memória usando os agregados.
      const result = baseRows
        .map((row) => {
          const items = itemsByPhase.get(row.phaseId) ?? [];
          const campaignRests = restsByCampaign.get(row.campaignId) ?? [];

          const productSet = new Map<number, { productId: number; productName: string; tipo: string | null }>();
          for (const it of items) {
            if (!productSet.has(it.productId)) {
              productSet.set(it.productId, {
                productId: it.productId,
                productName: it.productName ?? "—",
                tipo: it.productTipo ?? null,
              });
            }
          }

          const locationSet = new Map<number, { restaurantId: number; restaurantName: string; source: "item" | "campaign" }>();
          for (const it of items) {
            if (it.restaurantId != null && !locationSet.has(it.restaurantId)) {
              locationSet.set(it.restaurantId, {
                restaurantId: it.restaurantId,
                restaurantName: it.restaurantName ?? "—",
                source: "item",
              });
            }
          }
          for (const r of campaignRests) {
            if (!locationSet.has(r.restaurantId)) {
              locationSet.set(r.restaurantId, {
                restaurantId: r.restaurantId,
                restaurantName: r.restaurantName ?? "—",
                source: "campaign",
              });
            }
          }

          return {
            ...row,
            products: Array.from(productSet.values()),
            locations: Array.from(locationSet.values()),
            itemCount: items.length,
          };
        })
        .filter((row) => {
          if (f.productId && !row.products.some((p) => p.productId === f.productId)) return false;
          if (f.restaurantId && !row.locations.some((l) => l.restaurantId === f.restaurantId)) return false;
          return true;
        });

      return result;
    }),

  // Visão Local: fases que envolvem um determinado active_restaurant.
  // Cobre tanto itens vinculados explicitamente (campaign_items.restaurantId)
  // quanto campanhas legadas que apontam o local via campaign_restaurants.
  locationCalendar: internalProcedure
    .input(
      z.object({
        restaurantId: z.number().int(),
        from: z.string().optional(),
        to: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDatabase();

      // 1) phaseIds via campaign_items
      const fromItems = await db
        .select({ phaseId: campaignItems.campaignPhaseId })
        .from(campaignItems)
        .where(eq(campaignItems.restaurantId, input.restaurantId));

      // 2) campaignIds via campaign_restaurants legacy
      const fromCampaigns = await db
        .select({ campaignId: campaignRestaurants.campaignId })
        .from(campaignRestaurants)
        .where(eq(campaignRestaurants.restaurantId, input.restaurantId));

      const phaseIdSet = new Set<number>(fromItems.map((r) => r.phaseId));
      const legacyCampaignIds = Array.from(new Set(fromCampaigns.map((r) => r.campaignId)));

      if (legacyCampaignIds.length > 0) {
        const extra = await db
          .select({ id: campaignPhases.id })
          .from(campaignPhases)
          .where(inArray(campaignPhases.campaignId, legacyCampaignIds));
        for (const e of extra) phaseIdSet.add(e.id);
      }

      const phaseIds = Array.from(phaseIdSet);
      if (phaseIds.length === 0) return [];

      const dateConds: any[] = [inArray(campaignPhases.id, phaseIds)];
      if (input.from) dateConds.push(gte(campaignPhases.periodEnd, input.from));
      if (input.to) dateConds.push(lte(campaignPhases.periodStart, input.to));

      const rows = await db
        .select({
          phaseId: campaignPhases.id,
          campaignId: campaignPhases.campaignId,
          sequence: campaignPhases.sequence,
          label: campaignPhases.label,
          periodStart: campaignPhases.periodStart,
          periodEnd: campaignPhases.periodEnd,
          phaseStatus: campaignPhases.status,
          phaseNotes: campaignPhases.notes,
          campaignName: campaigns.name,
          campaignStatus: campaigns.status,
          campaignNumber: campaigns.campaignNumber,
          isBonificada: campaigns.isBonificada,
          clientId: campaigns.clientId,
          clientName: clients.name,
        })
        .from(campaignPhases)
        .innerJoin(campaigns, eq(campaigns.id, campaignPhases.campaignId))
        .leftJoin(clients, eq(clients.id, campaigns.clientId))
        .where(and(...dateConds))
        .orderBy(asc(campaignPhases.periodStart));

      // Produtos por fase (limitados aos itens deste local quando houver vínculo)
      const itemRows = await db
        .select({
          phaseId: campaignItems.campaignPhaseId,
          productId: campaignItems.productId,
          productName: products.name,
          productTipo: products.tipo,
          restaurantId: campaignItems.restaurantId,
        })
        .from(campaignItems)
        .leftJoin(products, eq(products.id, campaignItems.productId))
        .where(inArray(campaignItems.campaignPhaseId, phaseIds));

      const itemsByPhase = new Map<number, typeof itemRows>();
      for (const r of itemRows) {
        if (!itemsByPhase.has(r.phaseId)) itemsByPhase.set(r.phaseId, []);
        itemsByPhase.get(r.phaseId)!.push(r);
      }

      return rows.map((row) => {
        const items = itemsByPhase.get(row.phaseId) ?? [];
        const localItems = items.filter(
          (it) => it.restaurantId == null || it.restaurantId === input.restaurantId,
        );
        const productSet = new Map<number, { productId: number; productName: string; tipo: string | null }>();
        for (const it of localItems) {
          if (!productSet.has(it.productId)) {
            productSet.set(it.productId, {
              productId: it.productId,
              productName: it.productName ?? "—",
              tipo: it.productTipo ?? null,
            });
          }
        }
        return {
          ...row,
          products: Array.from(productSet.values()),
          locations: [{ restaurantId: input.restaurantId, restaurantName: "" }],
          itemCount: localItems.length,
        };
      });
    }),
});
