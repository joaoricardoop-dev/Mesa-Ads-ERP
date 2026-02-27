import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { restaurantTerms, activeRestaurants } from "../drizzle/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

async function generateTermNumber(db: any) {
  const year = new Date().getFullYear();
  const pattern = `TRM-${year}-%`;
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(restaurantTerms)
    .where(sql`${restaurantTerms.termNumber} LIKE ${pattern}`);
  const seqNum = Number(countResult[0]?.count || 0) + 1;
  return `TRM-${year}-${String(seqNum).padStart(4, "0")}`;
}

export const termRouter = router({
  list: protectedProcedure
    .input(z.object({
      restaurantId: z.number().optional(),
      status: z.enum(["rascunho", "enviado", "assinado", "vigente", "encerrado"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.restaurantId) conditions.push(eq(restaurantTerms.restaurantId, input.restaurantId));
      if (input?.status) conditions.push(eq(restaurantTerms.status, input.status));

      const rows = await db
        .select()
        .from(restaurantTerms)
        .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) : undefined)
        .orderBy(desc(restaurantTerms.createdAt));

      const restaurantIds = Array.from(new Set(rows.map(r => r.restaurantId)));
      const restMap: Record<number, string> = {};

      if (restaurantIds.length > 0) {
        const restRows = await db.select({ id: activeRestaurants.id, name: activeRestaurants.name }).from(activeRestaurants).where(inArray(activeRestaurants.id, restaurantIds));
        for (const r of restRows) restMap[r.id] = r.name;
      }

      return rows.map(r => ({
        ...r,
        restaurantName: restMap[r.restaurantId] || "—",
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const result = await db.select().from(restaurantTerms).where(eq(restaurantTerms.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Termo não encontrado" });
      return result[0];
    }),

  create: protectedProcedure
    .input(z.object({
      restaurantId: z.number(),
      conditions: z.string().optional(),
      remunerationRule: z.string().optional(),
      allowedCategories: z.string().optional(),
      blockedCategories: z.string().optional(),
      restaurantObligations: z.string().optional(),
      mesaObligations: z.string().optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const termNumber = await generateTermNumber(db);
      const [created] = await db.insert(restaurantTerms).values({
        ...input,
        termNumber,
      }).returning();
      return created;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      conditions: z.string().optional(),
      remunerationRule: z.string().optional(),
      allowedCategories: z.string().optional(),
      blockedCategories: z.string().optional(),
      restaurantObligations: z.string().optional(),
      mesaObligations: z.string().optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
      status: z.enum(["rascunho", "enviado", "assinado", "vigente", "encerrado"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(restaurantTerms)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(restaurantTerms.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Termo não encontrado" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(restaurantTerms).where(eq(restaurantTerms.id, input.id));
      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["rascunho", "enviado", "assinado", "vigente", "encerrado"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(restaurantTerms)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(restaurantTerms.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Termo não encontrado" });
      return updated;
    }),
});
