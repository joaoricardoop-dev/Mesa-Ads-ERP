import { protectedProcedure, adminProcedure, internalProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { products, productPricingTiers } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const TIPO_ENUM = ["impressos", "eletronicos", "telas"] as const;

export const productRouter = router({
  // ── Product CRUD ─────────────────────────────────────────────────────────────
  list: protectedProcedure.query(async () => {
    const db = await getDatabase();
    return db.select().from(products).orderBy(asc(products.name));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.select().from(products).where(eq(products.id, input.id));
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      return rows[0];
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      tipo: z.enum(TIPO_ENUM).default("impressos"),
      temDistribuicaoPorLocal: z.boolean().default(true),
      imagemUrl: z.string().optional(),
      unitLabel: z.string().min(1).default("unidade"),
      unitLabelPlural: z.string().min(1).default("unidades"),
      defaultQtyPerLocation: z.number().int().min(1).default(500),
      defaultSemanas: z.number().int().default(12),
      irpj: z.string().default("6.00"),
      comRestaurante: z.string().default("15.00"),
      comComercial: z.string().default("10.00"),
      pricingMode: z.enum(["cost_based", "price_based"]).default("cost_based"),
      entryType: z.enum(["tiers", "fixed_quantities"]).default("tiers"),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.insert(products).values(input).returning();
      return rows[0];
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      tipo: z.enum(TIPO_ENUM).optional(),
      temDistribuicaoPorLocal: z.boolean().optional(),
      imagemUrl: z.string().optional(),
      unitLabel: z.string().min(1).optional(),
      unitLabelPlural: z.string().min(1).optional(),
      defaultQtyPerLocation: z.number().int().min(1).optional(),
      defaultSemanas: z.number().int().optional(),
      irpj: z.string().optional(),
      comRestaurante: z.string().optional(),
      comComercial: z.string().optional(),
      pricingMode: z.enum(["cost_based", "price_based"]).optional(),
      entryType: z.enum(["tiers", "fixed_quantities"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const rows = await db.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, id)).returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      return rows[0];
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
});
