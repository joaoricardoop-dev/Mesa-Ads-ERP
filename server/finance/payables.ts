// ─────────────────────────────────────────────────────────────────────────────
// Finrefac fase 3 — Materialização automática de payables a partir de faturas.
//
// `materializePayablesForInvoice(db, invoiceId, event)` é o ÚNICO ponto de
// entrada para gerar entradas no ledger `accounts_payable` derivadas de uma
// fatura. É chamado nos hooks de criação/atualização/pagamento/cancelamento
// de invoices.
//
// Idempotência: a função usa `sourceRef` como chave natural e fica segura
// contra re-execução (não duplica linhas).
//
// Eventos:
//   • 'emitida'   → impostos (IRPJ, ISS opcional, PIS/COFINS).
//   • 'paga'      → comissão restaurante, repasse VIP, comissão parceiro.
//   • 'cancelada' → cancela TODOS os derivados não pagos; bloqueia se algum
//                   derivado já foi pago.
//   • 'reverter_pagamento' → cancela apenas os derivados de pagamento
//                   (restaurante/VIP/parceiro); bloqueia se algum desses
//                   já está pago. Impostos seguem ativos.
// ─────────────────────────────────────────────────────────────────────────────
import { eq, and, sql } from "drizzle-orm";
import {
  accountsPayable,
  invoices,
  campaigns,
  clients,
  products,
  vipProviders,
  partners,
  quotations,
} from "../../drizzle/schema";
import {
  calcTaxes,
  calcRestaurantCommission,
  calcVipRepasse,
  calcPartnerCommission,
  competenceMonthFor,
  lastDayOfMonth,
  safeDueDate,
  num,
  type CampaignLike,
  type InvoiceLike,
  type PartnerLike,
  type ProductLike,
  type VipProviderLike,
  type TaxKind,
} from "./calc";
// Aceita tanto a conexão direta (`getDb()`) quanto um transaction handle
// passado por `db.transaction(async tx => ...)` — ambos compartilham o mesmo
// shape funcional em Drizzle.
import type { NeonDatabase, NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
type Schema = Record<string, unknown>;
export type DbClient =
  | NeonDatabase<Schema>
  | PgTransaction<NeonQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
type Db = DbClient;
type SourceRef = Record<string, number | string | null | number[]>;

export type InvoiceEvent = "emitida" | "paga" | "cancelada" | "reverter_pagamento";

export interface MaterializeResult {
  created: number;
  updated: number;
  cancelled: number;
}

const EMPTY: MaterializeResult = { created: 0, updated: 0, cancelled: 0 };

const PAYMENT_DERIVED_SOURCE_TYPES = ["restaurant_commission", "vip_repasse", "partner_commission"] as const;

export async function materializePayablesForInvoice(
  db: Db,
  invoiceId: number,
  event: InvoiceEvent,
): Promise<MaterializeResult> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return EMPTY;

  if (event === "cancelada") {
    return cancelDerivedPayables(db, invoiceId, "all");
  }
  if (event === "reverter_pagamento") {
    return cancelDerivedPayables(db, invoiceId, "payment_derived");
  }

  if (!invoice.campaignId) return EMPTY;
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, invoice.campaignId)).limit(1);
  if (!campaign) return EMPTY;

  const product: ProductLike | null = campaign.productId
    ? (await db.select().from(products).where(eq(products.id, campaign.productId)).limit(1))[0] ?? null
    : null;

  if (event === "emitida") {
    return materializeTaxes(db, invoice as InvoiceLike, campaign as CampaignLike, product);
  }

  // event === 'paga'
  const r1 = await materializeRestaurantCommission(db, invoice as InvoiceLike, campaign as CampaignLike, product);
  const r2 = await materializeVipRepasse(db, invoice as InvoiceLike, campaign as CampaignLike, product);
  const r3 = await materializePartnerCommission(db, invoice as InvoiceLike, campaign as CampaignLike, product);
  return mergeCounts(r1, r2, r3);
}

function mergeCounts(...rs: MaterializeResult[]): MaterializeResult {
  return rs.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      updated: acc.updated + r.updated,
      cancelled: acc.cancelled + r.cancelled,
    }),
    { ...EMPTY },
  );
}

