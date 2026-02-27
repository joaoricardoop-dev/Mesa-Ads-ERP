import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { libraryItems, campaigns, clients } from "../drizzle/schema";
import { eq, desc, sql, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const libraryRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      campaignId: z.number().optional(),
      clientId: z.number().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.campaignId) conditions.push(eq(libraryItems.campaignId, input.campaignId));
      if (input?.clientId) conditions.push(eq(libraryItems.clientId, input.clientId));
      if (input?.status) conditions.push(eq(libraryItems.status, input.status));
      if (input?.search) {
        conditions.push(
          or(
            sql`${libraryItems.title} ILIKE ${'%' + input.search + '%'}`,
            sql`${libraryItems.tags} ILIKE ${'%' + input.search + '%'}`
          )!
        );
      }

      const rows = await db
        .select()
        .from(libraryItems)
        .where(conditions.length > 0 ? sql`${conditions.reduce((acc, c, i) => i === 0 ? c : sql`${acc} AND ${c}`)}` : undefined)
        .orderBy(desc(libraryItems.createdAt));

      const campaignIds = Array.from(new Set(rows.map(r => r.campaignId).filter((v): v is number => v != null)));
      const clientIds = Array.from(new Set(rows.map(r => r.clientId).filter((v): v is number => v != null)));

      const campaignMap: Record<number, string> = {};
      const clientMap: Record<number, string> = {};

      if (campaignIds.length > 0) {
        const campRows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, campaignIds));
        for (const c of campRows) campaignMap[c.id] = c.name;
      }
      if (clientIds.length > 0) {
        const cliRows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds));
        for (const c of cliRows) clientMap[c.id] = c.name;
      }

      return rows.map(r => ({
        ...r,
        campaignName: r.campaignId ? (campaignMap[r.campaignId] || "—") : "—",
        clientName: r.clientId ? (clientMap[r.clientId] || "—") : "—",
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const result = await db.select().from(libraryItems).where(eq(libraryItems.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      return result[0];
    }),

  create: protectedProcedure
    .input(z.object({
      campaignId: z.number().optional(),
      clientId: z.number().optional(),
      title: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      artPdfUrl: z.string().optional(),
      artImageUrls: z.string().optional(),
      tags: z.string().optional(),
      status: z.string().optional(),
      metrics: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [created] = await db.insert(libraryItems).values(input).returning();
      return created;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      artPdfUrl: z.string().optional(),
      artImageUrls: z.string().optional(),
      tags: z.string().optional(),
      status: z.string().optional(),
      metrics: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(libraryItems)
        .set(data)
        .where(eq(libraryItems.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(libraryItems).where(eq(libraryItems.id, input.id));
      return { success: true };
    }),
});
