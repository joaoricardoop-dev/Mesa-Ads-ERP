import { invoices, campaignPhases, campaignItems } from "../../drizzle/schema";
import { sql, inArray, eq, and } from "drizzle-orm";
import type { DbClient } from "../finance/payables";

export type ScheduledInvoiceRow = {
  campaignId: number;
  campaignPhaseId: number;
  clientId: number;
  invoiceNumber: string;
  amount: string;
  billingType: "bruto";
  issueDate: string;
  dueDate: string;
  status: "prevista";
  notes: string;
};

export type PhaseForScheduling = {
  id: number;
  sequence: number;
  label: string;
  periodStart: string;
};

export type ItemForScheduling = {
  campaignPhaseId: number;
  quantity: number;
  unitPrice: string;
  totalPrice: string | null;
};

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function sumPhaseRevenue(items: ItemForScheduling[]): Record<number, number> {
  const revenueByPhase: Record<number, number> = {};
  for (const it of items) {
    const v = it.totalPrice != null
      ? parseFloat(it.totalPrice)
      : it.quantity * parseFloat(it.unitPrice);
    revenueByPhase[it.campaignPhaseId] = (revenueByPhase[it.campaignPhaseId] ?? 0) + v;
  }
  return revenueByPhase;
}

export function planScheduledInvoices(args: {
  campaignId: number;
  clientId: number;
  phases: PhaseForScheduling[];
  items: ItemForScheduling[];
  phasesWithExistingInvoice: Set<number>;
  dueOffsetDays: number;
}): ScheduledInvoiceRow[] {
  const revenueByPhase = sumPhaseRevenue(args.items);
  const out: ScheduledInvoiceRow[] = [];
  for (const p of args.phases) {
    if (args.phasesWithExistingInvoice.has(p.id)) continue;
    const amount = (revenueByPhase[p.id] ?? 0).toFixed(2);
    out.push({
      campaignId: args.campaignId,
      campaignPhaseId: p.id,
      clientId: args.clientId,
      invoiceNumber: `PREV-${args.campaignId}-${p.sequence}`,
      amount,
      billingType: "bruto",
      issueDate: p.periodStart,
      dueDate: addDaysIso(p.periodStart, args.dueOffsetDays),
      status: "prevista",
      notes: `Fatura prevista — Batch ${p.sequence} (${p.label})`,
    });
  }
  return out;
}

export async function scheduleInvoicesForCampaign(
  tx: DbClient,
  campaign: { id: number; clientId: number },
  opts: { dueOffsetDays?: number; restrictToPhaseIds?: number[] } = {},
): Promise<{ created: number; skipped: number; total: number }> {
  const dueOffsetDays = opts.dueOffsetDays ?? 15;

  const allPhases: PhaseForScheduling[] = await tx
    .select({
      id: campaignPhases.id,
      sequence: campaignPhases.sequence,
      label: campaignPhases.label,
      periodStart: campaignPhases.periodStart,
    })
    .from(campaignPhases)
    .where(eq(campaignPhases.campaignId, campaign.id));

  const phases = opts.restrictToPhaseIds
    ? allPhases.filter((p) => opts.restrictToPhaseIds!.includes(p.id))
    : allPhases;

  if (phases.length === 0) {
    return { created: 0, skipped: 0, total: 0 };
  }

  const phaseIds = phases.map((p) => p.id);
  const itemRows = await tx
    .select({
      campaignPhaseId: campaignItems.campaignPhaseId,
      quantity: campaignItems.quantity,
      unitPrice: campaignItems.unitPrice,
      totalPrice: campaignItems.totalPrice,
    })
    .from(campaignItems)
    .where(inArray(campaignItems.campaignPhaseId, phaseIds));
  const items: ItemForScheduling[] = itemRows.map((r) => ({
    campaignPhaseId: r.campaignPhaseId,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    totalPrice: r.totalPrice,
  }));

  const existing = await tx
    .select({ phaseId: invoices.campaignPhaseId })
    .from(invoices)
    .where(and(
      eq(invoices.campaignId, campaign.id),
      inArray(invoices.campaignPhaseId, phaseIds),
      sql`${invoices.status} <> 'cancelada'`,
    ));
  const phasesWithExistingInvoice = new Set<number>();
  for (const row of existing) {
    if (row.phaseId != null) phasesWithExistingInvoice.add(row.phaseId);
  }

  const toInsert = planScheduledInvoices({
    campaignId: campaign.id,
    clientId: campaign.clientId,
    phases,
    items,
    phasesWithExistingInvoice,
    dueOffsetDays,
  });

  if (toInsert.length > 0) {
    await tx.insert(invoices).values(toInsert);
  }

  return {
    created: toInsert.length,
    skipped: phases.length - toInsert.length,
    total: phases.length,
  };
}