// ─── IMPOSTOS ───────────────────────────────────────────────────────────────
async function materializeTaxes(
  db: Db,
  invoice: InvoiceLike,
  _campaign: CampaignLike,
  product: ProductLike | null,
): Promise<MaterializeResult> {
  const taxes = calcTaxes(invoice, product);
  const compMonth = competenceMonthFor(invoice.issueDate);
  const dueDate = safeDueDate(null); // impostos vencem hoje (default); ajuste manual opcional
  let created = 0;
  let updated = 0;
  let cancelled = 0;

  const validKinds = new Set<TaxKind>(taxes.map((t) => t.kind));

  // Upsert por kind
  for (const tax of taxes) {
    const existing = await db
      .select()
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.sourceType, "tax"),
          sql`${accountsPayable.sourceRef}->>'invoiceId' = ${String(invoice.id)}`,
          sql`${accountsPayable.sourceRef}->>'kind' = ${tax.kind}`,
        ),
      );
    const description = `${tax.description} - NF ${invoice.invoiceNumber || invoice.id}`;
    if (existing.length === 0) {
      await db.insert(accountsPayable).values({
        campaignId: invoice.campaignId,
        invoiceId: invoice.id,
        type: "imposto",
        description,
        amount: tax.amount.toFixed(2),
        recipientType: "fisco",
        status: "pendente",
        dueDate,
        sourceType: "tax",
        sourceRef: { invoiceId: invoice.id, kind: tax.kind },
        competenceMonth: compMonth,
        createdBySystem: true,
      }).onConflictDoNothing();
      created++;
    } else {
      const ap = existing[0];
      if (ap.status === "pago" || ap.status === "cancelada") continue;
      const sameAmount = Math.abs(num(ap.amount) - tax.amount) < 0.005;
      const sameComp = ap.competenceMonth === compMonth;
      if (!sameAmount || !sameComp) {
        await db
          .update(accountsPayable)
          .set({
            amount: tax.amount.toFixed(2),
            description,
            competenceMonth: compMonth,
            updatedAt: new Date(),
          })
          .where(eq(accountsPayable.id, ap.id));
        updated++;
      }
    }
  }

  // Cancela impostos cujo kind deixou de existir (ex.: ISS virou retido).
  const allTaxesForInvoice = await db
    .select()
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.sourceType, "tax"),
        sql`${accountsPayable.sourceRef}->>'invoiceId' = ${String(invoice.id)}`,
      ),
    );
  for (const ap of allTaxesForInvoice) {
    const kind = ap.sourceRef?.kind as TaxKind | undefined;
    if (kind && !validKinds.has(kind) && ap.status !== "pago" && ap.status !== "cancelada") {
      await db
        .update(accountsPayable)
        .set({ status: "cancelada", updatedAt: new Date() })
        .where(eq(accountsPayable.id, ap.id));
      cancelled++;
    }
  }

  return { created, updated, cancelled };
}

// ─── COMISSÃO RESTAURANTE ───────────────────────────────────────────────────
async function materializeRestaurantCommission(
  db: Db,
  invoice: InvoiceLike,
  campaign: CampaignLike,
  product: ProductLike | null,
): Promise<MaterializeResult> {
  const amount = calcRestaurantCommission(invoice, campaign, product);
  if (amount <= 0) return EMPTY;

  const existing = await db
    .select()
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.sourceType, "restaurant_commission"),
        sql`${accountsPayable.sourceRef}->>'invoiceId' = ${String(invoice.id)}`,
      ),
    );
  // Ignora linhas canceladas: permitir re-materialização após
  // cancelamento/reverter_pagamento (caso a invoice volte a 'paga').
  if (existing.some((r) => r.status !== "cancelada")) return EMPTY;

  const compMonth = competenceMonthFor(invoice.paymentDate || invoice.issueDate);
  const restRate = num(campaign.restaurantCommission);
  await db.insert(accountsPayable).values({
    campaignId: invoice.campaignId,
    invoiceId: invoice.id,
    type: "comissao",
    description: `Comissão Restaurante (${restRate.toFixed(2)}%) - NF ${invoice.invoiceNumber || invoice.id}`,
    amount: amount.toFixed(2),
    recipientType: "restaurante",
    status: "pendente",
    dueDate: safeDueDate(invoice.paymentDate || null),
    sourceType: "restaurant_commission",
    sourceRef: { invoiceId: invoice.id, campaignId: invoice.campaignId },
    competenceMonth: compMonth,
    createdBySystem: true,
  }).onConflictDoNothing();
  return { created: 1, updated: 0, cancelled: 0 };
}

