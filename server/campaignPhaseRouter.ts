import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  campaigns,
  campaignPhases,
  campaignItems,
  products,
  invoices,
  accountsPayable,
  vipProviders,
  partners,
  quotations,
  clients,
} from "../drizzle/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { calcPhaseFinancials, type PhaseItemLike, type PhaseOverrides } from "./finance/calc";
import { materializePayablesForInvoice } from "./finance/payables";
import { recordAudit } from "./finance/audit";

const PHASE_OVERRIDE_FIELDS = [
  "unitPriceOverride",
  "markupOverride",
  "taxRateOverride",
  "restaurantCommissionOverride",
  "vipRepasseOverride",
  "bvPercentOverride",
  "grossUpRateOverride",
  "freightCostOverride",
  "batchCostOverride",
] as const;
type PhaseOverrideField = typeof PHASE_OVERRIDE_FIELDS[number];

function extractOverridesFromPhase(phase: any): PhaseOverrides {
  return {
    unitPriceOverride: phase?.unitPriceOverride ?? null,
    taxRateOverride: phase?.taxRateOverride ?? null,
    restaurantCommissionOverride: phase?.restaurantCommissionOverride ?? null,
    vipRepasseOverride: phase?.vipRepasseOverride ?? null,
    bvPercentOverride: phase?.bvPercentOverride ?? null,
    grossUpRateOverride: phase?.grossUpRateOverride ?? null,
    freightCostOverride: phase?.freightCostOverride ?? null,
    batchCostOverride: phase?.batchCostOverride ?? null,
  };
}

// Após mudar override de um batch, regenera APs PREVISTOS (status='pendente'
// + createdBySystem=true) sem tocar em pago/cancelado. Idempotente.
async function softRegenPredictedPayables(db: any, phaseId: number) {
  const [invoice] = await db.select().from(invoices)
    .where(and(eq(invoices.campaignPhaseId, phaseId), sql`${invoices.status} <> 'cancelada'`))
    .orderBy(desc(invoices.id)).limit(1);
  if (!invoice) return { regenerated: 0, cancelled: 0, invoiceId: null as number | null };
  // Cancela APs previstos vinculados via sourceRef.invoiceId OU via
  // sourceRef.invoiceIds[] (BV agregado). Preserva pago/cancelado.
  const idStr = String(invoice.id);
  const cancelled = await db.update(accountsPayable).set({
    status: "cancelada", updatedAt: new Date(),
  }).where(and(
    sql`(
      (${accountsPayable.sourceRef}->>'invoiceId') = ${idStr}
      OR (${accountsPayable.sourceRef}->'invoiceIds') @> ${sql`${JSON.stringify([invoice.id])}::jsonb`}
    )`,
    eq(accountsPayable.status, "pendente"),
    eq(accountsPayable.createdBySystem, true),
  )).returning();
  let totalCreated = 0;
  if (invoice.status === "emitida" || invoice.status === "paga") {
    const r1 = await materializePayablesForInvoice(db, invoice.id, "emitida");
    totalCreated += r1.created;
  }
  if (invoice.status === "paga") {
    const r2 = await materializePayablesForInvoice(db, invoice.id, "paga");
    totalCreated += r2.created;
  }
  return { regenerated: totalCreated, cancelled: cancelled.length, invoiceId: invoice.id };
}

// Mesma cadeia que server/finance/payables.ts:resolvePartnerForCampaign
// (quotation → campaign.partnerId → client.partnerId) para evitar divergência
// entre o DRE do batch e os APs materializados pelo ledger.
async function resolvePartnerForCampaignBasic(db: any, campaign: any) {
  if (campaign?.quotationId) {
    const [q] = await db.select({ partnerId: quotations.partnerId })
      .from(quotations).where(eq(quotations.id, campaign.quotationId)).limit(1);
    if (q?.partnerId) {
      const [p] = await db.select().from(partners).where(eq(partners.id, q.partnerId)).limit(1);
      if (p) return p;
    }
  }
  if (campaign?.partnerId) {
    const [p] = await db.select().from(partners).where(eq(partners.id, campaign.partnerId)).limit(1);
    if (p) return p;
  }
  if (campaign?.clientId) {
    const [c] = await db.select({ partnerId: clients.partnerId })
      .from(clients).where(eq(clients.id, campaign.clientId)).limit(1);
    if (c?.partnerId) {
      const [p] = await db.select().from(partners).where(eq(partners.id, c.partnerId)).limit(1);
      if (p) return p;
    }
  }
  return null;
}

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const PHASE_STATUS_ENUM = ["planejada", "ativa", "concluida", "cancelada"] as const;

