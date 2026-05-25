import { getDb } from "../db";
import { leads, leadInteractions, crmNotifications } from "../../drizzle/schema";
import { and, eq, lte, sql } from "drizzle-orm";
import {
  LEAD_SLA_REASSIGN_DAYS,
  LEAD_SLA_STAGE,
  LEAD_SLA_WARNING_DAYS,
  resolveLeadSlaFallbackUserId,
} from "../_core/leadSlaConfig";

export const LEAD_SLA_EVENT_WARNING = "lead_sla_warning";
export const LEAD_SLA_EVENT_REASSIGN = "lead_sla_reassign";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type LeadRow = {
  id: number;
  name: string;
  company: string | null;
  assignedTo: string | null;
  updatedAt: Date;
};

function leadLabel(row: LeadRow) {
  return row.company?.trim() || row.name;
}

function daysSince(date: Date, now: number) {
  return Math.floor((now - date.getTime()) / ONE_DAY_MS);
}

/**
 * Roda o sweep de SLA de leads em `novo`:
 *  - >= 7 dias parados → notificação CRM ao `assignedTo` (idempotente por
 *    leadId + eventType dentro da janela atual de estagnação).
 *  - >= 14 dias parados → reatribui pro fallback user + grava interação
 *    + notificação CRM. Não reatribui se já está com o fallback.
 *
 * Idempotência: usamos `createdAt >= lead.updatedAt` na busca por notificações
 * existentes. Quando o lead é tocado (reassign, nota, mudança de stage), o
 * updatedAt avança e o ciclo recomeça naturalmente.
 */
export async function runLeadSlaSweep(now: Date = new Date()): Promise<{
  warned: number;
  reassigned: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[LeadSLA] Database indisponível, pulando sweep.");
    return { warned: 0, reassigned: 0 };
  }

  const nowMs = now.getTime();
  const warnCutoff = new Date(nowMs - LEAD_SLA_WARNING_DAYS * ONE_DAY_MS);
  const reassignCutoff = new Date(nowMs - LEAD_SLA_REASSIGN_DAYS * ONE_DAY_MS);

  const stagnantLeads = (await db
    .select({
      id: leads.id,
      name: leads.name,
      company: leads.company,
      assignedTo: leads.assignedTo,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.stage, LEAD_SLA_STAGE),
        lte(leads.updatedAt, warnCutoff),
      ),
    )) as LeadRow[];

  if (stagnantLeads.length === 0) {
    return { warned: 0, reassigned: 0 };
  }

  const fallbackUserId = await resolveLeadSlaFallbackUserId();
  let warned = 0;
  let reassigned = 0;

  for (const lead of stagnantLeads) {
    const days = daysSince(lead.updatedAt, nowMs);
    const isReassignDue =
      lead.updatedAt.getTime() <= reassignCutoff.getTime();
    const label = leadLabel(lead);

    // Warning (idempotente por janela de estagnação)
    const existingWarning = await db
      .select({ id: crmNotifications.id })
      .from(crmNotifications)
      .where(
        and(
          eq(crmNotifications.leadId, lead.id),
          eq(crmNotifications.eventType, LEAD_SLA_EVENT_WARNING),
          sql`${crmNotifications.createdAt} >= ${lead.updatedAt}`,
        ),
      )
      .limit(1);

    if (existingWarning.length === 0) {
      try {
        // Insert direto (sem swallow) — se falhar, propaga pro catch
        // externo e *não* incrementamos warned nem gravamos interação.
        await db.insert(crmNotifications).values({
          eventType: LEAD_SLA_EVENT_WARNING,
          leadId: lead.id,
          partnerId: null,
          campaignId: null,
          clientId: null,
          message: `Lead ${label} parado há ${days} dias${
            lead.assignedTo ? "" : " (sem responsável)"
          }.`,
        });
        await db.insert(leadInteractions).values({
          leadId: lead.id,
          type: "note",
          content: `[SLA] Alerta: lead parado há ${days} dias na etapa "${LEAD_SLA_STAGE}".`,
          contactedBy: lead.assignedTo ?? null,
        });
        warned += 1;
      } catch (err) {
        console.error(`[LeadSLA] Falha ao gravar warning do lead #${lead.id}:`, err);
      }
    }

    // Reassign (idempotente: skipa se já está com fallback ou se já houve
    // reassign nessa janela)
    if (!isReassignDue) continue;
    if (!fallbackUserId) continue;
    if (lead.assignedTo === fallbackUserId) continue;

    const existingReassign = await db
      .select({ id: crmNotifications.id })
      .from(crmNotifications)
      .where(
        and(
          eq(crmNotifications.leadId, lead.id),
          eq(crmNotifications.eventType, LEAD_SLA_EVENT_REASSIGN),
          sql`${crmNotifications.createdAt} >= ${lead.updatedAt}`,
        ),
      )
      .limit(1);

    if (existingReassign.length > 0) continue;

    const previousAssignee = lead.assignedTo ?? "—";
    try {
      await db
        .update(leads)
        .set({ assignedTo: fallbackUserId, updatedAt: new Date(nowMs) })
        .where(eq(leads.id, lead.id));

      await db.insert(crmNotifications).values({
        eventType: LEAD_SLA_EVENT_REASSIGN,
        leadId: lead.id,
        partnerId: null,
        campaignId: null,
        clientId: null,
        message: `Lead ${label} reatribuído após ${days} dias parado (responsável anterior: ${previousAssignee}).`,
      });

      await db.insert(leadInteractions).values({
        leadId: lead.id,
        type: "note",
        content: `[SLA] Reatribuído automaticamente após ${days} dias: ${previousAssignee} → ${fallbackUserId}.`,
        contactedBy: fallbackUserId,
      });

      reassigned += 1;
    } catch (err) {
      console.error(`[LeadSLA] Falha ao reatribuir lead #${lead.id}:`, err);
    }
  }

  return { warned, reassigned };
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startLeadSlaScheduler() {
  if (process.env.DISABLE_LEAD_SLA_JOB === "1") {
    console.log("[LeadSLA] Scheduler desabilitado via DISABLE_LEAD_SLA_JOB=1.");
    return;
  }
  if (scheduledTimer) return;

  const tick = async () => {
    try {
      const result = await runLeadSlaSweep();
      if (result.warned || result.reassigned) {
        console.log(
          `[LeadSLA] Sweep concluído: ${result.warned} avisos, ${result.reassigned} reatribuições.`,
        );
      }
    } catch (err) {
      console.error("[LeadSLA] Erro durante sweep:", err);
    }
  };

  // Roda 30s após boot (deixa migrations terminarem) e depois a cada 24h.
  setTimeout(tick, 30_000);
  scheduledTimer = setInterval(tick, ONE_DAY_MS);
}

export function stopLeadSlaScheduler() {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
