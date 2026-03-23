import { internalProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { serviceOrders, campaigns, clients, quotations, campaignHistory, products, invoices } from "../drizzle/schema";
import { eq, and, desc, sql, inArray, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

async function generateOrderNumber(db: any, type: "anunciante" | "producao" | "distribuicao") {
  const prefix = type === "anunciante" ? "OS-ANT" : type === "distribuicao" ? "OS-DIST" : "OS-PROD";
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(serviceOrders)
    .where(sql`${serviceOrders.orderNumber} LIKE ${pattern}`);
  const seqNum = Number(countResult[0]?.count || 0) + 1;
  return `${prefix}-${year}-${String(seqNum).padStart(4, "0")}`;
}

export const serviceOrderRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.enum(["anunciante", "producao", "distribuicao"]).optional(),
      status: z.enum(["rascunho", "enviada", "assinada", "execucao", "concluida"]).optional(),
      campaignId: z.number().optional(),
      clientId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.type) conditions.push(eq(serviceOrders.type, input.type));
      if (input?.status) conditions.push(eq(serviceOrders.status, input.status));
      if (input?.campaignId) conditions.push(eq(serviceOrders.campaignId, input.campaignId));
      if (input?.clientId) conditions.push(eq(serviceOrders.clientId, input.clientId));

      const rows = await db
        .select()
        .from(serviceOrders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(serviceOrders.createdAt));

      const campaignIds = Array.from(new Set(rows.map(r => r.campaignId).filter((v): v is number => v != null)));
      const clientIds = Array.from(new Set(rows.map(r => r.clientId).filter((v): v is number => v != null)));
      const productIds = Array.from(new Set(rows.map(r => r.productId).filter((v): v is number => v != null)));

      const campaignMap: Record<number, string> = {};
      const clientMap: Record<number, string> = {};
      const productMap: Record<number, string> = {};

      if (campaignIds.length > 0) {
        const campRows = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(inArray(campaigns.id, campaignIds));
        for (const c of campRows) campaignMap[c.id] = c.name;
      }
      if (clientIds.length > 0) {
        const cliRows = await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, clientIds));
        for (const c of cliRows) clientMap[c.id] = c.name;
      }
      if (productIds.length > 0) {
        const prodRows = await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds));
        for (const p of prodRows) productMap[p.id] = p.name;
      }

      return rows.map(r => ({
        ...r,
        campaignName: r.campaignId ? (campaignMap[r.campaignId] || "—") : "—",
        clientName: r.clientId ? (clientMap[r.clientId] || "—") : "—",
        productName: r.productId ? (productMap[r.productId] || null) : null,
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const result = await db.select().from(serviceOrders).where(eq(serviceOrders.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });
      return result[0];
    }),

  create: internalProcedure
    .input(z.object({
      type: z.enum(["anunciante", "producao", "distribuicao"]),
      campaignId: z.number().optional(),
      clientId: z.number().optional(),
      description: z.string().optional(),
      coasterVolume: z.number().optional(),
      networkAllocation: z.string().optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      totalValue: z.string().optional(),
      paymentTerms: z.string().optional(),
      specs: z.string().optional(),
      supplierName: z.string().optional(),
      estimatedDeadline: z.string().optional(),
      artPdfUrl: z.string().optional(),
      artImageUrls: z.string().optional(),
      productId: z.number().optional(),
      trackingCode: z.string().optional(),
      freightProvider: z.string().optional(),
      freightExpectedDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const orderNumber = await generateOrderNumber(db, input.type);
      const [created] = await db.insert(serviceOrders).values({
        ...input,
        orderNumber,
      }).returning();
      return created;
    }),

  update: internalProcedure
    .input(z.object({
      id: z.number(),
      description: z.string().optional(),
      coasterVolume: z.number().optional(),
      networkAllocation: z.string().optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      totalValue: z.string().optional(),
      paymentTerms: z.string().optional(),
      status: z.enum(["rascunho", "enviada", "assinada", "execucao", "concluida"]).optional(),
      specs: z.string().optional(),
      supplierName: z.string().optional(),
      estimatedDeadline: z.string().optional(),
      artPdfUrl: z.string().optional(),
      artImageUrls: z.string().optional(),
      productId: z.number().optional(),
      trackingCode: z.string().optional(),
      freightProvider: z.string().optional(),
      freightExpectedDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(serviceOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(serviceOrders.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });
      return updated;
    }),

  delete: internalProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(serviceOrders).where(eq(serviceOrders.id, input.id));
      return { success: true };
    }),

  updateStatus: internalProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["rascunho", "enviada", "assinada", "execucao", "concluida"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(serviceOrders)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(serviceOrders.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });

      if (input.status === "assinada" && updated.quotationId) {
        const quotation = await db.select().from(quotations).where(eq(quotations.id, updated.quotationId)).limit(1);
        if (quotation[0] && quotation[0].status === "os_gerada") {
          const year = new Date().getFullYear();
          const countResult = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(campaigns)
            .where(sql`"campaignNumber" LIKE ${'CMP-' + year + '-%'}`);
          const seqNum = Number(countResult[0]?.count || 0) + 1;
          const campaignNumber = `CMP-${year}-${String(seqNum).padStart(4, "0")}`;

          const q = quotation[0];
          const clientRows = await db.select().from(clients).where(eq(clients.id, q.clientId!)).limit(1);
          const clientName = clientRows[0]?.name || clientRows[0]?.company || "Cliente";

          const [campaign] = await db.insert(campaigns).values({
            campaignNumber,
            clientId: q.clientId!,
            name: `${clientName} - Campanha`,
            startDate: updated.periodStart || new Date().toISOString().split("T")[0],
            endDate: updated.periodEnd || new Date().toISOString().split("T")[0],
            status: "briefing",
            quotationId: q.id,
            proposalSignedAt: new Date(),
            briefingEnteredAt: new Date(),
            coastersPerRestaurant: 500,
            usagePerDay: 3,
            daysPerMonth: 26,
            activeRestaurants: 10,
            pricingType: "variable",
            markupPercent: "30.00",
            fixedPrice: "0.00",
            commissionType: "variable",
            restaurantCommission: "20.00",
            fixedCommission: "0.0500",
            sellerCommission: "10.00",
            taxRate: "15.00",
            contractDuration: q.cycles || 6,
            batchSize: q.coasterVolume,
            batchCost: "1200.00",
            notes: q.notes,
            productId: q.productId,
          }).returning();

          await db.insert(campaignHistory).values({
            campaignId: campaign.id,
            action: "created_from_quotation",
            details: `Campanha criada após assinatura da OS ${updated.orderNumber} (cotação ${q.quotationNumber})`,
          });

          if (!q.isBonificada && q.totalValue && parseFloat(q.totalValue) > 0) {
            const invYear = new Date().getFullYear();
            const invCount = await db.select({ count: sql<number>`COUNT(*)` }).from(invoices).where(sql`"invoiceNumber" LIKE ${'FAT-' + invYear + '-%'}`);
            const invSeq = Number(invCount[0]?.count || 0) + 1;
            const invoiceNumber = `FAT-${invYear}-${String(invSeq).padStart(4, "0")}`;
            const today = new Date().toISOString().split("T")[0];
            const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            await db.insert(invoices).values({
              campaignId: campaign.id,
              clientId: campaign.clientId,
              invoiceNumber,
              amount: q.totalValue,
              issueDate: today,
              dueDate,
              status: "emitida",
            });
          }

          await db
            .update(quotations)
            .set({ status: "win", updatedAt: new Date() })
            .where(eq(quotations.id, q.id));

          return { ...updated, campaignCreated: true, campaignId: campaign.id, campaignNumber };
        }
      }

      return updated;
    }),
});
