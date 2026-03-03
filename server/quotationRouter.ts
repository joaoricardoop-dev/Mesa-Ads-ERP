import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { quotations, campaigns, clients, campaignHistory, serviceOrders, quotationRestaurants, activeRestaurants, campaignRestaurants } from "../drizzle/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const MONTH_NAMES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function generateQuotationName(clientName: string, coasterVolume: number, date?: Date): string {
  const d = date || new Date();
  const month = MONTH_NAMES_PT[d.getMonth()];
  const year = d.getFullYear();
  const formattedVolume = coasterVolume.toLocaleString("pt-BR");
  return `${month} ${year} | ${clientName} | ${formattedVolume}`;
}

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

async function generateOSNumber(db: any) {
  const year = new Date().getFullYear();
  const pattern = `OS-ANT-${year}-%`;
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(serviceOrders)
    .where(sql`${serviceOrders.orderNumber} LIKE ${pattern}`);
  const seqNum = Number(countResult[0]?.count || 0) + 1;
  return `OS-ANT-${year}-${String(seqNum).padStart(4, "0")}`;
}

export const quotationRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["rascunho", "enviada", "ativa", "os_gerada", "win", "perdida", "expirada"]).optional(),
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
          quotationName: quotations.quotationName,
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
          clientCnpj: clients.cnpj,
          clientEmail: clients.contactEmail,
          clientPhone: clients.contactPhone,
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
          quotationName: quotations.quotationName,
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
          clientCnpj: clients.cnpj,
          clientEmail: clients.contactEmail,
          clientPhone: clients.contactPhone,
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
      const clientName = client[0].name || client[0].company || "Cliente";
      const quotationName = generateQuotationName(clientName, input.coasterVolume);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        quotationName,
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
      status: z.enum(["rascunho", "enviada", "ativa", "os_gerada", "win", "perdida", "expirada"]).optional(),
      lossReason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;

      const existing = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });

      const clientId = data.clientId ?? existing[0].clientId;
      const coasterVolume = data.coasterVolume ?? existing[0].coasterVolume;

      if (data.clientId !== undefined || data.coasterVolume !== undefined) {
        const client = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
        const clientName = client[0]?.name || client[0]?.company || "Cliente";
        (data as any).quotationName = generateQuotationName(clientName, coasterVolume);
      }

      const [updated] = await db
        .update(quotations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(quotations.id, id))
        .returning();
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
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const quotation = await db.select().from(quotations).where(eq(quotations.id, input.id)).limit(1);
      if (!quotation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      if (quotation[0].status === "win") throw new TRPCError({ code: "BAD_REQUEST", message: "Cotação já foi convertida" });

      const campaignNumber = await generateCampaignNumber(db);
      const campaignName = quotation[0].quotationName || quotation[0].quotationNumber;

      const [campaign] = await db.insert(campaigns).values({
        campaignNumber,
        clientId: quotation[0].clientId,
        name: campaignName,
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
      const client = await db.select().from(clients).where(eq(clients.id, original[0].clientId)).limit(1);
      const clientName = client[0]?.name || client[0]?.company || "Cliente";
      const quotationName = generateQuotationName(clientName, original[0].coasterVolume);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        quotationName,
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

  generateOS: comercialProcedure
    .input(z.object({
      id: z.number(),
      description: z.string().optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      paymentTerms: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const quotation = await db.select().from(quotations).where(eq(quotations.id, input.id)).limit(1);
      if (!quotation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      if (quotation[0].status !== "ativa") throw new TRPCError({ code: "BAD_REQUEST", message: "Cotação precisa estar ativa para gerar OS" });

      const existingOS = await db.select().from(serviceOrders).where(eq(serviceOrders.quotationId, input.id)).limit(1);
      if (existingOS[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "OS já foi gerada para esta cotação" });

      const orderNumber = await generateOSNumber(db);

      const [os] = await db.insert(serviceOrders).values({
        orderNumber,
        type: "anunciante" as const,
        quotationId: quotation[0].id,
        clientId: quotation[0].clientId,
        description: input.description || `OS referente à cotação ${quotation[0].quotationNumber}`,
        coasterVolume: quotation[0].coasterVolume,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalValue: quotation[0].totalValue,
        paymentTerms: input.paymentTerms,
        status: "rascunho" as const,
      }).returning();

      await db
        .update(quotations)
        .set({ status: "os_gerada", updatedAt: new Date() })
        .where(eq(quotations.id, input.id));

      return { quotationId: input.id, serviceOrderId: os.id, orderNumber };
    }),

  getOS: protectedProcedure
    .input(z.object({ quotationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const result = await db
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.quotationId, input.quotationId))
        .limit(1);
      return result[0] || null;
    }),

  getRestaurants: protectedProcedure
    .input(z.object({ quotationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select({
          id: quotationRestaurants.id,
          quotationId: quotationRestaurants.quotationId,
          restaurantId: quotationRestaurants.restaurantId,
          coasterQuantity: quotationRestaurants.coasterQuantity,
          restaurantName: activeRestaurants.name,
          restaurantAddress: activeRestaurants.address,
          commissionPercent: quotationRestaurants.commissionPercent,
        })
        .from(quotationRestaurants)
        .leftJoin(activeRestaurants, eq(quotationRestaurants.restaurantId, activeRestaurants.id))
        .where(eq(quotationRestaurants.quotationId, input.quotationId));
      return rows;
    }),

  setRestaurants: comercialProcedure
    .input(z.object({
      quotationId: z.number(),
      restaurants: z.array(z.object({
        restaurantId: z.number(),
        coasterQuantity: z.number().int().min(1),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(quotationRestaurants).where(eq(quotationRestaurants.quotationId, input.quotationId));
      if (input.restaurants.length > 0) {
        const restaurantIds = input.restaurants.map(r => r.restaurantId);
        const restaurantRecords = await db
          .select({ id: activeRestaurants.id, commissionPercent: activeRestaurants.commissionPercent })
          .from(activeRestaurants)
          .where(inArray(activeRestaurants.id, restaurantIds));
        const commMap = new Map(restaurantRecords.map(r => [r.id, r.commissionPercent || "20.00"]));

        await db.insert(quotationRestaurants).values(
          input.restaurants.map(r => ({
            quotationId: input.quotationId,
            restaurantId: r.restaurantId,
            coasterQuantity: r.coasterQuantity,
            commissionPercent: String(commMap.get(r.restaurantId) || "20.00"),
          }))
        );
      }
      return { success: true, count: input.restaurants.length };
    }),

  signOS: comercialProcedure
    .input(z.object({
      quotationId: z.number(),
      signatureUrl: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const quotation = await db.select().from(quotations).where(eq(quotations.id, input.quotationId)).limit(1);
      if (!quotation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      if (quotation[0].status !== "os_gerada") throw new TRPCError({ code: "BAD_REQUEST", message: "Cotação precisa estar com OS gerada" });

      const allocatedRestaurants = await db
        .select()
        .from(quotationRestaurants)
        .where(eq(quotationRestaurants.quotationId, input.quotationId));
      if (allocatedRestaurants.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário alocar restaurantes antes de assinar a OS" });
      }

      const os = await db.select().from(serviceOrders).where(eq(serviceOrders.quotationId, input.quotationId)).limit(1);
      if (!os[0]) throw new TRPCError({ code: "NOT_FOUND", message: "OS não encontrada" });

      await db
        .update(serviceOrders)
        .set({ status: "assinada", signatureUrl: input.signatureUrl, updatedAt: new Date() })
        .where(eq(serviceOrders.id, os[0].id));

      let totalCoasters = 0;
      let weightedCommissionSum = 0;
      for (const alloc of allocatedRestaurants) {
        const comm = parseFloat(String(alloc.commissionPercent || "20"));
        totalCoasters += alloc.coasterQuantity;
        weightedCommissionSum += comm * alloc.coasterQuantity;
      }
      const avgCommission = totalCoasters > 0 ? (weightedCommissionSum / totalCoasters).toFixed(2) : "20.00";

      const campaignNumber = await generateCampaignNumber(db);
      const campaignName = quotation[0].quotationName || quotation[0].quotationNumber;

      const [campaign] = await db.insert(campaigns).values({
        campaignNumber,
        clientId: quotation[0].clientId,
        name: campaignName,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "producao",
        quotationId: quotation[0].id,
        campaignType: quotation[0].campaignType,
        coastersPerRestaurant: 500,
        usagePerDay: 3,
        daysPerMonth: 26,
        activeRestaurants: allocatedRestaurants.length,
        pricingType: "variable",
        markupPercent: "30.00",
        fixedPrice: "0.00",
        commissionType: "variable",
        restaurantCommission: avgCommission,
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
        details: `Campanha criada a partir da cotação ${quotation[0].quotationNumber} (OS assinada)`,
      });

      if (allocatedRestaurants.length > 0) {
        await db.insert(campaignRestaurants).values(
          allocatedRestaurants.map(r => ({
            campaignId: campaign.id,
            restaurantId: r.restaurantId,
            coastersCount: r.coasterQuantity,
          }))
        );
      }

      await db
        .update(quotations)
        .set({ status: "win", updatedAt: new Date() })
        .where(eq(quotations.id, input.quotationId));

      return { quotationId: input.quotationId, campaignId: campaign.id, campaignNumber };
    }),

});
