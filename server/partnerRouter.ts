import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { partners, leads, quotations, campaigns, clients } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const partnerRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "inactive"]).optional(),
      type: z.enum(["agencia", "indicador", "consultor"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.status) conditions.push(eq(partners.status, input.status));
      if (input?.type) conditions.push(eq(partners.type, input.type));

      const rows = await db
        .select()
        .from(partners)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(partners.createdAt));

      const result = await Promise.all(rows.map(async (p) => {
        const leadsCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(leads)
          .where(eq(leads.partnerId, p.id));
        const quotationsCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(quotations)
          .where(eq(quotations.partnerId, p.id));
        return {
          ...p,
          leadsCount: Number(leadsCount[0]?.count || 0),
          quotationsCount: Number(quotationsCount[0]?.count || 0),
        };
      }));

      return result;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [partner] = await db
        .select()
        .from(partners)
        .where(eq(partners.id, input.id))
        .limit(1);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado" });
      return partner;
    }),

  create: comercialProcedure
    .input(z.object({
      name: z.string().min(1),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      type: z.enum(["agencia", "indicador", "consultor"]).default("indicador"),
      commissionPercent: z.string().default("10.00"),
      status: z.enum(["active", "inactive"]).default("active"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [created] = await db.insert(partners).values(input).returning();
      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      type: z.enum(["agencia", "indicador", "consultor"]).optional(),
      commissionPercent: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(partners)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(partners.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado" });
      return updated;
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(partners).where(eq(partners.id, input.id));
      return { success: true };
    }),

  getLeads: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.execute(sql`
        SELECT l.*,
          "cl"."name" AS "clientName"
        FROM leads l
        LEFT JOIN clients "cl" ON l."client_id" = "cl"."id"
        WHERE l."partnerId" = ${input.partnerId}
        ORDER BY l."updatedAt" DESC
      `);
      return rows.rows as any[];
    }),

  getQuotations: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          quotationName: quotations.quotationName,
          clientId: quotations.clientId,
          leadId: quotations.leadId,
          coasterVolume: quotations.coasterVolume,
          totalValue: quotations.totalValue,
          status: quotations.status,
          createdAt: quotations.createdAt,
          clientName: clients.name,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .where(eq(quotations.partnerId, input.partnerId))
        .orderBy(desc(quotations.createdAt));
      return rows;
    }),

  getRevenue: protectedProcedure
    .input(z.object({ partnerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const wonQuotations = await db
        .select({
          totalValue: quotations.totalValue,
        })
        .from(quotations)
        .where(and(
          eq(quotations.partnerId, input.partnerId),
          eq(quotations.status, "win"),
        ));

      const totalRevenue = wonQuotations.reduce((sum, q) => sum + Number(q.totalValue || 0), 0);

      const activeCampaignsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM campaigns c
        INNER JOIN quotations q ON c."quotationId" = q."id"
        WHERE q."partnerId" = ${input.partnerId}
        AND c."status" IN ('active', 'veiculacao', 'executar', 'producao', 'transito')
      `);
      const activeCampaigns = Number((activeCampaignsResult.rows[0] as any)?.count || 0);

      return { totalRevenue, activeCampaigns };
    }),
});