export const campaignPhaseRouter = router({
  // ── Fases ─────────────────────────────────────────────────────────────────

  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const phases = await db
        .select()
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId))
        .orderBy(asc(campaignPhases.sequence));

      if (phases.length === 0) return [];

      // Busca itens e agrega por fase
      const phaseIds = phases.map((p) => p.id);
      const itemRows = await db
        .select({
          item: campaignItems,
          productName: products.name,
          productTipo: products.tipo,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
        })
        .from(campaignItems)
        .leftJoin(products, eq(products.id, campaignItems.productId))
        .where(sql`${campaignItems.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`);

      const itemsByPhase: Record<number, typeof itemRows> = {};
      for (const r of itemRows) {
        const phaseId = r.item.campaignPhaseId;
        if (!itemsByPhase[phaseId]) itemsByPhase[phaseId] = [];
        itemsByPhase[phaseId].push(r);
      }

      // Agrega totais financeiros por fase (faturado e pago) do que já existe
      const invoiceAgg = await db
        .select({
          campaignPhaseId: invoices.campaignPhaseId,
          totalInvoiced: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} <> 'cancelada' THEN ${invoices.amount}::numeric ELSE 0 END), 0)`,
          totalReceived: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paga' THEN ${invoices.amount}::numeric ELSE 0 END), 0)`,
          invoiceCount: sql<number>`COUNT(*)::int`,
        })
        .from(invoices)
        .where(sql`${invoices.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(invoices.campaignPhaseId);

      const invoiceAggMap: Record<number, { totalInvoiced: number; totalReceived: number; invoiceCount: number }> = {};
      for (const row of invoiceAgg) {
        if (row.campaignPhaseId != null) {
          invoiceAggMap[row.campaignPhaseId] = {
            totalInvoiced: parseFloat(row.totalInvoiced),
            totalReceived: parseFloat(row.totalReceived),
            invoiceCount: row.invoiceCount,
          };
        }
      }

      // Fatura ativa por fase (não-cancelada, mais recente). Usado pelo
      // badge de status no card de batch (regra "1 batch = 1 fatura").
      const activeInvoiceRows = await db
        .select()
        .from(invoices)
        .where(sql`${invoices.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)}) AND ${invoices.status} <> 'cancelada'`)
        .orderBy(desc(invoices.id));
      const todayIso = new Date().toISOString().slice(0, 10);
      const activeInvoiceByPhase: Record<number, {
        id: number; invoiceNumber: string; amount: number;
        status: "paga" | "emitida" | "vencida" | "prevista";
        rawStatus: string; issueDate: string; dueDate: string;
      }> = {};
      for (const inv of activeInvoiceRows) {
        if (inv.campaignPhaseId == null) continue;
        if (activeInvoiceByPhase[inv.campaignPhaseId]) continue; // já temos a mais recente
        let status: "paga" | "emitida" | "vencida" | "prevista" = "prevista";
        if (inv.status === "paga") status = "paga";
        else if (inv.status === "vencida") status = "vencida";
        else if (inv.status === "emitida") status = inv.dueDate < todayIso ? "vencida" : "emitida";
        else status = "prevista";
        activeInvoiceByPhase[inv.campaignPhaseId] = {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: parseFloat(inv.amount),
          status,
          rawStatus: inv.status,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
        };
      }

      const payableAgg = await db
        .select({
          campaignPhaseId: accountsPayable.campaignPhaseId,
          totalDue: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.status} <> 'cancelado' THEN ${accountsPayable.amount}::numeric ELSE 0 END), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.status} = 'pago' THEN ${accountsPayable.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(accountsPayable)
        .where(sql`${accountsPayable.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(accountsPayable.campaignPhaseId);

      const payableAggMap: Record<number, { totalDue: number; totalPaid: number }> = {};
      for (const row of payableAgg) {
        if (row.campaignPhaseId != null) {
          payableAggMap[row.campaignPhaseId] = {
            totalDue: parseFloat(row.totalDue),
            totalPaid: parseFloat(row.totalPaid),
          };
        }
      }

      return phases.map((p) => {
        const items = (itemsByPhase[p.id] ?? []).map((r) => ({
          ...r.item,
          productName: r.productName ?? "—",
          productTipo: r.productTipo ?? null,
          productUnitLabel: r.productUnitLabel ?? "unidade",
          productUnitLabelPlural: r.productUnitLabelPlural ?? "unidades",
          // Preço total "resolvido": usa totalPrice se setado, senão calcula
          resolvedTotalPrice: r.item.totalPrice != null
            ? parseFloat(r.item.totalPrice)
            : r.item.quantity * parseFloat(r.item.unitPrice),
        }));

        const expectedRevenue = items.reduce((sum, it) => sum + it.resolvedTotalPrice, 0);
        const expectedCosts = items.reduce(
          (sum, it) => sum + parseFloat(it.productionCost) + parseFloat(it.freightCost),
          0,
        );

        return {
          ...p,
          items,
          itemCount: items.length,
          expectedRevenue,
          expectedCosts,
          expectedMargin: expectedRevenue - expectedCosts,
          financial: {
            totalInvoiced: invoiceAggMap[p.id]?.totalInvoiced ?? 0,
            totalReceived: invoiceAggMap[p.id]?.totalReceived ?? 0,
            invoiceCount: invoiceAggMap[p.id]?.invoiceCount ?? 0,
            totalDue: payableAggMap[p.id]?.totalDue ?? 0,
            totalPaid: payableAggMap[p.id]?.totalPaid ?? 0,
          },
          activeInvoice: activeInvoiceByPhase[p.id] ?? null,
        };
      });
    }),

  getPhase: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.id));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada" });
      return phase;
    }),

  createPhase: comercialProcedure
    .input(z.object({
      campaignId: z.number(),
      label: z.string().min(1),
      periodStart: z.string(),
      periodEnd: z.string(),
      status: z.enum(PHASE_STATUS_ENUM).default("planejada"),
      notes: z.string().optional(),
      // sequence é calculado automaticamente (próximo disponível)
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Verifica campanha
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      // Próximo sequence
      const [maxSeq] = await db
        .select({ max: sql<number>`COALESCE(MAX(${campaignPhases.sequence}), 0)::int` })
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId));

      const [created] = await db
        .insert(campaignPhases)
        .values({
          campaignId: input.campaignId,
          sequence: (maxSeq?.max ?? 0) + 1,
          label: input.label,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: input.status,
          notes: input.notes ?? null,
        })
        .returning();
      return created;
    }),

  updatePhase: comercialProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().min(1).optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      status: z.enum(PHASE_STATUS_ENUM).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(campaignPhases)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(campaignPhases.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada" });
      return updated;
    }),

  // Avança ou desfaz uma etapa da timeline do batch.
  // - markStage: grava NOW() na coluna correspondente (idempotente)
  // - clearStage: zera a coluna
  advanceStage: comercialProcedure
    .input(z.object({
      phaseId: z.number(),
      stage: z.enum(["briefing", "design", "aprovacao", "producao", "distribuicao", "veiculacao", "concluida"]),
      action: z.enum(["mark", "clear"]).default("mark"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const colMap: Record<typeof input.stage, string> = {
        briefing: "briefingEnteredAt",
        design: "designEnteredAt",
        aprovacao: "aprovacaoEnteredAt",
        producao: "producaoEnteredAt",
        distribuicao: "distribuicaoEnteredAt",
        veiculacao: "veiculacaoEnteredAt",
        concluida: "concluidaAt",
      };
      const col = colMap[input.stage];
      const value = input.action === "mark" ? "NOW()" : "NULL";
      await db.execute(sql.raw(
        `UPDATE "campaign_phases" SET "${col}" = ${value}, "updatedAt" = NOW() WHERE id = ${input.phaseId}`
      ));
      // Se marcou "concluida", também muda status pra concluida
      if (input.stage === "concluida" && input.action === "mark") {
        await db.update(campaignPhases).set({ status: "concluida", updatedAt: new Date() }).where(eq(campaignPhases.id, input.phaseId));
      }
      const [updated] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.phaseId));
      return updated;
    }),

  deletePhase: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Checa se há faturas ou contas a pagar vinculadas
      const [invoiceCount] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(invoices)
        .where(eq(invoices.campaignPhaseId, input.id));
      if ((invoiceCount?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: há faturas vinculadas a esta fase. Cancele ou desvincule primeiro.",
        });
      }
      const [payableCount] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(accountsPayable)
        .where(eq(accountsPayable.campaignPhaseId, input.id));
      if ((payableCount?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: há contas a pagar vinculadas. Remova-as primeiro.",
        });
      }
      await db.delete(campaignPhases).where(eq(campaignPhases.id, input.id));
      return { success: true };
    }),

  // ── Itens ─────────────────────────────────────────────────────────────────

  createItem: comercialProcedure
    .input(z.object({
      campaignPhaseId: z.number(),
      productId: z.number(),
      quantity: z.number().int().min(1).default(1),
      unitPrice: z.string().default("0"),
      totalPrice: z.string().nullable().optional(),
      productionCost: z.string().default("0"),
      freightCost: z.string().default("0"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.campaignPhaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada" });

      const [created] = await db
        .insert(campaignItems)
        .values({
          campaignPhaseId: input.campaignPhaseId,
          productId: input.productId,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalPrice: input.totalPrice ?? null,
          productionCost: input.productionCost,
          freightCost: input.freightCost,
          notes: input.notes ?? null,
        })
        .returning();
      return created;
    }),

  updateItem: comercialProcedure
    .input(z.object({
      id: z.number(),
      quantity: z.number().int().min(1).optional(),
      unitPrice: z.string().optional(),
      totalPrice: z.string().nullable().optional(),
      productionCost: z.string().optional(),
      freightCost: z.string().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(campaignItems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(campaignItems.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      return updated;
    }),

  deleteItem: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Checa se há contas a pagar vinculadas ao item
      const [payableCount] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(accountsPayable)
        .where(eq(accountsPayable.campaignItemId, input.id));
      if ((payableCount?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: há contas a pagar vinculadas a este item.",
        });
      }
      await db.delete(campaignItems).where(eq(campaignItems.id, input.id));
      return { success: true };
    }),

  // ── Consolidação financeira da campanha (previsto vs realizado) ──────────
  // Agrega totais por fase, por produto e geral. Usado pra relatório de
  // fechamento mostrando margem real da campanha.
  consolidation: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const phases = await db
        .select()
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId))
        .orderBy(asc(campaignPhases.sequence));

      const phaseIds = phases.map((p) => p.id);

      // Itens com produto
      const items = phaseIds.length > 0
        ? await db
            .select({
              item: campaignItems,
              productName: products.name,
              productTipo: products.tipo,
              productVipProviderId: products.vipProviderId,
              productVipProviderCommissionPercent: products.vipProviderCommissionPercent,
              productIrpj: products.irpj,
              vipProviderRepassePercent: vipProviders.repassePercent,
            })
            .from(campaignItems)
            .leftJoin(products, eq(products.id, campaignItems.productId))
            .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
            .where(sql`${campaignItems.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`)
        : [];

      // Resolve % de repasse VIP (override do produto vence base do provedor).
      // Só aplica em produtos digitais (telas/janelas) com provedor configurado.
      // Bonificadas não geram repasse (consistente com financialRouter/calcVipRepasse).
      const DIGITAL_TIPOS = new Set(["telas", "janelas_digitais"]);
      const isBonificada = !!campaign.isBonificada;
      const isDigitalItem = (i: typeof items[number]): boolean =>
        !!i.productTipo && DIGITAL_TIPOS.has(i.productTipo);
      const vipRepasseRateForItem = (i: typeof items[number]): number => {
        if (isBonificada) return 0;
        if (!isDigitalItem(i)) return 0;
        if (!i.productVipProviderId) return 0;
        const override = i.productVipProviderCommissionPercent;
        if (override != null && override !== "") {
          const v = parseFloat(String(override));
          if (Number.isFinite(v)) return v / 100;
        }
        const base = parseFloat(String(i.vipProviderRepassePercent ?? "0"));
        return Number.isFinite(base) ? base / 100 : 0;
      };
      const itemRevenue = (i: typeof items[number]): number =>
        i.item.totalPrice != null
          ? parseFloat(i.item.totalPrice)
          : i.item.quantity * parseFloat(i.item.unitPrice);
      // Repasse VIP é cobrado SOBRE a receita líquida de impostos e comissão
      // comercial — espelha calcVipRepasse / DRE da campanha.
      const PIS_COFINS_RATE = 0.0365;
      const IRPJ_DEFAULT_RATE = 0.06;
      const sellerRate = (() => {
        const v = parseFloat(String(campaign.sellerCommission ?? "0"));
        return Number.isFinite(v) ? v / 100 : 0;
      })();
      const itemTaxes = (i: typeof items[number]): number => {
        const irpj = i.productIrpj != null && i.productIrpj !== ""
          ? parseFloat(String(i.productIrpj)) / 100
          : IRPJ_DEFAULT_RATE;
        return itemRevenue(i) * (irpj + PIS_COFINS_RATE);
      };
      const itemSellerComm = (i: typeof items[number]): number =>
        itemRevenue(i) * sellerRate;
      const itemVipRepasse = (i: typeof items[number]): number => {
        const rate = vipRepasseRateForItem(i);
        if (rate <= 0) return 0;
        const base = itemRevenue(i) - itemTaxes(i) - itemSellerComm(i);
        return base > 0 ? base * rate : 0;
      };
      // Regra "tela vs bolacha": digitais pulam produção/frete; físicos pulam VIP.
      const itemProductionCost = (i: typeof items[number]): number =>
        isDigitalItem(i) ? 0 : parseFloat(i.item.productionCost);
      const itemFreightCost = (i: typeof items[number]): number =>
        isDigitalItem(i) ? 0 : parseFloat(i.item.freightCost);

      // Faturas e contas a pagar da campanha (toda)
      const campaignInvoices = await db
        .select()
        .from(invoices)
        .where(eq(invoices.campaignId, input.campaignId))
        .orderBy(asc(invoices.issueDate));

      const campaignPayables = await db
        .select()
        .from(accountsPayable)
        .where(eq(accountsPayable.campaignId, input.campaignId));

      // Hoje (UTC date) para detectar vencidas
      const todayIso = new Date().toISOString().slice(0, 10);

      // Agregações por fase
      const phaseBreakdown = phases.map((p) => {
        const phaseItems = items.filter((i) => i.item.campaignPhaseId === p.id);
        const expectedRevenue = phaseItems.reduce((s, i) => s + itemRevenue(i), 0);
        // Custos previstos = produção + frete (físicos) + repasse VIP (digitais).
        const expectedCosts = phaseItems.reduce(
          (s, i) => s + itemProductionCost(i) + itemFreightCost(i) + itemVipRepasse(i),
          0,
        );

        const phaseInvoices = campaignInvoices.filter((inv) => inv.campaignPhaseId === p.id);
        const invoiced = phaseInvoices
          .filter((inv) => inv.status !== "cancelada" && inv.status !== "prevista")
          .reduce((s, inv) => s + parseFloat(inv.amount), 0);
        const received = phaseInvoices
          .filter((inv) => inv.status === "paga")
          .reduce((s, inv) => s + parseFloat(inv.amount), 0);

        const phasePayables = campaignPayables.filter((ap) => ap.campaignPhaseId === p.id);
        const payableDue = phasePayables
          .filter((ap) => ap.status !== "cancelado")
          .reduce((s, ap) => s + parseFloat(ap.amount), 0);
        const paid = phasePayables
          .filter((ap) => ap.status === "pago")
          .reduce((s, ap) => s + parseFloat(ap.amount), 0);

        // Fatura ativa do batch (1 ativa por phase). Se há mais de uma
        // não-cancelada (caso de refaturamento mal feito), usa a mais recente.
        const activeInvoices = phaseInvoices
          .filter((inv) => inv.status !== "cancelada")
          .sort((a, b) => (a.id < b.id ? 1 : -1));
        const activeInvoice = activeInvoices[0] ?? null;
        const invoiceStatus: "paga" | "emitida" | "vencida" | "prevista" | "cancelada" | "none" = (() => {
          if (!activeInvoice) return "none";
          if (activeInvoice.status === "paga") return "paga";
          if (activeInvoice.status === "emitida") {
            return activeInvoice.dueDate < todayIso ? "vencida" : "emitida";
          }
          if (activeInvoice.status === "vencida") return "vencida";
          if (activeInvoice.status === "prevista") return "prevista";
          return "cancelada";
        })();

        return {
          phaseId: p.id,
          sequence: p.sequence,
          label: p.label,
          status: p.status,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          itemCount: phaseItems.length,
          expectedRevenue,
          expectedCosts,
          expectedMargin: expectedRevenue - expectedCosts,
          invoiced,
          received,
          payableDue,
          paid,
          realMargin: received - paid,
          realMarginPct: received > 0 ? ((received - paid) / received) * 100 : 0,
          invoice: activeInvoice ? {
            id: activeInvoice.id,
            invoiceNumber: activeInvoice.invoiceNumber,
            amount: parseFloat(activeInvoice.amount),
            status: invoiceStatus,
            rawStatus: activeInvoice.status,
            issueDate: activeInvoice.issueDate,
            dueDate: activeInvoice.dueDate,
            paymentDate: activeInvoice.paymentDate,
            documentUrl: activeInvoice.documentUrl,
          } : null,
          duplicateInvoiceCount: activeInvoices.length > 1 ? activeInvoices.length : 0,
        };
      });

      // Breakdown por produto (agregado em todas as fases)
      const productAgg: Record<number, {
        productId: number;
        productName: string;
        productTipo: string | null;
        totalQuantity: number;
        totalRevenue: number;
        totalProductionCost: number;
        totalFreightCost: number;
        totalVipRepasse: number;
        phaseCount: number;
      }> = {};
      for (const i of items) {
        const { item, productName, productTipo } = i;
        const agg = productAgg[item.productId] ?? {
          productId: item.productId,
          productName: productName ?? "—",
          productTipo,
          totalQuantity: 0,
          totalRevenue: 0,
          totalProductionCost: 0,
          totalFreightCost: 0,
          totalVipRepasse: 0,
          phaseCount: 0,
        };
        agg.totalQuantity += item.quantity;
        agg.totalRevenue += itemRevenue(i);
        agg.totalProductionCost += itemProductionCost(i);
        agg.totalFreightCost += itemFreightCost(i);
        agg.totalVipRepasse += itemVipRepasse(i);
        agg.phaseCount += 1;
        productAgg[item.productId] = agg;
      }
      const productBreakdown = Object.values(productAgg);

      // Totais gerais
      const summary = {
        expectedRevenue: phaseBreakdown.reduce((s, p) => s + p.expectedRevenue, 0),
        expectedCosts: phaseBreakdown.reduce((s, p) => s + p.expectedCosts, 0),
        invoiced: phaseBreakdown.reduce((s, p) => s + p.invoiced, 0),
        received: phaseBreakdown.reduce((s, p) => s + p.received, 0),
        payableDue: phaseBreakdown.reduce((s, p) => s + p.payableDue, 0),
        paid: phaseBreakdown.reduce((s, p) => s + p.paid, 0),
      };
      const computed = {
        expectedMargin: summary.expectedRevenue - summary.expectedCosts,
        expectedMarginPct: summary.expectedRevenue > 0 ? ((summary.expectedRevenue - summary.expectedCosts) / summary.expectedRevenue) * 100 : 0,
        realMargin: summary.received - summary.paid,
        realMarginPct: summary.received > 0 ? ((summary.received - summary.paid) / summary.received) * 100 : 0,
        invoicedVsExpectedPct: summary.expectedRevenue > 0 ? (summary.invoiced / summary.expectedRevenue) * 100 : 0,
        receivedVsInvoicedPct: summary.invoiced > 0 ? (summary.received / summary.invoiced) * 100 : 0,
        paidVsDuePct: summary.payableDue > 0 ? (summary.paid / summary.payableDue) * 100 : 0,
      };

      return {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          isBonificada: (campaign as any).isBonificada ?? false,
        },
        summary: { ...summary, ...computed },
        phaseBreakdown,
        productBreakdown,
      };
    }),

  // ── Wizard: cria campanha completa com fases e itens de uma vez ──────────
  // Não cria a campanha (isso é do campaignRouter); apenas fases + itens em
  // lote. Útil pro wizard de criação/edição em massa.
  bulkCreate: comercialProcedure
    .input(z.object({
      campaignId: z.number(),
      phases: z.array(z.object({
        label: z.string().min(1),
        periodStart: z.string(),
        periodEnd: z.string(),
        status: z.enum(PHASE_STATUS_ENUM).default("planejada"),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().int().min(1).default(1),
          unitPrice: z.string().default("0"),
          productionCost: z.string().default("0"),
          freightCost: z.string().default("0"),
        })).default([]),
      })),
      replaceExisting: z.boolean().default(false),
      autoScheduleInvoices: z.boolean().default(true),
      dueOffsetDays: z.number().int().min(0).max(120).default(15),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      // Toda a operação (deleção opcional + phases + items + faturas previstas)
      // roda numa transação única — atomicidade garante que não ficamos com
      // batches sem cronograma de faturamento em caso de falha parcial.
      return await db.transaction(async (tx: any) => {
        if (input.replaceExisting) {
          await tx.delete(campaignPhases).where(eq(campaignPhases.campaignId, input.campaignId));
        }

        const [maxSeq] = await tx
          .select({ max: sql<number>`COALESCE(MAX(${campaignPhases.sequence}), 0)::int` })
          .from(campaignPhases)
          .where(eq(campaignPhases.campaignId, input.campaignId));
        let nextSeq = (maxSeq?.max ?? 0) + 1;

        const createdPhases: Array<{ phaseId: number; itemIds: number[] }> = [];

        for (const ph of input.phases) {
          const [createdPhase] = await tx
            .insert(campaignPhases)
            .values({
              campaignId: input.campaignId,
              sequence: nextSeq++,
              label: ph.label,
              periodStart: ph.periodStart,
              periodEnd: ph.periodEnd,
              status: ph.status,
            })
            .returning();

          const itemIds: number[] = [];
          for (const it of ph.items) {
            const total = (parseFloat(it.unitPrice) * it.quantity).toFixed(2);
            const [createdItem] = await tx
              .insert(campaignItems)
              .values({
                campaignPhaseId: createdPhase.id,
                productId: it.productId,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                totalPrice: total,
                productionCost: it.productionCost,
                freightCost: it.freightCost,
              })
              .returning();
            itemIds.push(createdItem.id);
          }

          createdPhases.push({ phaseId: createdPhase.id, itemIds });
        }

        let scheduledInvoices = 0;
        if (input.autoScheduleInvoices && createdPhases.length > 0) {
          const addDays = (iso: string, days: number) => {
            const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
            d.setUTCDate(d.getUTCDate() + days);
            return d.toISOString().slice(0, 10);
          };
          const newPhaseIds = createdPhases.map((cp) => cp.phaseId);
          const phaseRows = await tx.select().from(campaignPhases).where(sql`${campaignPhases.id} IN (${sql.join(newPhaseIds.map((id) => sql`${id}`), sql`, `)})`);
          const itemRows = await tx.select().from(campaignItems).where(sql`${campaignItems.campaignPhaseId} IN (${sql.join(newPhaseIds.map((id) => sql`${id}`), sql`, `)})`);
          const revenueByPhase: Record<number, number> = {};
          for (const it of itemRows) {
            const v = it.totalPrice != null
              ? parseFloat(it.totalPrice)
              : it.quantity * parseFloat(it.unitPrice);
            revenueByPhase[it.campaignPhaseId] = (revenueByPhase[it.campaignPhaseId] ?? 0) + v;
          }
          const existing = await tx
            .select({ phaseId: invoices.campaignPhaseId })
            .from(invoices)
            .where(sql`${invoices.campaignPhaseId} IN (${sql.join(newPhaseIds.map((id) => sql`${id}`), sql`, `)}) AND ${invoices.status} <> 'cancelada'`);
          const skip = new Set<number>(existing.map((r: any) => r.phaseId).filter((x: any): x is number => x != null));

          const toInsert: any[] = [];
          for (const p of phaseRows) {
            if (skip.has(p.id)) continue;
            toInsert.push({
              campaignId: input.campaignId,
              campaignPhaseId: p.id,
              clientId: campaign.clientId,
              invoiceNumber: `PREV-${input.campaignId}-${p.sequence}`,
              amount: (revenueByPhase[p.id] ?? 0).toFixed(2),
              billingType: "bruto" as const,
              issueDate: p.periodStart,
              dueDate: addDays(p.periodStart, input.dueOffsetDays),
              status: "prevista" as const,
              notes: `Fatura prevista — Batch ${p.sequence} (${p.label})`,
            });
          }
          if (toInsert.length > 0) {
            await tx.insert(invoices).values(toInsert);
            scheduledInvoices = toInsert.length;
          }
        }

        return { createdPhases, count: createdPhases.length, scheduledInvoices };
      });
    }),

  // ── Aba Financeiro do batch — fonte única ──────────────────────────────
  // Retorna tudo que a UI do batch precisa: phase, items, campaign,
  // financials (calcPhaseFinancials), invoice única, payables filtrados,
  // overrides e dados do parceiro p/ exibir BV.
  getFinancials: comercialProcedure
    .input(z.object({ phaseId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.phaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Batch não encontrado" });
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, phase.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const itemRows = await db
        .select({
          item: campaignItems,
          productTipo: products.tipo,
          productName: products.name,
          productIrpj: products.irpj,
          productVipProviderId: products.vipProviderId,
          productVipProviderCommissionPercent: products.vipProviderCommissionPercent,
          vipProviderRepassePercent: vipProviders.repassePercent,
        })
        .from(campaignItems)
        .leftJoin(products, eq(products.id, campaignItems.productId))
        .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
        .where(eq(campaignItems.campaignPhaseId, input.phaseId));

      const itemsForCalc: PhaseItemLike[] = itemRows.map((r) => ({
        productTipo: r.productTipo ?? null,
        quantity: r.item.quantity,
        unitPrice: r.item.unitPrice,
        totalPrice: r.item.totalPrice,
        productionCost: r.item.productionCost ?? 0,
        freightCost: r.item.freightCost ?? 0,
        productIrpj: r.productIrpj ?? null,
        vipProviderRepassePercent: r.vipProviderRepassePercent ?? null,
        productVipProviderCommissionPercent: r.productVipProviderCommissionPercent ?? null,
        vipProviderId: r.productVipProviderId ?? null,
      }));

      const partner = await resolvePartnerForCampaignBasic(db, campaign);

      const overrides = extractOverridesFromPhase(phase);
      const calcInput = {
        items: itemsForCalc,
        campaign: {
          isBonificada: campaign.isBonificada,
          restaurantCommission: campaign.restaurantCommission ?? 0,
          sellerCommission: campaign.sellerCommission ?? 0,
          agencyBvPercent: (campaign as any).agencyBvPercent ?? null,
          hasAgencyBv: (campaign as any).hasAgencyBv ?? null,
          partnerCommissionPercent: partner?.commissionPercent ?? null,
          partnerGrossUpRate: (partner as any)?.grossUpRate ?? null,
          globalBvGrossUpRate: null,
        },
      } as const;
      const financials = calcPhaseFinancials({ ...calcInput, overrides });
      // Para a coluna "Campanha (herdado)" da UI: rodamos o cálculo SEM
      // overrides do batch e devolvemos os valores efetivos resultantes.
      const financialsInherited = calcPhaseFinancials({ ...calcInput, overrides: {} });
      const inherited = {
        taxRate: financialsInherited.effective.taxRate.value,
        restaurantCommission: financialsInherited.effective.restaurantCommission.value,
        vipRepasse: financialsInherited.effective.vipRepasse.value,
        bvPercent: financialsInherited.effective.bvPercent.value,
        grossUpRate: financialsInherited.effective.grossUpRate.value,
        freightCost: financialsInherited.effective.freightCost.value,
        productionCost: financialsInherited.effective.productionCost.value,
      };

      // Fatura "atual" do batch: prioriza a mais recente NÃO cancelada;
      // se todas estiverem canceladas, devolve a última cancelada para
      // o front renderizar o CTA "Gerar nova".
      const [activeInv] = await db.select().from(invoices)
        .where(and(
          eq(invoices.campaignPhaseId, input.phaseId),
          sql`${invoices.status} <> 'cancelada'`,
        ))
        .orderBy(desc(invoices.id))
        .limit(1);
      let invoice = activeInv;
      if (!invoice) {
        const [lastCancelled] = await db.select().from(invoices)
          .where(eq(invoices.campaignPhaseId, input.phaseId))
          .orderBy(desc(invoices.id))
          .limit(1);
        invoice = lastCancelled;
      }

      // Payables EXCLUSIVAMENTE deste batch — escopo estrito por
      // campaignPhaseId. APs agregados (BV mensal/multi-batch) são
      // expostos separadamente quando necessário; não entram nesta lista.
      const payables = await db.select().from(accountsPayable)
        .where(eq(accountsPayable.campaignPhaseId, input.phaseId));

      return {
        phase,
        campaign,
        items: itemRows,
        financials,
        inherited,
        invoice: invoice ?? null,
        payables,
        overrides,
        partner: partner ? { id: partner.id, name: partner.name, commissionPercent: partner.commissionPercent } : null,
      };
    }),

  setOverride: comercialProcedure
    .input(z.object({
      phaseId: z.number(),
      field: z.enum(PHASE_OVERRIDE_FIELDS),
      value: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.phaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Batch não encontrado" });
      const before = (phase as any)[input.field];
      const updates: any = {
        [input.field]: input.value,
        overrideUpdatedAt: new Date(),
        overrideUpdatedBy: ctx.user.id,
        updatedAt: new Date(),
      };
      const [updated] = await db.update(campaignPhases).set(updates).where(eq(campaignPhases.id, input.phaseId)).returning();
      const regen = await softRegenPredictedPayables(db as any, input.phaseId);
      try {
        await recordAudit(db as any, { user: { id: ctx.user.id, role: (ctx.user as any).role ?? null } }, {
          entityType: "campaign_phase",
          entityId: input.phaseId,
          action: "set_override",
          before: { [input.field]: before },
          after: { [input.field]: input.value },
          metadata: { field: input.field, regen },
        });
      } catch {}
      return { ...updated, regen };
    }),

  clearOverride: comercialProcedure
    .input(z.object({
      phaseId: z.number(),
      field: z.enum(PHASE_OVERRIDE_FIELDS),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.phaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Batch não encontrado" });
      const before = (phase as any)[input.field];
      const updates: any = {
        [input.field]: null,
        overrideUpdatedAt: new Date(),
        overrideUpdatedBy: ctx.user.id,
        updatedAt: new Date(),
      };
      const [updated] = await db.update(campaignPhases).set(updates).where(eq(campaignPhases.id, input.phaseId)).returning();
      const regen = await softRegenPredictedPayables(db as any, input.phaseId);
      try {
        await recordAudit(db as any, { user: { id: ctx.user.id, role: (ctx.user as any).role ?? null } }, {
          entityType: "campaign_phase",
          entityId: input.phaseId,
          action: "clear_override",
          before: { [input.field]: before },
          after: { [input.field]: null },
          metadata: { field: input.field, regen },
        });
      } catch {}
      return { ...updated, regen };
    }),

  // Geração idempotente: dispara o materializer da fatura do batch.
  // Se ela está 'emitida', cria APs de imposto. Se 'paga', cria também
  // restaurante/VIP/BV. Sem efeito se nenhuma fatura existe.
  generatePayables: comercialProcedure
    .input(z.object({ phaseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.phaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Batch não encontrado" });
      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.campaignPhaseId, input.phaseId), sql`${invoices.status} <> 'cancelada'`))
        .orderBy(desc(invoices.id)).limit(1);
      if (!invoice) return { created: 0, updated: 0, message: "Sem fatura para este batch — agende em Consolidado." };

      let totalCreated = 0;
      let totalUpdated = 0;
      if (invoice.status === "emitida" || invoice.status === "paga") {
        const r1 = await materializePayablesForInvoice(db as any, invoice.id, "emitida");
        totalCreated += r1.created; totalUpdated += r1.updated;
      }
      if (invoice.status === "paga") {
        const r2 = await materializePayablesForInvoice(db as any, invoice.id, "paga");
        totalCreated += r2.created; totalUpdated += r2.updated;
      }
      try {
        await recordAudit(db as any, { user: { id: ctx.user.id, role: (ctx.user as any).role ?? null } }, {
          entityType: "campaign_phase",
          entityId: input.phaseId,
          action: "generate",
          metadata: { invoiceId: invoice.id, created: totalCreated, updated: totalUpdated },
        });
      } catch {}
      return { created: totalCreated, updated: totalUpdated };
    }),

  regeneratePayables: comercialProcedure
    .input(z.object({ phaseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.phaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Batch não encontrado" });
      const [invoice] = await db.select().from(invoices)
        .where(and(eq(invoices.campaignPhaseId, input.phaseId), sql`${invoices.status} <> 'cancelada'`))
        .orderBy(desc(invoices.id)).limit(1);
      if (!invoice) return { regenerated: 0, cancelled: 0 };

      // Cancela só os 'pendente' criados pelo sistema (preserva pago/cancelado).
      const cancelled = await db.update(accountsPayable).set({
        status: "cancelada", updatedAt: new Date(),
      }).where(and(
        sql`(${accountsPayable.sourceRef}->>'invoiceId') = ${String(invoice.id)}`,
        eq(accountsPayable.status, "pendente"),
        eq(accountsPayable.createdBySystem, true),
      )).returning();

      let totalCreated = 0;
      if (invoice.status === "emitida" || invoice.status === "paga") {
        const r1 = await materializePayablesForInvoice(db as any, invoice.id, "emitida");
        totalCreated += r1.created;
      }
      if (invoice.status === "paga") {
        const r2 = await materializePayablesForInvoice(db as any, invoice.id, "paga");
        totalCreated += r2.created;
      }
      try {
        await recordAudit(db as any, { user: { id: ctx.user.id, role: (ctx.user as any).role ?? null } }, {
          entityType: "campaign_phase",
          entityId: input.phaseId,
          action: "regenerate_payables",
          metadata: { invoiceId: invoice.id, cancelled: cancelled.length, created: totalCreated },
        });
      } catch {}
      return { regenerated: totalCreated, cancelled: cancelled.length };
    }),
});
