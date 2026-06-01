import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { opportunities, partners } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createCrmNotification } from "./notificationRouter";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const opportunityRouter = router({
  list: protectedProcedure
    .input(z.object({
      stage: z.string().optional(),
      ownerId: z.string().optional(),
      clientId: z.number().optional(),
      farmingStatus: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.stage) conditions.push(sql`o."stage" = ${input.stage}`);
      if (input?.ownerId) conditions.push(sql`o."ownerId" = ${input.ownerId}`);
      if (input?.clientId) conditions.push(sql`o."clientId" = ${input.clientId}`);
      if (input?.farmingStatus) conditions.push(sql`o."farmingStatus" = ${input.farmingStatus}`);

      const whereSql = conditions.length
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      const rows = await db.execute(sql`
        SELECT o.*,
          "ow"."first_name" AS "ownerFirstName",
          "ow"."last_name" AS "ownerLastName",
          "cb"."first_name" AS "createdByFirstName",
          "cb"."last_name" AS "createdByLastName",
          "cl"."name" AS "clientName",
          "p"."name" AS "partnerName"
        FROM opportunities o
        LEFT JOIN users "ow" ON o."ownerId" = "ow"."id"
        LEFT JOIN users "cb" ON o."createdBy" = "cb"."id"
        LEFT JOIN clients "cl" ON o."clientId" = "cl"."id"
        LEFT JOIN partners "p" ON o."partnerId" = "p"."id"
        ${whereSql}
        ORDER BY o."updatedAt" DESC
      `);

      return rows.rows as any[];
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.execute(sql`
        SELECT o.*,
          "ow"."first_name" AS "ownerFirstName",
          "ow"."last_name" AS "ownerLastName",
          "cb"."first_name" AS "createdByFirstName",
          "cb"."last_name" AS "createdByLastName",
          "cl"."name" AS "clientName",
          "p"."name" AS "partnerName"
        FROM opportunities o
        LEFT JOIN users "ow" ON o."ownerId" = "ow"."id"
        LEFT JOIN users "cb" ON o."createdBy" = "cb"."id"
        LEFT JOIN clients "cl" ON o."clientId" = "cl"."id"
        LEFT JOIN partners "p" ON o."partnerId" = "p"."id"
        WHERE o."id" = ${input.id}
        LIMIT 1
      `);
      if (!rows.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Oportunidade não encontrada" });
      return rows.rows[0] as any;
    }),

  create: comercialProcedure
    .input(z.object({
      title: z.string().min(1),
      clientId: z.number().nullable().optional(),
      leadId: z.number().nullable().optional(),
      stage: z.string().default("qualificada"),
      estimatedValue: z.string().nullable().optional(),
      expectedCloseDate: z.string().nullable().optional(),
      ownerId: z.string().nullable().optional(),
      opportunityType: z.enum(["new", "upsell", "renewal"]).nullable().optional(),
      revenueType: z.enum(["mrr", "oneshot"]).nullable().optional(),
      praca: z.enum(["manaus", "rio", "ambas"]).nullable().optional(),
      source: z.string().nullable().optional(),
      partnerId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();

      const [created] = await db.insert(opportunities).values({
        title: input.title,
        clientId: input.clientId ?? null,
        leadId: input.leadId ?? null,
        stage: input.stage,
        estimatedValue: input.estimatedValue ?? null,
        expectedCloseDate: input.expectedCloseDate ?? null,
        ownerId: input.ownerId ?? ctx.user?.id ?? null,
        opportunityType: input.opportunityType ?? null,
        revenueType: input.revenueType ?? null,
        praca: input.praca ?? null,
        source: input.source ?? null,
        partnerId: input.partnerId ?? null,
        createdBy: ctx.user?.id ?? null,
      }).returning();

      if (created.partnerId) {
        const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, created.partnerId)).limit(1);
        const partnerLabel = partner?.name || `Parceiro #${created.partnerId}`;
        await createCrmNotification(db, {
          eventType: "opportunity_created",
          leadId: created.leadId ?? null,
          clientId: created.clientId ?? null,
          partnerId: created.partnerId,
          message: `Nova oportunidade indicada por ${partnerLabel}: ${created.title}`,
        });
      }

      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      clientId: z.number().nullable().optional(),
      leadId: z.number().nullable().optional(),
      stage: z.string().optional(),
      estimatedValue: z.string().nullable().optional(),
      expectedCloseDate: z.string().nullable().optional(),
      ownerId: z.string().nullable().optional(),
      opportunityType: z.enum(["new", "upsell", "renewal"]).nullable().optional(),
      revenueType: z.enum(["mrr", "oneshot"]).nullable().optional(),
      praca: z.enum(["manaus", "rio", "ambas"]).nullable().optional(),
      lossReason: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      farmingStatus: z.enum(["ativo", "pausado"]).nullable().optional(),
      farmingTags: z.string().nullable().optional(),
      partnerId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(opportunities)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(opportunities.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Oportunidade não encontrada" });
      return updated;
    }),

  changeStage: comercialProcedure
    .input(z.object({
      id: z.number(),
      stage: z.string(),
      lossReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(opportunities)
        .set({
          stage: input.stage,
          ...(input.stage === "perdida" && input.lossReason ? { lossReason: input.lossReason } : {}),
          updatedAt: new Date(),
        })
        .where(eq(opportunities.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Oportunidade não encontrada" });

      await createCrmNotification(db, {
        eventType: "opportunity_stage_changed",
        leadId: updated.leadId ?? null,
        clientId: updated.clientId ?? null,
        partnerId: updated.partnerId ?? null,
        message: `Oportunidade ${updated.title} avançou para: ${input.stage}`,
      });

      return updated;
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(opportunities).where(eq(opportunities.id, input.id));
      return { success: true };
    }),
});
