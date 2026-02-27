import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  invoices,
  operationalCosts,
  campaigns,
  clients,
  restaurantPayments,
  activeRestaurants,
} from "../drizzle/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

function requireFinancialAccess(role: string) {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao módulo financeiro" });
  }
}

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
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
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
    const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

    const paidThisMonth = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(invoices)
      .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, monthStart), lte(invoices.paymentDate, monthEnd)));

    const overdueTotal = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(invoices)
      .where(and(eq(invoices.status, "emitida"), lte(invoices.dueDate, now.toISOString().split("T")[0])));

    const receivablesResult = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(invoices)
      .where(eq(invoices.status, "emitida"));

    const costData = await db
      .select({
        totalProduction: sql<string>`COALESCE(SUM("productionCost"::numeric), 0)`,
        totalFreight: sql<string>`COALESCE(SUM("freightCost"::numeric), 0)`,
      })
      .from(operationalCosts);

    const rpTotal = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(restaurantPayments)
      .where(and(
        gte(restaurantPayments.createdAt, new Date(currentYear, currentMonth, 1)),
        lte(restaurantPayments.createdAt, new Date(currentYear, currentMonth + 1, 0))
      ));

    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const mStart = d.toISOString().split("T")[0];
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const r = await db
        .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
        .from(invoices)
        .where(and(eq(invoices.status, "paga"), gte(invoices.paymentDate, mStart), lte(invoices.paymentDate, mEnd)));
      monthlyRevenue.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        revenue: parseFloat(r[0]?.total || "0"),
      });
    }

    const activeCampaigns = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(campaigns)
      .where(eq(campaigns.status, "quotation"));

    const revenue = parseFloat(paidThisMonth[0]?.total || "0");
    const production = parseFloat(costData[0]?.totalProduction || "0");
    const freight = parseFloat(costData[0]?.totalFreight || "0");
    const restaurantCosts = parseFloat(rpTotal[0]?.total || "0");
    const totalCosts = production + freight + restaurantCosts;
    const margin = revenue - totalCosts;

    return {
      revenue,
      totalCosts,
      margin,
      marginPercent: revenue > 0 ? (margin / revenue) * 100 : 0,
      overdue: parseFloat(overdueTotal[0]?.total || "0"),
      receivables: parseFloat(receivablesResult[0]?.total || "0"),
      costBreakdown: { production, freight, restaurantCosts },
      monthlyRevenue,
      pipeline: Number(activeCampaigns[0]?.count || 0),
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

      const rows = await db
        .select()
        .from(invoices)
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
      paymentMethod: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const campaign = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      const year = new Date().getFullYear();
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(invoices)
        .where(sql`EXTRACT(YEAR FROM "createdAt") = ${year}`);
      const seqNum = Number(countResult[0]?.count || 0) + 1;
      const invoiceNumber = `FAT-${year}-${String(seqNum).padStart(4, "0")}`;

      const [created] = await db.insert(invoices).values({
        campaignId: input.campaignId,
        clientId: campaign[0].clientId,
        invoiceNumber,
        amount: input.amount,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: input.dueDate,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      }).returning();

      return created;
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

      return campaignRows.map((c) => {
        const cost = costMap[c.id];
        const production = parseFloat(cost?.productionCost || c.productionCost || "0");
        const freight = parseFloat(cost?.freightCost || c.freightCost || "0");
        const restaurantCost = rpMap[c.id] || 0;
        return {
          campaignId: c.id,
          campaignName: c.name,
          production,
          freight,
          restaurantCost,
          total: production + freight + restaurantCost,
          coastersTotal: c.coastersPerRestaurant * c.activeRestaurants,
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

      const cmpIds = uniqueIds(paidInvoices.map((i) => i.campaignId));
      const cliIds = uniqueIds(paidInvoices.map((i) => i.clientId));

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

      return {
        totalRevenue,
        totalCosts,
        margin: totalRevenue - totalCosts,
        marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0,
        byCampaign: Object.values(byCampaign),
        byClient,
        byRestaurant,
      };
    }),

  campaignsForInvoice: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();

    const rows = await db
      .select({ id: campaigns.id, name: campaigns.name, clientId: campaigns.clientId, status: campaigns.status })
      .from(campaigns)
      .where(inArray(campaigns.status, ["active", "quotation", "completed"]))
      .orderBy(desc(campaigns.createdAt));

    const cliIds = uniqueIds(rows.map((r) => r.clientId));
    const clientMap: Record<number, string> = {};
    if (cliIds.length > 0) {
      const cliRows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, cliIds));
      for (const c of cliRows) clientMap[c.id] = c.name;
    }

    return rows.map((r) => ({ ...r, clientName: clientMap[r.clientId] || "—" }));
  }),
});
