import { financeiroProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
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
} from "../drizzle/schema";
import { VIP_PRODUCT_TIPOS } from "./productRouter";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
            COALESCE(${products.vipProviderCommissionPercent}::numeric, ${vipProviders.commissionPercent}::numeric, 0) / 100
          )
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

    // ── Invoice totals by status (valor líquido = nossa parte) ────────────────
    const invoicesByStatus = await db
      .select({
        status: invoices.status,
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM(${NET_AMOUNT_SQL}), 0)`,
      })
      .from(invoices)
      .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
      .leftJoin(products, eq(products.id, campaigns.productId))
      .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
      .groupBy(invoices.status);

    const invByStatus: Record<string, { count: number; total: number }> = {};
    for (const row of invoicesByStatus) {
      invByStatus[row.status] = { count: row.count, total: parseFloat(row.total) };
    }

    // Overdue = emitida past due date (líquido)
    const overdueResult = await buildNetInvoiceCountQuery(db)
      .where(and(eq(invoices.status, "emitida"), lte(invoices.dueDate, today)));

    // Invoiced this month (emitida + paga issued this month) - líquido
    const invoicedThisMonthResult = await buildNetInvoiceQuery(db)
      .where(and(
        sql`${invoices.status} NOT IN ('cancelada')`,
        gte(invoices.issueDate, monthStart),
        lte(invoices.issueDate, monthEnd),
      ));

    // Received this month (paga) - líquido
    const paidThisMonthResult = await buildNetInvoiceQuery(db)
      .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, monthStart), lte(invoices.paymentDate, monthEnd)));

    // ── Pending restaurant payments ─────────────────────────────────────────────
    const pendingRpResult = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`COUNT(*)::int` })
      .from(restaurantPayments)
      .where(eq(restaurantPayments.status, "pending"));

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

    const rpPaidTotal = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(restaurantPayments)
      .where(eq(restaurantPayments.status, "paid"));

    // ── Monthly chart: last 6 months, invoiced vs received (líquidos) ───────
    const monthlyData: { month: string; invoiced: number; received: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mStart = d.toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const [inv, rcv] = await Promise.all([
        buildNetInvoiceQuery(db)
          .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, mStart), lte(invoices.issueDate, mEnd))),
        buildNetInvoiceQuery(db)
          .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, mStart), lte(invoices.paymentDate, mEnd))),
      ]);
      monthlyData.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        invoiced: parseFloat(inv[0]?.total || "0"),
        received: parseFloat(rcv[0]?.total || "0"),
      });
    }

    // ── Upcoming invoices (due in next 30 days, not yet paid) — net ─────────
    const upcomingRows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount, // bruto (referência)
        netAmount: sql<string>`${NET_AMOUNT_SQL}`, // nossa parte
        dueDate: invoices.dueDate,
        clientId: invoices.clientId,
        campaignId: invoices.campaignId,
      })
      .from(invoices)
      .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
      .leftJoin(products, eq(products.id, campaigns.productId))
      .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
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
    // `revenue` e `invoicedThisMonth` já estão LÍQUIDOS (net = nossa parte).
    // Os repasses (comissão restaurante + VIP) já foram deduzidos do bruto pelo
    // NET_AMOUNT_SQL, portanto NÃO devem entrar novamente em totalCosts.
    // `restaurantCosts` é mantido apenas no breakdown (referência histórica).
    // ──────────────────────────────────────────────────────────────────────────
    const revenue = parseFloat(paidThisMonthResult[0]?.total || "0");
    const invoicedThisMonth = parseFloat(invoicedThisMonthResult[0]?.total || "0");
    const production = parseFloat(costData[0]?.totalProduction || "0");
    const freight = parseFloat(costData[0]?.totalFreight || "0");
    const restaurantCosts = parseFloat(rpPaidTotal[0]?.total || "0");
    const totalCosts = production + freight; // comm de restaurante/VIP já deduzidos
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

    // ── YTD & current month revenue (líquidos = nossa parte) ────────────────
    const [ytdInvoiced, ytdReceived, currInvoiced, currReceived, prevInvoiced, prevReceived] = await Promise.all([
      buildNetInvoiceQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, ytdStart), lte(invoices.issueDate, today))),
      buildNetInvoiceQuery(db)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, ytdStart), lte(invoices.paymentDate, today))),
      buildNetInvoiceQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, currMonthStart), lte(invoices.issueDate, currMonthEnd))),
      buildNetInvoiceQuery(db)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, currMonthStart), lte(invoices.paymentDate, currMonthEnd))),
      buildNetInvoiceQuery(db)
        .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, prevMonthStart), lte(invoices.issueDate, prevMonthEnd))),
      buildNetInvoiceQuery(db)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, prevMonthStart), lte(invoices.paymentDate, prevMonthEnd))),
    ]);

    // ── Total costs (no date on operational_costs) ──────────────────────────
    const [totalCostRows, ytdRpRows, allRpRows, currRpRows, prevRpRows] = await Promise.all([
      db.select({
        production: sql<string>`COALESCE(SUM("productionCost"::numeric), 0)`,
        freight: sql<string>`COALESCE(SUM("freightCost"::numeric), 0)`,
      }).from(operationalCosts),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(restaurantPayments)
        .where(and(eq(restaurantPayments.status, "paid"), gte(restaurantPayments.createdAt, new Date(ytdStart)))),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)`, count: sql<number>`COUNT(*)::int` })
        .from(restaurantPayments).where(eq(restaurantPayments.status, "paid")),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(restaurantPayments)
        .where(and(eq(restaurantPayments.status, "paid"), gte(restaurantPayments.createdAt, new Date(currMonthStart)), lte(restaurantPayments.createdAt, new Date(currMonthEnd + "T23:59:59")))),
      db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(restaurantPayments)
        .where(and(eq(restaurantPayments.status, "paid"), gte(restaurantPayments.createdAt, new Date(prevMonthStart)), lte(restaurantPayments.createdAt, new Date(prevMonthEnd + "T23:59:59")))),
    ]);

    const totalProduction = parseFloat(totalCostRows[0]?.production || "0");
    const totalFreight = parseFloat(totalCostRows[0]?.freight || "0");
    const ytdRpCosts = parseFloat(ytdRpRows[0]?.total || "0");
    const allRpPaid = parseFloat(allRpRows[0]?.total || "0");
    const currRpCosts = parseFloat(currRpRows[0]?.total || "0");
    const prevRpCosts = parseFloat(prevRpRows[0]?.total || "0");

    // ── 12-month series (invoiced/received líquidos; rpCosts mantido bruto) ─
    const monthlySeries: { month: string; invoiced: number; received: number; rpCosts: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mStart = d.toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const [inv, rcv, rp] = await Promise.all([
        buildNetInvoiceQuery(db)
          .where(and(sql`${invoices.status} NOT IN ('cancelada')`, gte(invoices.issueDate, mStart), lte(invoices.issueDate, mEnd))),
        buildNetInvoiceQuery(db)
          .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, mStart), lte(invoices.paymentDate, mEnd))),
        db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` }).from(restaurantPayments)
          .where(and(eq(restaurantPayments.status, "paid"), gte(restaurantPayments.createdAt, new Date(mStart)), lte(restaurantPayments.createdAt, new Date(mEnd + "T23:59:59")))),
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

    // ── Top clients by paid invoices (por valor líquido) ────────────────────
    const topClientRows = await db
      .select({
        clientId: invoices.clientId,
        total: sql<string>`COALESCE(SUM(${NET_AMOUNT_SQL}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
      .leftJoin(products, eq(products.id, campaigns.productId))
      .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
      .where(eq(invoices.status, "paga"))
      .groupBy(invoices.clientId)
      .orderBy(desc(sql`SUM(${NET_AMOUNT_SQL})`))
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
    // ytdInvoicedVal / ytdReceivedVal já são LÍQUIDOS (nossa parte).
    // Comissão de restaurante e repasse VIP já deduzidos pelo NET_AMOUNT_SQL.
    // Custos diretos agora = produção + frete (comissões não recontam aqui).
    const ytdInvoicedVal = parseFloat(ytdInvoiced[0]?.total || "0");
    const ytdReceivedVal = parseFloat(ytdReceived[0]?.total || "0");
    const ytdTotalCosts = totalProduction + totalFreight;
    const ytdIrpj = ytdInvoicedVal * 0.06;
    const ytdGrossProfit = ytdInvoicedVal - ytdTotalCosts;
    const ytdNetProfit = ytdGrossProfit - ytdIrpj;
    const ytdGrossMargin = ytdInvoicedVal > 0 ? ytdGrossProfit / ytdInvoicedVal : 0;
    const ytdNetMargin = ytdInvoicedVal > 0 ? ytdNetProfit / ytdInvoicedVal : 0;

    const currInvoicedVal = parseFloat(currInvoiced[0]?.total || "0");
    const currReceivedVal = parseFloat(currReceived[0]?.total || "0");
    const currDirectCosts = 0; // comissões já deduzidas do net
    const currGrossProfit = currInvoicedVal - currDirectCosts;
    const currIrpj = currInvoicedVal * 0.06;
    const currNetProfit = currGrossProfit - currIrpj;
    const currGrossMargin = currInvoicedVal > 0 ? currGrossProfit / currInvoicedVal : 0;

    const prevInvoicedVal = parseFloat(prevInvoiced[0]?.total || "0");
    const prevReceivedVal = parseFloat(prevReceived[0]?.total || "0");
    const prevGrossProfit = prevInvoicedVal; // sem custos diretos aqui (já net)

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
        // `grossRevenue` aqui já é LÍQUIDO (nossa parte), pois comissões de
        // restaurante e repasse VIP foram deduzidos no NET_AMOUNT_SQL.
        // O nome do campo foi mantido para compat de clientes, mas
        // semanticamente = nossa receita líquida.
        grossRevenue: ytdInvoicedVal,
        restaurantCommissions: allRpPaid, // referência histórica
        productionCosts: totalProduction,
        freightCosts: totalFreight,
        totalDirectCosts: totalProduction + totalFreight,
        grossProfit: ytdInvoicedVal - (totalProduction + totalFreight),
        irpj: ytdIrpj,
        netProfit: ytdInvoicedVal - (totalProduction + totalFreight) - ytdIrpj,
        grossMarginPct: ytdInvoicedVal > 0 ? (ytdInvoicedVal - (totalProduction + totalFreight)) / ytdInvoicedVal : 0,
        netMarginPct: ytdInvoicedVal > 0 ? (ytdInvoicedVal - (totalProduction + totalFreight) - ytdIrpj) / ytdInvoicedVal : 0,
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
          status: invoices.status,
          paymentMethod: invoices.paymentMethod,
          notes: invoices.notes,
          billingType: invoices.billingType,
          withheldTax: invoices.withheldTax,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          // Campos computados
          netAmount: sql<string>`${NET_AMOUNT_SQL}`,
          restaurantRepasseAmount: sql<string>`
            CASE WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
            ELSE ${invoices.amount}::numeric * (COALESCE(${campaigns.restaurantCommission}, 0)::numeric / 100)
            END
          `,
          vipRepasseAmount: sql<string>`
            CASE
              WHEN COALESCE(${campaigns.isBonificada}, false) THEN 0
              WHEN ${products.tipo} IN ('telas', 'janelas_digitais') AND ${products.vipProviderId} IS NOT NULL
              THEN ${invoices.amount}::numeric * (
                COALESCE(${products.vipProviderCommissionPercent}::numeric, ${vipProviders.commissionPercent}::numeric, 0) / 100
              )
              ELSE 0
            END
          `,
          vipProviderName: vipProviders.name,
          restaurantCommissionPercent: campaigns.restaurantCommission,
        })
        .from(invoices)
        .leftJoin(campaigns, eq(campaigns.id, invoices.campaignId))
        .leftJoin(products, eq(products.id, campaigns.productId))
        .leftJoin(vipProviders, eq(vipProviders.id, products.vipProviderId))
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
      amount: z.string(),
      dueDate: z.string(),
      issueDate: z.string().optional(),
      paymentMethod: z.string().optional(),
      installmentNumber: z.number().int().optional(),
      installmentTotal: z.number().int().optional(),
      notes: z.string().optional(),
      billingType: z.enum(["bruto", "liquido"]).optional(),
      withheldTax: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const campaign = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const year = new Date().getFullYear();
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

      const issueDate = input.issueDate || new Date().toISOString().split("T")[0];

      let notes = input.notes || "";
      if (input.installmentNumber && input.installmentTotal) {
        const parcelaLine = `Parcela ${input.installmentNumber}/${input.installmentTotal}`;
        notes = notes ? `${parcelaLine}\n${notes}` : parcelaLine;
      }

      const [created] = await db.insert(invoices).values({
        campaignId: input.campaignId,
        clientId: campaign[0].clientId,
        invoiceNumber,
        amount: input.amount,
        billingType: input.billingType ?? "bruto",
        withheldTax: input.withheldTax && parseFloat(input.withheldTax) > 0 ? input.withheldTax : undefined,
        issueDate,
        dueDate: input.dueDate,
        paymentMethod: input.paymentMethod,
        notes: notes || undefined,
      }).returning();

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
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (fields.amount !== undefined) updateData.amount = fields.amount;
      if (fields.dueDate !== undefined) updateData.dueDate = fields.dueDate;
      if (fields.issueDate !== undefined) updateData.issueDate = fields.issueDate;
      if (fields.paymentMethod !== undefined) updateData.paymentMethod = fields.paymentMethod;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.billingType !== undefined) updateData.billingType = fields.billingType;
      if (fields.withheldTax !== undefined) {
        updateData.withheldTax = fields.withheldTax && parseFloat(fields.withheldTax) > 0 ? fields.withheldTax : null;
      }
      const [updated] = await db.update(invoices).set(updateData).where(eq(invoices.id, id)).returning();
      return updated;
    }),

  markInvoicePaid: protectedProcedure
    .input(z.object({
      id: z.number(),
      paymentDate: z.string(),
      paymentMethod: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [updated] = await db
        .update(invoices)
        .set({ status: "paga", paymentDate: input.paymentDate, paymentMethod: input.paymentMethod, updatedAt: new Date() })
        .where(eq(invoices.id, input.id))
        .returning();

      if (updated && updated.campaignId) {
        try {
          const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, updated.campaignId));
          if (campaign && !(campaign as any).isBonificada) {
            const existing = await db.select({ id: accountsPayable.id })
              .from(accountsPayable)
              .where(and(
                eq(accountsPayable.campaignId, updated.campaignId),
                eq(accountsPayable.invoiceId, input.id),
                eq(accountsPayable.type, "comissao"),
              ));
            if (existing.length === 0) {
              const invoiceAmt = Number(updated.amount);
              const restCommRate = Number(campaign.restaurantCommission || 0);
              const commAmount = invoiceAmt * (restCommRate / 100);
              if (commAmount > 0) {
                await db.insert(accountsPayable).values({
                  campaignId: updated.campaignId,
                  invoiceId: input.id,
                  type: "comissao",
                  description: `Comissão Restaurante (${restCommRate}%) - NF ${updated.invoiceNumber || updated.id}`,
                  amount: commAmount.toFixed(2),
                  recipientType: "restaurante",
                  status: "pendente",
                });
              }
            }
          }

          // ── Repasse para Provedor de Sala VIP (telas e janelas digitais) ─────
          // Quando o produto da campanha é do tipo 'telas' ou 'janelas_digitais'
          // e está vinculado a um vip_provider, gera uma conta a pagar do tipo
          // 'repasse_vip' baseada no % configurado no produto (com fallback para
          // o % padrão do provedor).
          if (campaign && !(campaign as any).isBonificada && campaign.productId) {
            const [product] = await db
              .select()
              .from(products)
              .where(eq(products.id, campaign.productId));

            if (
              product &&
              product.vipProviderId &&
              (VIP_PRODUCT_TIPOS as readonly string[]).includes(product.tipo ?? "")
            ) {
              const existingVip = await db.select({ id: accountsPayable.id })
                .from(accountsPayable)
                .where(and(
                  eq(accountsPayable.campaignId, updated.campaignId),
                  eq(accountsPayable.invoiceId, input.id),
                  eq(accountsPayable.type, "repasse_vip"),
                ));

              if (existingVip.length === 0) {
                const [provider] = await db
                  .select()
                  .from(vipProviders)
                  .where(eq(vipProviders.id, product.vipProviderId));

                if (provider && provider.status === "active") {
                  const invoiceAmt = Number(updated.amount);
                  // % específico do produto tem prioridade; fallback no % do provedor
                  const rate = Number(
                    product.vipProviderCommissionPercent ?? provider.commissionPercent ?? 0,
                  );
                  const amount = invoiceAmt * (rate / 100);
                  if (amount > 0) {
                    await db.insert(accountsPayable).values({
                      campaignId: updated.campaignId,
                      invoiceId: input.id,
                      vipProviderId: provider.id,
                      type: "repasse_vip",
                      description: `Repasse Sala VIP - ${provider.name} (${rate}%) - NF ${updated.invoiceNumber || updated.id}`,
                      amount: amount.toFixed(2),
                      recipientType: "vip_provider",
                      status: "pendente",
                    });
                  }
                }
              }
            }
          }
        } catch (err) { console.warn("[markInvoicePaid] Auto-generate commission payable failed:", err); }
      }

      return updated;
    }),

  cancelInvoice: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [updated] = await db
        .update(invoices)
        .set({ status: "cancelada", updatedAt: new Date() })
        .where(eq(invoices.id, input.id))
        .returning();
      return updated;
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
      const [updated] = await db
        .update(restaurantPayments)
        .set({ status: "paid", paymentDate: input.paymentDate, proofUrl: input.proofUrl })
        .where(eq(restaurantPayments.id, input.id))
        .returning();
      return updated;
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

      const rpRows = await db
        .select({
          campaignId: restaurantPayments.campaignId,
          total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        })
        .from(restaurantPayments)
        .groupBy(restaurantPayments.campaignId);

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

      return campaignRows.map((c) => {
        const cost = costMap[c.id];
        const dur = c.contractDuration;
        const batchCost = parseFloat(c.batchCost || "0");
        const productionPerMonth = parseFloat(cost?.productionCost || "0") > 0
          ? parseFloat(cost.productionCost) / dur
          : batchCost;
        const productionTotal = productionPerMonth * dur;

        const freightPerMonth = parseFloat(c.freightCost || "0");
        const freightTotal = freightPerMonth * dur;

        const restaurantCost = rpMap[c.id] || 0;

        const isBonificada = !!(c as any).isBonificada;
        const revenue = isBonificada ? 0 : (
          soMap[c.id]
          || (c.quotationId ? quotMap[c.quotationId] || 0 : 0)
          || 0
        );

        const taxRate = parseFloat(c.taxRate || "0");
        const taxAmount = isBonificada ? 0 : revenue * (taxRate / 100);

        const restRate = parseFloat(c.restaurantCommission || "0");
        const restAmount = isBonificada ? 0 : (revenue - taxAmount) * (restRate / 100);

        const pId = c.quotationId ? null : (c as any).partnerId || clientPartnerMap[c.clientId] || null;
        const resolvedPartnerId = pId;
        const partnerInfo = resolvedPartnerId ? partnerMap[resolvedPartnerId] : null;
        const partnerPct = partnerInfo?.pct || 0;
        const commBase = isBonificada ? 0 : (revenue - taxAmount) - restAmount - productionTotal - freightTotal;
        const partnerCommission = isBonificada ? 0 : (commBase > 0 ? commBase * (partnerPct / 100) : 0);

        const totalCosts = productionTotal + freightTotal + restaurantCost + (isBonificada ? 0 : taxAmount + restAmount + partnerCommission);

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

      if (existing.length > 0) {
        const [updated] = await db
          .update(operationalCosts)
          .set({ productionCost: input.productionCost, freightCost: input.freightCost, notes: input.notes, updatedAt: new Date() })
          .where(eq(operationalCosts.campaignId, input.campaignId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(operationalCosts)
          .values({ campaignId: input.campaignId, productionCost: input.productionCost, freightCost: input.freightCost, notes: input.notes })
          .returning();
        return created;
      }
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

      const rpRows = await db
        .select({
          campaignId: restaurantPayments.campaignId,
          restaurantId: restaurantPayments.restaurantId,
          total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        })
        .from(restaurantPayments)
        .where(and(
          gte(restaurantPayments.createdAt, new Date(input.startDate)),
          lte(restaurantPayments.createdAt, new Date(input.endDate))
        ))
        .groupBy(restaurantPayments.campaignId, restaurantPayments.restaurantId);

      const rpByCampaign: Record<number, number> = {};
      const rpByRestaurant: Record<number, number> = {};
      for (const r of rpRows) {
        if (r.campaignId) rpByCampaign[r.campaignId] = (rpByCampaign[r.campaignId] || 0) + parseFloat(r.total);
        rpByRestaurant[r.restaurantId] = (rpByRestaurant[r.restaurantId] || 0) + parseFloat(r.total);
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
      const commissionValue = commissionBase * (partnerCommissionPercent / 100);

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
    }).optional())
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const conditions = [];
      if (input?.campaignId) conditions.push(eq(accountsPayable.campaignId, input.campaignId));
      if (input?.status) conditions.push(eq(accountsPayable.status, input.status));
      if (input?.type) conditions.push(eq(accountsPayable.type, input.type));
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

  createAccountPayable: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      invoiceId: z.number().optional(),
      supplierId: z.number().optional(),
      type: z.string(),
      description: z.string(),
      amount: z.string(),
      dueDate: z.string().optional(),
      recipientType: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [row] = await db.insert(accountsPayable).values({
        campaignId: input.campaignId,
        invoiceId: input.invoiceId ?? null,
        supplierId: input.supplierId ?? null,
        type: input.type,
        description: input.description,
        amount: input.amount,
        dueDate: input.dueDate ?? null,
        recipientType: input.recipientType ?? null,
        notes: input.notes ?? null,
        status: "pendente",
      }).returning();
      return row;
    }),

  updateAccountPayable: protectedProcedure
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

  markAccountPayablePaid: protectedProcedure
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

  deleteAccountPayable: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      await db.delete(accountsPayable).where(eq(accountsPayable.id, input.id));
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
        await db.insert(accountsPayable).values({
          campaignId: input.campaignId,
          invoiceId: input.invoiceId,
          type: "comissao",
          description: `Comissão Restaurante (${restCommRate}%)`,
          amount: commAmount.toFixed(2),
          recipientType: "restaurante",
          status: "pendente",
        });
        return { generated: 1 };
      }
      return { generated: 0 };
    }),
});
