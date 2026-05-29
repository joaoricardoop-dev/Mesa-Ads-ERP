// Task #197 — Cronograma de pagamento configurável (cotação ↔ campanha).
import { z } from "zod";
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, comercialProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  billingScheduleItems,
  quotations,
  campaigns,
  campaignPhases,
  campaignItems,
  invoices,
} from "../drizzle/schema";
import {
  suggestBillingSchedule,
  scheduleMatchesTotal,
  sumSchedule,
  type BillingScheduleSuggestion,
  addDaysIso,
  DEFAULT_DUE_OFFSET_DAYS,
} from "../shared/billingSchedule";
import { recordAudit } from "./finance/audit";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB indisponível" });
  return d;
}

const QUOTATION_EDITABLE_STATUSES = new Set(["rascunho", "enviada", "ativa"]);

const itemInput = z.object({
  sequence: z.number().int().min(1),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Valor inválido"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  notes: z.string().nullable().optional(),
});

export async function readBillingSchedule(
  db: any,
  ownerType: "quotation" | "campaign",
  ownerId: number,
) {
  return db
    .select()
    .from(billingScheduleItems)
    .where(and(
      eq(billingScheduleItems.ownerType, ownerType),
      eq(billingScheduleItems.ownerId, ownerId),
    ))
    .orderBy(asc(billingScheduleItems.sequence));
}

/**
 * Substitui (full-replace) o cronograma de uma cotação ou campanha.
 * Reaplica unique (ownerType, ownerId, sequence) — deleta tudo e reinsere.
 */
export async function replaceBillingSchedule(
  db: any,
  ownerType: "quotation" | "campaign",
  ownerId: number,
  items: Array<{ sequence: number; amount: string; dueDate: string; notes?: string | null }>,
) {
  await db.transaction(async (tx: any) => {
    await tx
      .delete(billingScheduleItems)
      .where(and(
        eq(billingScheduleItems.ownerType, ownerType),
        eq(billingScheduleItems.ownerId, ownerId),
      ));
    if (items.length > 0) {
      // Task #197 — preserva sequences originais (NÃO reindexar). Sequence
      // é a chave que liga parcelas → invoices `PREV-{campaignId}-{seq}`,
      // então renumerar quebraria o lock de invoices terminais existentes.
      const sorted = [...items].sort((a, b) => a.sequence - b.sequence);
      const seen = new Set<number>();
      for (const it of sorted) {
        if (!Number.isInteger(it.sequence) || it.sequence < 1) {
          throw new Error(`Sequence inválido (${it.sequence}) — deve ser inteiro >= 1`);
        }
        if (seen.has(it.sequence)) {
          throw new Error(`Sequence duplicado (${it.sequence}) — cada parcela precisa de número único`);
        }
        seen.add(it.sequence);
      }
      const normalized = sorted.map((it) => ({
        ownerType,
        ownerId,
        sequence: it.sequence,
        amount: it.amount,
        dueDate: it.dueDate,
        notes: it.notes ?? null,
      }));
      await tx.insert(billingScheduleItems).values(normalized);
    }
  });
}

/**
 * Garante schedule default para uma cotação (1 parcela = totalValue, due+15d
 * a partir de periodStart ou hoje). Idempotente: se já existe, no-op.
 */
export async function ensureDefaultQuotationSchedule(
  db: any,
  quotationId: number,
) {
  const [q] = await db
    .select({
      id: quotations.id,
      totalValue: quotations.totalValue,
      periodStart: quotations.periodStart,
      isBonificada: quotations.isBonificada,
    })
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);
  if (!q) return;
  if (q.isBonificada) return;
  const existing = await readBillingSchedule(db, "quotation", quotationId);
  if (existing.length > 0) return;
  const total = parseFloat(q.totalValue ?? "0");
  if (!isFinite(total) || total <= 0) return;
  // Task #197 — mirror legacy: 1 parcela por ciclo (4 semanas), due = start+15d.
  // Quando a cotação tem N ciclos definidos, gera N parcelas com valor
  // distribuído proporcionalmente (cotação não tem itens por ciclo, então
  // split equal por ciclo é o melhor proxy do legado).
  const qFull = await db
    .select({ cycles: quotations.cycles, batchWeeks: quotations.batchWeeks })
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);
  const cyclesCount = Math.max(1, qFull[0]?.cycles ?? 1);
  const weeks = qFull[0]?.batchWeeks ?? 4;
  const phases = cyclesCount > 1 && q.periodStart
    ? Array.from({ length: cyclesCount }).map((_, i) => ({
        sequence: i + 1,
        label: `Batch ${i + 1}`,
        periodStart: addDaysIso(q.periodStart!, i * weeks * 7),
      }))
    : undefined;
  const suggestion = suggestBillingSchedule({
    totalValue: total,
    periodStart: q.periodStart ?? null,
    phases,
  });
  if (suggestion.length === 0) return;
  await replaceBillingSchedule(db, "quotation", quotationId, suggestion);
}