// ─── REPASSE VIP ────────────────────────────────────────────────────────────
async function materializeVipRepasse(
  db: Db,
  invoice: InvoiceLike,
  campaign: CampaignLike,
  product: ProductLike | null,
): Promise<MaterializeResult> {
  if (!product || !product.vipProviderId) return EMPTY;
  const [provider] = await db
    .select()
    .from(vipProviders)
    .where(eq(vipProviders.id, product.vipProviderId))
    .limit(1);
  const amount = calcVipRepasse(invoice, campaign, product, (provider as VipProviderLike) ?? null);
  if (amount <= 0 || !provider) return EMPTY;

  const existing = await db
    .select()
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.sourceType, "vip_repasse"),
        sql`${accountsPayable.sourceRef}->>'invoiceId' = ${String(invoice.id)}`,
      ),
    );
  // Ignora linhas canceladas: permitir re-materialização após reversão.
  if (existing.some((r) => r.status !== "cancelada")) return EMPTY;

  const compMonth = competenceMonthFor(invoice.paymentDate || invoice.issueDate);
  const rate = num(product.vipProviderCommissionPercent ?? provider.repassePercent);
  await db.insert(accountsPayable).values({
    campaignId: invoice.campaignId,
    invoiceId: invoice.id,
    vipProviderId: provider.id,
    type: "repasse_vip",
    description: `Repasse Sala VIP - ${provider.name} (${rate.toFixed(2)}%) - NF ${invoice.invoiceNumber || invoice.id}`,
    amount: amount.toFixed(2),
    recipientType: "vip_provider",
    status: "pendente",
    dueDate: safeDueDate(invoice.paymentDate || null),
    sourceType: "vip_repasse",
    sourceRef: { invoiceId: invoice.id, vipProviderId: provider.id },
    competenceMonth: compMonth,
    createdBySystem: true,
  }).onConflictDoNothing();
  return { created: 1, updated: 0, cancelled: 0 };
}

// ─── COMISSÃO PARCEIRO (agrupada por partnerId+competenceMonth) ─────────────
async function resolvePartnerForCampaign(db: Db, campaign: CampaignLike): Promise<PartnerLike | null> {
  if (campaign.quotationId) {
    const [quot] = await db
      .select({ partnerId: quotations.partnerId })
      .from(quotations)
      .where(eq(quotations.id, campaign.quotationId))
      .limit(1);
    if (quot?.partnerId) {
      const [p] = await db.select().from(partners).where(eq(partners.id, quot.partnerId)).limit(1);
      if (p) return p as PartnerLike;
    }
  }
  if (campaign.partnerId) {
    const [p] = await db.select().from(partners).where(eq(partners.id, campaign.partnerId)).limit(1);
    if (p) return p as PartnerLike;
  }
  if (campaign.clientId) {
    const [client] = await db.select().from(clients).where(eq(clients.id, campaign.clientId)).limit(1);
    if (client?.partnerId) {
      const [p] = await db.select().from(partners).where(eq(partners.id, client.partnerId)).limit(1);
      if (p) return p as PartnerLike;
    }
  }
  return null;
}

async function materializePartnerCommission(
  db: Db,
  invoice: InvoiceLike,
  campaign: CampaignLike,
  product: ProductLike | null,
): Promise<MaterializeResult> {
  const partner = await resolvePartnerForCampaign(db, campaign);
  if (!partner) return EMPTY;

  const result = calcPartnerCommission(invoice, campaign, product, partner);
  if (result.amount <= 0) return EMPTY;

  const compMonth = competenceMonthFor(invoice.paymentDate || invoice.issueDate);
  const existing = await db
    .select()
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.sourceType, "partner_commission"),
        sql`${accountsPayable.sourceRef}->>'partnerId' = ${String(partner.id)}`,
        eq(accountsPayable.competenceMonth, compMonth),
        // Para idempotência, evitamos colidir com APs já pagas: se a do mês
        // foi paga, criamos uma "suplementar".
        sql`${accountsPayable.status} <> 'cancelada'`,
      ),
    );

  // Caso o agregado deste mês já esteja pago, criamos linha suplementar.
  const openExisting = existing.find((e) => e.status !== "pago");
  const paidExisting = existing.find((e) => e.status === "pago");

  if (openExisting) {
    const openIds = openExisting.sourceRef?.invoiceIds;
    const ids: number[] = Array.isArray(openIds) ? (openIds as number[]) : [];
    if (ids.includes(invoice.id)) return EMPTY; // idempotente
    const newAmount = num(openExisting.amount) + result.amount;
    await db
      .update(accountsPayable)
      .set({
        amount: newAmount.toFixed(2),
        sourceRef: {
          ...((openExisting.sourceRef as Record<string, unknown>) ?? {}),
          partnerId: partner.id,
          competenceMonth: compMonth,
          invoiceIds: [...ids, invoice.id],
        } satisfies SourceRef,
        description: `Comissão Parceiro - ${partner.name} (${compMonth}) - ${ids.length + 1} NFs`,
        updatedAt: new Date(),
      })
      .where(eq(accountsPayable.id, openExisting.id));
    return { created: 0, updated: 1, cancelled: 0 };
  }

  if (paidExisting) {
    const paidRefIds = paidExisting.sourceRef?.invoiceIds;
    const paidIds: number[] = Array.isArray(paidRefIds) ? (paidRefIds as number[]) : [];
    if (paidIds.includes(invoice.id)) return EMPTY; // idempotente
  }

  await db.insert(accountsPayable).values({
    campaignId: invoice.campaignId,
    type: "comissao_parceiro",
    description: paidExisting
      ? `Comissão Parceiro - ${partner.name} (${compMonth} suplementar) - NF ${invoice.invoiceNumber || invoice.id}`
      : `Comissão Parceiro - ${partner.name} (${compMonth}) - NF ${invoice.invoiceNumber || invoice.id}`,
    amount: result.amount.toFixed(2),
    recipientType: "parceiro",
    status: "pendente",
    dueDate: safeDueDate(lastDayOfMonth(compMonth)),
    sourceType: "partner_commission",
    sourceRef: (paidExisting
      ? {
          partnerId: partner.id,
          competenceMonth: compMonth,
          invoiceIds: [invoice.id],
          supplementOf: paidExisting.id,
        }
      : { partnerId: partner.id, competenceMonth: compMonth, invoiceIds: [invoice.id] }) satisfies SourceRef,
    competenceMonth: compMonth,
    createdBySystem: true,
  }).onConflictDoNothing();
  return { created: 1, updated: 0, cancelled: 0 };
}

