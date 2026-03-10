import { protectedProcedure, internalProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { restaurantTerms, activeRestaurants, termAcceptances } from "../drizzle/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

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
  list: internalProcedure
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

  get: internalProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const result = await db.select().from(restaurantTerms).where(eq(restaurantTerms.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Termo não encontrado" });
      return result[0];
    }),

  create: internalProcedure
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

  update: internalProcedure
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

  delete: internalProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(restaurantTerms).where(eq(restaurantTerms.id, input.id));
      return { success: true };
    }),

  updateStatus: internalProcedure
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

  generateInvite: internalProcedure
    .input(z.object({
      id: z.number(),
      inviteEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const term = await db.select().from(restaurantTerms).where(eq(restaurantTerms.id, input.id)).limit(1);
      if (!term[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Termo não encontrado" });
      if (term[0].status === "assinado" || term[0].status === "vigente") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Termo já foi assinado" });
      }

      const token = randomUUID();
      const [updated] = await db
        .update(restaurantTerms)
        .set({
          inviteToken: token,
          inviteEmail: input.inviteEmail || null,
          status: "enviado",
          updatedAt: new Date(),
        })
        .where(eq(restaurantTerms.id, input.id))
        .returning();

      return { ...updated, inviteToken: token };
    }),

  listAcceptances: internalProcedure
    .input(z.object({
      restaurantId: z.number().optional(),
      termId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.restaurantId) conditions.push(eq(termAcceptances.restaurantId, input.restaurantId));
      if (input?.termId) conditions.push(eq(termAcceptances.termId, input.termId));

      return db
        .select()
        .from(termAcceptances)
        .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`) : undefined)
        .orderBy(desc(termAcceptances.acceptedAt));
    }),

  fixOrphanedAcceptances: internalProcedure
    .mutation(async () => {
      const db = await getDatabase();
      const { isNull } = await import("drizzle-orm");

      const orphaned = await db
        .select()
        .from(termAcceptances)
        .where(isNull(termAcceptances.termId));

      if (orphaned.length === 0) return { fixed: 0 };

      let fixed = 0;
      for (const acc of orphaned) {
        const termNumber = await generateTermNumber(db);
        const [term] = await db.insert(restaurantTerms).values({
          termNumber,
          restaurantId: acc.restaurantId,
          conditions: acc.termContent || "",
          status: "assinado",
          inviteEmail: acc.acceptedByEmail || undefined,
        }).returning();

        await db
          .update(termAcceptances)
          .set({ termId: term.id })
          .where(eq(termAcceptances.id, acc.id));

        fixed++;
      }

      return { fixed };
    }),
});