/**
 * Task #218 — Reconcilia os vencimentos do schedule de uma cotação para
 * acompanhar um novo `periodStart`, preservando a quantidade de parcelas, os
 * valores e o espaçamento relativo entre elas. Só atua quando algum
 * vencimento está incoerente (anterior ao início do período), deslocando todas
 * as parcelas pelo mesmo delta de dias para que a primeira parcela vença em
 * `periodStart + DEFAULT_DUE_OFFSET_DAYS`. Idempotente: se todos os
 * vencimentos já são coerentes, é no-op (não mexe em schedules customizados
 * que já estão alinhados ao período).
 */
export async function reconcileQuotationScheduleDueDates(
  db: any,
  quotationId: number,
  periodStart: string | null | undefined,
): Promise<{ reconciled: boolean }> {
  if (!periodStart || periodStart.length < 10) return { reconciled: false };
  const existing = await readBillingSchedule(db, "quotation", quotationId);
  if (existing.length === 0) return { reconciled: false };

  // Só reconcilia se houver vencimento anterior ao início do período.
  const hasIncoherent = existing.some((r: any) => r.dueDate < periodStart);
  if (!hasIncoherent) return { reconciled: false };

  const sorted = [...existing].sort((a: any, b: any) => a.sequence - b.sequence);
  // Âncora no vencimento MAIS CEDO (não no menor sequence). Sequence e ordem
  // cronológica podem divergir em schedules customizados; deslocar pelo delta
  // do menor sequence deixaria outra parcela ainda antes do início. Anchorar
  // no mínimo garante que TODAS as parcelas fiquem >= periodStart após o shift.
  const earliestDue = existing.reduce(
    (min: string, r: any) => (r.dueDate < min ? r.dueDate : min),
    existing[0].dueDate as string,
  );
  const targetEarliestDue = addDaysIso(periodStart, DEFAULT_DUE_OFFSET_DAYS);
  const deltaDays = Math.round(
    (Date.parse(`${targetEarliestDue}T00:00:00Z`) - Date.parse(`${earliestDue}T00:00:00Z`)) / 86_400_000,
  );
  if (deltaDays === 0) return { reconciled: false };

  const items = sorted.map((r: any) => ({
    sequence: r.sequence,
    amount: r.amount,
    dueDate: addDaysIso(r.dueDate, deltaDays),
    notes: r.notes,
  }));
  await replaceBillingSchedule(db, "quotation", quotationId, items);
  return { reconciled: true };
}

/**
 * Copia o schedule de uma cotação para a campanha gerada. Se a cotação não
 * tem schedule, sintetiza o default usando as fases recém-criadas (uma
 * parcela por fase, due = periodStart+15d, valor pelo somatório dos itens
 * da fase). Idempotente: se a campanha já tem schedule, no-op.
 */
