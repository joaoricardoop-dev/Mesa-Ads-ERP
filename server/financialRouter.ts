import { adminProcedure, financeiroProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb, updateRestaurantPayment as updateRestaurantPaymentDb } from "./db";
import {
  invoices,
  operationalCosts,
  campaigns,
  clients,
  restaurantPayments,
  activeRestaurants,
  quotations,
  partners,
  serviceOrders,
  accountsPayable,
  suppliers,
  products,
  vipProviders,
  campaignPhases,
  campaignItems,
} from "../drizzle/schema";
import { users } from "@shared/models/auth";
import { VIP_PRODUCT_TIPOS } from "./productRouter";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { materializePayablesForInvoice, type DbClient } from "./finance/payables";
import { recordAudit } from "./finance/audit";
import { audited } from "./finance/auditMiddleware";
import { financialAuditLog } from "../drizzle/schema";

function requireFinancialAccess(role: string | null) {
  if (role !== "admin" && role !== "financeiro" && role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao módulo financeiro" });
  }
}

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Nossa parte" (net amount) = valor bruto da fatura menos todos os repasses:
//   • Comissão do restaurante (campaigns.restaurantCommission %)
//   • Repasse ao provedor de sala VIP (produtos tipo telas/janelas_digitais)
// Campanhas bonificadas (isBonificada) não geram repasse, então net = gross.
//
// Esta expressão SQL é usada tanto em agregações (SUM) quanto em linhas
// individuais. O FROM precisa fazer LEFT JOIN em campaigns + products + vip_providers.
// ─────────────────────────────────────────────────────────────────────────────
const NET_AMOUNT_SQL = sql<string>`
  CASE WHEN COALESCE(${campaigns.isBonificada}, false) THEN ${invoices.amount}::numeric
  ELSE
    ${invoices.amount}::numeric
    - (${invoices.amount}::numeric * (COALESCE(${campaigns.restaurantCommission}, 0)::numeric / 100))
    - (
        CASE
          WHEN ${products.tipo} IN ('telas', 'janelas_digitais') AND ${products.vipProviderId} IS NOT NULL
          THEN ${invoices.amount}::numeric * (
            COALESCE(${products.vipProviderCommissionPercent}::numeric, ${vipProviders.repassePercent}::numeric, 0) / 100
          )
          ELSE 0
        END
      )
    - (
        -- ISS retido pelo tomador reduz o líquido que recebemos.
        -- ISS não retido: empresa recolhe depois; não entra aqui.
        CASE WHEN COALESCE(${invoices.issRetained}, false)
          THEN ${invoices.amount}::numeric * (COALESCE(${invoices.issRate}, 0)::numeric / 100)
          ELSE 0
        END
      )
  END
`;

// Helpers para agregar net sobre um conjunto de condições. A query resultante
// já inclui os joins necessários com campaigns/products/vip_providers.
function buildNetInvoiceQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return db
    .select({ total: sql<string>`COALESCE(SUM(${NET_AMOUNT_SQL}), 0)` })
    .from(invoices)
    .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
    .leftJoin(products, eq(products.id, campaigns.productId))
    .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId));
}

function buildNetInvoiceCountQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return db
    .select({
      total: sql<string>`COALESCE(SUM(${NET_AMOUNT_SQL}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(invoices)
    .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
    .leftJoin(products, eq(products.id, campaigns.productId))
    .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId));
}

// ─────────────────────────────────────────────────────────────────────────────
// GROSS = valor cheio da fatura (sem deduzir comissão restaurante nem repasse
// VIP). Usado nas visões "Receita Total" do painel.
// ─────────────────────────────────────────────────────────────────────────────
function buildGrossInvoiceQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return db
    .select({ total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)` })
    .from(invoices);
}

function buildGrossInvoiceCountQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return db
    .select({
      total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(invoices);
}

// Deduções que viram CUSTO operacional (comissão restaurante + repasse sala VIP).
// Bonificadas e ISS retido ficam de fora — bonificadas não geram repasse e ISS
// é tributo, não custo.
const DEDUCTION_AMOUNT_SQL = sql<string>`
  CASE WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
  ELSE
    (${invoices.amount}::numeric * (COALESCE(${campaigns.restaurantCommission}, 0)::numeric / 100))
    + (
        CASE
          WHEN ${products.tipo} IN ('telas', 'janelas_digitais') AND ${products.vipProviderId} IS NOT NULL
          THEN ${invoices.amount}::numeric * (
            COALESCE(${products.vipProviderCommissionPercent}::numeric, ${vipProviders.repassePercent}::numeric, 0) / 100
          )
          ELSE 0
        END
      )
  END
`;

function buildDeductionQuery(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  return db
    .select({ total: sql<string>`COALESCE(SUM(${DEDUCTION_AMOUNT_SQL}), 0)` })
    .from(invoices)
    .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
    .leftJoin(products, eq(products.id, campaigns.productId))
    .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sincroniza accounts_payable (produção + frete) com os custos operacionais
// da campanha. Regras:
//   • Gera `contractDuration` parcelas por tipo (1 parcela = 1 mês).
//   • Parcelas JÁ PAGAS nunca são apagadas nem alteradas.
//   • Parcelas PENDENTES/CANCELADAS são recriadas conforme o valor atual.
//   • Se custo vira 0, remove as pendentes (mantém as pagas como histórico).
//
// Isso mantém Custos ↔ Contas a Pagar sempre em sincronia a partir da edição
// na tela de Custos.
// ─────────────────────────────────────────────────────────────────────────────
async function syncCampaignCostPayables(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  campaignId: number,
  costs: { productionCost: number; freightCost: number },
): Promise<{ type: string; created: number; removed: number }[]> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) return [];

  // ── Regra tela vs bolacha ────────────────────────────────────────────────
  // Produtos digitais (telas / janelas digitais) não geram custo de produção
  // física nem frete — apenas repasse_vip (gerado em outro fluxo).
  // Coaster (bolacha) e demais produtos físicos mantêm produção + frete.
  let productTipo: string | null = null;
  if (campaign.productId) {
    const [prod] = await db.select({ tipo: products.tipo }).from(products).where(eq(products.id, campaign.productId)).limit(1);
    productTipo = prod?.tipo ?? null;
  }
  const isDigitalOnly = productTipo === "telas" || productTipo === "janelas_digitais";
  const effectiveProduction = isDigitalOnly ? 0 : costs.productionCost;
  const effectiveFreight = isDigitalOnly ? 0 : costs.freightCost;

  const duration = Math.max(1, campaign.contractDuration ?? 1);
  const today = new Date();
  const summary: { type: string; created: number; removed: number }[] = [];

  for (const { type, totalValue, label, recipient } of [
    { type: "producao", totalValue: effectiveProduction, label: "Produção Gráfica", recipient: "fornecedor" },
    { type: "frete", totalValue: effectiveFreight, label: "Frete/Logística", recipient: "transportadora" },
  ] as const) {
    // Custo total já está "mensal" no operational_costs (padrão atual).
    // Portanto cada parcela = totalValue (não dividimos).
    const installmentAmount = Number(totalValue.toFixed(2));

    // Remove pendentes/canceladas existentes deste tipo/campanha
    const existing = await db
      .select()
      .from(accountsPayable)
      .where(and(
        eq(accountsPayable.campaignId, campaignId),
        eq(accountsPayable.type, type),
      ));

    const paidCount = existing.filter((e) => e.status === "pago").length;
    const toRemove = existing.filter((e) => e.status !== "pago");

    for (const entry of toRemove) {
      await db.delete(accountsPayable).where(eq(accountsPayable.id, entry.id));
    }

    // Quantas novas parcelas precisamos criar?
    const remaining = Math.max(0, duration - paidCount);
    const shouldCreate = installmentAmount > 0 ? remaining : 0;

    for (let i = 0; i < shouldCreate; i++) {
      const installmentIndex = paidCount + i + 1;
      const dueDate = new Date(today.getFullYear(), today.getMonth() + i, today.getDate());
      await db.insert(accountsPayable).values({
        campaignId,
        type,
        description: `${label} - Mês ${installmentIndex}/${duration}`,
        amount: installmentAmount.toFixed(2),
        recipientType: recipient,
        status: "pendente",
        dueDate: dueDate.toISOString().split("T")[0],
      });
    }

    summary.push({ type, created: shouldCreate, removed: toRemove.length });
  }

  return summary;
}

function uniqueIds(arr: (number | null | undefined)[]): number[] {
  const set = new Set<number>();
  for (const v of arr) if (v != null) set.add(v);
  return Array.from(set);
}

