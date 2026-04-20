import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { seasonalMultipliers, products, activeRestaurants } from "../drizzle/schema";
import { and, eq, ne, asc, desc, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

type Db = Awaited<ReturnType<typeof getDatabase>>;

function parseDate(s: string): Date {
  const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: `Data inválida: ${s}` });
  return d;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return parseDate(aStart) <= parseDate(bEnd) && parseDate(bStart) <= parseDate(aEnd);
}

async function ensureNoOverlap(
  db: Db,
  data: { productId: number; restaurantId: number | null; startDate: string; endDate: string },
  ignoreId?: number,
) {
  const conditions = [eq(seasonalMultipliers.productId, data.productId)];
  if (data.restaurantId == null) {
    conditions.push(isNull(seasonalMultipliers.restaurantId));
  } else {
    conditions.push(eq(seasonalMultipliers.restaurantId, data.restaurantId));
  }
  const rows = await db.select().from(seasonalMultipliers).where(and(...conditions));
  for (const row of rows) {
    if (ignoreId && row.id === ignoreId) continue;
    if (rangesOverlap(data.startDate, data.endDate, row.startDate, row.endDate)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Já existe multiplicador "${row.seasonLabel}" (${row.startDate} → ${row.endDate}) sobreposto para esta combinação de produto/local.`,
      });
    }
  }
}

const baseInput = z.object({
  productId: z.number().int().positive(),
  restaurantId: z.number().int().positive().nullable().optional(),
  seasonLabel: z.string().min(1).max(100),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  multiplier: z.string().min(1),
});

export const seasonalMultiplierRouter = router({
  list: adminProcedure
    .input(z.object({
      productId: z.number().int().optional(),
      restaurantId: z.number().int().nullable().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions: Array<ReturnType<typeof eq> | ReturnType<typeof isNull>> = [];
      if (input?.productId != null) conditions.push(eq(seasonalMultipliers.productId, input.productId));
      if (input?.restaurantId !== undefined) {
        if (input.restaurantId === null) conditions.push(isNull(seasonalMultipliers.restaurantId));
        else conditions.push(eq(seasonalMultipliers.restaurantId, input.restaurantId));
      }
      const rows = await db
        .select({
          id: seasonalMultipliers.id,
          productId: seasonalMultipliers.productId,
          restaurantId: seasonalMultipliers.restaurantId,
          seasonLabel: seasonalMultipliers.seasonLabel,
          startDate: seasonalMultipliers.startDate,
          endDate: seasonalMultipliers.endDate,
          multiplier: seasonalMultipliers.multiplier,
          createdAt: seasonalMultipliers.createdAt,
          productName: products.name,
          restaurantName: activeRestaurants.name,
        })
        .from(seasonalMultipliers)
        .leftJoin(products, eq(seasonalMultipliers.productId, products.id))
        .leftJoin(activeRestaurants, eq(seasonalMultipliers.restaurantId, activeRestaurants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(seasonalMultipliers.startDate));
      return rows;
    }),

  create: adminProcedure.input(baseInput).mutation(async ({ input }) => {
    const db = await getDatabase();
    if (parseDate(input.startDate) > parseDate(input.endDate)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Data inicial deve ser anterior ou igual à data final." });
    }
    const mult = parseFloat(input.multiplier);
    if (!isFinite(mult) || mult <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Multiplicador deve ser maior que zero." });
    }
    const restaurantId = input.restaurantId ?? null;
    await ensureNoOverlap(db, { ...input, restaurantId });
    const [row] = await db.insert(seasonalMultipliers).values({
      productId: input.productId,
      restaurantId,
      seasonLabel: input.seasonLabel,
      startDate: input.startDate,
      endDate: input.endDate,
      multiplier: input.multiplier,
    }).returning();
    return row;
  }),

  update: adminProcedure
    .input(baseInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      if (parseDate(input.startDate) > parseDate(input.endDate)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Data inicial deve ser anterior ou igual à data final." });
      }
      const mult = parseFloat(input.multiplier);
      if (!isFinite(mult) || mult <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Multiplicador deve ser maior que zero." });
      }
      const restaurantId = input.restaurantId ?? null;
      await ensureNoOverlap(db, { ...input, restaurantId }, input.id);
      const [row] = await db.update(seasonalMultipliers)
        .set({
          productId: input.productId,
          restaurantId,
          seasonLabel: input.seasonLabel,
          startDate: input.startDate,
          endDate: input.endDate,
          multiplier: input.multiplier,
        })
        .where(eq(seasonalMultipliers.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Multiplicador não encontrado" });
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.delete(seasonalMultipliers).where(eq(seasonalMultipliers.id, input.id)).returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Multiplicador não encontrado" });
      return rows[0];
    }),

  // Usado pelo CampaignBuilder para aplicar multiplicadores sazonais ao
  // calcular o preço estimado em tempo real.
  forBuilder: protectedProcedure
    .input(z.object({
      productIds: z.array(z.number().int()).min(1),
    }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select({
          id: seasonalMultipliers.id,
          productId: seasonalMultipliers.productId,
          restaurantId: seasonalMultipliers.restaurantId,
          seasonLabel: seasonalMultipliers.seasonLabel,
          startDate: seasonalMultipliers.startDate,
          endDate: seasonalMultipliers.endDate,
          multiplier: seasonalMultipliers.multiplier,
        })
        .from(seasonalMultipliers)
        .where(sql`${seasonalMultipliers.productId} = ANY(${input.productIds})`);
      return rows;
    }),
});