export async function seedCampaignScheduleFromQuotation(
  db: any,
  args: { quotationId: number; campaignId: number },
): Promise<{ items: Array<{ sequence: number; amount: string; dueDate: string; notes: string | null }>; source: "quotation" | "phases" | "single" }> {
  const existingCampaign = await readBillingSchedule(db, "campaign", args.campaignId);
  if (existingCampaign.length > 0) {
    return {
      items: existingCampaign.map((r: any) => ({ sequence: r.sequence, amount: r.amount, dueDate: r.dueDate, notes: r.notes })),
      source: "quotation",
    };
  }

  const fromQuot = await readBillingSchedule(db, "quotation", args.quotationId);
  if (fromQuot.length > 0) {
    const items = fromQuot.map((r: any, i: number) => ({
      sequence: i + 1,
      amount: r.amount,
      dueDate: r.dueDate,
      notes: r.notes,
    }));
    await replaceBillingSchedule(db, "campaign", args.campaignId, items);
    return { items, source: "quotation" };
  }

  // Fallback: mirror exato do legado scheduleInvoicesForCampaign — uma
  // parcela por fase, valor = soma da receita dos campaignItems da fase,
  // due = periodStart + 15d.
  const phases = await db
    .select({
      id: campaignPhases.id,
      sequence: campaignPhases.sequence,
      label: campaignPhases.label,
      periodStart: campaignPhases.periodStart,
    })
    .from(campaignPhases)
    .where(eq(campaignPhases.campaignId, args.campaignId))
    .orderBy(asc(campaignPhases.sequence));

  const [c] = await db
    .select({ totalValue: quotations.totalValue })
    .from(quotations)
    .where(eq(quotations.id, args.quotationId))
    .limit(1);
  const total = parseFloat(c?.totalValue ?? "0");

  if (phases.length === 0) {
    const suggestion = suggestBillingSchedule({ totalValue: total });
    if (suggestion.length === 0) return { items: [], source: "single" };
    await replaceBillingSchedule(db, "campaign", args.campaignId, suggestion);
    return { items: suggestion, source: "single" };
  }

  const phaseIds = phases.map((p: any) => p.id);
  const itemRows = await db
    .select({
      campaignPhaseId: campaignItems.campaignPhaseId,
      quantity: campaignItems.quantity,
      unitPrice: campaignItems.unitPrice,
      totalPrice: campaignItems.totalPrice,
    })
    .from(campaignItems)
    .where(inArray(campaignItems.campaignPhaseId, phaseIds));

  const revenueByPhase: Record<number, number> = {};
  for (const it of itemRows) {
    const v = it.totalPrice != null
      ? parseFloat(it.totalPrice)
      : it.quantity * parseFloat(it.unitPrice);
    revenueByPhase[it.campaignPhaseId] = (revenueByPhase[it.campaignPhaseId] ?? 0) + v;
  }

  // Se nenhum item tem revenue (campanha sem itens financeiros), fallback
  // para split equal pelo total da cotação, mantendo per-fase due dates.
  const totalFromItems = Object.values(revenueByPhase).reduce((s, v) => s + v, 0);
  const useItemRevenue = totalFromItems > 0;

  let items: Array<{ sequence: number; amount: string; dueDate: string; notes: string | null }>;
  if (useItemRevenue) {
    items = phases.map((p: any) => ({
      sequence: p.sequence,
      amount: (revenueByPhase[p.id] ?? 0).toFixed(2),
      dueDate: addDaysIso(p.periodStart, 15),
      notes: `Batch ${p.sequence} — ${p.label}`,
    }));
  } else {
    const fallbackSuggestion = suggestBillingSchedule({
      totalValue: total,
      phases: phases.map((p: any) => ({ sequence: p.sequence, label: p.label, periodStart: p.periodStart })),
    });
    items = fallbackSuggestion;
  }

  if (items.length === 0) return { items: [], source: "phases" };
  await replaceBillingSchedule(db, "campaign", args.campaignId, items);
  return { items, source: "phases" };
}

/**
 * Cria invoices prevista para a campanha usando billing_schedule_items
 * (ownerType=campaign). Idempotente: pula sequences que já têm invoice
 * ativa (status != cancelada). Usado por scheduleInvoicesForCampaign
 * quando há schedule custom.
 */
export async function scheduleInvoicesFromBillingSchedule(
  tx: any,
  campaign: { id: number; clientId: number },
): Promise<{ created: number; skipped: number; total: number }> {
  const items = await tx
    .select()
    .from(billingScheduleItems)
    .where(and(
      eq(billingScheduleItems.ownerType, "campaign"),
      eq(billingScheduleItems.ownerId, campaign.id),
    ))
    .orderBy(asc(billingScheduleItems.sequence));
  if (items.length === 0) return { created: 0, skipped: 0, total: 0 };

  // invoiceNumber pattern: PREV-{campaignId}-{sequence}
  const existing = await tx
    .select({ invoiceNumber: invoices.invoiceNumber, status: invoices.status })
    .from(invoices)
    .where(and(
      eq(invoices.campaignId, campaign.id),
      sql`${invoices.status} <> 'cancelada'`,
    ));
  const existingNumbers = new Set(existing.map((r: any) => r.invoiceNumber));

  const toInsert: any[] = [];
  for (const it of items) {
    const invNumber = `PREV-${campaign.id}-${it.sequence}`;
    if (existingNumbers.has(invNumber)) continue;
    toInsert.push({
      campaignId: campaign.id,
      clientId: campaign.clientId,
      invoiceNumber: invNumber,
      amount: it.amount,
      billingType: "bruto" as const,
      issueDate: it.dueDate,
      dueDate: it.dueDate,
      status: "prevista" as const,
      notes: it.notes || `Parcela ${it.sequence}`,
    });
  }
  if (toInsert.length > 0) {
    await tx.insert(invoices).values(toInsert);
  }
  return { created: toInsert.length, skipped: items.length - toInsert.length, total: items.length };
}

