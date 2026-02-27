import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { quotations, campaigns, clients, campaignHistory } from "../drizzle/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

async function generateQuotationNumber(db: any) {
  const year = new Date().getFullYear();
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(quotations)
    .where(sql`"quotationNumber" LIKE ${'QOT-' + year + '-%'}`);
  const seqNum = Number(countResult[0]?.count || 0) + 1;
  return `QOT-${year}-${String(seqNum).padStart(4, "0")}`;
}

async function generateCampaignNumber(db: any) {
  const year = new Date().getFullYear();
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(campaigns)
    .where(sql`"campaignNumber" LIKE ${'CMP-' + year + '-%'}`);
  const seqNum = Number(countResult[0]?.count || 0) + 1;
  return `CMP-${year}-${String(seqNum).padStart(4, "0")}`;
}

export const quotationRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["rascunho", "enviada", "ativa", "win", "perdida", "expirada"]).optional(),
      clientId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.status) conditions.push(eq(quotations.status, input.status));
      if (input?.clientId) conditions.push(eq(quotations.clientId, input.clientId));

      const rows = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          clientId: quotations.clientId,
          campaignType: quotations.campaignType,
          coasterVolume: quotations.coasterVolume,
          networkProfile: quotations.networkProfile,
          regions: quotations.regions,
          cycles: quotations.cycles,
          unitPrice: quotations.unitPrice,
          totalValue: quotations.totalValue,
          includesProduction: quotations.includesProduction,
          notes: quotations.notes,
          validUntil: quotations.validUntil,
          status: quotations.status,
          lossReason: quotations.lossReason,
          createdBy: quotations.createdBy,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
          clientName: clients.name,
          clientCompany: clients.company,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(quotations.createdAt));

      return rows;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          clientId: quotations.clientId,
          campaignType: quotations.campaignType,
          coasterVolume: quotations.coasterVolume,
          networkProfile: quotations.networkProfile,
          regions: quotations.regions,
          cycles: quotations.cycles,
          unitPrice: quotations.unitPrice,
          totalValue: quotations.totalValue,
          includesProduction: quotations.includesProduction,
          notes: quotations.notes,
          validUntil: quotations.validUntil,
          status: quotations.status,
          lossReason: quotations.lossReason,
          createdBy: quotations.createdBy,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
          clientName: clients.name,
          clientCompany: clients.company,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .where(eq(quotations.id, input.id))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      return rows[0];
    }),

  create: comercialProcedure
    .input(z.object({
      clientId: z.number(),
      campaignType: z.string().optional(),
      coasterVolume: z.number().int().min(1),
      networkProfile: z.string().optional(),
      regions: z.string().optional(),
      cycles: z.number().int().optional(),
      unitPrice: z.string().optional(),
      totalValue: z.string().optional(),
      includesProduction: z.boolean().optional(),
      notes: z.string().optional(),
      validUntil: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const client = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
      if (!client[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });

      const quotationNumber = await generateQuotationNumber(db);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        clientId: input.clientId,
        campaignType: input.campaignType,
        coasterVolume: input.coasterVolume,
        networkProfile: input.networkProfile,
        regions: input.regions,
        cycles: input.cycles,
        unitPrice: input.unitPrice,
        totalValue: input.totalValue,
        includesProduction: input.includesProduction,
        notes: input.notes,
        validUntil: input.validUntil,
        createdBy: input.createdBy,
      }).returning();

      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      clientId: z.number().optional(),
      campaignType: z.string().optional(),
      coasterVolume: z.number().int().min(1).optional(),
      networkProfile: z.string().optional(),
      regions: z.string().optional(),
      cycles: z.number().int().optional(),
      unitPrice: z.string().optional(),
      totalValue: z.string().optional(),
      includesProduction: z.boolean().optional(),
      notes: z.string().optional(),
      validUntil: z.string().optional(),
      status: z.enum(["rascunho", "enviada", "ativa", "win", "perdida", "expirada"]).optional(),
      lossReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(quotations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(quotations.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      return updated;
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(quotations).where(eq(quotations.id, input.id));
      return { success: true };
    }),

  markWin: comercialProcedure
    .input(z.object({
      id: z.number(),
      campaignName: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const quotation = await db.select().from(quotations).where(eq(quotations.id, input.id)).limit(1);
      if (!quotation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      if (quotation[0].status === "win") throw new TRPCError({ code: "BAD_REQUEST", message: "Cotação já foi convertida" });

      const campaignNumber = await generateCampaignNumber(db);

      const [campaign] = await db.insert(campaigns).values({
        campaignNumber,
        clientId: quotation[0].clientId,
        name: input.campaignName,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "active",
        quotationId: quotation[0].id,
        campaignType: quotation[0].campaignType,
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
        contractDuration: quotation[0].cycles || 6,
        batchSize: quotation[0].coasterVolume,
        batchCost: "1200.00",
        notes: quotation[0].notes,
      }).returning();

      await db.insert(campaignHistory).values({
        campaignId: campaign.id,
        action: "created_from_quotation",
        details: `Campanha criada a partir da cotação ${quotation[0].quotationNumber}`,
      });

      await db
        .update(quotations)
        .set({ status: "win", updatedAt: new Date() })
        .where(eq(quotations.id, input.id));

      return { quotationId: input.id, campaignId: campaign.id, campaignNumber };
    }),

  markLost: comercialProcedure
    .input(z.object({
      id: z.number(),
      lossReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(quotations)
        .set({ status: "perdida", lossReason: input.lossReason, updatedAt: new Date() })
        .where(eq(quotations.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      return updated;
    }),

  duplicate: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const original = await db.select().from(quotations).where(eq(quotations.id, input.id)).limit(1);
      if (!original[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });

      const quotationNumber = await generateQuotationNumber(db);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        clientId: original[0].clientId,
        campaignType: original[0].campaignType,
        coasterVolume: original[0].coasterVolume,
        networkProfile: original[0].networkProfile,
        regions: original[0].regions,
        cycles: original[0].cycles,
        unitPrice: original[0].unitPrice,
        totalValue: original[0].totalValue,
        includesProduction: original[0].includesProduction,
        notes: original[0].notes ? `[Cópia] ${original[0].notes}` : `[Cópia de ${original[0].quotationNumber}]`,
        validUntil: original[0].validUntil,
        createdBy: original[0].createdBy,
        status: "rascunho",
      }).returning();

      return created;
    }),
});
