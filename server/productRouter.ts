import { protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { products, productPricingTiers } from "../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const productRouter = router({
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
      unitLabel: z.string().min(1).default("unidade"),
      unitLabelPlural: z.string().min(1).default("unidades"),
      defaultQtyPerLocation: z.number().int().min(1).default(500),
      irpj: z.string().default("6.00"),
      comRestaurante: z.string().default("15.00"),
      comComercial: z.string().default("10.00"),
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
      unitLabel: z.string().min(1).optional(),
      unitLabelPlural: z.string().min(1).optional(),
      defaultQtyPerLocation: z.number().int().min(1).optional(),
      irpj: z.string().optional(),
      comRestaurante: z.string().optional(),
      comComercial: z.string().optional(),
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

  upsertTiers: protectedProcedure
    .input(z.object({
      productId: z.number(),
      tiers: z.array(z.object({
        id: z.number().optional(),
        volumeMin: z.number().int().min(0),
        volumeMax: z.number().int().nullable(),
        custoUnitario: z.string(),
        frete: z.string(),
        margem: z.string().default("50.00"),
        artes: z.number().int().default(1),
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
            }))
          );
        }
      });
      return db.select().from(productPricingTiers)
        .where(eq(productPricingTiers.productId, input.productId))
        .orderBy(asc(productPricingTiers.volumeMin));
    }),
});
