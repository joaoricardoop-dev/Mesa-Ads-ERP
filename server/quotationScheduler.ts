import { getDb } from "./db";
import { quotations, crmNotifications, clients, leads } from "../drizzle/schema";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import {
  QUOTATION_AUTO_EXPIRE_DAYS,
  QUOTATION_PRE_EXPIRE_WARNING_DAYS,
  QUOTATION_OPEN_STATUSES,
} from "../shared/commercial-config";
import { LOSS_REASON_AUTO_EXPIRED } from "../shared/loss-reasons";

const PRE_EXPIRE_EVENT_PREFIX = "quotation_pre_expire";

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

function startOfDayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  const d = startOfDayUtc();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function runQuotationExpirationJob(): Promise<{
  expired: number;
  warnings: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[QuotationScheduler] Database unavailable, skipping run.");
    return { expired: 0, warnings: 0 };
  }

  const openStatuses = QUOTATION_OPEN_STATUSES as readonly string[];
  const expireCutoff = daysAgo(QUOTATION_AUTO_EXPIRE_DAYS);
  const warnCutoff = daysAgo(QUOTATION_AUTO_EXPIRE_DAYS - QUOTATION_PRE_EXPIRE_WARNING_DAYS);

  // 1) Auto-expirar cotações abertas com idade > QUOTATION_AUTO_EXPIRE_DAYS.
  //    Idempotente: o WHERE filtra por status aberto, então a 2ª rodada não
  //    pega as mesmas linhas.
  const expiredRows = await db
    .update(quotations)
    .set({
      status: "expirada",
      lossReason: LOSS_REASON_AUTO_EXPIRED,
      lossReasonNotes: sql`COALESCE(${quotations.lossReasonNotes}, '') || CASE WHEN COALESCE(${quotations.lossReasonNotes}, '') = '' THEN '' ELSE E'\n' END || ${`[Auto-expiração] Cotação expirada automaticamente após ${QUOTATION_AUTO_EXPIRE_DAYS} dias sem fechamento.`}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(quotations.status, openStatuses as any),
        lt(quotations.createdAt, expireCutoff),
      ),
    )
    .returning({ id: quotations.id });

  // 2) Avisar 5 dias antes da auto-expiração.
  //    Cotações abertas com createdAt entre (expireCutoff, warnCutoff].
  //    Idempotência: filtramos as que já têm notificação `quotation_pre_expire:<id>`.
  const dueForWarning = await db
    .select({
      id: quotations.id,
      quotationNumber: quotations.quotationNumber,
      createdBy: quotations.createdBy,
      leadId: quotations.leadId,
      clientId: quotations.clientId,
    })
    .from(quotations)
    .where(
      and(
        inArray(quotations.status, openStatuses as any),
        lt(quotations.createdAt, warnCutoff),
        // ainda não passou do cutoff de expiração (essas viraram expiradas em #1)
        sql`${quotations.createdAt} >= ${expireCutoff}`,
      ),
    );

  // Resiliência a FKs órfãs (Task #399): cotações antigas podem apontar para
  // clients/leads já removidos; o insert em crm_notifications violaria a FK e
  // abortava o job inteiro. Validamos as referências em lote e, para IDs
  // órfãos, inserimos com NULL (mantém a notificação, sem FK inválida).
  const clientIds = Array.from(new Set(dueForWarning.map((q) => q.clientId).filter((v): v is number => v != null)));
  const leadIds = Array.from(new Set(dueForWarning.map((q) => q.leadId).filter((v): v is number => v != null)));
  const validClientIds = new Set(
    clientIds.length > 0
      ? (await db.select({ id: clients.id }).from(clients).where(inArray(clients.id, clientIds))).map((r) => r.id)
      : [],
  );
  const validLeadIds = new Set(
    leadIds.length > 0
      ? (await db.select({ id: leads.id }).from(leads).where(inArray(leads.id, leadIds))).map((r) => r.id)
      : [],
  );

  let warningsCreated = 0;
  for (const q of dueForWarning) {
    const eventType = `${PRE_EXPIRE_EVENT_PREFIX}:${q.id}`;
    try {
      const existing = await db
        .select({ id: crmNotifications.id })
        .from(crmNotifications)
        .where(eq(crmNotifications.eventType, eventType))
        .limit(1);
      if (existing.length > 0) continue;

      const safeClientId = q.clientId != null && validClientIds.has(q.clientId) ? q.clientId : null;
      const safeLeadId = q.leadId != null && validLeadIds.has(q.leadId) ? q.leadId : null;
      if (q.clientId != null && safeClientId == null) {
        console.warn(`[QuotationScheduler] cotação ${q.quotationNumber} (id=${q.id}) referencia clientId=${q.clientId} inexistente — notificando sem vínculo de cliente.`);
      }
      if (q.leadId != null && safeLeadId == null) {
        console.warn(`[QuotationScheduler] cotação ${q.quotationNumber} (id=${q.id}) referencia leadId=${q.leadId} inexistente — notificando sem vínculo de lead.`);
      }

      await db.insert(crmNotifications).values({
        eventType,
        leadId: safeLeadId,
        clientId: safeClientId,
        // userId = dono da cotação → notificação aparece só pra ele na
        // listagem admin (NULL = broadcast). Se a cotação não tem createdBy
        // (legado pré-Sprint 1), cai pro broadcast clássico.
        userId: q.createdBy ?? null,
        message: `Cotação ${q.quotationNumber} vai expirar em ${QUOTATION_PRE_EXPIRE_WARNING_DAYS} dias — reaja para não perder o lead.`,
      });
      warningsCreated++;
    } catch (err) {
      // Última linha de defesa: qualquer erro nesta notificação (ex.: outra
      // FK órfã, race com deleção) é logado e o loop continua — uma cotação
      // problemática não pode mais abortar o job inteiro.
      console.error(`[QuotationScheduler] falha ao criar aviso de pré-expiração para cotação id=${q.id} — pulando:`, err);
    }
  }

  console.log(
    `[QuotationScheduler] run done — expired=${expiredRows.length} warnings=${warningsCreated}`,
  );
  return { expired: expiredRows.length, warnings: warningsCreated };
}

let timer: NodeJS.Timeout | null = null;

export function startQuotationScheduler() {
  if (timer) return;
  // Roda 1x ao subir, depois 1x por dia. Erros são logados mas não derrubam
  // o processo.
  const tick = () => {
    runQuotationExpirationJob().catch((err) => {
      console.error("[QuotationScheduler] run failed:", err);
    });
  };
  // Pequeno delay para não competir com migrations no boot.
  setTimeout(tick, 30 * 1000);
  timer = setInterval(tick, RUN_INTERVAL_MS);
}