export const financialRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
    const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // ── Invoice totals by status (valor BRUTO = receita total) ───────────────
    const invoicesByStatus = await db
      .select({
        status: invoices.status,
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`,
      })
      .from(invoices)
      .groupBy(invoices.status);

    const invByStatus: Record<string, { count: number; total: number }> = {};
    for (const row of invoicesByStatus) {
      invByStatus[row.status] = { count: row.count, total: parseFloat(row.total) };
    }

    // Overdue = emitida past due date (bruto)
    const overdueResult = await buildGrossInvoiceCountQuery(db)
      .where(and(eq(invoices.status, "emitida"), lte(invoices.dueDate, today)));

    // Invoiced this month (emitida + paga issued this month) - bruto
    const invoicedThisMonthResult = await buildGrossInvoiceQuery(db)
      .where(and(
        sql`${invoices.status} NOT IN ('cancelada')`,
        gte(invoices.issueDate, monthStart),
        lte(invoices.issueDate, monthEnd),
      ));

    // Received this month (paga) - bruto
    const paidThisMonthResult = await buildGrossInvoiceQuery(db)
      .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, monthStart), lte(invoices.paymentDate, monthEnd)));

    // Deduções (comissão restaurante + repasse VIP) sobre faturas emitidas
    // este mês — entram como custo operacional do mês.
    const deductionsThisMonthResult = await buildDeductionQuery(db)
      .where(and(
        sql`${invoices.status} NOT IN ('cancelada')`,
        gte(invoices.issueDate, monthStart),
        lte(invoices.issueDate, monthEnd),
      ));

    // ── Pending restaurant payments (lê do ledger único — finrefac fase 2) ──
    const pendingRpResult = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`COUNT(*)::int` })
      .from(accountsPayable)
      .where(and(
        eq(accountsPayable.sourceType, "restaurant_commission"),
        eq(accountsPayable.status, "pendente"),
      ));

    // ── Active campaigns count ─────────────────────────────────────────────────
    const activeCampaignsResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(campaigns)
      .where(inArray(campaigns.status, ["active", "briefing", "design", "aprovacao", "veiculacao", "executar", "producao", "transito", "distribuicao"]));

    // ── Operational costs totals ──────────────────────────────────────────────
    const costData = await db
      .select({
        totalProduction: sql<string>`COALESCE(SUM("productionCost"::numeric), 0)`,
        totalFreight: sql<string>`COALESCE(SUM("freightCost"::numeric), 0)`,
      })
      .from(operationalCosts);

    // Total pago de comissão de restaurante (ledger único — finrefac fase 2).
    const rpPaidTotal = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(accountsPayable)
      .where(and(
        eq(accountsPayable.sourceType, "restaurant_commission"),
        eq(accountsPayable.status, "pago"),
      ));

    // ── Monthly chart: last 6 months, invoiced vs received (BRUTOS) ─────────
    const monthlyData: { month: string; invoiced: number; received: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mStart = d.toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const [inv, rcv] = await Promise.all([
        buildGrossInvoiceQuery(db)
          .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, mStart), lte(invoices.issueDate, mEnd))),
        buildGrossInvoiceQuery(db)
          .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, mStart), lte(invoices.paymentDate, mEnd))),
      ]);
      monthlyData.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        invoiced: parseFloat(inv[0]?.total || "0"),
        received: parseFloat(rcv[0]?.total || "0"),
      });
    }

    // ── Upcoming invoices (due in next 30 days, not yet paid) — bruto ───────
    const upcomingRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount, // bruto = receita total
        dueDate: invoices.dueDate,
        clientId: invoices.clientId,
        campaignId: invoices.campaignId,
      })
      .from(invoices)
      .where(and(
        eq(invoices.status, "emitida"),
        gte(invoices.dueDate, today),
        lte(invoices.dueDate, next30Days),
      ))
      .orderBy(invoices.dueDate);

    const upcomingCampaignIds = uniqueIds(upcomingRows.map((r) => r.campaignId));
    const upcomingClientIds = uniqueIds(upcomingRows.map((r) => r.clientId));
    const upCampMap: Record<number, string> = {};
    const upCliMap: Record<number, string> = {};
    if (upcomingCampaignIds.length > 0) {
      const rows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, upcomingCampaignIds));
      for (const r of rows) upCampMap[r.id] = r.name;
    }
    if (upcomingClientIds.length > 0) {
      const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, upcomingClientIds));
      for (const r of rows) upCliMap[r.id] = r.name;
    }
    const upcomingInvoices = upcomingRows.map((r) => ({
      ...r,
      campaignName: upCampMap[r.campaignId] || "—",
      clientName: upCliMap[r.clientId] || "—",
    }));

    // ── Legacy revenue for old monthly chart ──────────────────────────────
    const monthlyRevenue = monthlyData.map((m) => ({ month: m.month, revenue: m.received }));

    // ──────────────────────────────────────────────────────────────────────────
    // `revenue` e `invoicedThisMonth` agora são BRUTOS (receita total cheia).
    // `totalCosts` inclui produção + frete + deduções operacionais
    // (comissão restaurante + repasse VIP) deste mês.
    // ──────────────────────────────────────────────────────────────────────────
    const revenue = parseFloat(paidThisMonthResult[0]?.total || "0");
    const invoicedThisMonth = parseFloat(invoicedThisMonthResult[0]?.total || "0");
    const production = parseFloat(costData[0]?.totalProduction || "0");
    const freight = parseFloat(costData[0]?.totalFreight || "0");
    const restaurantCosts = parseFloat(rpPaidTotal[0]?.total || "0");
    const deductionsThisMonth = parseFloat(deductionsThisMonthResult[0]?.total || "0");
    const totalCosts = production + freight + deductionsThisMonth;
    const margin = revenue - totalCosts;

    return {
      revenue,
      invoicedThisMonth,
      totalCosts,
      margin,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
      overdue: parseFloat(overdueResult[0]?.total || "0"),
      overdueCount: overdueResult[0]?.count || 0,
      receivables: invByStatus["emitida"]?.total || 0,
      receivablesCount: invByStatus["emitida"]?.count || 0,
      paidTotal: invByStatus["paga"]?.total || 0,
      pendingRestaurantPayments: parseFloat(pendingRpResult[0]?.total || "0"),
      pendingRestaurantCount: pendingRpResult[0]?.count || 0,
      activeCampaigns: activeCampaignsResult[0]?.count || 0,
      costBreakdown: { production, freight, restaurantCosts },
      invoiceStatusSummary: invByStatus,
      monthlyRevenue,
      monthlyData,
      upcomingInvoices,
      pipeline: Number(activeCampaignsResult[0]?.count || 0),
    };
  }),

  dashboardExpanded: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.toISOString().split("T")[0];
    const ytdStart = `${currentYear}-01-01`;
    const currMonthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
    const currMonthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthStart = new Date(prevYear, prevMonth, 1).toISOString().split("T")[0];
    const prevMonthEnd = new Date(prevYear, prevMonth + 1, 0).toISOString().split("T")[0];

    // ── YTD & current month revenue (BRUTOS = receita total) ────────────────
    const [
      ytdInvoiced, ytdReceived, currInvoiced, currReceived, prevInvoiced, prevReceived,
      ytdDeductions, currDeductions, prevDeductions,
    ] = await Promise.all([
      buildGrossInvoiceQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, ytdStart), lte(invoices.issueDate, today))),
      buildGrossInvoiceQuery(db)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, ytdStart), lte(invoices.paymentDate, today))),
      buildGrossInvoiceQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, currMonthStart), lte(invoices.issueDate, currMonthEnd))),
      buildGrossInvoiceQuery(db)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, currMonthStart), lte(invoices.paymentDate, currMonthEnd))),
      buildGrossInvoiceQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, prevMonthStart), lte(invoices.issueDate, prevMonthEnd))),
      buildGrossInvoiceQuery(db)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, prevMonthStart), lte(invoices.paymentDate, prevMonthEnd))),
      buildDeductionQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, ytdStart), lte(invoices.issueDate, today))),
      buildDeductionQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, currMonthStart), lte(invoices.issueDate, currMonthEnd))),
      buildDeductionQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, prevMonthStart), lte(invoices.issueDate, prevMonthEnd))),
    ]);

    // ── Total costs (no date on operational_costs) ──────────────────────────
    const [totalCostRows, ytdRpRows, allRpRows, currRpRows, prevRpRows] = await Promise.all([
      db.select({
        production: sql<string>`COALESCE(SUM("productionCost"::numeric), 0)`,
        freight: sql<string>`COALESCE(SUM("freightCost"::numeric), 0)`,
      }).from(operationalCosts),
      // Restaurant commission costs lidos do ledger único (finrefac fase 2).
      // Janelas temporais usam competenceMonth (YYYY-MM) para que updates
      // não desloquem históricos: createdAt é hora de gravação, não período.
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(accountsPayable)
        .where(and(eq(accountsPayable.sourceType, "restaurant_commission"), eq(accountsPayable.status, "pago"), gte(accountsPayable.competenceMonth, ytdStart.slice(0, 7)))),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`COUNT(*)::int` })
        .from(accountsPayable).where(and(eq(accountsPayable.sourceType, "restaurant_commission"), eq(accountsPayable.status, "pago"))),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(accountsPayable)
        .where(and(eq(accountsPayable.sourceType, "restaurant_commission"), eq(accountsPayable.status, "pago"), eq(accountsPayable.competenceMonth, currMonthStart.slice(0, 7)))),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(accountsPayable)
        .where(and(eq(accountsPayable.sourceType, "restaurant_commission"), eq(accountsPayable.status, "pago"), eq(accountsPayable.competenceMonth, prevMonthStart.slice(0, 7)))),
    ]);

    const totalProduction = parseFloat(totalCostRows[0]?.production || "0");
    const totalFreight = parseFloat(totalCostRows[0]?.freight || "0");
    const ytdRpCosts = parseFloat(ytdRpRows[0]?.total || "0");
    const allRpPaid = parseFloat(allRpRows[0]?.total || "0");
    const currRpCosts = parseFloat(currRpRows[0]?.total || "0");
    const prevRpCosts = parseFloat(prevRpRows[0]?.total || "0");

    // ── 12-month series (invoiced/received BRUTOS; rpCosts mantido bruto) ───
    const monthlySeries: { month: string; invoiced: number; received: number; rpCosts: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mStart = d.toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const [inv, rcv, rp] = await Promise.all([
        buildGrossInvoiceQuery(db)
          .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, mStart), lte(invoices.issueDate, mEnd))),
        buildGrossInvoiceQuery(db)
          .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, mStart), lte(invoices.paymentDate, mEnd))),
        // Restaurant commission costs do mês — ledger único (finrefac fase 2).
        // Janela por competenceMonth (YYYY-MM), preserva histórico em updates.
        db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(accountsPayable)
          .where(and(eq(accountsPayable.sourceType, "restaurant_commission"), eq(accountsPayable.status, "pago"), eq(accountsPayable.competenceMonth, mStart.slice(0, 7)))),
      ]);
      monthlySeries.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        invoiced: parseFloat(inv[0]?.total || "0"),
        received: parseFloat(rcv[0]?.total || "0"),
        rpCosts: parseFloat(rp[0]?.total || "0"),
      });
    }

    // ── Quotation stats ─────────────────────────────────────────────────────
    const qStatRows = await db
      .select({
        status: quotations.status,
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM("totalValue"::numeric), 0)`,
        avgDiscount: sql<string>`COALESCE(AVG(NULLIF("manualDiscountPercent"::numeric, 0)), 0)`,
        sumDiscountVal: sql<string>`COALESCE(SUM(CASE WHEN "manualDiscountPercent"::numeric > 0 THEN "totalValue"::numeric * "manualDiscountPercent"::numeric / (100 - "manualDiscountPercent"::numeric) ELSE 0 END), 0)`,
      })
      .from(quotations)
      .groupBy(quotations.status);

    const qByStatus: Record<string, { count: number; total: number; avgDiscount: number; totalDiscount: number }> = {};
    for (const row of qStatRows) {
      qByStatus[row.status] = {
        count: row.count,
        total: parseFloat(row.total),
        avgDiscount: parseFloat(row.avgDiscount),
        totalDiscount: parseFloat(row.sumDiscountVal),
      };
    }

    const qWon = qByStatus["ganha"] || { count: 0, total: 0, avgDiscount: 0, totalDiscount: 0 };
    const qLost = qByStatus["perdida"] || { count: 0, total: 0, avgDiscount: 0, totalDiscount: 0 };
    const qCancelled = qByStatus["cancelada"] || { count: 0, total: 0, avgDiscount: 0, totalDiscount: 0 };
    const qSent = qByStatus["enviada"] || { count: 0, total: 0, avgDiscount: 0, totalDiscount: 0 };
    const qDraft = qByStatus["rascunho"] || { count: 0, total: 0, avgDiscount: 0, totalDiscount: 0 };
    const totalClosed = qWon.count + qLost.count;
    const conversionRate = totalClosed > 0 ? qWon.count / totalClosed : 0;

    const bonificadasRows = await db
      .select({ count: sql<number>`COUNT(*)::int`, total: sql<string>`COALESCE(SUM("totalValue"::numeric), 0)` })
      .from(quotations).where(and(eq(quotations.isBonificada, true), sql`"totalValue" IS NOT NULL`));
    const bonificadas = { count: bonificadasRows[0]?.count || 0, total: parseFloat(bonificadasRows[0]?.total || "0") };

    // ── Top clients by paid invoices (BRUTO = receita total) ────────────────
    const topClientRows = await db
      .select({
        clientId: invoices.clientId,
        total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .where(eq(invoices.status, "paga"))
      .groupBy(invoices.clientId)
      .orderBy(desc(sql`SUM(${invoices.amount}::numeric)`))
      .limit(10);

    const topClientIds = uniqueIds(topClientRows.map(r => r.clientId));
    const topCliMap: Record<number, string> = {};
    if (topClientIds.length > 0) {
      const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, topClientIds));
      for (const r of rows) topCliMap[r.id] = r.name;
    }
    const topClients = topClientRows.map(r => ({
      name: topCliMap[r.clientId] || `Cliente #${r.clientId}`,
      total: parseFloat(r.total),
      count: r.count,
    }));

    // ── Number of distinct clients with paid invoices ────────────────────────
    const clientCountRow = await db
      .select({ count: sql<number>`COUNT(DISTINCT "clientId")::int` })
      .from(invoices).where(eq(invoices.status, "paga"));
    const activeClientsCount = clientCountRow[0]?.count || 0;

    // ── Invoice count paid ───────────────────────────────────────────────────
    const paidCountRow = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(invoices).where(eq(invoices.status, "paga"));
    const paidInvoiceCount = paidCountRow[0]?.count || 0;

    // ── DRE components ───────────────────────────────────────────────────────
    // ytdInvoicedVal / ytdReceivedVal são BRUTOS (receita total).
    // Custos = produção + frete + deduções (comissão restaurante + repasse VIP).
    const ytdInvoicedVal = parseFloat(ytdInvoiced[0]?.total || "0");
    const ytdReceivedVal = parseFloat(ytdReceived[0]?.total || "0");
    const ytdDeductionsVal = parseFloat(ytdDeductions[0]?.total || "0");
    const ytdTotalCosts = totalProduction + totalFreight + ytdDeductionsVal;
    const ytdIrpj = ytdInvoicedVal * 0.06;
    const ytdGrossProfit = ytdInvoicedVal - ytdTotalCosts;
    const ytdNetProfit = ytdGrossProfit - ytdIrpj;
    const ytdGrossMargin = ytdInvoicedVal > 0 ? ytdGrossProfit / ytdInvoicedVal : 0;
    const ytdNetMargin = ytdInvoicedVal > 0 ? ytdNetProfit / ytdInvoicedVal : 0;

    const currInvoicedVal = parseFloat(currInvoiced[0]?.total || "0");
    const currReceivedVal = parseFloat(currReceived[0]?.total || "0");
    const currDeductionsVal = parseFloat(currDeductions[0]?.total || "0");
    const currDirectCosts = currDeductionsVal; // produção/frete não tem data
    const currGrossProfit = currInvoicedVal - currDirectCosts;
    const currIrpj = currInvoicedVal * 0.06;
    const currNetProfit = currGrossProfit - currIrpj;
    const currGrossMargin = currInvoicedVal > 0 ? currGrossProfit / currInvoicedVal : 0;

    const prevInvoicedVal = parseFloat(prevInvoiced[0]?.total || "0");
    const prevReceivedVal = parseFloat(prevReceived[0]?.total || "0");
    const prevDeductionsVal = parseFloat(prevDeductions[0]?.total || "0");
    const prevGrossProfit = prevInvoicedVal - prevDeductionsVal;

    const growthInvoiced = (prevInvoicedVal > 0 && currInvoicedVal > 0) ? (currInvoicedVal - prevInvoicedVal) / prevInvoicedVal : null;
    const growthReceived = (prevReceivedVal > 0 && currReceivedVal > 0) ? (currReceivedVal - prevReceivedVal) / prevReceivedVal : null;
    const growthProfit = (prevGrossProfit > 0 && currGrossProfit > 0) ? (currGrossProfit - prevGrossProfit) / prevGrossProfit : null;

    const avgTicket = paidInvoiceCount > 0 ? ytdReceivedVal / paidInvoiceCount : 0;
    const avgRevenuePerClient = activeClientsCount > 0 ? ytdReceivedVal / activeClientsCount : 0;

    return {
      ytd: {
        invoiced: ytdInvoicedVal,
        received: ytdReceivedVal,
        directCosts: ytdTotalCosts,
        restaurantCosts: allRpPaid,
        productionCosts: totalProduction,
        freightCosts: totalFreight,
        grossProfit: ytdGrossProfit,
        irpj: ytdIrpj,
        netProfit: ytdNetProfit,
        grossMargin: ytdGrossMargin,
        netMargin: ytdNetMargin,
        discountsGiven: qWon.totalDiscount,
        avgTicket,
        avgRevenuePerClient,
        activeClientsCount,
        paidInvoiceCount,
      },
      currMonth: {
        invoiced: currInvoicedVal,
        received: currReceivedVal,
        grossProfit: currGrossProfit,
        irpj: currIrpj,
        netProfit: currNetProfit,
        grossMargin: currGrossMargin,
        directCosts: currDirectCosts,
        deductions: currDeductionsVal,
      },
      prevMonth: {
        invoiced: prevInvoicedVal,
        received: prevReceivedVal,
        grossProfit: prevGrossProfit,
      },
      growth: {
        invoiced: growthInvoiced,
        received: growthReceived,
        profit: growthProfit,
      },
      dre: {
        // `grossRevenue` = receita BRUTA total (sem deduzir comissões/repasses).
        // Custos = produção + frete + comissão restaurante + repasse VIP YTD.
        grossRevenue: ytdInvoicedVal,
        restaurantCommissions: ytdDeductionsVal, // comissões + repasses YTD
        productionCosts: totalProduction,
        freightCosts: totalFreight,
        totalDirectCosts: totalProduction + totalFreight + ytdDeductionsVal,
        grossProfit: ytdGrossProfit,
        irpj: ytdIrpj,
        netProfit: ytdNetProfit,
        grossMarginPct: ytdGrossMargin,
        netMarginPct: ytdNetMargin,
      },
      quotations: {
        won: qWon,
        lost: qLost,
        cancelled: qCancelled,
        sent: qSent,
        draft: qDraft,
        conversionRate,
        totalClosed,
        lostRevenue: qLost.total + qCancelled.total,
        totalDiscountsGiven: qWon.totalDiscount,
        avgDiscountPercent: qWon.avgDiscount,
        bonificadas,
      },
      monthlySeries,
      topClients,
    };
  }),

  listInvoices: protectedProcedure
    .input(z.object({
      status: z.enum(["emitida", "paga", "vencida", "cancelada"]).optional(),
      clientId: z.number().optional(),
      campaignId: z.number().optional(),
      campaignPhaseId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const conditions = [];
      if (input?.status) conditions.push(eq(invoices.status, input.status));
      if (input?.clientId) conditions.push(eq(invoices.clientId, input.clientId));
      if (input?.campaignId) conditions.push(eq(invoices.campaignId, input.campaignId));
      if (input?.campaignPhaseId) conditions.push(eq(invoices.campaignPhaseId, input.campaignPhaseId));
      if (input?.startDate) conditions.push(gte(invoices.issueDate, input.startDate));
      if (input?.endDate) conditions.push(lte(invoices.issueDate, input.endDate));

      // Query com joins pra calcular valor líquido (nossa parte) + repasses
      const rows = await db
        .select({
          // Todas as colunas de invoices
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          campaignId: invoices.campaignId,
          clientId: invoices.clientId,
          amount: invoices.amount,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          paymentDate: invoices.paymentDate,
          receivedDate: invoices.receivedDate,
          status: invoices.status,
          paymentMethod: invoices.paymentMethod,
          notes: invoices.notes,
          billingType: invoices.billingType,
          withheldTax: invoices.withheldTax,
          issRate: invoices.issRate,
          issRetained: invoices.issRetained,
          campaignPhaseId: invoices.campaignPhaseId,
          documentUrl: invoices.documentUrl,
          documentLabel: invoices.documentLabel,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          // Campos computados
          netAmount: sql<string>`${NET_AMOUNT_SQL}`,
          issAmount: sql<string>`
            ${invoices.amount}::numeric * (COALESCE(${invoices.issRate}, 0)::numeric / 100)
          `,
          restaurantRepasseAmount: sql<string>`
            CASE
              WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
              WHEN ${products.tipo} IN ('telas', 'janelas_digitais') THEN 0
              ELSE ${invoices.amount}::numeric * (COALESCE(${campaigns.restaurantCommission}, 0)::numeric / 100)
            END
          `,
          productTipo: products.tipo,
          vipRepasseAmount: sql<string>`
            CASE
              WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
              WHEN ${products.tipo} IN ('telas', 'janelas_digitais') AND ${products.vipProviderId} IS NOT NULL
              THEN ${invoices.amount}::numeric * (
                COALESCE(${products.vipProviderCommissionPercent}::numeric, ${vipProviders.repassePercent}::numeric, 0) / 100
              )
              ELSE 0
            END
          `,
          vipProviderName: vipProviders.name,
          restaurantCommissionPercent: campaigns.restaurantCommission,
          phaseLabel: campaignPhases.label,
          phaseSequence: campaignPhases.sequence,
        })
        .from(invoices)
        .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
        .leftJoin(products, eq(products.id, campaigns.productId))
        .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
        .leftJoin(campaignPhases, eq(campaignPhases.id, invoices.campaignPhaseId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(invoices.createdAt));

      const campaignIds = uniqueIds(rows.map((r) => r.campaignId));
      const clientIds = uniqueIds(rows.map((r) => r.clientId));

      const campaignMap: Record<number, string> = {};
      const clientMap: Record<number, string> = {};

      if (campaignIds.length > 0) {
        const campRows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, campaignIds));
        for (const c of campRows) campaignMap[c.id] = c.name;
      }
      if (clientIds.length > 0) {
        const cliRows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds));
        for (const c of cliRows) clientMap[c.id] = c.name;
      }

      return rows.map((r) => ({
        ...r,
        campaignName: campaignMap[r.campaignId] || "—",
        clientName: clientMap[r.clientId] || "—",
      }));
    }),

  createInvoice: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      campaignPhaseId: z.number().optional(),
      amount: z.string(),
      dueDate: z.string(),
      issueDate: z.string().optional(),
      paymentMethod: z.string().optional(),
      installmentNumber: z.number().int().optional(),
      installmentTotal: z.number().int().optional(),
      notes: z.string().optional(),
      billingType: z.enum(["bruto", "liquido"]).optional(),
      withheldTax: z.string().optional(),
      issRate: z.string().optional(),
      issRetained: z.boolean().optional(),
      documentUrl: z.string().refine(
        (v) => v === "" || /^https?:\/\//i.test(v.trim()),
        { message: "URL do documento deve começar com http:// ou https://" }
      ).optional(),
      documentLabel: z.string().max(100).optional(),
      receivedDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const campaign = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const issueDate = input.issueDate || new Date().toISOString().split("T")[0];
      const year = parseInt(issueDate.slice(0, 4), 10);
      const prefix = `FAT-${year}-`;
      const maxResult = await db
        .select({ maxNum: sql<string>`MAX("invoiceNumber")` })
        .from(invoices)
        .where(sql`"invoiceNumber" LIKE ${prefix + '%'}`);
      const maxStr = maxResult[0]?.maxNum;
      let seqNum = 1;
      if (maxStr) {
        const lastSeq = parseInt(maxStr.slice(prefix.length), 10);
        if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
      }
      const invoiceNumber = `${prefix}${String(seqNum).padStart(4, "0")}`;

      // Finrefac #4 — validação de numeração sequencial por cliente+ano,
      // atrás do flag INVOICE_NUMBERING_STRICT. Auditoria fiscal exige que
      // dentro do mesmo (cliente, ano) as faturas formem uma sequência
      // contínua e cronológica, sem back-dating que crie gaps.
      if (process.env.INVOICE_NUMBERING_STRICT === "true") {
        const clientYearRows = await db
          .select({
            count: sql<string>`COUNT(*)`,
            maxIssueDate: sql<string | null>`MAX("issueDate")`,
            maxSeq: sql<string | null>`MAX(CAST(SPLIT_PART("invoiceNumber", '-', 3) AS INTEGER))`,
          })
          .from(invoices)
          .where(and(
            eq(invoices.clientId, campaign[0].clientId),
            sql`EXTRACT(YEAR FROM "issueDate")::int = ${year}`,
            sql`"status" <> 'cancelada'`,
          ));
        const existingCount = parseInt(clientYearRows[0]?.count ?? "0", 10) || 0;
        const lastIssueDate = clientYearRows[0]?.maxIssueDate ?? null;
        const lastClientSeq = clientYearRows[0]?.maxSeq ? parseInt(clientYearRows[0].maxSeq, 10) : null;

        // 1) Bloqueia back-dating que quebraria a ordem cronológica
        //    da numeração para este cliente.
        if (lastIssueDate && issueDate < lastIssueDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Numeração estrita: já existe fatura emitida em ${lastIssueDate} para este cliente em ${year}. ` +
              `A nova fatura precisa ter issueDate >= ${lastIssueDate}.`,
          });
        }
        // 2) Bloqueia gaps no contador global do ano (race condition / inserts manuais).
        if (lastClientSeq !== null && seqNum <= lastClientSeq) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Numeração estrita: a próxima sequência esperada (${lastClientSeq + 1}) é maior que ${seqNum}.`,
          });
        }
        // 3) A nova fatura é a (existingCount+1)-ésima do cliente no ano —
        //    invariante usada por relatórios fiscais.
        const expectedClientPosition = existingCount + 1;
        if (expectedClientPosition < 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Numeração inválida para o cliente." });
        }
      }

      let notes = input.notes || "";
      if (input.installmentNumber && input.installmentTotal) {
        const parcelaLine = `Parcela ${input.installmentNumber}/${input.installmentTotal}`;
        notes = notes ? `${parcelaLine}\n${notes}` : parcelaLine;
      }

      // Finrefac fase 3: emissão + materialização de impostos atômica.
      const created = await db.transaction(async (tx: DbClient) => {
        const [row] = await tx.insert(invoices).values({
          campaignId: input.campaignId,
          campaignPhaseId: input.campaignPhaseId ?? null,
          clientId: campaign[0].clientId,
          invoiceNumber,
          amount: input.amount,
          billingType: input.billingType ?? "bruto",
          withheldTax: input.withheldTax && parseFloat(input.withheldTax) > 0 ? input.withheldTax : undefined,
          issRate: input.issRate && parseFloat(input.issRate) > 0 ? input.issRate : "0.00",
          issRetained: input.issRetained ?? false,
          issueDate,
          dueDate: input.dueDate,
          paymentMethod: input.paymentMethod,
          notes: notes || undefined,
          documentUrl: input.documentUrl?.trim() || undefined,
          documentLabel: input.documentLabel?.trim() || undefined,
        }).returning();
        await materializePayablesForInvoice(tx, row.id, "emitida");
        return row;
      });

      await recordAudit(db, ctx, {
        entityType: "invoice", entityId: created.id, action: "create",
        before: null, after: created,
      });
      return created;
    }),

  updateInvoice: protectedProcedure
    .input(z.object({
      id: z.number(),
      amount: z.string().optional(),
      dueDate: z.string().optional(),
      issueDate: z.string().optional(),
      paymentMethod: z.string().optional(),
      notes: z.string().optional(),
      billingType: z.enum(["bruto", "liquido"]).optional(),
      withheldTax: z.string().optional(),
      issRate: z.string().optional(),
      issRetained: z.boolean().optional(),
      documentUrl: z.string().refine(
        (v) => v === "" || /^https?:\/\//i.test(v.trim()),
        { message: "URL do documento deve começar com http:// ou https://" }
      ).optional(),
      documentLabel: z.string().max(100).optional(),
      receivedDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const { id, ...fields } = input;
      const [before] = await db.select().from(invoices).where(eq(invoices.id, id));
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.amount !== undefined) updateData.amount = fields.amount;
      if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate;
      if (fields.issueDate !== undefined) updateData.issueDate = fields.issueDate;
      if (fields.paymentMethod !== undefined) updateData.paymentMethod = fields.paymentMethod;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.billingType !== undefined) updateData.billingType = fields.billingType;
      if (fields.receivedDate !== undefined) updateData.receivedDate = fields.receivedDate || null;
      if (fields.issRate !== undefined) {
        updateData.issRate = fields.issRate && parseFloat(fields.issRate) > 0 ? fields.issRate : "0.00";
      }
      if (fields.issRetained !== undefined) updateData.issRetained = fields.issRetained;
      if (fields.withheldTax !== undefined) {
        updateData.withheldTax = fields.withheldTax && parseFloat(fields.withheldTax) > 0 ? fields.withheldTax : null;
      }
      if (fields.documentUrl !== undefined) {
        const trimmed = fields.documentUrl.trim();
        updateData.documentUrl = trimmed.length > 0 ? trimmed : null;
      }
      if (fields.documentLabel !== undefined) {
        const trimmed = fields.documentLabel.trim();
        updateData.documentLabel = trimmed.length > 0 ? trimmed : null;
      }
      // Finrefac fase 3: update + re-materialize taxes atomicamente quando
      // amount/iss muda em fatura "emitida".
      const updated = await db.transaction(async (tx: DbClient) => {
        const [row] = await tx.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
        if (
          row &&
          row.status === "emitida" &&
          (fields.amount !== undefined ||
            fields.issRate !== undefined ||
            fields.issRetained !== undefined ||
            fields.issueDate !== undefined)
        ) {
          // issueDate afeta competenceMonth dos impostos — re-materializa
          // para manter o agregado por mês consistente.
          await materializePayablesForInvoice(tx, row.id, "emitida");
        }
        return row;
      });
      if (updated) {
        await recordAudit(db, ctx, {
          entityType: "invoice", entityId: id, action: "update",
          before, after: updated,
        });
      }
      return updated;
    }),

  markInvoicePaid: protectedProcedure
    .input(z.object({
      id: z.number(),
      paymentDate: z.string(),
      paymentMethod: z.string().optional(),
      // Finrefac #4 — quando o operador já confirma a entrada do dinheiro
      // na conta no momento do pagamento (conciliação imediata).
      receivedDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [before] = await db.select().from(invoices).where(eq(invoices.id, input.id));
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Fatura não encontrada" });
      // Não permite pular a etapa de emissão: 'prevista' precisa virar
      // 'emitida' antes (via confirmInvoiceEmission), o que cria os APs de
      // impostos. Senão o passivo fiscal seria perdido.
      if (before.status === "prevista") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Fatura ainda está prevista. Confirme a emissão antes de marcar como paga.",
        });
      }
      if (before.status === "cancelada") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Fatura cancelada não pode ser marcada como paga." });
      }
      if (before.status === "paga") {
        return before; // idempotente
      }
      // Finrefac fase 3: pagamento + materialização atômicos.
      const updated = await db.transaction(async (tx: DbClient) => {
        const [row] = await tx
          .update(invoices)
          .set({
            status: "paga",
            paymentDate: input.paymentDate,
            receivedDate: input.receivedDate ?? null,
            paymentMethod: input.paymentMethod,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, input.id))
          .returning();
        if (row) {
          await materializePayablesForInvoice(tx, row.id, "paga");
        }
        return row;
      });

      if (updated) {
        await recordAudit(db, ctx, {
          entityType: "invoice", entityId: input.id, action: "mark_paid",
          before, after: updated,
        });
      }
      return updated;
    }),

  revertInvoicePayment: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [before] = await db.select().from(invoices).where(eq(invoices.id, input.id));

      try {
        const result = await db.transaction(async (tx: DbClient) => {
          // Bloqueia se algum derivado de pagamento já está pago.
          await materializePayablesForInvoice(tx, input.id, "reverter_pagamento");
          const [row] = await tx
            .update(invoices)
            .set({ status: "emitida", paymentDate: null, updatedAt: new Date() })
            .where(eq(invoices.id, input.id))
            .returning();
          return row;
        });
        if (result) {
          await recordAudit(db, ctx, {
            entityType: "invoice", entityId: input.id, action: "revert_payment",
            before, after: result,
          });
        }
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err?.message || "Falha ao reverter pagamento" });
      }
    }),

  cancelInvoice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [before] = await db.select().from(invoices).where(eq(invoices.id, input.id));

      try {
        const result = await db.transaction(async (tx: DbClient) => {
          // Cancela todos os derivados não pagos; bloqueia se algum já está pago.
          await materializePayablesForInvoice(tx, input.id, "cancelada");
          const [row] = await tx
            .update(invoices)
            .set({ status: "cancelada", updatedAt: new Date() })
            .where(eq(invoices.id, input.id))
            .returning();
          return row;
        });
        if (result) {
          await recordAudit(db, ctx, {
            entityType: "invoice", entityId: input.id, action: "cancel",
            before, after: result,
          });
        }
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err?.message || "Falha ao cancelar fatura" });
      }
    }),

  listPayments: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      restaurantId: z.number().optional(),
      campaignId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const conditions = [];
      if (input?.status) conditions.push(eq(restaurantPayments.status, input.status));
      if (input?.restaurantId) conditions.push(eq(restaurantPayments.restaurantId, input.restaurantId));
      if (input?.campaignId && input.campaignId) conditions.push(eq(restaurantPayments.campaignId, input.campaignId));
      if (input?.startDate) conditions.push(gte(restaurantPayments.createdAt, new Date(input.startDate)));
      if (input?.endDate) conditions.push(lte(restaurantPayments.createdAt, new Date(input.endDate)));

      const rows = await db
        .select()
        .from(restaurantPayments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(restaurantPayments.createdAt));

      const restaurantIds = uniqueIds(rows.map((r) => r.restaurantId));
      const campaignIds = uniqueIds(rows.map((r) => r.campaignId));

      const restMap: Record<number, string> = {};
      const campMap: Record<number, string> = {};

      if (restaurantIds.length > 0) {
        const restRows = await db.select({ id: activeRestaurants.id, name: activeRestaurants.name }).from(activeRestaurants).where(inArray(activeRestaurants.id, restaurantIds));
        for (const r of restRows) restMap[r.id] = r.name;
      }
      if (campaignIds.length > 0) {
        const campRows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, campaignIds));
        for (const c of campRows) campMap[c.id] = c.name;
      }

      return rows.map((r) => ({
        ...r,
        restaurantName: restMap[r.restaurantId] || "—",
        campaignName: r.campaignId ? (campMap[r.campaignId] || "—") : "—",
      }));
    }),

  markPaymentPaid: protectedProcedure
    .input(z.object({
      id: z.number(),
      paymentDate: z.string(),
      proofUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [before] = await db.select().from(restaurantPayments).where(eq(restaurantPayments.id, input.id));
      // Roteia pelo helper de dual-write para que o ledger
      // (accounts_payable) seja sincronizado automaticamente. Atualizar
      // direto na tabela legada deixaria o ledger stale e quebraria os
      // relatórios financeiros que agora lêem dele.
      const updated = await updateRestaurantPaymentDb(input.id, {
        status: "paid",
        paymentDate: input.paymentDate,
        proofUrl: input.proofUrl,
      });
      if (before && updated[0]) {
        await recordAudit(db, ctx, {
          entityType: "restaurant_payment", entityId: input.id, action: "mark_paid",
          before, after: updated[0],
        });
      }
      return updated[0];
    }),

  listCosts: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const conditions = [];
      if (input?.startDate) conditions.push(gte(campaigns.startDate, input.startDate));
      if (input?.endDate) conditions.push(lte(campaigns.startDate, input.endDate));

      const campaignRows = await db
        .select()
        .from(campaigns)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(campaigns.createdAt));

      const costRows = await db.select().from(operationalCosts);
      const costMap: Record<number, typeof costRows[0]> = {};
      for (const c of costRows) costMap[c.campaignId] = c;

      // Map productId -> tipo (digital/physical) para regra tela vs bolacha
      const productTipoMap: Record<number, string | null> = {};
      const productIds = uniqueIds(campaignRows.map((c) => c.productId));
      if (productIds.length > 0) {
        const prodRows = await db.select({ id: products.id, tipo: products.tipo }).from(products).where(inArray(products.id, productIds));
        for (const p of prodRows) productTipoMap[p.id] = p.tipo;
      }

      // Custos de comissão restaurante por campanha — ledger único (finrefac fase 2).
      const rpRows = await db
        .select({
          campaignId: accountsPayable.campaignId,
          total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        })
        .from(accountsPayable)
        .where(eq(accountsPayable.sourceType, "restaurant_commission"))
        .groupBy(accountsPayable.campaignId);

      const rpMap: Record<number, number> = {};
      for (const r of rpRows) {
        if (r.campaignId) rpMap[r.campaignId] = parseFloat(r.total);
      }

      const soRows = await db
        .select({
          campaignId: serviceOrders.campaignId,
          totalValue: serviceOrders.totalValue,
        })
        .from(serviceOrders)
        .where(
          and(
            eq(serviceOrders.type, "anunciante"),
            eq(serviceOrders.status, "assinada"),
          )
        );
      const soMap: Record<number, number> = {};
      for (const s of soRows) {
        if (s.campaignId) soMap[s.campaignId] = parseFloat(s.totalValue || "0");
      }

      const quotRows2 = await db
        .select({ id: quotations.id, totalValue: quotations.totalValue })
        .from(quotations);
      const quotMap: Record<number, number> = {};
      for (const q of quotRows2) quotMap[q.id] = parseFloat(q.totalValue || "0");

      const partnerRows = await db.select({ id: partners.id, name: partners.name, commissionPercent: partners.commissionPercent }).from(partners);
      const partnerMap: Record<number, { name: string; pct: number }> = {};
      for (const p of partnerRows) partnerMap[p.id] = { name: p.name, pct: parseFloat(p.commissionPercent || "0") };

      const clientRows = await db.select({ id: clients.id, partnerId: clients.partnerId }).from(clients);
      const clientPartnerMap: Record<number, number | null> = {};
      for (const cl of clientRows) clientPartnerMap[cl.id] = cl.partnerId;

      // ── Agrega contas a pagar (produção+frete) por campanha+tipo ───────────
      // Retorna contagem total e contagem paga por (campaign,type) para mostrar
      // status "X de Y parcelas pagas" na tela de Custos.
      const payableAgg = await db
        .select({
          campaignId: accountsPayable.campaignId,
          type: accountsPayable.type,
          count: sql<number>`COUNT(*)::int`,
          paidCount: sql<number>`COUNT(*) FILTER (WHERE ${accountsPayable.status} = 'pago')::int`,
          totalAmount: sql<string>`COALESCE(SUM(${accountsPayable.amount}::numeric), 0)`,
          paidAmount: sql<string>`COALESCE(SUM(${accountsPayable.amount}::numeric) FILTER (WHERE ${accountsPayable.status} = 'pago'), 0)`,
        })
        .from(accountsPayable)
        .where(inArray(accountsPayable.type, ["producao", "frete"]))
        .groupBy(accountsPayable.campaignId, accountsPayable.type);

      // Map: campaignId -> { producao: {...}, frete: {...} }
      type PayableStatus = {
        installmentsTotal: number;
        installmentsPaid: number;
        amountTotal: number;
        amountPaid: number;
      };
      const payableMap: Record<number, { producao?: PayableStatus; frete?: PayableStatus }> = {};
      for (const row of payableAgg) {
        if (!payableMap[row.campaignId]) payableMap[row.campaignId] = {};
        const entry: PayableStatus = {
          installmentsTotal: row.count,
          installmentsPaid: row.paidCount,
          amountTotal: parseFloat(row.totalAmount),
          amountPaid: parseFloat(row.paidAmount),
        };
        if (row.type === "producao") payableMap[row.campaignId].producao = entry;
        else if (row.type === "frete") payableMap[row.campaignId].frete = entry;
      }

      return campaignRows.map((c) => {
        const cost = costMap[c.id];
        const dur = c.contractDuration;
        const tipo = c.productId ? productTipoMap[c.productId] : null;
        const isDigitalOnly = tipo === "telas" || tipo === "janelas_digitais";
        const batchCost = parseFloat(c.batchCost || "0");
        const productionPerMonthRaw = parseFloat(cost?.productionCost || "0") > 0
          ? parseFloat(cost.productionCost) / dur
          : batchCost;
        const productionPerMonth = isDigitalOnly ? 0 : productionPerMonthRaw;
        const productionTotal = productionPerMonth * dur;

        const freightPerMonthRaw = parseFloat(c.freightCost || "0");
        const freightPerMonth = isDigitalOnly ? 0 : freightPerMonthRaw;
        const freightTotal = freightPerMonth * dur;

        const restaurantCost = isDigitalOnly ? 0 : (rpMap[c.id] || 0);

        const isBonificada = !!(c as any).isBonificada;
        const revenue = isBonificada ? 0 : (
          soMap[c.id]
          || (c.quotationId ? quotMap[c.quotationId] || 0 : 0)
          || 0
        );

        const taxRate = parseFloat(c.taxRate || "0");
        const taxAmount = isBonificada ? 0 : revenue * (taxRate / 100);

        const restRate = isDigitalOnly ? 0 : parseFloat(c.restaurantCommission || "0");
        const restAmount = (isBonificada || isDigitalOnly) ? 0 : (revenue - taxAmount) * (restRate / 100);

        const pId = c.quotationId ? null : (c as any).partnerId || clientPartnerMap[c.clientId] || null;
        const resolvedPartnerId = pId;
        const partnerInfo = resolvedPartnerId ? partnerMap[resolvedPartnerId] : null;
        const hasAgencyBv = (c as any).hasAgencyBv !== false;
        const rawAgencyBvPct = parseFloat((c as any).agencyBvPercent ?? "");
        const partnerPct = hasAgencyBv
          ? (Number.isFinite(rawAgencyBvPct) ? rawAgencyBvPct : (partnerInfo?.pct || 0))
          : 0;
        const commBase = isBonificada ? 0 : (revenue - taxAmount) - restAmount - productionTotal - freightTotal;
        const partnerCommission = (isBonificada || !hasAgencyBv) ? 0 : (commBase > 0 ? commBase * (partnerPct / 100) : 0);

        const totalCosts = productionTotal + freightTotal + restaurantCost + (isBonificada ? 0 : taxAmount + restAmount + partnerCommission);

        const payables = payableMap[c.id] || {};

        return {
          campaignId: c.id,
          campaignName: c.name,
          isBonificada,
          status: c.status,
          startDate: c.startDate,
          contractDuration: dur,
          coastersTotal: c.coastersPerRestaurant * c.activeRestaurants,
          activeRestaurants: c.activeRestaurants,
          revenue,
          taxRate,
          taxAmount,
          restRate,
          restAmount,
          productionPerMonth,
          productionTotal,
          freightPerMonth,
          freightTotal,
          restaurantCost,
          partnerName: partnerInfo?.name || null,
          partnerPct,
          partnerCommission,
          totalCosts,
          margin: revenue > 0 ? revenue - totalCosts : 0,
          marginPct: revenue > 0 ? ((revenue - totalCosts) / revenue) * 100 : 0,
          // Status de pagamento das parcelas geradas em Contas a Pagar
          payables: {
            producao: payables.producao ?? null,
            frete: payables.frete ?? null,
          },
        };
      });
    }),

  upsertCost: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      productionCost: z.string(),
      freightCost: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const existing = await db.select().from(operationalCosts).where(eq(operationalCosts.campaignId, input.campaignId));

      let row;
      let action: "create" | "update" = "create";
      const before = existing[0] ?? null;
      if (existing.length > 0) {
        const [updated] = await db
          .update(operationalCosts)
          .set({ productionCost: input.productionCost, freightCost: input.freightCost, notes: input.notes, updatedAt: new Date() })
          .where(eq(operationalCosts.campaignId, input.campaignId))
          .returning();
        row = updated;
        action = "update";
      } else {
        const [created] = await db
          .insert(operationalCosts)
          .values({ campaignId: input.campaignId, productionCost: input.productionCost, freightCost: input.freightCost, notes: input.notes })
          .returning();
        row = created;
      }
      // Sincroniza contas a pagar correspondentes (produção e frete, por parcela)
      let syncResult: Array<{ type: string; created: number; removed: number }> = [];
      try {
        syncResult = await syncCampaignCostPayables(db, input.campaignId, {
          productionCost: Number(input.productionCost) || 0,
          freightCost: Number(input.freightCost) || 0,
        });
      } catch (err) {
        console.warn("[upsertCost] syncCampaignCostPayables failed:", err);
      }

      await recordAudit(db, ctx, {
        entityType: "operational_cost", entityId: row?.id ?? null, action,
        before, after: row,
        metadata: {
          campaignId: input.campaignId,
          payablesSync: syncResult,
        },
      });
      if (syncResult && syncResult.some(r => r.created > 0 || r.removed > 0)) {
        await recordAudit(db, ctx, {
          entityType: "accounts_payable", entityId: null, action: "generate",
          before: null, after: null,
          metadata: {
            source: "upsertCost",
            campaignId: input.campaignId,
            sync: syncResult,
          },
        });
      }

      return { ...row, syncResult };
    }),

  report: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const paidInvoices = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, input.startDate), lte(invoices.paymentDate, input.endDate)));

      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

      const periodInvoices = await db
        .select()
        .from(invoices)
        .where(and(gte(invoices.issueDate, input.startDate), lte(invoices.issueDate, input.endDate)))
        .orderBy(invoices.issueDate);

      const costRows = await db.select().from(operationalCosts);
      const costMap: Record<number, { production: number; freight: number }> = {};
      for (const c of costRows) {
        costMap[c.campaignId] = { production: parseFloat(c.productionCost), freight: parseFloat(c.freightCost) };
      }

      // Comissão restaurante agrupada — ledger único (finrefac fase 2).
      // restaurantId vive em sourceRef.restaurantId.
      const rpRows = await db
        .select({
          campaignId: accountsPayable.campaignId,
          restaurantId: sql<number>`(("sourceRef"->>'restaurantId'))::int`,
          total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        })
        .from(accountsPayable)
        .where(and(
          eq(accountsPayable.sourceType, "restaurant_commission"),
          // Janela por mês de competência (YYYY-MM) para preservar
          // bucket histórico mesmo após updates do espelho.
          gte(accountsPayable.competenceMonth, input.startDate.slice(0, 7)),
          lte(accountsPayable.competenceMonth, input.endDate.slice(0, 7)),
        ))
        .groupBy(accountsPayable.campaignId, sql`("sourceRef"->>'restaurantId')`);

      const rpByCampaign: Record<number, number> = {};
      const rpByRestaurant: Record<number, number> = {};
      for (const r of rpRows) {
        if (r.campaignId) rpByCampaign[r.campaignId] = (rpByCampaign[r.campaignId] || 0) + parseFloat(r.total);
        if (r.restaurantId) rpByRestaurant[r.restaurantId] = (rpByRestaurant[r.restaurantId] || 0) + parseFloat(r.total);
      }

      const allInvoicesForLookup = [...paidInvoices, ...periodInvoices];
      const cmpIds = uniqueIds(allInvoicesForLookup.map((i) => i.campaignId));
      const cliIds = uniqueIds(allInvoicesForLookup.map((i) => i.clientId));

      const campaignMap: Record<number, string> = {};
      const clientMap: Record<number, string> = {};

      if (cmpIds.length > 0) {
        const rows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, cmpIds));
        for (const c of rows) campaignMap[c.id] = c.name;
      }
      if (cliIds.length > 0) {
        const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, cliIds));
        for (const c of rows) clientMap[c.id] = c.name;
      }

      const restaurantIds = Object.keys(rpByRestaurant).map(Number);
      const restMap: Record<number, string> = {};
      if (restaurantIds.length > 0) {
        const rows = await db.select({ id: activeRestaurants.id, name: activeRestaurants.name }).from(activeRestaurants).where(inArray(activeRestaurants.id, restaurantIds));
        for (const r of rows) restMap[r.id] = r.name;
      }

      const byCampaign: Record<number, { name: string; revenue: number; costs: number; margin: number }> = {};
      for (const inv of paidInvoices) {
        if (!byCampaign[inv.campaignId]) {
          byCampaign[inv.campaignId] = { name: campaignMap[inv.campaignId] || `Campanha #${inv.campaignId}`, revenue: 0, costs: 0, margin: 0 };
        }
        byCampaign[inv.campaignId].revenue += parseFloat(inv.amount);
      }
      for (const cId of Object.keys(byCampaign)) {
        const id = Number(cId);
        const costs = (costMap[id]?.production || 0) + (costMap[id]?.freight || 0) + (rpByCampaign[id] || 0);
        byCampaign[id].costs = costs;
        byCampaign[id].margin = byCampaign[id].revenue - costs;
      }

      const clientRevMap: Record<number, number> = {};
      for (const inv of paidInvoices) {
        clientRevMap[inv.clientId] = (clientRevMap[inv.clientId] || 0) + parseFloat(inv.amount);
      }
      const byClient = Object.entries(clientRevMap).map(([cId, rev]) => ({
        name: clientMap[Number(cId)] || `Cliente #${cId}`,
        revenue: rev,
      })).sort((a, b) => b.revenue - a.revenue);

      const byRestaurant = Object.entries(rpByRestaurant).map(([rId, total]) => ({
        name: restMap[Number(rId)] || `Restaurante #${rId}`,
        total,
      })).sort((a, b) => b.total - a.total);

      const totalCosts = Object.values(byCampaign).reduce((s, c) => s + c.costs, 0);

      // ── Monthly billing breakdown (by issueDate of all invoices in period) ─
      const monthlyMap: Record<string, number> = {};
      for (const inv of periodInvoices) {
        const month = inv.issueDate ? inv.issueDate.substring(0, 7) : "unknown";
        monthlyMap[month] = (monthlyMap[month] || 0) + parseFloat(inv.amount);
      }
      const monthlyRevenue = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue }));

      // ── Invoice list for period (all invoices by issueDate) ───────────────
      const invoiceList = periodInvoices
        .map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          clientName: clientMap[inv.clientId] || `Cliente #${inv.clientId}`,
          campaignName: campaignMap[inv.campaignId] || `Campanha #${inv.campaignId}`,
          amount: parseFloat(inv.amount),
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          paymentDate: inv.paymentDate || null,
          status: inv.status,
          paymentMethod: inv.paymentMethod || null,
        }));

      return {
        totalRevenue,
        totalCosts,
        margin: totalRevenue - totalCosts,
        marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0,
        byCampaign: Object.values(byCampaign),
        byClient,
        byRestaurant,
        monthlyRevenue,
        invoiceList,
      };
    }),

  // ─────────────────────────────────────────────────────────────────────────────
  // FONTE ÚNICA DE VERDADE para métricas financeiras consolidadas.
  //
  // Todas as páginas financeiras devem buscar dados aqui para garantir
  // consistência:
  //   • Receita Bruta  = soma dos valores das faturas não-canceladas
  //   • Receita Líquida ("Nossa Parte") = NET_AMOUNT_SQL (bruto - comissão
  //     restaurante - repasse VIP - ISS retido)
  //   • Custos = operational_costs (produção + frete)
  //   • Resultado = Receita Líquida - Custos
  //
  // Filtro de data aplicado sobre invoices.issueDate. Sem filtro = tudo.
  // ─────────────────────────────────────────────────────────────────────────────
  getMetrics: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      regime: z.enum(["competencia", "caixa"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const regime = input?.regime || "competencia";
      const dateCol = regime === "caixa" ? invoices.paymentDate : invoices.issueDate;
      const invConditions = regime === "caixa"
        ? [eq(invoices.status, "paga")]
        : [sql`${invoices.status} NOT IN ('cancelada')`];
      if (input?.startDate) invConditions.push(gte(dateCol, input.startDate));
      if (input?.endDate) invConditions.push(lte(dateCol, input.endDate));

      // Busca faturas com valor líquido (Nossa Parte) calculado via SQL
      const invoiceRows = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          campaignId: invoices.campaignId,
          clientId: invoices.clientId,
          amount: invoices.amount,
          netAmount: NET_AMOUNT_SQL,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          paymentDate: invoices.paymentDate,
          paymentMethod: invoices.paymentMethod,
        })
        .from(invoices)
        .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
        .leftJoin(products, eq(products.id, campaigns.productId))
        .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
        .where(and(...invConditions))
        .orderBy(invoices.issueDate);

      // Custos operacionais por campanha (fonte: operational_costs)
      const costRows = await db.select().from(operationalCosts);
      const costMap: Record<number, { production: number; freight: number }> = {};
      for (const c of costRows) {
        costMap[c.campaignId] = {
          production: parseFloat(c.productionCost || "0"),
          freight: parseFloat(c.freightCost || "0"),
        };
      }

      // Nomes de campanhas e clientes
      const campaignIds = [...new Set(invoiceRows.map(i => i.campaignId))];
      const clientIds = [...new Set(invoiceRows.map(i => i.clientId))];

      const campaignMap: Record<number, string> = {};
      const clientMap: Record<number, string> = {};

      if (campaignIds.length > 0) {
        const rows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, campaignIds));
        for (const r of rows) campaignMap[r.id] = r.name;
      }
      if (clientIds.length > 0) {
        const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds));
        for (const r of rows) clientMap[r.id] = r.name;
      }

      // Agrega por campanha
      type CampaignEntry = {
        name: string;
        grossBilling: number;
        netBilling: number;
        invoiceCount: number;
        productionCosts: number;
        freightCosts: number;
        invList: typeof invoiceRows;
      };
      const byCampaignMap: Record<number, CampaignEntry> = {};

      let totalGross = 0;
      let totalNet = 0;

      for (const inv of invoiceRows) {
        const gross = parseFloat(inv.amount);
        const net = parseFloat(inv.netAmount as string);
        totalGross += gross;
        totalNet += net;

        if (!byCampaignMap[inv.campaignId]) {
          const costs = costMap[inv.campaignId] || { production: 0, freight: 0 };
          byCampaignMap[inv.campaignId] = {
            name: campaignMap[inv.campaignId] || `Campanha #${inv.campaignId}`,
            grossBilling: 0,
            netBilling: 0,
            invoiceCount: 0,
            productionCosts: costs.production,
            freightCosts: costs.freight,
            invList: [],
          };
        }
        byCampaignMap[inv.campaignId].grossBilling += gross;
        byCampaignMap[inv.campaignId].netBilling += net;
        byCampaignMap[inv.campaignId].invoiceCount++;
        byCampaignMap[inv.campaignId].invList.push(inv);
      }

      // Custos totais somente das campanhas com faturas
      let totalProductionCosts = 0;
      let totalFreightCosts = 0;
      for (const entry of Object.values(byCampaignMap)) {
        totalProductionCosts += entry.productionCosts;
        totalFreightCosts += entry.freightCosts;
      }

      // Agrega por cliente
      type ClientEntry = { name: string; grossBilling: number; netBilling: number; invList: typeof invoiceRows };
      const byClientMap: Record<number, ClientEntry> = {};
      for (const inv of invoiceRows) {
        if (!byClientMap[inv.clientId]) {
          byClientMap[inv.clientId] = {
            name: clientMap[inv.clientId] || `Cliente #${inv.clientId}`,
            grossBilling: 0,
            netBilling: 0,
            invList: [],
          };
        }
        byClientMap[inv.clientId].grossBilling += parseFloat(inv.amount);
        byClientMap[inv.clientId].netBilling += parseFloat(inv.netAmount as string);
        byClientMap[inv.clientId].invList.push(inv);
      }

      // Agrega por mês — bucketing depende do regime:
      //  • caixa       → mês do paymentDate (quando o dinheiro entrou)
      //  • competência → mês do issueDate (quando a fatura foi emitida)
      const byMonthMap: Record<string, { grossBilling: number; netBilling: number }> = {};
      for (const inv of invoiceRows) {
        const bucketDate = regime === "caixa" ? inv.paymentDate : inv.issueDate;
        const month = bucketDate ? bucketDate.substring(0, 7) : "unknown";
        if (!byMonthMap[month]) byMonthMap[month] = { grossBilling: 0, netBilling: 0 };
        byMonthMap[month].grossBilling += parseFloat(inv.amount);
        byMonthMap[month].netBilling += parseFloat(inv.netAmount as string);
      }

      const grossResult = totalNet - totalProductionCosts - totalFreightCosts;

      const invMapper = (inv: typeof invoiceRows[0], campaignName: string, clientName: string) => ({
        invoiceNumber: inv.invoiceNumber,
        campaignName,
        clientName,
        grossAmount: parseFloat(inv.amount),
        netAmount: parseFloat(inv.netAmount as string),
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paymentDate: inv.paymentDate || null,
        paymentMethod: inv.paymentMethod || null,
        status: inv.status,
      });

      return {
        summary: {
          grossBilling: totalGross,
          netBilling: totalNet,
          deductions: totalGross - totalNet,
          productionCosts: totalProductionCosts,
          freightCosts: totalFreightCosts,
          totalCosts: totalProductionCosts + totalFreightCosts,
          grossResult,
          marginPct: totalNet > 0 ? grossResult / totalNet : 0,
        },
        byCampaign: Object.entries(byCampaignMap).map(([id, c]) => {
          const result = c.netBilling - c.productionCosts - c.freightCosts;
          return {
            campaignId: Number(id),
            name: c.name,
            grossBilling: c.grossBilling,
            netBilling: c.netBilling,
            deductions: c.grossBilling - c.netBilling,
            invoiceCount: c.invoiceCount,
            productionCosts: c.productionCosts,
            freightCosts: c.freightCosts,
            totalCosts: c.productionCosts + c.freightCosts,
            result,
            marginPct: c.netBilling > 0 ? result / c.netBilling : 0,
            invoices: c.invList.map(inv => invMapper(inv, c.name, clientMap[inv.clientId] || `Cliente #${inv.clientId}`)),
          };
        }).sort((a, b) => b.netBilling - a.netBilling),
        byClient: Object.entries(byClientMap).map(([, c]) => ({
          name: c.name,
          grossBilling: c.grossBilling,
          netBilling: c.netBilling,
          invoices: c.invList.map(inv => invMapper(inv, campaignMap[inv.campaignId] || `Campanha #${inv.campaignId}`, c.name)),
        })).sort((a, b) => b.netBilling - a.netBilling),
        byMonth: Object.entries(byMonthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, v]) => ({ month, ...v })),
        invoiceList: invoiceRows.map(inv => invMapper(
          inv,
          campaignMap[inv.campaignId] || `Campanha #${inv.campaignId}`,
          clientMap[inv.clientId] || `Cliente #${inv.clientId}`,
        )),
      };
    }),

  campaignsForInvoice: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();

    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        clientId: campaigns.clientId,
        status: campaigns.status,
        quotationTotalValue: quotations.totalValue,
        quotationCycles: quotations.cycles,
      })
      .from(campaigns)
      .leftJoin(quotations, eq(campaigns.quotationId, quotations.id))
      .where(inArray(campaigns.status, ["active", "quotation", "completed", "briefing", "design", "aprovacao", "veiculacao", "executar", "producao", "transito", "distribuicao", "paused"]))
      .orderBy(desc(campaigns.createdAt));

    const cliIds = uniqueIds(rows.map((r) => r.clientId));
    const clientMap: Record<number, string> = {};
    if (cliIds.length > 0) {
      const cliRows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, cliIds));
      for (const c of cliRows) clientMap[c.id] = c.name;
    }

    return rows.map((r) => {
      const total = r.quotationTotalValue ? parseFloat(r.quotationTotalValue) : null;
      const cycles = r.quotationCycles && r.quotationCycles > 0 ? r.quotationCycles : 1;
      const invoiceAmount = total !== null ? (total / cycles) : null;
      return {
        id: r.id,
        name: r.name,
        clientId: r.clientId,
        status: r.status,
        clientName: clientMap[r.clientId] || "—",
        invoiceAmount,
        cycles,
      };
    });
  }),

  partnerCommissionReport: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId)).limit(1);
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const [client] = await db.select().from(clients).where(eq(clients.id, campaign.clientId)).limit(1);

      let partnerId: number | null = null;
      let partnerName: string | null = null;
      let partnerCommissionPercent = 0;
      let partnerBillingMode = "bruto";

      let quotCoasterVolume: number | null = null;

      if (campaign.quotationId) {
        const [quot] = await db.select({
          partnerId: quotations.partnerId,
          agencyCommissionPercent: quotations.agencyCommissionPercent,
          totalValue: quotations.totalValue,
          coasterVolume: quotations.coasterVolume,
        }).from(quotations).where(eq(quotations.id, campaign.quotationId)).limit(1);

        if (quot?.coasterVolume) {
          quotCoasterVolume = parseInt(String(quot.coasterVolume));
        }

        if (quot?.partnerId) {
          partnerId = quot.partnerId;
          const [partner] = await db.select().from(partners).where(eq(partners.id, quot.partnerId)).limit(1);
          if (partner) {
            partnerName = partner.name;
            partnerCommissionPercent = parseFloat(partner.commissionPercent);
            partnerBillingMode = partner.billingMode;
          }
        }
      }

      if (!partnerId && campaign.partnerId) {
        const [partner] = await db.select().from(partners).where(eq(partners.id, campaign.partnerId)).limit(1);
        if (partner) {
          partnerId = partner.id;
          partnerName = partner.name;
          partnerCommissionPercent = parseFloat(partner.commissionPercent);
          partnerBillingMode = partner.billingMode;
        }
      }

      if (!partnerId && client?.partnerId) {
        const [partner] = await db.select().from(partners).where(eq(partners.id, client.partnerId)).limit(1);
        if (partner) {
          partnerId = partner.id;
          partnerName = partner.name;
          partnerCommissionPercent = parseFloat(partner.commissionPercent);
          partnerBillingMode = partner.billingMode;
        }
      }

      const [osAnunciante] = await db.select({ totalValue: serviceOrders.totalValue })
        .from(serviceOrders)
        .where(and(
          eq(serviceOrders.campaignId, campaign.id),
          eq(serviceOrders.type, "anunciante"),
          eq(serviceOrders.status, "assinada"),
        ))
        .limit(1);
      const osValue = osAnunciante?.totalValue ? parseFloat(osAnunciante.totalValue) : 0;

      let quotTotalValue = 0;
      if (campaign.quotationId) {
        const [q] = await db.select({ totalValue: quotations.totalValue })
          .from(quotations).where(eq(quotations.id, campaign.quotationId)).limit(1);
        if (q?.totalValue) quotTotalValue = parseFloat(q.totalValue);
      }

      const contractRevenueTruth = osValue > 0 ? osValue : (quotTotalValue > 0 ? quotTotalValue : 0);

      let baseGross: number;
      if (contractRevenueTruth > 0) {
        baseGross = contractRevenueTruth;
      } else {
        const n = campaign.activeRestaurants || 1;
        let coastersPerRest = campaign.coastersPerRestaurant;
        if (quotCoasterVolume && quotCoasterVolume > 0 && n > 0) {
          coastersPerRest = Math.round(quotCoasterVolume / n);
        }
        const unitCost = parseFloat(String(campaign.batchCost || "0")) / campaign.batchSize;
        const productionCostPerRest = coastersPerRest * unitCost;
        const freightPerRest = n > 0 ? parseFloat(String((campaign as any).freightCost || "0")) / n : 0;
        const restCommFixed = campaign.commissionType === "fixed" ? Number(campaign.fixedCommission || 0) * coastersPerRest : 0;
        const custoPD = productionCostPerRest + restCommFixed + freightPerRest;
        const restVarRate = campaign.commissionType === "variable" ? parseFloat(String(campaign.restaurantCommission || "0")) / 100 : 0;
        const sellerRate = parseFloat(String(campaign.sellerCommission || "0")) / 100;
        const taxRateCalc = parseFloat(String(campaign.taxRate || "0")) / 100;
        const totalVarRate = sellerRate + taxRateCalc + restVarRate;
        const denominator = 1 - totalVarRate;
        const custoBruto = denominator > 0 ? custoPD / denominator : custoPD;
        let sellingPricePerRest: number;
        if (campaign.pricingType === "fixed") {
          sellingPricePerRest = custoBruto + Number(campaign.fixedPrice || 0);
        } else {
          sellingPricePerRest = custoBruto * (1 + parseFloat(String(campaign.markupPercent || "0")) / 100);
        }
        const monthlyRevenue = sellingPricePerRest * n;
        baseGross = monthlyRevenue * campaign.contractDuration;
      }

      const taxRate = parseFloat(String(campaign.taxRate || "0"));
      const taxDeduction = baseGross * (taxRate / 100);

      const afterTax = baseGross - taxDeduction;

      const restaurantRate = parseFloat(String(campaign.restaurantCommission || "0"));
      const restaurantDeduction = afterTax * (restaurantRate / 100);

      const productionCost = parseFloat(String(campaign.batchCost || "0")) * campaign.contractDuration;
      const freightCost = parseFloat(String((campaign as any).freightCost || "0")) * campaign.contractDuration;

      const afterRestaurant = afterTax - restaurantDeduction;
      const afterProduction = afterRestaurant - productionCost;
      const afterFreight = afterProduction - freightCost;
      const commissionBase = afterFreight;

      const totalDeductions = taxDeduction + restaurantDeduction + productionCost + freightCost;

      const hasAgencyBv = (campaign as any).hasAgencyBv !== false;
      const rawCampaignBvPct = parseFloat((campaign as any).agencyBvPercent ?? "");
      if (!hasAgencyBv) {
        partnerCommissionPercent = 0;
      } else if (Number.isFinite(rawCampaignBvPct)) {
        partnerCommissionPercent = rawCampaignBvPct;
      }
      const commissionValue = hasAgencyBv ? commissionBase * (partnerCommissionPercent / 100) : 0;

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        clientName: client?.name || "—",
        partnerId,
        partnerName,
        partnerCommissionPercent,
        partnerBillingMode,
        grossValue: baseGross,
        taxRate,
        taxDeduction,
        afterTax,
        restaurantRate,
        restaurantDeduction,
        afterRestaurant,
        productionCost,
        freightCost,
        afterProduction,
        afterFreight,
        totalDeductions,
        commissionBase,
        commissionValue,
        totalToPartner: commissionValue,
        contractDuration: campaign.contractDuration,
        startDate: campaign.startDate,
        monthlyInstallments: (() => {
          const months: { month: string; revenue: number; commission: number }[] = [];
          const dur = campaign.contractDuration;
          const monthlyRevenue = baseGross / dur;
          const monthlyComm = commissionValue / dur;
          const start = new Date(campaign.startDate + "T00:00:00");
          for (let i = 0; i < dur; i++) {
            const d = new Date(start);
            d.setMonth(d.getMonth() + i);
            const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            months.push({ month: label, revenue: monthlyRevenue, commission: monthlyComm });
          }
          return months;
        })(),
      };
    }),

  listPartnerCampaigns: protectedProcedure
    .input(z.object({ partnerId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      let partnerIds: number[] = [];
      if (input.partnerId) {
        partnerIds = [input.partnerId];
      } else {
        const allPartners = await db.select({ id: partners.id }).from(partners);
        partnerIds = allPartners.map(p => p.id);
      }

      if (partnerIds.length === 0) return [];

      const quotRows = await db.select({
        campaignId: campaigns.id,
        campaignName: campaigns.name,
        clientName: clients.name,
        partnerId: quotations.partnerId,
        partnerName: partners.name,
        status: campaigns.status,
        totalValue: quotations.totalValue,
      })
        .from(campaigns)
        .innerJoin(quotations, eq(campaigns.quotationId, quotations.id))
        .innerJoin(partners, eq(quotations.partnerId, partners.id))
        .innerJoin(clients, eq(campaigns.clientId, clients.id))
        .where(inArray(quotations.partnerId, partnerIds));

      const clientRows = await db.select({
        campaignId: campaigns.id,
        campaignName: campaigns.name,
        clientName: clients.name,
        partnerId: clients.partnerId,
        partnerName: partners.name,
        status: campaigns.status,
      })
        .from(campaigns)
        .innerJoin(clients, eq(campaigns.clientId, clients.id))
        .innerJoin(partners, eq(clients.partnerId, partners.id))
        .where(inArray(clients.partnerId, partnerIds));

      const directRows = await db.select({
        campaignId: campaigns.id,
        campaignName: campaigns.name,
        clientName: clients.name,
        partnerId: campaigns.partnerId,
        partnerName: partners.name,
        status: campaigns.status,
      })
        .from(campaigns)
        .innerJoin(clients, eq(campaigns.clientId, clients.id))
        .innerJoin(partners, eq(campaigns.partnerId, partners.id))
        .where(inArray(campaigns.partnerId, partnerIds));

      const seen = new Set<number>();
      const result: { campaignId: number; campaignName: string; clientName: string; partnerId: number; partnerName: string; status: string; totalValue: number }[] = [];

      for (const r of quotRows) {
        if (!seen.has(r.campaignId)) {
          seen.add(r.campaignId);
          result.push({
            campaignId: r.campaignId,
            campaignName: r.campaignName,
            clientName: r.clientName,
            partnerId: r.partnerId!,
            partnerName: r.partnerName!,
            status: r.status,
            totalValue: parseFloat(r.totalValue || "0"),
          });
        }
      }
      for (const r of clientRows) {
        if (!seen.has(r.campaignId) && r.partnerId) {
          seen.add(r.campaignId);
          result.push({
            campaignId: r.campaignId,
            campaignName: r.campaignName,
            clientName: r.clientName,
            partnerId: r.partnerId,
            partnerName: r.partnerName!,
            status: r.status,
            totalValue: 0,
          });
        }
      }
      for (const r of directRows) {
        if (!seen.has(r.campaignId) && r.partnerId) {
          seen.add(r.campaignId);
          result.push({
            campaignId: r.campaignId,
            campaignName: r.campaignName,
            clientName: r.clientName,
            partnerId: r.partnerId,
            partnerName: r.partnerName!,
            status: r.status,
            totalValue: 0,
          });
        }
      }

      return result;
    }),

  listAllPartners: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();
    const rows = await db.select({ id: partners.id, name: partners.name, commissionPercent: partners.commissionPercent }).from(partners).where(eq(partners.status, "active"));
    return rows;
  }),

  listAccountsPayable: protectedProcedure
    .input(z.object({
      campaignId: z.number().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      sourceType: z.enum([
        "restaurant_commission", "vip_repasse", "supplier_cost", "freight_cost",
        "bv_campanha", "seller_commission", "tax", "manual",
      ]).optional(),
      dueDateFrom: z.string().optional(),
      dueDateTo: z.string().optional(),
      supplierId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const conditions = [];
      if (input?.campaignId) conditions.push(eq(accountsPayable.campaignId, input.campaignId));
      if (input?.status) conditions.push(eq(accountsPayable.status, input.status));
      if (input?.type) conditions.push(eq(accountsPayable.type, input.type));
      if (input?.sourceType) conditions.push(eq(accountsPayable.sourceType, input.sourceType));
      if (input?.supplierId) conditions.push(eq(accountsPayable.supplierId, input.supplierId));
      if (input?.dueDateFrom) conditions.push(gte(accountsPayable.dueDate, input.dueDateFrom));
      if (input?.dueDateTo) conditions.push(lte(accountsPayable.dueDate, input.dueDateTo));
      const rows = await db
        .select({
          ap: accountsPayable,
          campaignName: campaigns.name,
          supplierName: suppliers.name,
        })
        .from(accountsPayable)
        .leftJoin(campaigns, eq(accountsPayable.campaignId, campaigns.id))
        .leftJoin(suppliers, eq(accountsPayable.supplierId, suppliers.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(accountsPayable.createdAt));
      return rows.map(r => ({ ...r.ap, campaignName: r.campaignName, supplierName: r.supplierName }));
    }),

  // Auditoria automática via middleware audited(): elimina recordAudit
  // inline e garante cobertura uniforme. requireFinancialAccess permanece
  // como guard de role (executado antes do insert; o middleware só grava
  // após o sucesso da mutation).
  createAccountPayable: audited(protectedProcedure, {
    entityType: "accounts_payable",
    action: "create",
  })
    .input(z.object({
      campaignId: z.number(),
      campaignPhaseId: z.number().optional(),
      campaignItemId: z.number().optional(),
      invoiceId: z.number().optional(),
      supplierId: z.number().optional(),
      type: z.string(),
      description: z.string(),
      amount: z.string(),
      dueDate: z.string().optional(),
      recipientType: z.string().optional(),
      notes: z.string().optional(),
      sourceType: z.enum([
        "restaurant_commission",
        "vip_repasse",
        "supplier_cost",
        "freight_cost",
        "bv_campanha",
        "seller_commission",
        "tax",
        "manual",
      ]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [row] = await db.insert(accountsPayable).values({
        campaignId: input.campaignId,
        campaignPhaseId: input.campaignPhaseId ?? null,
        campaignItemId: input.campaignItemId ?? null,
        invoiceId: input.invoiceId ?? null,
        supplierId: input.supplierId ?? null,
        type: input.type,
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate ?? null,
        recipientType: input.recipientType ?? null,
        notes: input.notes ?? null,
        status: "pendente",
        sourceType: input.sourceType ?? "manual",
      }).returning();
      return row;
    }),

  bulkMarkAccountsPayablePaid: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      paymentDate: z.string(),
      proofUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const updated = await db
        .update(accountsPayable)
        .set({ status: "pago", paymentDate: input.paymentDate, proofUrl: input.proofUrl ?? null, updatedAt: new Date() })
        .where(and(inArray(accountsPayable.id, input.ids), eq(accountsPayable.status, "pendente")))
        .returning();
      return { count: updated.length };
    }),

  updateAccountPayable: audited(protectedProcedure, {
    entityType: "accounts_payable",
    action: "update",
    loadBefore: async (input: { id: number }, db) => {
      const [row] = await db.select().from(accountsPayable).where(eq(accountsPayable.id, input.id));
      return row ?? null;
    },
  })
    .input(z.object({
      id: z.number(),
      dueDate: z.string().optional(),
      amount: z.string().optional(),
      supplierId: z.number().nullable().optional(),
      notes: z.string().optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate;
      if (fields.amount !== undefined) updateData.amount = fields.amount;
      if (fields.supplierId !== undefined) updateData.supplierId = fields.supplierId;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.status !== undefined) updateData.status = fields.status;
      const [updated] = await db.update(accountsPayable).set(updateData).where(eq(accountsPayable.id, id)).returning();
      return updated;
    }),

  markAccountPayablePaid: audited(protectedProcedure, {
    entityType: "accounts_payable",
    action: "mark_paid",
    loadBefore: async (input: { id: number }, db) => {
      const [row] = await db.select().from(accountsPayable).where(eq(accountsPayable.id, input.id));
      return row ?? null;
    },
  })
    .input(z.object({
      id: z.number(),
      paymentDate: z.string(),
      proofUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [updated] = await db
        .update(accountsPayable)
        .set({ status: "pago", paymentDate: input.paymentDate, proofUrl: input.proofUrl ?? null, updatedAt: new Date() })
        .where(eq(accountsPayable.id, input.id))
        .returning();
      return updated;
    }),

  deleteAccountPayable: audited(protectedProcedure, {
    entityType: "accounts_payable",
    action: "delete",
    loadBefore: async (input: { id: number }, db) => {
      const [row] = await db.select().from(accountsPayable).where(eq(accountsPayable.id, input.id));
      return row ?? null;
    },
    skipWhenEmpty: false,
  })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      await db.delete(accountsPayable).where(eq(accountsPayable.id, input.id));
      return { ok: true };
    }),

  // Hard delete de fatura — admin/financeiro apenas, somente quando ainda
  // está em "rascunho" (cancelInvoice é o caminho normal para emitidas).
  deleteInvoice: audited(protectedProcedure, {
    entityType: "invoice",
    action: "delete",
    loadBefore: async (input: { id: number }, db) => {
      const [row] = await db.select().from(invoices).where(eq(invoices.id, input.id));
      return row ?? null;
    },
    skipWhenEmpty: false,
  })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [existing] = await db.select().from(invoices).where(eq(invoices.id, input.id));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Fatura não encontrada" });
      if (existing.status !== "cancelada") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas faturas canceladas podem ser excluídas. Cancele a fatura primeiro.",
        });
      }
      await db.delete(accountsPayable).where(eq(accountsPayable.invoiceId, input.id));
      await db.delete(invoices).where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  // Hard delete de custo operacional — admin/financeiro apenas.
  deleteOperationalCost: audited(protectedProcedure, {
    entityType: "operational_cost",
    action: "delete",
    loadBefore: async (input: { id: number }, db) => {
      const [row] = await db.select().from(operationalCosts).where(eq(operationalCosts.id, input.id));
      return row ?? null;
    },
    skipWhenEmpty: false,
  })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      await db.delete(operationalCosts).where(eq(operationalCosts.id, input.id));
      return { ok: true };
    }),

  generateCampaignPayables: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const existing = await db.select({ id: accountsPayable.id, type: accountsPayable.type })
        .from(accountsPayable)
        .where(eq(accountsPayable.campaignId, input.campaignId));
      const hasProduction = existing.some(e => e.type === "producao");
      const hasFreight = existing.some(e => e.type === "frete");

      const toInsert: any[] = [];
      const prodCost = Number(campaign.batchCost);
      const freightCost = Number((campaign as any).freightCost || 0);
      const dur = campaign.contractDuration;

      if (!hasProduction && prodCost > 0) {
        for (let m = 0; m < dur; m++) {
          toInsert.push({
            campaignId: input.campaignId,
            type: "producao",
            description: `Produção Gráfica - Mês ${m + 1}/${dur}`,
            amount: prodCost.toFixed(2),
            recipientType: "fornecedor",
            status: "pendente",
          });
        }
      }

      if (!hasFreight && freightCost > 0) {
        for (let m = 0; m < dur; m++) {
          toInsert.push({
            campaignId: input.campaignId,
            type: "frete",
            description: `Frete/Logística - Mês ${m + 1}/${dur}`,
            amount: freightCost.toFixed(2),
            recipientType: "transportadora",
            status: "pendente",
          });
        }
      }

      if (toInsert.length > 0) {
        await db.insert(accountsPayable).values(toInsert);
      }
      await recordAudit(db, ctx, {
        entityType: "accounts_payable", entityId: null, action: "generate",
        before: null, after: null,
        metadata: { campaignId: input.campaignId, generated: toInsert.length, items: toInsert },
      });
      return { generated: toInsert.length };
    }),

  generateCommissionPayable: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      invoiceId: z.number(),
      invoiceAmount: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await db.select({ id: accountsPayable.id })
        .from(accountsPayable)
        .where(and(
          eq(accountsPayable.campaignId, input.campaignId),
          eq(accountsPayable.invoiceId, input.invoiceId),
          eq(accountsPayable.type, "comissao"),
        ));
      if (existing.length > 0) return { generated: 0 };

      const invoiceAmt = Number(input.invoiceAmount);
      const restCommRate = Number(campaign.restaurantCommission || 0);
      const commAmount = invoiceAmt * (restCommRate / 100);

      if (commAmount > 0) {
        const [row] = await db.insert(accountsPayable).values({
          campaignId: input.campaignId,
          invoiceId: input.invoiceId,
          type: "comissao",
          description: `Comissão Restaurante (${restCommRate}%)`,
          amount: commAmount.toFixed(2),
          recipientType: "restaurante",
          status: "pendente",
        }).returning();
        await recordAudit(db, ctx, {
          entityType: "accounts_payable", entityId: row.id, action: "generate",
          before: null, after: row,
          metadata: { campaignId: input.campaignId, invoiceId: input.invoiceId, kind: "comissao" },
        });
        return { generated: 1 };
      }
      return { generated: 0 };
    }),

  // ── Auditoria financeira (finrefac fase 5) ─────────────────────────────
  // Lista entradas do financial_audit_log com filtros. Restrito a admin.
  auditLog: adminProcedure
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      action: z.string().optional(),
      actorUserId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const f: {
        entityType?: string; entityId?: number; action?: string; actorUserId?: string;
        startDate?: string; endDate?: string; limit: number; offset: number;
      } = input ?? { limit: 100, offset: 0 };
      const conditions = [];
      if (f.entityType) conditions.push(eq(financialAuditLog.entityType, f.entityType));
      if (f.entityId != null) conditions.push(eq(financialAuditLog.entityId, f.entityId));
      if (f.action) conditions.push(eq(financialAuditLog.action, f.action));
      if (f.actorUserId) conditions.push(eq(financialAuditLog.actorUserId, f.actorUserId));
      if (f.startDate) conditions.push(gte(financialAuditLog.createdAt, new Date(f.startDate)));
      if (f.endDate) conditions.push(lte(financialAuditLog.createdAt, new Date(`${f.endDate}T23:59:59.999Z`)));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const limit = f.limit ?? 100;
      const offset = f.offset ?? 0;

      const [rows, totalRows] = await Promise.all([
        db.select().from(financialAuditLog).where(where).orderBy(desc(financialAuditLog.createdAt)).limit(limit).offset(offset),
        db.select({ c: sql<number>`COUNT(*)::int` }).from(financialAuditLog).where(where),
      ]);

      return { rows, total: totalRows[0]?.c ?? 0, limit, offset };
    }),

  auditLogActors: adminProcedure.query(async () => {
    const db = await getDatabase();
    const rows = await db
      .select({ actorUserId: financialAuditLog.actorUserId, actorRole: financialAuditLog.actorRole })
      .from(financialAuditLog)
      .groupBy(financialAuditLog.actorUserId, financialAuditLog.actorRole);
    return rows.filter((r) => r.actorUserId);
  }),

  // ────────────────────────────────────────────────────────────────────────────
  // Finrefac #7 — Preferências do usuário (regime DRE persistido).
  // ────────────────────────────────────────────────────────────────────────────
  getUserPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDatabase();
    const [u] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    const prefs = (u?.preferences || {}) as Record<string, unknown>;
    return {
      dreRegime: (prefs.dreRegime === "caixa" ? "caixa" : "competencia") as "competencia" | "caixa",
    };
  }),

  setDrePreference: protectedProcedure
    .input(z.object({ regime: z.enum(["competencia", "caixa"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [u] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const merged = { ...((u?.preferences || {}) as Record<string, unknown>), dreRegime: input.regime };
      await db.update(users).set({ preferences: merged, updatedAt: new Date() }).where(eq(users.id, ctx.user.id));
      return { regime: input.regime };
    }),

  // ────────────────────────────────────────────────────────────────────────────
  // Finrefac #7 — DRE Dual (regime: competência | caixa).
  //
  // Competência: receita pelo issueDate; custo pelo competenceMonth (ou dueDate).
  // Caixa:       receita pelo paymentDate; custo pelo paymentDate.
  // Janela default: YTD (ano corrente até hoje).
  // ────────────────────────────────────────────────────────────────────────────
  dre: protectedProcedure
    .input(z.object({
      regime: z.enum(["competencia", "caixa"]).default("competencia"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const now = new Date();
      const startDate = input?.startDate || `${now.getFullYear()}-01-01`;
      const endDate = input?.endDate || now.toISOString().split("T")[0];
      const regime = input?.regime || "competencia";

      const startMonth = startDate.slice(0, 7);
      const endMonth = endDate.slice(0, 7);

      // ── Receita + deduções a partir das invoices ────────────────────────
      const dateCol = regime === "caixa" ? invoices.paymentDate : invoices.issueDate;
      const invConditions = regime === "caixa"
        ? [eq(invoices.status, "paga"), gte(invoices.paymentDate, startDate), lte(invoices.paymentDate, endDate)]
        : [sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, startDate), lte(invoices.issueDate, endDate)];

      const [rev] = await buildGrossInvoiceQuery(db).where(and(...invConditions));

      // ── BV de Agência + Comissão Comercial ──────────────────────────────
      // BV de Agência: para campanhas SEM partnerId. Quando há partnerId, o
      // BV já é capturado em accounts_payable.sourceType='bv_campanha'
      // (ver server/finance/payables.ts → upsertPartnerCommissionForInvoice).
      // Esta SQL preenche o gap das campanhas sem parceiro associado, evitando
      // double-counting com partnerCommissions agregado abaixo.
      // Comissão Comercial: aplicada a todas as campanhas (interno).
      // Bonificadas não geram comissões (mesma regra dos outros repasses).
      const [agencyAndSellerRow] = await db
        .select({
          agencyBv: sql<string>`COALESCE(SUM(
            CASE WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
                 WHEN COALESCE(${campaigns.hasAgencyBv}, false) = false THEN 0
                 WHEN ${campaigns.partnerId} IS NOT NULL THEN 0
                 ELSE ${invoices.amount}::numeric * (COALESCE(${campaigns.agencyBvPercent}, 0)::numeric / 100)
            END
          ), 0)`,
          sellerCommission: sql<string>`COALESCE(SUM(
            CASE WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
                 ELSE ${invoices.amount}::numeric * (COALESCE(${campaigns.sellerCommission}, 0)::numeric / 100)
            END
          ), 0)`,
        })
        .from(invoices)
        .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
        .where(and(...invConditions));

      // ── Custos via accountsPayable ──────────────────────────────────────
      // Competência: usa COALESCE(competenceMonth, to_char(dueDate,'YYYY-MM'))
      // como mês de competência. Status sem filtro (pendente + pago contam,
      // exceto canceladas).
      // Caixa: status = 'pago' e paymentDate na janela.
      const apCompMonth = sql<string>`COALESCE(${accountsPayable.competenceMonth}, to_char(${accountsPayable.dueDate}, 'YYYY-MM'))`;
      const apConditions = regime === "caixa"
        ? [eq(accountsPayable.status, "pago"), gte(accountsPayable.paymentDate, startDate), lte(accountsPayable.paymentDate, endDate)]
        : [gte(apCompMonth, startMonth), lte(apCompMonth, endMonth), sql`${accountsPayable.status} <> 'cancelada'`];

      const apByCat = await db
        .select({
          sourceType: accountsPayable.sourceType,
          type: accountsPayable.type,
          total: sql<string>`COALESCE(SUM(${accountsPayable.amount}::numeric), 0)`,
        })
        .from(accountsPayable)
        .where(and(...apConditions))
        .groupBy(accountsPayable.sourceType, accountsPayable.type);

      let production = 0;
      let freight = 0;
      let partnerCommission = 0;
      let othersAp = 0;
      let restaurantCommissions = 0;
      let vipRepasses = 0;
      let taxes = 0;
      for (const r of apByCat) {
        const v = parseFloat(r.total);
        if (r.sourceType === "restaurant_commission") restaurantCommissions += v;
        else if (r.sourceType === "vip_repasse") vipRepasses += v;
        else if (r.sourceType === "bv_campanha") partnerCommission += v;
        else if (r.sourceType === "tax") taxes += v;
        else if (r.type === "producao") production += v;
        else if (r.type === "frete") freight += v;
        else othersAp += v;
      }

      const grossRevenue = parseFloat(rev?.total || "0");
      const agencyBv = parseFloat(agencyAndSellerRow?.agencyBv || "0");
      const sellerCommission = parseFloat(agencyAndSellerRow?.sellerCommission || "0");

      // Deduções de receita: comissão restaurante + repasse VIP + ISS retido
      // (estes três derivados da AP — fonte única de verdade do ledger).
      const revenueDeductions = restaurantCommissions + vipRepasses + taxes;
      const netRevenue = grossRevenue - revenueDeductions;

      const totalCosts = production + freight + partnerCommission + othersAp + agencyBv + sellerCommission;
      const grossProfit = netRevenue - totalCosts;
      const irpj = grossRevenue * 0.06;
      const netProfit = grossProfit - irpj;

      return {
        regime,
        startDate,
        endDate,
        lines: {
          grossRevenue,
          restaurantCommissions,
          vipRepasses,
          taxes,
          revenueDeductions,
          netRevenue,
          productionCosts: production,
          freightCosts: freight,
          partnerCommissions: partnerCommission,
          agencyBv,
          sellerCommission,
          otherCosts: othersAp,
          totalCosts,
          grossProfit,
          irpj,
          netProfit,
          grossMarginPct: grossRevenue > 0 ? grossProfit / grossRevenue : 0,
          netMarginPct: grossRevenue > 0 ? netProfit / grossRevenue : 0,
        },
      };
    }),

  // ────────────────────────────────────────────────────────────────────────────
  // Finrefac #7 — Inadimplência com aging buckets (0-30, 30-60, 60-90, 90+).
  // ────────────────────────────────────────────────────────────────────────────
  delinquency: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();
    const today = new Date().toISOString().split("T")[0];

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
        clientId: invoices.clientId,
        daysOverdue: sql<number>`(CURRENT_DATE - ${invoices.dueDate})::int`,
      })
      .from(invoices)
      .where(and(eq(invoices.status, "emitida"), lte(invoices.dueDate, today)));

    const buckets = {
      "0-30": { count: 0, total: 0 },
      "30-60": { count: 0, total: 0 },
      "60-90": { count: 0, total: 0 },
      "90+":   { count: 0, total: 0 },
    };
    let totalAmount = 0;
    let totalCount = 0;

    const cliIds = uniqueIds(rows.map((r) => r.clientId));
    const cliMap: Record<number, string> = {};
    if (cliIds.length > 0) {
      const cs = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, cliIds));
      for (const c of cs) cliMap[c.id] = c.name;
    }

    const items: Array<{ id: number; invoiceNumber: string; clientName: string; amount: number; dueDate: string; daysOverdue: number; bucket: keyof typeof buckets }> = [];

    for (const r of rows) {
      const days = Math.max(0, Number(r.daysOverdue) || 0);
      const amt = parseFloat(r.amount);
      const bucket: keyof typeof buckets =
        days <= 30 ? "0-30" : days <= 60 ? "30-60" : days <= 90 ? "60-90" : "90+";
      buckets[bucket].count++;
      buckets[bucket].total += amt;
      totalAmount += amt;
      totalCount++;
      items.push({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        clientName: cliMap[r.clientId] || `Cliente #${r.clientId}`,
        amount: amt,
        dueDate: r.dueDate,
        daysOverdue: days,
        bucket,
      });
    }

    items.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return { totalAmount, totalCount, buckets, items };
  }),

  // ────────────────────────────────────────────────────────────────────────────
  // Finrefac #7 — DSO (Days Sales Outstanding):
  //   média de dias entre issueDate e paymentDate de faturas pagas.
  // Janela: últimos 90 dias; comparação com 90 dias anteriores para tendência.
  // ────────────────────────────────────────────────────────────────────────────
  dso: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const d90 = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
    const d180 = new Date(now.getTime() - 180 * 86400000).toISOString().split("T")[0];

    const calc = async (start: string, end: string) => {
      const [r] = await db
        .select({
          avg: sql<string>`COALESCE(AVG((${invoices.paymentDate} - ${invoices.issueDate})::int), 0)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(invoices)
        .where(and(
          eq(invoices.status, "paga"),
          gte(invoices.paymentDate, start),
          lte(invoices.paymentDate, end),
        ));
      return { avg: parseFloat(r?.avg || "0"), count: r?.count || 0 };
    };

    const current = await calc(d90, today);
    const previous = await calc(d180, d90);

    const trend = previous.avg > 0 ? (current.avg - previous.avg) / previous.avg : null;

    return {
      currentDso: current.avg,
      currentSampleSize: current.count,
      previousDso: previous.avg,
      previousSampleSize: previous.count,
      trend, // positivo = piorou; negativo = melhorou
    };
  }),

  // ────────────────────────────────────────────────────────────────────────────
  // Finrefac #7 — Funil: Cotação → Fatura → Recebido (YTD).
  // ────────────────────────────────────────────────────────────────────────────
  funnel: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();
    const now = new Date();
    const ytdStart = `${now.getFullYear()}-01-01`;
    const today = now.toISOString().split("T")[0];

    // Cotações enviadas no período (pipeline aberto + fechado)
    const [sent] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM(${quotations.totalValue}::numeric), 0)`,
      })
      .from(quotations)
      .where(and(
        sql`${quotations.status} <> 'rascunho'`,
        gte(quotations.createdAt, new Date(ytdStart)),
      ));

    // Cotações ganhas (win + os_gerada — convertidas em OS)
    const [won] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM(${quotations.totalValue}::numeric), 0)`,
      })
      .from(quotations)
      .where(and(
        sql`${quotations.status} IN ('win', 'os_gerada')`,
        gte(quotations.createdAt, new Date(ytdStart)),
      ));

    const [invoiced] = await buildGrossInvoiceCountQuery(db)
      .where(and(
        sql`${invoices.status} NOT IN ('cancelada')`,
        gte(invoices.issueDate, ytdStart),
        lte(invoices.issueDate, today),
      ));

    const [received] = await buildGrossInvoiceCountQuery(db)
      .where(and(
        eq(invoices.status, "paga"),
        gte(invoices.paymentDate, ytdStart),
        lte(invoices.paymentDate, today),
      ));

    return {
      sent:     { count: sent?.count || 0,     total: parseFloat(sent?.total     || "0") },
      won:      { count: won?.count || 0,      total: parseFloat(won?.total      || "0") },
      invoiced: { count: invoiced?.count || 0, total: parseFloat(invoiced?.total || "0") },
      received: { count: received?.count || 0, total: parseFloat(received?.total || "0") },
    };
  }),

  // ── Cronograma de faturamento por batch ──────────────────────────────────
  // Regra: 1 batch (campaignPhase) = 1 mês de veiculação = 1 fatura.
  // Cria 1 invoice em status 'prevista' por fase que ainda não tem fatura
  // ativa (não-cancelada). Idempotente.
  generateScheduledInvoices: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      // Quando informado, escopa a geração apenas a este batch (usado pelo
      // card "Gerar nova" da aba Financeiro). Sem ele, comporta-se como
      // antes, agendando para todos os batches sem fatura ativa.
      phaseId: z.number().optional(),
      dueOffsetDays: z.number().int().min(0).max(120).default(15),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const phaseRows = await db
        .select()
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId))
        .orderBy(campaignPhases.sequence);
      const phases = input.phaseId
        ? phaseRows.filter((p) => p.id === input.phaseId)
        : phaseRows;
      if (phases.length === 0) {
        return { created: 0, skipped: 0, total: 0 };
      }

      const phaseIds = phases.map((p) => p.id);
      const items = await db
        .select()
        .from(campaignItems)
        .where(inArray(campaignItems.campaignPhaseId, phaseIds));
      const revenueByPhase: Record<number, number> = {};
      for (const it of items) {
        const v = it.totalPrice != null
          ? parseFloat(it.totalPrice)
          : it.quantity * parseFloat(it.unitPrice);
        revenueByPhase[it.campaignPhaseId] = (revenueByPhase[it.campaignPhaseId] ?? 0) + v;
      }

      const existing = await db
        .select({ phaseId: invoices.campaignPhaseId, status: invoices.status })
        .from(invoices)
        .where(and(
          eq(invoices.campaignId, input.campaignId),
          inArray(invoices.campaignPhaseId, phaseIds),
          sql`${invoices.status} <> 'cancelada'`,
        ));
      const phasesWithInvoice = new Set<number>();
      for (const row of existing) if (row.phaseId != null) phasesWithInvoice.add(row.phaseId);

      const addDays = (iso: string, days: number) => {
        const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };

      const toInsert: any[] = [];
      let skipped = 0;
      for (const p of phases) {
        if (phasesWithInvoice.has(p.id)) { skipped++; continue; }
        const amount = (revenueByPhase[p.id] ?? 0).toFixed(2);
        toInsert.push({
          campaignId: input.campaignId,
          campaignPhaseId: p.id,
          clientId: campaign.clientId,
          invoiceNumber: `PREV-${input.campaignId}-${p.sequence}`,
          amount,
          billingType: "bruto" as const,
          issueDate: p.periodStart,
          dueDate: addDays(p.periodStart, input.dueOffsetDays),
          status: "prevista" as const,
          notes: `Fatura prevista — Batch ${p.sequence} (${p.label})`,
        });
      }

      if (toInsert.length > 0) {
        await db.insert(invoices).values(toInsert);
      }
      return { created: toInsert.length, skipped, total: phases.length };
    }),

  // ── Confirmar emissão de uma fatura prevista ─────────────────────────────
  // Promove status 'prevista' → 'emitida', grava número real da NF, datas e
  // (opcional) URL do documento. Materializa contas a pagar após emitir.
  confirmInvoiceEmission: protectedProcedure
    .input(z.object({
      id: z.number(),
      invoiceNumber: z.string().min(1).max(20).optional(),
      issueDate: z.string().optional(),
      dueDate: z.string().optional(),
      amount: z.string().optional(),
      documentUrl: z.string().refine(
        (v) => v === "" || /^https?:\/\//i.test(v.trim()),
        { message: "URL do documento deve começar com http:// ou https://" },
      ).optional(),
      documentLabel: z.string().max(100).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const [inv] = await db.select().from(invoices).where(eq(invoices.id, input.id));
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Fatura não encontrada" });
      if (inv.status !== "prevista") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Fatura já está em status "${inv.status}". Só é possível confirmar emissão de previstas.`,
        });
      }

      const issueDate = input.issueDate || inv.issueDate;
      let invoiceNumber = input.invoiceNumber?.trim();
      if (!invoiceNumber) {
        const year = parseInt(issueDate.slice(0, 4), 10);
        const prefix = `FAT-${year}-`;
        const maxResult = await db
          .select({ maxNum: sql<string>`MAX("invoiceNumber")` })
          .from(invoices)
          .where(sql`"invoiceNumber" LIKE ${prefix + '%'}`);
        const maxStr = maxResult[0]?.maxNum;
        let seqNum = 1;
        if (maxStr && maxStr.startsWith(prefix)) {
          const lastSeq = parseInt(maxStr.slice(prefix.length), 10);
          if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
        }
        invoiceNumber = `${prefix}${String(seqNum).padStart(4, "0")}`;
      }

      const updates: any = {
        invoiceNumber,
        issueDate,
        dueDate: input.dueDate ?? inv.dueDate,
        status: "emitida",
        updatedAt: new Date(),
      };
      if (input.amount != null) updates.amount = input.amount;
      if (input.documentUrl != null) updates.documentUrl = input.documentUrl;
      if (input.documentLabel != null) updates.documentLabel = input.documentLabel;
      if (input.notes != null) updates.notes = input.notes;

      // Emissão + materialização de impostos devem ser ATÔMICAS: se o
      // materializer falha, a emissão é revertida (não pode ficar fatura
      // 'emitida' sem AP de imposto associada).
      const updated = await db.transaction(async (tx: DbClient) => {
        const [row] = await tx
          .update(invoices)
          .set(updates)
          .where(eq(invoices.id, input.id))
          .returning();
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Falha ao atualizar fatura" });
        await materializePayablesForInvoice(tx, row.id, "emitida");
        return row;
      });
      try {
        await recordAudit(
          db as unknown as DbClient,
          { user: { id: ctx.user.id, role: (ctx.user as any).role ?? null } },
          {
            entityType: "invoice",
            entityId: updated.id,
            action: "update",
            metadata: { reason: "confirm_emission", invoiceNumber, issueDate, dueDate: updates.dueDate },
          },
        );
      } catch {}

      return updated;
    }),
});
