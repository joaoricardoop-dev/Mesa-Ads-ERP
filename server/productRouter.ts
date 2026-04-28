import { protectedProcedure, adminProcedure, internalProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { products, productPricingTiers, productDiscountPriceTiers, productLocations, activeRestaurants, campaignItems, campaignPhases, campaigns } from "../drizzle/schema";
import { eq, asc, and, gte, inArray, notInArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

// Status de campanhas considerados "encerrados" — não bloqueiam remoção
// de vínculo produto×local. Compartilhado por removeLocation e pela
// sincronização diff em product.update para garantir mesma regra.
const FINISHED_CAMPAIGN_STATUSES = ["draft", "quotation", "completed", "archived", "inativa"] as const;

async function findBlockingCampaignNames(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  productId: number,
  restaurantIds: number[],
): Promise<string[]> {
  if (restaurantIds.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ campaignId: campaigns.id, campaignName: campaigns.name })
    .from(campaignItems)
    .innerJoin(campaignPhases, eq(campaignItems.campaignPhaseId, campaignPhases.id))
    .innerJoin(campaigns, eq(campaignPhases.campaignId, campaigns.id))
    .where(
      and(
        eq(campaignItems.productId, productId),
        inArray(campaignItems.restaurantId, restaurantIds),
        notInArray(campaigns.status, [...FINISHED_CAMPAIGN_STATUSES]),
        gte(campaignPhases.periodEnd, sql`${today}::date`),
      )
    )
    .limit(10);
  const names = new Set<string>();
  for (const r of rows) if (r.campaignName) names.add(r.campaignName);
  return Array.from(names);
}

const TIPO_ENUM = ["coaster", "display", "cardapio", "totem", "adesivo", "porta_guardanapo", "outro", "impressos", "eletronicos", "telas", "janelas_digitais"] as const;

// Produtos veiculados em ambientes de sala VIP (telas e janelas digitais)
// geram repasse automático ao provedor vinculado quando a fatura é paga.
export const VIP_PRODUCT_TIPOS = ["telas", "janelas_digitais"] as const;
const IMPRESSION_FORMULA_ENUM = ["por_coaster", "por_tela", "por_visitante", "por_evento", "manual"] as const;
const DISTRIBUTION_TYPE_ENUM = ["rede", "local_especifico"] as const;
const WORKFLOW_TEMPLATE_ENUM = ["fisico", "eletronico_cliente_envia", "ativacao_evento"] as const;

export const productRouter = router({
  // ── Product CRUD ─────────────────────────────────────────────────────────────
  list: protectedProcedure.query(async () => {
    const db = await getDatabase();
    return db.select().from(products).orderBy(asc(products.name));
  }),

  // Lista pública: usada na tela /montar-campanha aberta a visitantes
  // (logged out). Devolve apenas produtos ativos e visíveis para anunciantes.
  listPublic: publicProcedure.query(async () => {
    const db = await getDatabase();
    const all = await db.select().from(products).orderBy(asc(products.name));
    return all.filter((p) => p.isActive && p.visibleToAdvertisers);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.select().from(products).where(eq(products.id, input.id));
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      const product = rows[0];
      const locations = await db
        .select({ restaurantId: productLocations.restaurantId })
        .from(productLocations)
        .where(eq(productLocations.productId, input.id));
      return { ...product, locationIds: locations.map(l => l.restaurantId) };
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      tipo: z.enum(TIPO_ENUM).default("impressos"),
      temDistribuicaoPorLocal: z.boolean().default(true),
      imagemUrl: z.string().nullable().optional(),
      unitLabel: z.string().min(1).default("unidade"),
      unitLabelPlural: z.string().min(1).default("unidades"),
      defaultQtyPerLocation: z.number().int().min(1).default(500),
      defaultSemanas: z.number().int().default(12),
      irpj: z.string().default("6.00"),
      comRestaurante: z.string().default("15.00"),
      comComercial: z.string().default("10.00"),
      pricingMode: z.enum(["cost_based", "price_based"]).default("cost_based"),
      entryType: z.enum(["tiers", "fixed_quantities"]).default("tiers"),
      workflowTemplate: z.enum(WORKFLOW_TEMPLATE_ENUM).nullable().optional(),
      isActive: z.boolean().default(true),
      impressionFormulaType: z.string().optional().nullable().default("por_coaster"),
      attentionFactor: z.string().default("1.00"),
      frequencyParam: z.string().default("1.00"),
      distributionType: z.enum(DISTRIBUTION_TYPE_ENUM).default("rede"),
      defaultPessoasPorMesa: z.string().default("3.00"),
      loopDurationSeconds: z.number().int().default(30),
      frequenciaAparicoes: z.string().default("1.00"),
      vipProviderId: z.number().int().nullable().optional(),
      vipProviderCommissionPercent: z.string().nullable().optional(),
      locationIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { locationIds, ...productData } = input;
      const rows = await db.insert(products).values(productData).returning();
      const product = rows[0];
      const effectiveLocationIds = productData.distributionType === "local_especifico" ? (locationIds ?? []) : [];
      if (effectiveLocationIds.length > 0) {
        await db.insert(productLocations).values(
          effectiveLocationIds.map(restaurantId => ({ productId: product.id, restaurantId }))
        );
      }
      return product;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      tipo: z.enum(TIPO_ENUM).optional(),
      temDistribuicaoPorLocal: z.boolean().optional(),
      imagemUrl: z.string().nullable().optional(),
      unitLabel: z.string().min(1).optional(),
      unitLabelPlural: z.string().min(1).optional(),
      defaultQtyPerLocation: z.number().int().min(1).optional(),
      defaultSemanas: z.number().int().optional(),
      irpj: z.string().optional(),
      comRestaurante: z.string().optional(),
      comComercial: z.string().optional(),
      pricingMode: z.enum(["cost_based", "price_based"]).optional(),
      entryType: z.enum(["tiers", "fixed_quantities"]).optional(),
      workflowTemplate: z.enum(WORKFLOW_TEMPLATE_ENUM).nullable().optional(),
      isActive: z.boolean().optional(),
      impressionFormulaType: z.string().optional().nullable(),
      attentionFactor: z.string().optional(),
      frequencyParam: z.string().optional(),
      distributionType: z.enum(DISTRIBUTION_TYPE_ENUM).optional(),
      defaultPessoasPorMesa: z.string().optional(),
      loopDurationSeconds: z.number().int().optional(),
      frequenciaAparicoes: z.string().optional(),
      vipProviderId: z.number().int().nullable().optional(),
      vipProviderCommissionPercent: z.string().nullable().optional(),
      locationIds: z.array(z.number().int()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, locationIds, ...data } = input;

      // Pré-validação fora da transação: produto existe? E, se vamos
      // remover vínculos via diff, há campanhas ativas que bloqueiam?
      // Falhamos cedo para nunca persistir parcialmente os campos do produto.
      const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });

      let plan: { toAdd: number[]; toRemoveIds: number[] } | null = null;
      if (locationIds !== undefined) {
        const updatedDistributionType = data.distributionType ?? current.distributionType;
        const effectiveLocationIds = updatedDistributionType === "local_especifico" ? locationIds : [];
        const existing = await db
          .select({ id: productLocations.id, restaurantId: productLocations.restaurantId })
          .from(productLocations)
          .where(eq(productLocations.productId, id));
        const existingSet = new Set(existing.map(e => e.restaurantId));
        const desiredSet = new Set(effectiveLocationIds);
        const toAdd = effectiveLocationIds.filter(rid => !existingSet.has(rid));
        const toRemoveLinks = existing.filter(e => !desiredSet.has(e.restaurantId));
        if (toRemoveLinks.length > 0) {
          const blockedNames = await findBlockingCampaignNames(
            db,
            id,
            toRemoveLinks.map(l => l.restaurantId),
          );
          if (blockedNames.length > 0) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Não é possível remover locais com campanhas ativas vinculadas (${blockedNames.join(", ")}). Use a aba "Locais" ou encerre/arquive as campanhas antes de retirar a seleção.`,
            });
          }
        }
        plan = { toAdd, toRemoveIds: toRemoveLinks.map(l => l.id) };
      }

      // Tudo validado: aplica produto + diff de locais atomicamente.
      // Diff-based sync preserva maxShares/cycleWeeks dos vínculos existentes
      // (configurados na aba "Locais").
      return await db.transaction(async (tx) => {
        const rows = await tx.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, id)).returning();
        if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
        if (plan) {
          if (plan.toRemoveIds.length > 0) {
            await tx.delete(productLocations).where(inArray(productLocations.id, plan.toRemoveIds));
          }
          if (plan.toAdd.length > 0) {
            await tx.insert(productLocations).values(
              plan.toAdd.map(restaurantId => ({ productId: id, restaurantId }))
            );
          }
        }
        return rows[0];
      });
    }),

  getLocations: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select({ restaurantId: productLocations.restaurantId })
        .from(productLocations)
        .where(eq(productLocations.productId, input.productId));
    }),

  // ── Product Locations CRUD (Marketplace v2) ─────────────────────────────────
  // Statuses considerados "ativos" — bloqueiam a remoção do vínculo
  // produto×local e contam para "shares ocupados agora".
  // Excluímos: draft, quotation, completed, archived, inativa.

  listLocations: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const today = new Date().toISOString().slice(0, 10);

      const rows = await db
        .select({
          id: productLocations.id,
          productId: productLocations.productId,
          restaurantId: productLocations.restaurantId,
          maxShares: productLocations.maxShares,
          cycleWeeks: productLocations.cycleWeeks,
          createdAt: productLocations.createdAt,
          restaurantName: activeRestaurants.name,
          neighborhood: activeRestaurants.neighborhood,
          city: activeRestaurants.city,
        })
        .from(productLocations)
        .innerJoin(activeRestaurants, eq(productLocations.restaurantId, activeRestaurants.id))
        .where(eq(productLocations.productId, input.productId))
        .orderBy(asc(activeRestaurants.name));

      if (rows.length === 0) return [];

      const occRows = await db
        .select({
          restaurantId: campaignItems.restaurantId,
          shares: sql<number>`COUNT(DISTINCT ${campaignItems.shareIndex})`.as("shares"),
        })
        .from(campaignItems)
        .innerJoin(campaignPhases, eq(campaignItems.campaignPhaseId, campaignPhases.id))
        .innerJoin(campaigns, eq(campaignPhases.campaignId, campaigns.id))
        .where(
          and(
            eq(campaignItems.productId, input.productId),
            inArray(campaignItems.restaurantId, rows.map(r => r.restaurantId)),
            sql`${campaignPhases.periodStart} <= ${today}::date`,
            sql`${campaignPhases.periodEnd} >= ${today}::date`,
            notInArray(campaigns.status, ["draft", "quotation", "completed", "archived", "inativa"]),
            sql`${campaignItems.shareIndex} IS NOT NULL`,
          )
        )
        .groupBy(campaignItems.restaurantId);

      const occMap = new Map<number, number>();
      for (const o of occRows) {
        if (o.restaurantId != null) occMap.set(o.restaurantId, Number(o.shares) || 0);
      }

      return rows.map(r => ({
        ...r,
        sharesOccupiedNow: occMap.get(r.restaurantId) ?? 0,
      }));
    }),

  addLocation: adminProcedure
    .input(z.object({
      productId: z.number().int(),
      restaurantId: z.number().int(),
      maxShares: z.number().int().min(1).default(1),
      cycleWeeks: z.number().int().min(1).default(4),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const productExists = await db.select({ id: products.id }).from(products).where(eq(products.id, input.productId)).limit(1);
      if (!productExists.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
      const restExists = await db.select({ id: activeRestaurants.id }).from(activeRestaurants).where(eq(activeRestaurants.id, input.restaurantId)).limit(1);
      if (!restExists.length) throw new TRPCError({ code: "NOT_FOUND", message: "Local não encontrado." });

      const existing = await db
        .select()
        .from(productLocations)
        .where(and(eq(productLocations.productId, input.productId), eq(productLocations.restaurantId, input.restaurantId)))
        .limit(1);
      if (existing.length) throw new TRPCError({ code: "CONFLICT", message: "Este local já está vinculado ao produto." });

      const [row] = await db.insert(productLocations).values({
        productId: input.productId,
        restaurantId: input.restaurantId,
        maxShares: input.maxShares,
        cycleWeeks: input.cycleWeeks,
      }).returning();
      return row;
    }),

  updateLocation: adminProcedure
    .input(z.object({
      id: z.number().int(),
      maxShares: z.number().int().min(1).optional(),
      cycleWeeks: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const patch: Record<string, unknown> = {};
      if (input.maxShares !== undefined) patch.maxShares = input.maxShares;
      if (input.cycleWeeks !== undefined) patch.cycleWeeks = input.cycleWeeks;
      if (Object.keys(patch).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum campo para atualizar." });
      }
      const rows = await db.update(productLocations).set(patch).where(eq(productLocations.id, input.id)).returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Vínculo não encontrado." });
      return rows[0];
    }),

  removeLocation: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [link] = await db.select().from(productLocations).where(eq(productLocations.id, input.id)).limit(1);
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Vínculo não encontrado." });

      const blockedNames = await findBlockingCampaignNames(db, link.productId, [link.restaurantId]);
      if (blockedNames.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Não é possível remover: existem campanhas ativas usando este local (${blockedNames.join(", ")}). Encerre ou arquive as campanhas antes de remover o vínculo.`,
        });
      }

      await db.delete(productLocations).where(eq(productLocations.id, input.id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.delete(products).where(eq(products.id, input.id)).returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      return rows[0];
    }),

  listTiers: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db.select().from(productPricingTiers)
        .where(eq(productPricingTiers.productId, input.productId))
        .orderBy(asc(productPricingTiers.volumeMin));
    }),

  getTiers: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db.select().from(productPricingTiers)
        .where(eq(productPricingTiers.productId, input.productId))
        .orderBy(asc(productPricingTiers.volumeMin));
    }),

  setPartnerVisibility: adminProcedure
    .input(z.object({
      productId: z.number(),
      visibleToPartners: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .update(products)
        .set({ visibleToPartners: input.visibleToPartners, updatedAt: new Date() })
        .where(eq(products.id, input.productId))
        .returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      return rows[0];
    }),

  setAdvertiserVisibility: adminProcedure
    .input(z.object({
      productId: z.number(),
      visibleToAdvertisers: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .update(products)
        .set({ visibleToAdvertisers: input.visibleToAdvertisers, updatedAt: new Date() })
        .where(eq(products.id, input.productId))
        .returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      return rows[0];
    }),

  listForPartners: adminProcedure.query(async () => {
    const db = await getDatabase();
    return db.select().from(products).where(eq(products.isActive, true)).orderBy(asc(products.name));
  }),

  upsertTiers: internalProcedure
    .input(z.object({
      productId: z.number(),
      tiers: z.array(z.object({
        id: z.number().optional(),
        volumeMin: z.number().int().min(0),
        volumeMax: z.number().int().nullable(),
        custoUnitario: z.string().default("0.0000"),
        frete: z.string().default("0.00"),
        margem: z.string().default("50.00"),
        artes: z.number().int().default(1),
        precoBase: z.string().nullable().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.transaction(async (tx) => {
        await tx.delete(productPricingTiers).where(eq(productPricingTiers.productId, input.productId));
        if (input.tiers.length > 0) {
          await tx.insert(productPricingTiers).values(
            input.tiers.map(t => ({
              productId: input.productId,
              volumeMin: t.volumeMin,
              volumeMax: t.volumeMax,
              custoUnitario: t.custoUnitario,
              frete: t.frete,
              margem: t.margem,
              artes: t.artes,
              precoBase: t.precoBase ?? null,
            }))
          );
        }
      });
      return db.select().from(productPricingTiers)
        .where(eq(productPricingTiers.productId, input.productId))
        .orderBy(asc(productPricingTiers.volumeMin));
    }),

  // ── Product Discount Price Tiers CRUD ────────────────────────────────────────

  listDiscountTiers: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db.select().from(productDiscountPriceTiers)
        .where(eq(productDiscountPriceTiers.productId, input.productId))
        .orderBy(asc(productDiscountPriceTiers.priceMin));
    }),

  upsertDiscountTiers: internalProcedure
    .input(z.object({
      productId: z.number(),
      tiers: z.array(z.object({
        priceMin: z.string(),
        priceMax: z.string(),
        discountPercent: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      for (const t of input.tiers) {
        const min = parseFloat(t.priceMin);
        const max = parseFloat(t.priceMax);
        const disc = parseFloat(t.discountPercent);
        if (isNaN(min) || isNaN(max) || isNaN(disc))
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valores de faixa inválidos." });
        if (min < 0 || max < 0)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Preço mínimo e máximo devem ser positivos." });
        if (min >= max)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Preço mínimo deve ser menor que o máximo." });
        if (disc <= 0 || disc > 100)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Desconto deve ser entre 0.01% e 100%." });
      }
      const sorted = [...input.tiers].sort((a, b) => parseFloat(a.priceMin) - parseFloat(b.priceMin));
      for (let i = 1; i < sorted.length; i++) {
        if (parseFloat(sorted[i].priceMin) <= parseFloat(sorted[i - 1].priceMax))
          throw new TRPCError({ code: "BAD_REQUEST", message: "Faixas de preço não podem se sobrepor." });
      }
      const db = await getDatabase();
      await db.transaction(async (tx) => {
        await tx.delete(productDiscountPriceTiers).where(eq(productDiscountPriceTiers.productId, input.productId));
        if (input.tiers.length > 0) {
          await tx.insert(productDiscountPriceTiers).values(
            input.tiers.map(t => ({
              productId: input.productId,
              priceMin: t.priceMin,
              priceMax: t.priceMax,
              discountPercent: t.discountPercent,
            }))
          );
        }
      });
      return db.select().from(productDiscountPriceTiers)
        .where(eq(productDiscountPriceTiers.productId, input.productId))
        .orderBy(asc(productDiscountPriceTiers.priceMin));
    }),
});
