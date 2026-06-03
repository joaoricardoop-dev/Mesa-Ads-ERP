import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { opportunities, partners, leads, quotations } from "../drizzle/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createCrmNotification } from "./notificationRouter";
import { ensureContact } from "./contactSync";
import { toCsv } from "./_core/csv";
import { getActiveConfigCodes } from "./configOptionRouter";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

/**
 * Propaga o contato do lead vinculado a uma oportunidade para o diretório
 * unificado de `contacts`, linkando por clientId (quando a oportunidade tem
 * anunciante) e por leadId. Idempotente via `ensureContact`.
 */
async function syncOpportunityContact(db: any, opp: { leadId?: number | null; clientId?: number | null }) {
  if (!opp.leadId && !opp.clientId) return;
  let name: string | null | undefined;
  let email: string | null | undefined;
  let phone: string | null | undefined;
  let role: string | null | undefined;
  if (opp.leadId) {
    const [lead] = await db
      .select({
        name: leads.name,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        contactPhone: leads.contactPhone,
        contactWhatsApp: leads.contactWhatsApp,
        cargo: leads.cargo,
      })
      .from(leads)
      .where(eq(leads.id, opp.leadId))
      .limit(1);
    if (lead && (lead.contactName || lead.contactEmail || lead.contactPhone || lead.contactWhatsApp)) {
      name = lead.contactName || lead.name;
      email = lead.contactEmail || undefined;
      phone = lead.contactPhone || lead.contactWhatsApp || undefined;
      role = lead.cargo || undefined;
    }
  }
  if (!name && !email && !phone) return;
  if (opp.clientId) {
    await ensureContact({ clientId: opp.clientId, name, email, phone, role, primaryIfFirst: true });
  }
  if (opp.leadId) {
    await ensureContact({ leadId: opp.leadId, name, email, phone, role, primaryIfFirst: true });
  }
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

  exportCsv: protectedProcedure
    .input(z.object({
      stage: z.string().optional(),
      ownerId: z.string().optional(),
      clientId: z.number().optional(),
      farmingStatus: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.stage) conditions.push(sql`o."stage" = ${input.stage}`);
      if (input?.ownerId) conditions.push(sql`o."ownerId" = ${input.ownerId}`);
      if (input?.clientId) conditions.push(sql`o."clientId" = ${input.clientId}`);
      if (input?.farmingStatus) conditions.push(sql`o."farmingStatus" = ${input.farmingStatus}`);
      if (input?.dateFrom) conditions.push(sql`o."createdAt" >= ${input.dateFrom}`);
      if (input?.dateTo) conditions.push(sql`o."createdAt" < (${input.dateTo}::date + interval '1 day')`);
      const whereSql = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT o.*,
          "ow"."first_name" AS "ownerFirstName",
          "ow"."last_name" AS "ownerLastName",
          "cl"."name" AS "clientName",
          "p"."name" AS "partnerName"
        FROM opportunities o
        LEFT JOIN users "ow" ON o."ownerId" = "ow"."id"
        LEFT JOIN clients "cl" ON o."clientId" = "cl"."id"
        LEFT JOIN partners "p" ON o."partnerId" = "p"."id"
        ${whereSql}
        ORDER BY o."createdAt" DESC
      `);

      const headers = ["ID", "Título", "Anunciante", "Estágio", "Valor estimado", "Tipo", "Receita", "Praça", "Responsável", "Parceiro", "Farming", "Tags farming", "Fechamento previsto", "Criado em"];
      const data = (rows.rows as any[]).map((r) => [
        r.id,
        r.title,
        r.clientName,
        r.stage,
        r.estimatedValue,
        r.opportunityType,
        r.revenueType,
        r.praca,
        [r.ownerFirstName, r.ownerLastName].filter(Boolean).join(" "),
        r.partnerName,
        r.farmingStatus,
        r.farmingTags,
        r.expectedCloseDate ? new Date(r.expectedCloseDate).toLocaleDateString("pt-BR") : "",
        r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "",
      ]);
      return { filename: `oportunidades-${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(headers, data) };
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
      quotationIds: z.array(z.number()).optional(),
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

      try {
        await syncOpportunityContact(db, { leadId: created.leadId, clientId: created.clientId });
      } catch (err) {
        console.error("Failed to sync contact on opportunity create:", err);
      }

      if (input.quotationIds && input.quotationIds.length > 0) {
        // Só vincula cotações que pertençam ao mesmo anunciante/lead da
        // oportunidade — evita vínculos cruzados via IDs forjados/obsoletos.
        const ownerCondition = created.clientId != null
          ? eq(quotations.clientId, created.clientId)
          : created.leadId != null
            ? eq(quotations.leadId, created.leadId)
            : null;
        if (ownerCondition) {
          await db
            .update(quotations)
            .set({ opportunityId: created.id, updatedAt: new Date() })
            .where(and(inArray(quotations.id, input.quotationIds), ownerCondition));
        }
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
      lossReasonNotes: z.string().nullable().optional(),
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

      try {
        await syncOpportunityContact(db, { leadId: updated.leadId, clientId: updated.clientId });
      } catch (err) {
        console.error("Failed to sync contact on opportunity update:", err);
      }

      return updated;
    }),

  changeStage: comercialProcedure
    .input(z.object({
      id: z.number(),
      stage: z.string(),
      lossReason: z.string().optional(),
      lossReasonNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      if (input.stage === "perdida") {
        const validCodes = await getActiveConfigCodes("loss_reason");
        if (!input.lossReason || !validCodes.has(input.lossReason)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um motivo de perda válido" });
        }
      }
      const [updated] = await db
        .update(opportunities)
        .set({
          stage: input.stage,
          ...(input.stage === "perdida" && input.lossReason
            ? { lossReason: input.lossReason, lossReasonNotes: input.lossReasonNotes ?? null }
            : {}),
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

  reactivate: comercialProcedure
    .input(z.object({
      id: z.number(),
      stage: z.string().default("qualificada"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(opportunities)
        .set({
          farmingStatus: null,
          farmingTags: null,
          stage: input.stage,
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
        message: `Oportunidade ${updated.title} reativada do farming para: ${input.stage}`,
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
