import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { quotations, campaigns, clients, campaignHistory, serviceOrders, quotationRestaurants, activeRestaurants, campaignRestaurants, leads, campaignBatches, campaignBatchAssignments, products, partners, quotationItems, productPricingTiers } from "../drizzle/schema";
import { eq, desc, sql, and, inArray, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { createCrmNotification } from "./notificationRouter";

const MONTH_NAMES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function generateQuotationName(clientName: string, coasterVolume: number, productName?: string, date?: Date): string {
  const d = date || new Date();
  const month = MONTH_NAMES_PT[d.getMonth()];
  const year = d.getFullYear();
  const formattedVolume = coasterVolume.toLocaleString("pt-BR");
  const prodLabel = productName ? ` | ${productName}` : "";
  return `${month} ${year} | ${clientName} | ${formattedVolume}${prodLabel}`;
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
      leadId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.status) conditions.push(eq(quotations.status, input.status));
      if (input?.clientId) conditions.push(eq(quotations.clientId, input.clientId));
      if (input?.leadId) conditions.push(eq(quotations.leadId, input.leadId));

      const rows = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          quotationName: quotations.quotationName,
          clientId: quotations.clientId,
          leadId: quotations.leadId,
          coasterVolume: quotations.coasterVolume,
          manualDiscountPercent: quotations.manualDiscountPercent,
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
          isBonificada: quotations.isBonificada,
          hasPartnerDiscount: quotations.hasPartnerDiscount,
          productId: quotations.productId,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
          clientName: clients.name,
          clientCompany: clients.company,
          clientCnpj: clients.cnpj,
          clientEmail: clients.contactEmail,
          clientPhone: clients.contactPhone,
          leadName: leads.name,
          leadCompany: leads.company,
          leadCnpj: leads.cnpj,
          leadEmail: leads.contactEmail,
          leadPhone: leads.contactPhone,
          productName: products.name,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
          partnerId: quotations.partnerId,
          partnerName: partners.name,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .leftJoin(leads, eq(quotations.leadId, leads.id))
        .leftJoin(products, eq(quotations.productId, products.id))
        .leftJoin(partners, eq(quotations.partnerId, partners.id))
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
          leadId: quotations.leadId,
          coasterVolume: quotations.coasterVolume,
          manualDiscountPercent: quotations.manualDiscountPercent,
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
          isBonificada: quotations.isBonificada,
          hasPartnerDiscount: quotations.hasPartnerDiscount,
          productId: quotations.productId,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
          publicToken: quotations.publicToken,
          signedAt: quotations.signedAt,
          clientName: clients.name,
          clientCompany: clients.company,
          clientCnpj: clients.cnpj,
          clientEmail: clients.contactEmail,
          clientPhone: clients.contactPhone,
          leadName: leads.name,
          leadCompany: leads.company,
          leadCnpj: leads.cnpj,
          leadEmail: leads.contactEmail,
          leadPhone: leads.contactPhone,
          productName: products.name,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
          partnerId: quotations.partnerId,
          partnerName: partners.name,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .leftJoin(leads, eq(quotations.leadId, leads.id))
        .leftJoin(products, eq(quotations.productId, products.id))
        .leftJoin(partners, eq(quotations.partnerId, partners.id))
        .where(eq(quotations.id, input.id))
        .limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      return rows[0];
    }),

  create: comercialProcedure
    .input(z.object({
      clientId: z.number().optional(),
      leadId: z.number().optional(),
      coasterVolume: z.number().int().min(1),
      manualDiscountPercent: z.string().optional(),
      networkProfile: z.string().optional(),
      regions: z.string().optional(),
      cycles: z.number().int().optional(),
      unitPrice: z.string().optional(),
      totalValue: z.string().optional(),
      includesProduction: z.boolean().optional(),
      notes: z.string().optional(),
      validUntil: z.string().optional(),
      createdBy: z.string().optional(),
      isBonificada: z.boolean().optional(),
      hasPartnerDiscount: z.boolean().optional(),
      productId: z.number(),
      partnerId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      if (!input.clientId && !input.leadId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um cliente ou lead para a cotação" });
      }

      let entityName = "Lead";

      if (input.clientId) {
        const client = await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1);
        if (!client[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        entityName = client[0].name || client[0].company || "Cliente";
      } else if (input.leadId) {
        const lead = await db.select().from(leads).where(eq(leads.id, input.leadId)).limit(1);
        if (!lead[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
        entityName = lead[0].company || lead[0].name || "Lead";
      }

      let productName: string | undefined;
      if (input.productId) {
        const prod = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
        if (prod[0]) productName = prod[0].name;
      }

      const quotationNumber = await generateQuotationNumber(db);
      const quotationName = generateQuotationName(entityName, input.coasterVolume, productName);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        quotationName,
        clientId: input.clientId ?? null,
        leadId: input.leadId ?? null,
        coasterVolume: input.coasterVolume,
        manualDiscountPercent: input.manualDiscountPercent ?? "0",
        networkProfile: input.networkProfile,
        regions: input.regions,
        cycles: input.cycles,
        unitPrice: input.unitPrice,
        totalValue: input.totalValue,
        includesProduction: input.includesProduction,
        notes: input.notes,
        validUntil: input.validUntil,
        createdBy: input.createdBy,
        isBonificada: input.isBonificada ?? false,
        hasPartnerDiscount: input.hasPartnerDiscount ?? false,
        productId: input.productId,
        partnerId: input.partnerId ?? null,
      }).returning();

      if (created.partnerId) {
        const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, created.partnerId)).limit(1);
        const partnerLabel = partner?.name || `Parceiro #${created.partnerId}`;
        await createCrmNotification(db, {
          eventType: "quotation_created",
          leadId: created.leadId ?? null,
          partnerId: created.partnerId,
          message: `Cotação ${quotationNumber} gerada para lead de ${partnerLabel}: ${entityName}`,
        });
      } else if (created.leadId) {
        const [leadRow] = await db.select({ partnerId: leads.partnerId, company: leads.company, name: leads.name }).from(leads).where(eq(leads.id, created.leadId)).limit(1);
        if (leadRow?.partnerId) {
          const [partner] = await db.select({ name: partners.name }).from(partners).where(eq(partners.id, leadRow.partnerId)).limit(1);
          const partnerLabel = partner?.name || `Parceiro #${leadRow.partnerId}`;
          await createCrmNotification(db, {
            eventType: "quotation_created",
            leadId: created.leadId,
            partnerId: leadRow.partnerId,
            message: `Cotação ${quotationNumber} gerada para lead de ${partnerLabel}: ${entityName}`,
          });
        }
      }

      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      clientId: z.number().optional(),
      coasterVolume: z.number().int().min(1).optional(),
      manualDiscountPercent: z.string().optional(),
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
      isBonificada: z.boolean().optional(),
      hasPartnerDiscount: z.boolean().optional(),
      productId: z.number().nullable().optional(),
      partnerId: z.number().nullable().optional(),
      periodStart: z.string().nullable().optional(),
      batchWeeks: z.number().int().min(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;

      const existing = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });

      if (data.status && ["rascunho", "enviada", "ativa"].includes(data.status)) {
        const existingOS = await db.select({ id: serviceOrders.id }).from(serviceOrders).where(eq(serviceOrders.quotationId, id)).limit(1);
        if (existingOS[0]) {
          delete (data as any).status;
        }
      }

      const clientId = data.clientId ?? existing[0].clientId;
      const coasterVolume = data.coasterVolume ?? existing[0].coasterVolume;
      const productId = data.productId !== undefined ? data.productId : existing[0].productId;

      if (data.clientId !== undefined || data.coasterVolume !== undefined || data.productId !== undefined) {
        const client = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
        const clientName = client[0]?.name || client[0]?.company || "Cliente";
        let productName: string | undefined;
        if (productId) {
          const prod = await db.select().from(products).where(eq(products.id, productId)).limit(1);
          if (prod[0]) productName = prod[0].name;
        }
        (data as any).quotationName = generateQuotationName(clientName, coasterVolume, productName);
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
        clientId: quotation[0].clientId!,
        name: campaignName,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "active",
        quotationId: quotation[0].id,
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
        isBonificada: quotation[0].isBonificada,
        productId: quotation[0].productId,
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
      const client = await db.select().from(clients).where(eq(clients.id, original[0].clientId!)).limit(1);
      const clientName = client[0]?.name || client[0]?.company || "Cliente";
      let productName: string | undefined;
      if (original[0].productId) {
        const prod = await db.select().from(products).where(eq(products.id, original[0].productId)).limit(1);
        if (prod[0]) productName = prod[0].name;
      }
      const quotationName = generateQuotationName(clientName, original[0].coasterVolume, productName);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        quotationName,
        clientId: original[0].clientId,
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
        isBonificada: original[0].isBonificada,
        productId: original[0].productId,
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
      batchIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const quotation = await db.select().from(quotations).where(eq(quotations.id, input.id)).limit(1);
      if (!quotation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });

      const existingOS = await db.select().from(serviceOrders).where(eq(serviceOrders.quotationId, input.id)).limit(1);
      if (existingOS[0]) {
        if (["rascunho", "enviada", "ativa"].includes(quotation[0].status)) {
          await db.update(quotations).set({ status: "os_gerada", updatedAt: new Date() }).where(eq(quotations.id, input.id));
        }
        return { quotationId: input.id, serviceOrderId: existingOS[0].id, orderNumber: existingOS[0].orderNumber, alreadyExisted: true };
      }

      if (quotation[0].status !== "ativa") throw new TRPCError({ code: "BAD_REQUEST", message: "Cotação precisa estar ativa para gerar OS" });

      const orderNumber = await generateOSNumber(db);

      const [os] = await db.insert(serviceOrders).values({
        orderNumber,
        type: "anunciante" as const,
        quotationId: quotation[0].id,
        clientId: quotation[0].clientId!,
        description: input.description || `OS referente à cotação ${quotation[0].quotationNumber}`,
        coasterVolume: quotation[0].coasterVolume,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalValue: quotation[0].totalValue,
        paymentTerms: input.paymentTerms,
        status: "rascunho" as const,
        batchSelectionJson: input.batchIds ? JSON.stringify(input.batchIds) : undefined,
        productId: quotation[0].productId,
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

  generateSigningLink: comercialProcedure
    .input(z.object({
      quotationId: z.number(),
      batchIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const quotation = await db.select().from(quotations).where(eq(quotations.id, input.quotationId)).limit(1);
      if (!quotation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cotação não encontrada" });
      if (quotation[0].status !== "os_gerada") throw new TRPCError({ code: "BAD_REQUEST", message: "Cotação precisa estar com OS gerada" });

      const allocatedRestaurants = await db.select().from(quotationRestaurants).where(eq(quotationRestaurants.quotationId, input.quotationId));
      if (allocatedRestaurants.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "É necessário alocar restaurantes antes de enviar para assinatura" });

      const batchRecords = await db.select().from(campaignBatches).where(inArray(campaignBatches.id, input.batchIds)).orderBy(asc(campaignBatches.startDate));
      if (batchRecords.length !== input.batchIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Um ou mais batches não encontrados" });

      const token = crypto.randomBytes(32).toString("hex");
      await db.update(quotations).set({ publicToken: token, updatedAt: new Date() }).where(eq(quotations.id, input.quotationId));

      const os = await db.select().from(serviceOrders).where(eq(serviceOrders.quotationId, input.quotationId)).limit(1);
      if (os[0]) {
        await db.update(serviceOrders).set({
          batchSelectionJson: JSON.stringify(input.batchIds),
          periodStart: batchRecords[0].startDate,
          periodEnd: batchRecords[batchRecords.length - 1].endDate,
          status: "enviada",
          updatedAt: new Date(),
        }).where(eq(serviceOrders.id, os[0].id));
      }

      const baseUrl = process.env.NODE_ENV === "production"
        ? "https://app.mesaads.com.br"
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : "";
      const signingUrl = `${baseUrl}/cotacao/assinar/${token}`;

      return { token, signingUrl, quotationId: input.quotationId };
    }),

  signOS: comercialProcedure
    .input(z.object({
      quotationId: z.number(),
      signatureUrl: z.string().min(1),
      batchIds: z.array(z.number()).min(1),
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

      const batchRecords = await db
        .select()
        .from(campaignBatches)
        .where(inArray(campaignBatches.id, input.batchIds))
        .orderBy(asc(campaignBatches.startDate));

      if (batchRecords.length !== input.batchIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Um ou mais batches não encontrados" });
      }

      const firstBatch = batchRecords[0];
      const lastBatch = batchRecords[batchRecords.length - 1];
      const derivedStartDate = firstBatch.startDate;
      const derivedEndDate = lastBatch.endDate;

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
      const isBonificada = !!quotation[0].isBonificada;

      const [campaign] = await db.insert(campaigns).values({
        campaignNumber,
        clientId: quotation[0].clientId!,
        name: campaignName,
        startDate: derivedStartDate,
        endDate: derivedEndDate,
        status: "producao",
        quotationId: quotation[0].id,
        coastersPerRestaurant: 500,
        usagePerDay: 3,
        daysPerMonth: 26,
        activeRestaurants: allocatedRestaurants.length,
        pricingType: "variable",
        markupPercent: isBonificada ? "0.00" : "30.00",
        fixedPrice: "0.00",
        commissionType: "variable",
        restaurantCommission: isBonificada ? "0.00" : avgCommission,
        fixedCommission: isBonificada ? "0.00" : "0.0500",
        sellerCommission: isBonificada ? "0.00" : "10.00",
        taxRate: isBonificada ? "0.00" : "15.00",
        contractDuration: input.batchIds.length,
        batchSize: quotation[0].coasterVolume,
        batchCost: "1200.00",
        notes: quotation[0].notes,
        isBonificada,
        productId: quotation[0].productId,
      }).returning();

      await db.insert(campaignBatchAssignments).values(
        input.batchIds.map(batchId => ({
          campaignId: campaign.id,
          batchId,
        }))
      );

      await db.insert(campaignHistory).values({
        campaignId: campaign.id,
        action: "created_from_quotation",
        details: `Campanha criada a partir da cotação ${quotation[0].quotationNumber} (OS assinada) — ${batchRecords.length} batch(es)`,
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

  listItems: protectedProcedure
    .input(z.object({ quotationId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const items = await db
        .select({
          id: quotationItems.id,
          quotationId: quotationItems.quotationId,
          productId: quotationItems.productId,
          quantity: quotationItems.quantity,
          quantityPerLocation: quotationItems.quantityPerLocation,
          unitCost: quotationItems.unitCost,
          unitPrice: quotationItems.unitPrice,
          totalPrice: quotationItems.totalPrice,
          notes: quotationItems.notes,
          createdAt: quotationItems.createdAt,
          productName: products.name,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
          productTemDistribuicaoPorLocal: products.temDistribuicaoPorLocal,
        })
        .from(quotationItems)
        .innerJoin(products, eq(quotationItems.productId, products.id))
        .where(eq(quotationItems.quotationId, input.quotationId))
        .orderBy(asc(quotationItems.createdAt));
      return items;
    }),

  addItem: comercialProcedure
    .input(z.object({
      quotationId: z.number(),
      productId: z.number(),
      quantity: z.number().min(1),
      quantityPerLocation: z.number().optional(),
      unitPrice: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (!product.length) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });

      const tiers = await db
        .select()
        .from(productPricingTiers)
        .where(eq(productPricingTiers.productId, input.productId))
        .orderBy(asc(productPricingTiers.volumeMin));

      let unitCost: string | null = null;
      if (tiers.length > 0) {
        const tier = tiers.find(t => input.quantity >= t.volumeMin && (t.volumeMax == null || input.quantity <= t.volumeMax))
          ?? tiers[tiers.length - 1];
        unitCost = tier.custoUnitario;
      }

      const unitPrice = input.unitPrice ?? unitCost;
      const totalPrice = unitPrice ? String(parseFloat(unitPrice) * input.quantity) : null;

      const [item] = await db.insert(quotationItems).values({
        quotationId: input.quotationId,
        productId: input.productId,
        quantity: input.quantity,
        quantityPerLocation: input.quantityPerLocation,
        unitCost: unitCost,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        notes: input.notes,
      }).returning();

      await db.update(quotations)
        .set({ updatedAt: new Date() })
        .where(eq(quotations.id, input.quotationId));

      return item;
    }),

  updateItem: comercialProcedure
    .input(z.object({
      id: z.number(),
      quantity: z.number().min(1).optional(),
      quantityPerLocation: z.number().optional().nullable(),
      unitPrice: z.string().optional(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...updates } = input;

      const existing = await db.select().from(quotationItems).where(eq(quotationItems.id, id)).limit(1);
      if (!existing.length) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      const item = existing[0];

      const quantity = updates.quantity ?? item.quantity;
      const unitPrice = updates.unitPrice ?? item.unitPrice ?? undefined;
      const totalPrice = unitPrice ? String(parseFloat(unitPrice) * quantity) : item.totalPrice;

      const [updated] = await db.update(quotationItems)
        .set({
          quantity,
          quantityPerLocation: updates.quantityPerLocation !== undefined ? updates.quantityPerLocation : item.quantityPerLocation,
          unitPrice: unitPrice ?? item.unitPrice,
          totalPrice,
          notes: updates.notes !== undefined ? updates.notes : item.notes,
        })
        .where(eq(quotationItems.id, id))
        .returning();

      await db.update(quotations)
        .set({ updatedAt: new Date() })
        .where(eq(quotations.id, item.quotationId));

      return updated;
    }),

  removeItem: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const existing = await db.select().from(quotationItems).where(eq(quotationItems.id, input.id)).limit(1);
      if (!existing.length) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      await db.delete(quotationItems).where(eq(quotationItems.id, input.id));
      await db.update(quotations)
        .set({ updatedAt: new Date() })
        .where(eq(quotations.id, existing[0].quotationId));
      return { success: true };
    }),

});
