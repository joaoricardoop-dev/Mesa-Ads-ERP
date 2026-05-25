import { comercialProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { TRPCError } from "@trpc/server";
import { sql, eq, and, inArray, isNotNull, desc, asc } from "drizzle-orm";
import { quotations, leads, partners, clients } from "../drizzle/schema";
import { users } from "../shared/models/auth";
import { LOSS_REASON_CODES, LOSS_REASON_LABELS, type LossReasonCode } from "../shared/loss-reasons";
import { computePartnerHealth } from "./partnerRouter";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const periodInput = z.object({
  days: z.union([z.literal(30), z.literal(90), z.literal(180)]).default(90),
});

const TERMINAL_STATUSES = ["win", "perdida", "expirada"] as const;
const OPEN_STATUSES = ["rascunho", "enviada", "ativa", "os_gerada"] as const;

export const comercialDashboardRouter = router({
  funnel: comercialProcedure
    .input(periodInput)
    .query(async ({ input }) => {
      const db = await getDatabase();
      const days = input.days;

      // Counts no período: leads criados, cotações criadas, terminais.
      // Bonificadas são excluídas dos contadores de cotação (alinha com KPIs).
      const counts = await db.execute(sql`
        WITH
        leads_window AS (
          SELECT id, "createdAt" FROM leads
           WHERE "createdAt" >= NOW() - (${days} || ' days')::interval
        ),
        quotations_window AS (
          SELECT id, status, "createdAt", "updatedAt", "totalValue", "leadId"
            FROM quotations
           WHERE "createdAt" >= NOW() - (${days} || ' days')::interval
             AND COALESCE("isBonificada", false) = false
        )
        SELECT
          (SELECT COUNT(*) FROM leads_window)::int AS leads_count,
          (SELECT COUNT(*) FROM quotations_window WHERE status <> 'rascunho')::int AS sent_count,
          (SELECT COUNT(*) FROM quotations_window WHERE status = 'win')::int AS win_count,
          (SELECT COUNT(*) FROM quotations_window WHERE status = 'perdida')::int AS lost_count,
          (SELECT COUNT(*) FROM quotations_window WHERE status = 'expirada')::int AS expired_count,
          (SELECT COALESCE(SUM("totalValue"::numeric),0) FROM quotations_window WHERE status = 'win')::float AS win_value,
          (SELECT COALESCE(SUM("totalValue"::numeric),0) FROM quotations_window WHERE status = 'perdida')::float AS lost_value,
          (SELECT COALESCE(SUM("totalValue"::numeric),0) FROM quotations_window WHERE status = 'expirada')::float AS expired_value
      `);

      const c = (counts.rows[0] || {}) as any;
      const leadsCount = Number(c.leads_count || 0);
      const sentCount = Number(c.sent_count || 0);
      const winCount = Number(c.win_count || 0);
      const lostCount = Number(c.lost_count || 0);
      const expiredCount = Number(c.expired_count || 0);
      const closedCount = winCount + lostCount + expiredCount;

      // Tempos médios (em dias):
      // - leadToQuotation: lead.createdAt → primeira cotação do lead (em quotations_window)
      // - quotationToWin / Lost / Expired: createdAt → updatedAt da cotação
      const timings = await db.execute(sql`
        WITH first_quot AS (
          SELECT l.id AS lead_id,
                 MIN(q."createdAt") AS first_quot_at,
                 MIN(l."createdAt") AS lead_at
            FROM leads l
            JOIN quotations q ON q."leadId" = l.id
           WHERE l."createdAt" >= NOW() - (${days} || ' days')::interval
             AND COALESCE(q."isBonificada", false) = false
           GROUP BY l.id
        )
        SELECT
          (SELECT AVG(EXTRACT(EPOCH FROM (first_quot_at - lead_at)) / 86400.0)
             FROM first_quot)::float AS avg_lead_to_quot,
          (SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400.0)
             FROM quotations
            WHERE status = 'win'
              AND "createdAt" >= NOW() - (${days} || ' days')::interval
              AND COALESCE("isBonificada", false) = false)::float AS avg_quot_to_win,
          (SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400.0)
             FROM quotations
            WHERE status = 'perdida'
              AND "createdAt" >= NOW() - (${days} || ' days')::interval
              AND COALESCE("isBonificada", false) = false)::float AS avg_quot_to_lost,
          (SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400.0)
             FROM quotations
            WHERE status = 'expirada'
              AND "createdAt" >= NOW() - (${days} || ' days')::interval
              AND COALESCE("isBonificada", false) = false)::float AS avg_quot_to_expired
      `);
      const t = (timings.rows[0] || {}) as any;

      return {
        days,
        counts: {
          leads: leadsCount,
          quotationsSent: sentCount,
          win: winCount,
          lost: lostCount,
          expired: expiredCount,
          closed: closedCount,
        },
        values: {
          win: Number(c.win_value || 0),
          lost: Number(c.lost_value || 0),
          expired: Number(c.expired_value || 0),
        },
        conversion: {
          leadToQuotation: leadsCount > 0 ? sentCount / leadsCount : 0,
          quotationToWin: sentCount > 0 ? winCount / sentCount : 0,
          closedWinRate: closedCount > 0 ? winCount / closedCount : 0,
        },
        avgDays: {
          leadToQuotation: t.avg_lead_to_quot != null ? Number(t.avg_lead_to_quot) : null,
          quotationToWin: t.avg_quot_to_win != null ? Number(t.avg_quot_to_win) : null,
          quotationToLost: t.avg_quot_to_lost != null ? Number(t.avg_quot_to_lost) : null,
          quotationToExpired: t.avg_quot_to_expired != null ? Number(t.avg_quot_to_expired) : null,
        },
      };
    }),

  lossReasons: comercialProcedure
    .input(periodInput)
    .query(async ({ input }) => {
      const db = await getDatabase();
      const days = input.days;

      // Inclui perdida + expirada (rollup). Bonificadas fora.
      const rows = await db.execute(sql`
        SELECT
          COALESCE(NULLIF("lossReason", ''), 'sem_motivo') AS reason,
          status,
          COUNT(*)::int AS count,
          COALESCE(SUM("totalValue"::numeric), 0)::float AS lost_value
          FROM quotations
         WHERE status IN ('perdida', 'expirada')
           AND "createdAt" >= NOW() - (${days} || ' days')::interval
           AND COALESCE("isBonificada", false) = false
         GROUP BY 1, 2
         ORDER BY count DESC
      `);

      // Agrega por motivo (somando perdida + expirada).
      type LossItem = { reason: string; label: string; count: number; lostValue: number; byStatus: Record<string, number> };
      const map = new Map<string, LossItem>();
      for (const r of rows.rows as any[]) {
        const reason = String(r.reason);
        const label = (LOSS_REASON_LABELS as any)[reason] || (reason === "sem_motivo" ? "Sem motivo informado" : reason);
        const existing: LossItem = map.get(reason) || { reason, label, count: 0, lostValue: 0, byStatus: {} };
        existing.count += Number(r.count || 0);
        existing.lostValue += Number(r.lost_value || 0);
        const statusKey = String(r.status);
        existing.byStatus[statusKey] = (existing.byStatus[statusKey] || 0) + Number(r.count || 0);
        map.set(reason, existing);
      }

      const items = Array.from(map.values()).sort((a, b) => b.lostValue - a.lostValue || b.count - a.count);
      const totalCount = items.reduce((s, i) => s + i.count, 0);
      const totalValue = items.reduce((s, i) => s + i.lostValue, 0);

      return { days, items, totalCount, totalValue };
    }),

  activePipeline: comercialProcedure
    .input(periodInput)
    .query(async ({ input }) => {
      const db = await getDatabase();
      const sinceMs = Date.now() - input.days * 86_400_000;
      const since = new Date(sinceMs);

      const rows = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          quotationName: quotations.quotationName,
          status: quotations.status,
          totalValue: quotations.totalValue,
          createdAt: quotations.createdAt,
          createdBy: quotations.createdBy,
          isBonificada: quotations.isBonificada,
          clientName: clients.name,
          clientCompany: clients.company,
          leadName: leads.name,
          leadCompany: leads.company,
          ownerFirstName: users.firstName,
          ownerLastName: users.lastName,
          ownerEmail: users.email,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .leftJoin(leads, eq(quotations.leadId, leads.id))
        .leftJoin(users, eq(quotations.createdBy, users.id))
        .where(and(
          inArray(quotations.status, OPEN_STATUSES as unknown as any),
          sql`${quotations.createdAt} >= ${since}`,
        ))
        .orderBy(asc(quotations.createdAt));

      const now = Date.now();
      const items = rows.map((r) => {
        const ageDays = Math.floor((now - new Date(r.createdAt).getTime()) / 86_400_000);
        const ownerName = [r.ownerFirstName, r.ownerLastName].filter(Boolean).join(" ").trim()
          || r.ownerEmail || (r.createdBy ? `Usuário ${r.createdBy}` : "Sem responsável");
        const ownerId = r.createdBy || "_none";
        return {
          ...r,
          ageDays,
          ownerId,
          ownerName,
          targetLabel: r.clientName || r.clientCompany || r.leadCompany || r.leadName || "—",
        };
      });

      // Agrupa por owner.
      const groupsMap = new Map<string, { ownerId: string; ownerName: string; items: typeof items; total: number; maxAge: number }>();
      for (const it of items) {
        const g = groupsMap.get(it.ownerId) || { ownerId: it.ownerId, ownerName: it.ownerName, items: [], total: 0, maxAge: 0 };
        g.items.push(it);
        g.total += 1;
        if (it.ageDays > g.maxAge) g.maxAge = it.ageDays;
        groupsMap.set(it.ownerId, g);
      }
      const groups = Array.from(groupsMap.values())
        .map((g) => ({ ...g, items: g.items.sort((a, b) => b.ageDays - a.ageDays) }))
        .sort((a, b) => b.maxAge - a.maxAge);

      return { totalOpen: items.length, groups };
    }),

  partnerHealth: comercialProcedure
    .input(periodInput)
    .query(async ({ input }) => {
      const db = await getDatabase();
      const list = await db
        .select({ id: partners.id, name: partners.name, type: partners.type, status: partners.status })
        .from(partners)
        .where(eq(partners.status, "active"));

      const enriched = await Promise.all(list.map(async (p) => {
        const health = await computePartnerHealth(db, p.id, input.days);
        return { ...p, health };
      }));

      // Ordena por conversionRate desc, depois leads desc.
      enriched.sort((a, b) => {
        if (b.health.conversionRate !== a.health.conversionRate) return b.health.conversionRate - a.health.conversionRate;
        return b.health.totalLeads - a.health.totalLeads;
      });

      return { days: input.days, partners: enriched };
    }),
});
