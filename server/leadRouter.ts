import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { leads, leadInteractions, clients, partners, opportunities } from "../drizzle/schema";
import { users } from "../shared/models/auth";
import { eq, desc, and, ne, sql, or, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createCrmNotification } from "./notificationRouter";
import { sendEmail } from "./email";
import { ensureContact } from "./contactSync";
import { toCsv } from "./_core/csv";
import { getMissingHandoffLabels } from "../shared/handoff-checklist";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const leadRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.enum(["anunciante", "restaurante"]).optional(),
      stage: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.type) conditions.push(eq(leads.type, input.type));
      if (input?.stage) conditions.push(eq(leads.stage, input.stage));

      const rows = await db.execute(sql`
        SELECT l.*,
          "cb"."first_name" AS "createdByFirstName",
          "cb"."last_name" AS "createdByLastName",
          "at"."first_name" AS "assignedToFirstName",
          "at"."last_name" AS "assignedToLastName",
          "cl"."name" AS "clientName",
          "p"."name" AS "partnerName"
        FROM leads l
        LEFT JOIN users "cb" ON l."createdBy" = "cb"."id"
        LEFT JOIN users "at" ON l."assignedTo" = "at"."id"
        LEFT JOIN clients "cl" ON l."client_id" = "cl"."id"
        LEFT JOIN partners "p" ON l."partnerId" = "p"."id"
        ${input?.type ? sql`WHERE l."type" = ${input.type}` : sql``}
        ${input?.type && input?.stage ? sql`AND l."stage" = ${input.stage}` : !input?.type && input?.stage ? sql`WHERE l."stage" = ${input.stage}` : sql``}
        ORDER BY l."updatedAt" DESC
      `);

      return rows.rows as any[];
    }),

  exportCsv: protectedProcedure
    .input(z.object({
      type: z.enum(["anunciante", "restaurante"]).optional(),
      stage: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.type) conditions.push(sql`l."type" = ${input.type}`);
      if (input?.stage) conditions.push(sql`l."stage" = ${input.stage}`);
      if (input?.dateFrom) conditions.push(sql`l."createdAt" >= ${input.dateFrom}`);
      if (input?.dateTo) conditions.push(sql`l."createdAt" < (${input.dateTo}::date + interval '1 day')`);
      const whereSql = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT l.*,
          "at"."first_name" AS "assignedToFirstName",
          "at"."last_name" AS "assignedToLastName",
          "cl"."name" AS "clientName",
          "p"."name" AS "partnerName"
        FROM leads l
        LEFT JOIN users "at" ON l."assignedTo" = "at"."id"
        LEFT JOIN clients "cl" ON l."client_id" = "cl"."id"
        LEFT JOIN partners "p" ON l."partnerId" = "p"."id"
        ${whereSql}
        ORDER BY l."createdAt" DESC
      `);

      const headers = ["ID", "Tipo", "Nome", "Empresa", "CNPJ", "Estágio", "Contato", "Telefone", "E-mail", "Origem", "Cidade/UF", "Responsável", "Parceiro", "Criado em"];
      const data = (rows.rows as any[]).map((r) => [
        r.id,
        r.type,
        r.name,
        r.company,
        r.cnpj,
        r.stage,
        r.contactName,
        r.contactPhone,
        r.contactEmail,
        r.origin,
        [r.city, r.state].filter(Boolean).join("/"),
        [r.assignedToFirstName, r.assignedToLastName].filter(Boolean).join(" "),
        r.partnerName,
        r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "",
      ]);
      return { filename: `leads-${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(headers, data) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.execute(sql`
        SELECT l.*,
          "cb"."first_name" AS "createdByFirstName",
          "cb"."last_name" AS "createdByLastName",
          "at"."first_name" AS "assignedToFirstName",
          "at"."last_name" AS "assignedToLastName",
          "cl"."name" AS "clientName",
          "p"."name" AS "partnerName"
        FROM leads l
        LEFT JOIN users "cb" ON l."createdBy" = "cb"."id"
        LEFT JOIN users "at" ON l."assignedTo" = "at"."id"
        LEFT JOIN clients "cl" ON l."client_id" = "cl"."id"
        LEFT JOIN partners "p" ON l."partnerId" = "p"."id"
        WHERE l."id" = ${input.id}
        LIMIT 1
      `);
      if (!rows.rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      return rows.rows[0] as any;
    }),

  create: comercialProcedure
    .input(z.object({
      type: z.enum(["anunciante", "restaurante"]),
      name: z.string().min(1),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      razaoSocial: z.string().optional(),
      address: z.string().optional(),
      addressNumber: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      contactWhatsApp: z.string().optional(),
      instagram: z.string().optional(),
      origin: z.string().optional(),
      stage: z.string().default("novo"),
      assignedTo: z.string().optional(),
      nextFollowUp: z.string().optional(),
      tags: z.string().optional(),
      notes: z.string().optional(),
      opportunityType: z.enum(["new", "upsell"]).optional(),
      revenueType: z.enum(["mrr", "oneshot"]).optional(),
      clientId: z.number().optional(),
      partnerId: z.number().nullable().optional(),
      cargo: z.string().optional(),
      decisionRole: z.enum(["decisor", "influenciador"]).optional(),
      produtoInteresse: z.string().optional(),
      praca: z.enum(["manaus", "rio", "ambas"]).optional(),
      budgetEstimado: z.string().optional(),
      timing: z.string().optional(),
      objecoes: z.string().optional(),
      meetingScheduledAt: z.string().optional(),
      meetingLink: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      const { meetingScheduledAt, ...restInput } = input;

      let autoClientId = input.clientId;
      let autoOpportunityType = input.opportunityType;

      if (autoClientId && !autoOpportunityType) {
        autoOpportunityType = "upsell";
      }

      if (!autoClientId && input.type === "anunciante") {
        const cleanCnpj = input.cnpj?.replace(/\D/g, "");
        if (cleanCnpj && cleanCnpj.length === 14) {
          const [cnpjMatch] = await db
            .select({ id: clients.id })
            .from(clients)
            .where(sql`regexp_replace(${clients.cnpj}, '[^0-9]', '', 'g') = ${cleanCnpj}`)
            .limit(1);
          if (cnpjMatch) {
            autoClientId = cnpjMatch.id;
            autoOpportunityType = autoOpportunityType || "upsell";
          }
        }
        if (!autoClientId && input.company && input.company.trim()) {
          const [nameMatch] = await db
            .select({ id: clients.id })
            .from(clients)
            .where(ilike(clients.name, `%${input.company.trim()}%`))
            .orderBy(clients.id)
            .limit(1);
          if (nameMatch) {
            autoClientId = nameMatch.id;
            autoOpportunityType = autoOpportunityType || "upsell";
          }
        }
      }

      if (!autoOpportunityType) {
        autoOpportunityType = "new";
      }

      const [created] = await db.insert(leads).values({
        ...restInput,
        meetingScheduledAt: meetingScheduledAt ? new Date(meetingScheduledAt) : null,
        clientId: autoClientId,
        opportunityType: autoOpportunityType,
        createdBy: ctx.user?.id || null,
        assignedTo: input.assignedTo || ctx.user?.id || null,
      }).returning();

      if (created.partnerId) {
        const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, created.partnerId)).limit(1);
        const leadLabel = created.company || created.name;
        const partnerLabel = partner?.name || `Parceiro #${created.partnerId}`;
        await createCrmNotification(db, {
          eventType: "lead_created",
          leadId: created.id,
          partnerId: created.partnerId,
          message: `Novo lead indicado por ${partnerLabel}: ${leadLabel}`,
        });
      }

      try {
        if (created.contactName || created.contactEmail || created.contactPhone || created.contactWhatsApp) {
          await ensureContact({
            leadId: created.id,
            name: created.contactName || created.name,
            email: created.contactEmail || undefined,
            phone: created.contactPhone || created.contactWhatsApp || undefined,
            role: created.cargo || undefined,
            primaryIfFirst: true,
          });
        }
      } catch (err) {
        console.error("Failed to sync contact on lead create:", err);
      }

      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      type: z.enum(["anunciante", "restaurante"]).optional(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      razaoSocial: z.string().optional(),
      address: z.string().optional(),
      addressNumber: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      contactWhatsApp: z.string().optional(),
      instagram: z.string().optional(),
      origin: z.string().optional(),
      stage: z.string().optional(),
      assignedTo: z.string().nullable().optional(),
      nextFollowUp: z.string().nullable().optional(),
      tags: z.string().optional(),
      notes: z.string().optional(),
      opportunityType: z.enum(["new", "upsell"]).nullable().optional(),
      revenueType: z.enum(["mrr", "oneshot"]).nullable().optional(),
      clientId: z.number().nullable().optional(),
      partnerId: z.number().nullable().optional(),
      convertedToId: z.number().optional(),
      convertedToType: z.string().optional(),
      cargo: z.string().nullable().optional(),
      decisionRole: z.enum(["decisor", "influenciador"]).nullable().optional(),
      produtoInteresse: z.string().nullable().optional(),
      praca: z.enum(["manaus", "rio", "ambas"]).nullable().optional(),
      budgetEstimado: z.string().nullable().optional(),
      timing: z.string().nullable().optional(),
      objecoes: z.string().nullable().optional(),
      meetingScheduledAt: z.string().nullable().optional(),
      meetingLink: z.string().nullable().optional(),
      disqualifyReason: z.enum(["sem_budget", "sem_autoridade", "timing", "sem_fit"]).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, meetingScheduledAt, ...data } = input;
      const [updated] = await db
        .update(leads)
        .set({
          ...data,
          ...(meetingScheduledAt !== undefined
            ? { meetingScheduledAt: meetingScheduledAt ? new Date(meetingScheduledAt) : null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });

      try {
        if (updated.contactName || updated.contactEmail || updated.contactPhone || updated.contactWhatsApp) {
          await ensureContact({
            leadId: updated.id,
            name: updated.contactName || updated.name,
            email: updated.contactEmail || undefined,
            phone: updated.contactPhone || updated.contactWhatsApp || undefined,
            role: updated.cargo || undefined,
            primaryIfFirst: true,
          });
        }
      } catch (err) {
        console.error("Failed to sync contact on lead update:", err);
      }

      return updated;
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(leadInteractions).where(eq(leadInteractions.leadId, input.id));
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),

  changeStage: comercialProcedure
    .input(z.object({
      id: z.number(),
      stage: z.string(),
      disqualifyReason: z.enum(["sem_budget", "sem_autoridade", "timing", "sem_fit"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(leads)
        .set({
          stage: input.stage,
          ...(input.stage === "desqualificado" && input.disqualifyReason
            ? { disqualifyReason: input.disqualifyReason }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });

      const DISQUALIFY_LABELS: Record<string, string> = {
        sem_budget: "Sem budget",
        sem_autoridade: "Sem autoridade",
        timing: "Timing",
        sem_fit: "Sem fit",
      };
      const stageNote =
        input.stage === "desqualificado" && input.disqualifyReason
          ? `Estágio alterado para: ${input.stage} (motivo: ${DISQUALIFY_LABELS[input.disqualifyReason] ?? input.disqualifyReason})`
          : `Estágio alterado para: ${input.stage}`;

      await db.insert(leadInteractions).values({
        leadId: input.id,
        type: "note",
        content: stageNote,
      });

      const leadLabel = updated.company || updated.name;
      if (updated.partnerId) {
        const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, updated.partnerId)).limit(1);
        const partnerLabel = partner?.name || `Parceiro #${updated.partnerId}`;
        await createCrmNotification(db, {
          eventType: "stage_changed",
          leadId: updated.id,
          partnerId: updated.partnerId,
          message: `Lead ${leadLabel} (${partnerLabel}) avançou para: ${input.stage}`,
        });
      } else {
        await createCrmNotification(db, {
          eventType: "stage_changed",
          leadId: updated.id,
          partnerId: null,
          message: `Lead ${leadLabel} avançou para: ${input.stage}`,
        });
      }

      return updated;
    }),

  handoffToCloser: comercialProcedure
    .input(z.object({
      leadId: z.number(),
      closerId: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();

      const [lead] = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });

      const [closer] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, isCloser: users.isCloser, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, input.closerId))
        .limit(1);
      if (!closer) throw new TRPCError({ code: "NOT_FOUND", message: "Closer não encontrado" });
      if (!closer.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Closer inativo não pode receber handoff." });
      if (!closer.isCloser) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário selecionado não tem a tag Closer." });

      const leadLabel = lead.company || lead.name;
      const pracaValue = (lead.praca === "manaus" || lead.praca === "rio" || lead.praca === "ambas")
        ? lead.praca
        : null;

      const [opportunity] = await db.insert(opportunities).values({
        title: leadLabel,
        clientId: lead.clientId ?? null,
        leadId: lead.id,
        stage: "qualificada",
        ownerId: closer.id,
        opportunityType: (lead.opportunityType as any) ?? null,
        revenueType: (lead.revenueType as any) ?? null,
        praca: pracaValue,
        source: lead.origin ?? null,
        partnerId: lead.partnerId ?? null,
        createdBy: ctx.user?.id ?? null,
      }).returning();

      const [updatedLead] = await db
        .update(leads)
        .set({
          stage: "qualificado_handoff",
          convertedToType: "opportunity",
          convertedToId: opportunity.id,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id))
        .returning();

      const sdrName = [ctx.user?.firstName, ctx.user?.lastName].filter(Boolean).join(" ") || "SDR";
      const closerName = [closer.firstName, closer.lastName].filter(Boolean).join(" ") || "closer";

      const missingHandoffLabels = getMissingHandoffLabels(lead);
      const missingSummary = missingHandoffLabels.join(", ");
      const pendingNote = missingHandoffLabels.length > 0
        ? ` — passado com informações faltando: ${missingSummary}`
        : "";

      await db.insert(leadInteractions).values({
        leadId: lead.id,
        type: "note",
        content: `Lead qualificado por ${sdrName} → handoff para closer ${closerName} (oportunidade #${opportunity.id})${pendingNote}`,
      });

      await createCrmNotification(db, {
        eventType: "lead_qualified_handoff",
        leadId: lead.id,
        clientId: lead.clientId ?? null,
        partnerId: lead.partnerId ?? null,
        message: `Lead ${leadLabel} qualificado por ${sdrName} → atribuído a ${closerName}${pendingNote}`,
      });

      if (closer.email) {
        const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
        const meetingInfo = lead.meetingScheduledAt
          ? new Date(lead.meetingScheduledAt).toLocaleString("pt-BR")
          : "—";
        const html = `
          <div style="font-family: sans-serif; color: #0a0a0c;">
            <h2>Novo lead qualificado para você</h2>
            <p><strong>${fmt(leadLabel)}</strong> foi qualificado por ${fmt(sdrName)} e atribuído a você como closer.</p>
            ${missingHandoffLabels.length > 0 ? `<p style="background:#fff4e5;border:1px solid #ffb74d;border-radius:8px;padding:12px;color:#7a4f01;"><strong>⚠ Passado com informações faltando:</strong> ${fmt(missingSummary)}. Cobre esses dados com o SDR.</p>` : ""}
            <h3>Resumo BANT</h3>
            <ul>
              <li><strong>Contato:</strong> ${fmt(lead.contactName || lead.name)} ${lead.cargo ? `(${fmt(lead.cargo)})` : ""}</li>
              <li><strong>Papel na decisão:</strong> ${fmt(lead.decisionRole)}</li>
              <li><strong>Produto de interesse:</strong> ${fmt(lead.produtoInteresse)}</li>
              <li><strong>Praça:</strong> ${fmt(lead.praca)}</li>
              <li><strong>Budget estimado:</strong> ${fmt(lead.budgetEstimado)}</li>
              <li><strong>Timing:</strong> ${fmt(lead.timing)}</li>
              <li><strong>Objeções:</strong> ${fmt(lead.objecoes)}</li>
            </ul>
            <h3>Reunião</h3>
            <p><strong>Agendada para:</strong> ${meetingInfo}</p>
            ${lead.meetingLink ? `<p><strong>Link:</strong> <a href="${fmt(lead.meetingLink)}">${fmt(lead.meetingLink)}</a></p>` : ""}
            <p style="margin-top:16px;color:#666;">Oportunidade #${opportunity.id} criada no estágio "qualificada".</p>
          </div>
        `;
        await sendEmail({
          to: closer.email,
          subject: `Novo lead qualificado: ${leadLabel}`,
          html,
        });
      }

      return { opportunity, lead: updatedLead };
    }),

  listInteractions: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select()
        .from(leadInteractions)
        .where(eq(leadInteractions.leadId, input.leadId))
        .orderBy(desc(leadInteractions.createdAt));
    }),

  addInteraction: comercialProcedure
    .input(z.object({
      leadId: z.number(),
      type: z.string(),
      content: z.string().optional(),
      contactedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [created] = await db.insert(leadInteractions).values(input).returning();

      await db
        .update(leads)
        .set({ updatedAt: new Date() })
        .where(eq(leads.id, input.leadId));

      return created;
    }),

  listUsers: protectedProcedure
    .query(async () => {
      const db = await getDatabase();
      const result = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          email: users.email,
          isSdr: users.isSdr,
          isCloser: users.isCloser,
        })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          ne(users.role, "anunciante")
        ));
      return result;
    }),

  listClosers: protectedProcedure
    .query(async () => {
      const db = await getDatabase();
      const result = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          email: users.email,
          isSdr: users.isSdr,
          isCloser: users.isCloser,
        })
        .from(users)
        .where(and(
          eq(users.isActive, true),
          eq(users.isCloser, true)
        ));
      return result;
    }),
});