// ─── CANCELAMENTO / REVERSÃO ────────────────────────────────────────────────
async function cancelDerivedPayables(
  db: Db,
  invoiceId: number,
  scope: "all" | "payment_derived",
): Promise<MaterializeResult> {
  // Coleta todas as APs cujo sourceRef referencia esta invoice (direta ou via invoiceIds[]).
  const all = await db
    .select()
    .from(accountsPayable)
    .where(
      sql`(${accountsPayable.sourceRef}->>'invoiceId') = ${String(invoiceId)}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(${accountsPayable.sourceRef}->'invoiceIds') AS e
          WHERE (e)::text::int = ${invoiceId}
        )`,
    );

  const inScope = all.filter((ap) =>
    scope === "all" ? true : (PAYMENT_DERIVED_SOURCE_TYPES as readonly string[]).includes(ap.sourceType),
  );

  // Bloqueia se algum derivado já está pago.
  // Para partner_commission agregada: bloqueia só se a invoice está dentro de uma AP paga.
  for (const ap of inScope) {
    if (ap.status !== "pago") continue;
    if (ap.sourceType === "partner_commission") {
      const refIds = ap.sourceRef?.invoiceIds;
      const ids: number[] = Array.isArray(refIds) ? (refIds as number[]) : [];
      if (ids.includes(invoiceId)) {
        throw new Error(
          `Não é possível cancelar/reverter: comissão de parceiro do mês ${ap.competenceMonth} já foi paga.`,
        );
      }
    } else {
      throw new Error(
        `Não é possível cancelar/reverter: obrigação derivada (${ap.sourceType}) já está paga.`,
      );
    }
  }

  let cancelled = 0;
  let updated = 0;
  for (const ap of inScope) {
    if (ap.status === "pago" || ap.status === "cancelada") continue;

    if (ap.sourceType === "partner_commission") {
      // Remove só a contribuição desta invoice do agregado e recalcula.
      const refIds = ap.sourceRef?.invoiceIds;
      const ids: number[] = Array.isArray(refIds) ? (refIds as number[]) : [];
      const remaining = ids.filter((id) => id !== invoiceId);
      if (remaining.length === 0) {
        await db
          .update(accountsPayable)
          .set({ status: "cancelada", updatedAt: new Date() })
          .where(eq(accountsPayable.id, ap.id));
        cancelled++;
      } else {
        const newAmount = await recomputePartnerAggregate(db, remaining);
        await db
          .update(accountsPayable)
          .set({
            amount: newAmount.toFixed(2),
            sourceRef: {
              ...((ap.sourceRef as SourceRef) ?? {}),
              invoiceIds: remaining,
            } satisfies SourceRef,
            description: `Comissão Parceiro - recalculada - ${remaining.length} NFs`,
            updatedAt: new Date(),
          })
          .where(eq(accountsPayable.id, ap.id));
        updated++;
      }
      continue;
    }

    await db
      .update(accountsPayable)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(eq(accountsPayable.id, ap.id));
    cancelled++;
  }

  return { created: 0, updated, cancelled };
}

async function recomputePartnerAggregate(db: Db, invoiceIds: number[]): Promise<number> {
  let total = 0;
  for (const id of invoiceIds) {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv || !inv.campaignId) continue;
    const [camp] = await db.select().from(campaigns).where(eq(campaigns.id, inv.campaignId)).limit(1);
    if (!camp) continue;
    const prod: ProductLike | null = camp.productId
      ? (await db.select().from(products).where(eq(products.id, camp.productId)).limit(1))[0] ?? null
      : null;
    const partner = await resolvePartnerForCampaign(db, camp as CampaignLike);
    if (!partner) continue;
    const r = calcPartnerCommission(inv as InvoiceLike, camp as CampaignLike, prod, partner);
    total += r.amount;
  }
  return Math.round(total * 100) / 100;
}