export const billingScheduleRouter = router({
  // ── Cotação ────────────────────────────────────────────────────────────
  getForQuotation: protectedProcedure
    .input(z.object({ quotationId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const items = await readBillingSchedule(db, "quotation", input.quotationId);
      return items.map((r: any) => ({
        sequence: r.sequence,
        amount: r.amount,
        dueDate: r.dueDate,
        notes: r.notes,
      }));
    }),

  setForQuotation: comercialProcedure
    .input(z.object({
      quotationId: z.number().int(),
      items: z.array(itemInput),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      const [q] = await db
        .select({ id: quotations.id, status: quotations.status, totalValue: quotations.totalValue })
        .from(quotations)
        .where(eq(quotations.id, input.quotationId))
        .limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      if (!QUOTATION_EDITABLE_STATUSES.has(q.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cotação em estado "${q.status}" não permite editar condições — edite via campanha.`,
        });
      }

      const before = await readBillingSchedule(db, "quotation", input.quotationId);
      await replaceBillingSchedule(db, "quotation", input.quotationId, input.items);
      const after = await readBillingSchedule(db, "quotation", input.quotationId);

      // Trilha de auditoria (entityType "invoice" — única entrada do union)
      await recordAudit(db, ctx as any, {
        entityType: "invoice",
        entityId: null,
        action: "update",
        before: { quotationId: input.quotationId, items: before },
        after: { quotationId: input.quotationId, items: after },
        metadata: { kind: "billing_schedule", ownerType: "quotation" },
      });

      return {
        items: after.map((r: any) => ({ sequence: r.sequence, amount: r.amount, dueDate: r.dueDate, notes: r.notes })),
        totalValue: q.totalValue,
        matches: scheduleMatchesTotal(after, q.totalValue ?? "0"),
      };
    }),

  suggestForQuotation: protectedProcedure
    .input(z.object({ quotationId: z.number().int(), parts: z.number().int().min(1).max(36).optional() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [q] = await db
        .select({ totalValue: quotations.totalValue, periodStart: quotations.periodStart })
        .from(quotations)
        .where(eq(quotations.id, input.quotationId))
        .limit(1);
      if (!q) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      const total = parseFloat(q.totalValue ?? "0");
      const parts = input.parts ?? 1;
      if (parts <= 1) {
        return suggestBillingSchedule({ totalValue: total, periodStart: q.periodStart ?? null });
      }
      // Sugestão N parcelas mensais a partir de periodStart+15d
      const base = suggestBillingSchedule({ totalValue: total, periodStart: q.periodStart ?? null })[0];
      if (!base) return [];
      const { splitAmount, addDaysIso } = await import("../shared/billingSchedule");
      const amounts = splitAmount(total, parts);
      return amounts.map((a, i) => ({
        sequence: i + 1,
        amount: a,
        dueDate: addDaysIso(base.dueDate, i * 30),
        notes: `Parcela ${i + 1}/${parts}`,
      })) as BillingScheduleSuggestion[];
    }),

  // ── Campanha ───────────────────────────────────────────────────────────
  getForCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const items = await readBillingSchedule(db, "campaign", input.campaignId);
      // Anexa o estado da invoice atual para cada sequence (lock).
      const invs = await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          id: invoices.id,
        })
        .from(invoices)
        .where(eq(invoices.campaignId, input.campaignId));
      const byNumber = new Map(invs.map((i: any) => [i.invoiceNumber, i]));
      return items.map((r: any) => {
        const inv = byNumber.get(`PREV-${input.campaignId}-${r.sequence}`);
        const locked = !!inv && ["emitida", "paga", "cancelada"].includes((inv as any).status);
        return {
          sequence: r.sequence,
          amount: r.amount,
          dueDate: r.dueDate,
          notes: r.notes,
          invoiceStatus: (inv as any)?.status ?? "prevista",
          invoiceId: (inv as any)?.id ?? null,
          locked,
        };
      });
    }),

  updateForCampaign: comercialProcedure
    .input(z.object({
      campaignId: z.number().int(),
      items: z.array(itemInput),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();

      const [c] = await db
        .select({
          id: campaigns.id,
          clientId: campaigns.clientId,
          isBonificada: campaigns.isBonificada,
          quotationId: campaigns.quotationId,
        })
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });
      if (c.isBonificada) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha bonificada — sem cronograma de pagamento." });
      }

      // Total canônico da campanha = quotation.totalValue. Fallback: usa
      // soma do schedule atual (caso campanha avulsa sem cotação).
      let canonicalTotal: number | null = null;
      if (c.quotationId) {
        const [q] = await db
          .select({ totalValue: quotations.totalValue })
          .from(quotations)
          .where(eq(quotations.id, c.quotationId))
          .limit(1);
        if (q?.totalValue) canonicalTotal = parseFloat(q.totalValue);
      }

      const existing = await readBillingSchedule(db, "campaign", input.campaignId);
      const allInvoices = await db
        .select({
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          id: invoices.id,
        })
        .from(invoices)
        .where(eq(invoices.campaignId, input.campaignId));
      const invByNumber = new Map(allInvoices.map((i: any) => [i.invoiceNumber, i]));

      // Validação: parcelas com invoice terminal precisam vir inalteradas.
      for (const prev of existing) {
        const inv: any = invByNumber.get(`PREV-${input.campaignId}-${prev.sequence}`);
        if (inv && ["emitida", "paga", "cancelada"].includes(inv.status)) {
          const submitted = input.items.find((i) => i.sequence === prev.sequence);
          if (!submitted) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Parcela #${prev.sequence} está ${inv.status} e não pode ser removida.`,
            });
          }
          const amtDelta = Math.abs(parseFloat(submitted.amount) - parseFloat(prev.amount));
          if (amtDelta > 0.005 || submitted.dueDate !== prev.dueDate) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Parcela #${prev.sequence} (${inv.status}) é read-only — não altere valor/vencimento.`,
            });
          }
        }
      }

      // Validação: soma == valor canônico da campanha (quotation.totalValue).
      // Fallback (campanha sem cotação): valida soma de invoices terminais
      // (emitida/paga) ≤ nova soma, garantindo que o que já foi cobrado seja
      // honrado.
      const terminalSum = allInvoices
        .filter((i: any) => ["emitida", "paga"].includes(i.status))
        .reduce((s: number, i: any) => s + parseFloat(i.amount), 0);
      const newSum = sumSchedule(input.items);
      const expectedTotal = canonicalTotal ?? terminalSum + sumSchedule(
        existing.filter((e: any) => {
          const inv: any = invByNumber.get(`PREV-${input.campaignId}-${e.sequence}`);
          return !inv || inv.status === "prevista";
        }).map((e: any) => ({ amount: e.amount }))
      );
      // Tolerância: 1 centavo
      if (Math.abs(Math.round(newSum * 100) - Math.round(expectedTotal * 100)) > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Soma das parcelas (R$ ${newSum.toFixed(2)}) deve bater com o valor da campanha (R$ ${expectedTotal.toFixed(2)}).`,
        });
      }
      // Guard adicional: nova soma não pode ser menor que o que já foi
      // emitido/pago (não permite "desfazer" cobranças já realizadas).
      if (newSum + 0.01 < terminalSum) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Soma das parcelas (R$ ${newSum.toFixed(2)}) é inferior ao já emitido/pago (R$ ${terminalSum.toFixed(2)}).`,
        });
      }

      // Aplica: substitui o schedule e recria invoices prevista órfãs.
      await replaceBillingSchedule(db, "campaign", input.campaignId, input.items);

      // Apaga invoices "prevista" cujas sequences não existem mais ou cujos
      // valores/datas mudaram; em seguida recria a partir do schedule.
      const previstaInvoices = allInvoices.filter((i: any) => i.status === "prevista");
      const wantedNumbers = new Set(input.items.map((i) => `PREV-${input.campaignId}-${i.sequence}`));
      const previstaByNumber = new Map(previstaInvoices.map((i: any) => [i.invoiceNumber, i]));

      const toDelete: number[] = [];
      for (const inv of previstaInvoices as any[]) {
        if (!wantedNumbers.has(inv.invoiceNumber)) {
          toDelete.push(inv.id);
          continue;
        }
        const wanted = input.items.find((i) => `PREV-${input.campaignId}-${i.sequence}` === inv.invoiceNumber)!;
        const amtChanged = Math.abs(parseFloat(wanted.amount) - parseFloat(inv.amount)) > 0.005;
        const dueChanged = wanted.dueDate !== inv.dueDate;
        if (amtChanged || dueChanged) toDelete.push(inv.id);
      }
      if (toDelete.length > 0) {
        await db.delete(invoices).where(inArray(invoices.id, toDelete));
      }
      await scheduleInvoicesFromBillingSchedule(db, { id: input.campaignId, clientId: c.clientId });

      const after = await readBillingSchedule(db, "campaign", input.campaignId);
      await recordAudit(db, ctx as any, {
        entityType: "invoice",
        entityId: null,
        action: "update",
        before: { campaignId: input.campaignId, items: existing },
        after: { campaignId: input.campaignId, items: after },
        metadata: { kind: "billing_schedule", ownerType: "campaign" },
      });

      return { success: true, items: after };
    }),
});
