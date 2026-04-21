import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { quotations, campaigns, clients, campaignHistory, serviceOrders, quotationRestaurants, activeRestaurants, campaignRestaurants, leads, campaignBatches, campaignBatchAssignments, products, partners, quotationItems, productPricingTiers, productDiscountPriceTiers, invoices, seasonalMultipliers, campaignPhases, campaignItems } from "../drizzle/schema";
import { eq, desc, sql, and, inArray, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { createCrmNotification } from "./notificationRouter";
import { buildCampaignName } from "./utils/campaignName";
import { scheduleInvoicesForCampaign } from "./utils/scheduleInvoices";

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
  const prefix = `QOT-${year}-`;
  const result = await db
    .select({ maxNum: sql<string>`MAX("quotationNumber")` })
    .from(quotations)
    .where(sql`"quotationNumber" LIKE ${prefix + '%'}`);
  const maxStr = result[0]?.maxNum;
  let seqNum = 1;
  if (maxStr) {
    const lastSeq = parseInt(maxStr.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
  }
  return `${prefix}${String(seqNum).padStart(4, "0")}`;
}

async function generateCampaignNumber(db: any) {
  const year = new Date().getFullYear();
  const prefix = `CMP-${year}-`;
  const result = await db
    .select({ maxNum: sql<string>`MAX("campaignNumber")` })
    .from(campaigns)
    .where(sql`"campaignNumber" LIKE ${prefix + '%'}`);
  const maxStr = result[0]?.maxNum;
  let seqNum = 1;
  if (maxStr) {
    const lastSeq = parseInt(maxStr.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
  }
  return `${prefix}${String(seqNum).padStart(4, "0")}`;
}

async function generateInvoiceNumber(db: any) {
  const year = new Date().getFullYear();
  const prefix = `FAT-${year}-`;
  const result = await db
    .select({ maxNum: sql<string>`MAX("invoiceNumber")` })
    .from(invoices)
    .where(sql`"invoiceNumber" LIKE ${prefix + '%'}`);
  const maxStr = result[0]?.maxNum;
  let seqNum = 1;
  if (maxStr) {
    const lastSeq = parseInt(maxStr.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
  }
  return `${prefix}${String(seqNum).padStart(4, "0")}`;
}

async function autoCreateInvoice(db: any, campaign: { id: number; clientId: number }, quotation: { totalValue: string | null; isBonificada: boolean | null }) {
  if (quotation.isBonificada) return;
  const amount = quotation.totalValue;
  if (!amount || parseFloat(amount) <= 0) return;

  const invoiceNumber = await generateInvoiceNumber(db);
  const today = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Finrefac fase 3: emissão + materialização de impostos atômicos.
  // Erros propagam ao caller — invoice + payables ou nada (rollback).
  const { materializePayablesForInvoice } = await import("./finance/payables");
  type DbClient = import("./finance/payables").DbClient;
  await db.transaction(async (tx: DbClient) => {
    const [created] = await tx.insert(invoices).values({
      campaignId: campaign.id,
      clientId: campaign.clientId,
      invoiceNumber,
      amount,
      issueDate: today,
      dueDate,
      status: "emitida",
    }).returning();
    if (created) {
      await materializePayablesForInvoice(tx, created.id, "emitida");
    }
  });
}

async function generateOSNumber(db: any) {
  const year = new Date().getFullYear();
  const pattern = `OS-ANT-${year}-%`;
  const maxResult = await db
    .select({ maxSeq: sql<string>`MAX(CAST(SPLIT_PART("orderNumber", '-', 4) AS INTEGER))` })
    .from(serviceOrders)
    .where(sql`${serviceOrders.orderNumber} LIKE ${pattern}`);
  const seqNum = Number(maxResult[0]?.maxSeq || 0) + 1;
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
          isCustomProduct: quotations.isCustomProduct,
          customProductName: quotations.customProductName,
          customProjectCost: quotations.customProjectCost,
          customPricingMode: quotations.customPricingMode,
          customMarginPercent: quotations.customMarginPercent,
          customFinalPrice: quotations.customFinalPrice,
          customRestaurantCommission: quotations.customRestaurantCommission,
          customPartnerCommission: quotations.customPartnerCommission,
          customSellerCommission: quotations.customSellerCommission,
          agencyCommissionPercent: quotations.agencyCommissionPercent,
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
          productIrpj: products.irpj,
          partnerId: quotations.partnerId,
          partnerName: partners.name,
          periodStart: quotations.periodStart,
          batchWeeks: quotations.batchWeeks,
          itemCount: sql<number>`(SELECT COUNT(*) FROM quotation_items WHERE "quotationId" = ${quotations.id})`,
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
          isCustomProduct: quotations.isCustomProduct,
          customProductName: quotations.customProductName,
          customProjectCost: quotations.customProjectCost,
          customPricingMode: quotations.customPricingMode,
          customMarginPercent: quotations.customMarginPercent,
          customFinalPrice: quotations.customFinalPrice,
          customRestaurantCommission: quotations.customRestaurantCommission,
          customPartnerCommission: quotations.customPartnerCommission,
          customSellerCommission: quotations.customSellerCommission,
          agencyCommissionPercent: quotations.agencyCommissionPercent,
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
          productIrpj: products.irpj,
          partnerId: quotations.partnerId,
          partnerName: partners.name,
          periodStart: quotations.periodStart,
          batchWeeks: quotations.batchWeeks,
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
      coasterVolume: z.number().int().min(0),
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
      productId: z.number().optional().nullable(),
      partnerId: z.number().nullable().optional(),
      isCustomProduct: z.boolean().optional(),
      customProductName: z.string().optional(),
      customProjectCost: z.string().optional(),
      customPricingMode: z.string().optional(),
      customMarginPercent: z.string().optional(),
      customFinalPrice: z.string().optional(),
      customRestaurantCommission: z.string().optional(),
      customPartnerCommission: z.string().optional(),
      customSellerCommission: z.string().optional(),
      agencyCommissionPercent: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      if (!input.clientId && !input.leadId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um cliente ou lead para a cotação" });
      }

      if (input.isCustomProduct) {
        if (!input.customProductName?.trim()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nome do produto personalizado é obrigatório" });
        }
        const cost = parseFloat(input.customProjectCost || "0");
        if (!cost || cost <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Custo do projeto deve ser maior que zero" });
        }
        const restComm = parseFloat(input.customRestaurantCommission || "0");
        const partnerComm = parseFloat(input.customPartnerCommission || "0");
        const sellerComm = parseFloat(input.customSellerCommission || "0");
        if (restComm < 0 || partnerComm < 0 || sellerComm < 0 || restComm > 100 || partnerComm > 100 || sellerComm > 100) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Comissões devem estar entre 0% e 100%" });
        }
        if (input.customPricingMode === "margin") {
          const margin = parseFloat(input.customMarginPercent || "0");
          if (margin < 0 || margin > 100) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Margem deve estar entre 0% e 100%" });
          }
          const totalDeduct = restComm + partnerComm + sellerComm + margin;
          if (totalDeduct >= 100) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Soma das comissões e margem deve ser menor que 100%" });
          }
        } else if (input.customPricingMode === "fixed_price") {
          const fp = parseFloat(input.customFinalPrice || "0");
          if (!fp || fp <= 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Preço final deve ser maior que zero" });
          }
        }
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
      if (input.isCustomProduct && input.customProductName) {
        productName = input.customProductName;
      } else if (input.productId) {
        const prod = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
        if (prod[0]) productName = prod[0].name;
      }

      const quotationNumber = await generateQuotationNumber(db);
      const quotationName = generateQuotationName(entityName, input.coasterVolume ?? 0, productName);

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        quotationName,
        clientId: input.clientId ?? null,
        leadId: input.leadId ?? null,
        coasterVolume: input.coasterVolume ?? 0,
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
        productId: input.productId ?? null,
        partnerId: input.partnerId ?? null,
        isCustomProduct: input.isCustomProduct ?? false,
        customProductName: input.customProductName,
        customProjectCost: input.customProjectCost,
        customPricingMode: input.customPricingMode,
        customMarginPercent: input.customMarginPercent,
        customFinalPrice: input.customFinalPrice,
        customRestaurantCommission: input.customRestaurantCommission,
        customPartnerCommission: input.customPartnerCommission,
        customSellerCommission: input.customSellerCommission,
        agencyCommissionPercent: input.agencyCommissionPercent ?? null,
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
      coasterVolume: z.number().int().min(0).optional(),
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
      isCustomProduct: z.boolean().optional(),
      customProductName: z.string().optional().nullable(),
      customProjectCost: z.string().optional().nullable(),
      customPricingMode: z.string().optional().nullable(),
      customMarginPercent: z.string().optional().nullable(),
      customFinalPrice: z.string().optional().nullable(),
      customRestaurantCommission: z.string().optional().nullable(),
      customPartnerCommission: z.string().optional().nullable(),
      customSellerCommission: z.string().optional().nullable(),
      agencyCommissionPercent: z.string().optional().nullable(),
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
      const isCustomProduct = data.isCustomProduct !== undefined ? data.isCustomProduct : existing[0].isCustomProduct;
      const customProductName = data.customProductName !== undefined ? data.customProductName : existing[0].customProductName;

      if (data.clientId !== undefined || data.coasterVolume !== undefined || data.productId !== undefined || data.isCustomProduct !== undefined || data.customProductName !== undefined) {
        const client = clientId ? await db.select().from(clients).where(eq(clients.id, clientId)).limit(1) : [];
        const clientName = (client as any)[0]?.name || (client as any)[0]?.company || "Cliente";
        let productName: string | undefined;
        if (isCustomProduct && customProductName) {
          productName = customProductName;
        } else if (productId) {
          const prod = await db.select().from(products).where(eq(products.id, productId)).limit(1);
          if (prod[0]) productName = prod[0].name;
        }
        (data as any).quotationName = generateQuotationName(clientName, coasterVolume ?? 0, productName);
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
      const [cliRow] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, quotation[0].clientId!)).limit(1);
      const campaignName = buildCampaignName(cliRow?.name, input.startDate);

      const [campaign] = await db.insert(campaigns).values({
        campaignNumber,
        clientId: quotation[0].clientId!,
        name: campaignName,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "active",
        quotationId: quotation[0].id,
        coastersPerRestaurant: quotation[0].coasterVolume,
        usagePerDay: 3,
        daysPerMonth: 26,
        activeRestaurants: 1,
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

      // Marketplace v2: auto-criação de fases em ciclos de 4 semanas a partir
      // dos quotation_items que carregam restaurantId/shareIndex/cycleWeeks.
      try {
        const items = await db
          .select()
          .from(quotationItems)
          .where(eq(quotationItems.quotationId, quotation[0].id));
        const sharedItems = items.filter((it) => it.restaurantId != null);
        if (sharedItems.length > 0) {
          const baseStart = new Date(input.startDate + "T00:00:00Z");
          const phasesByCycle = new Map<number, { start: string; end: string; items: typeof sharedItems }>();
          for (const it of sharedItems) {
            const cycles = it.cycles ?? 1;
            const cycleWeeks = it.cycleWeeks ?? 4;
            for (let c = 0; c < cycles; c++) {
              const start = new Date(baseStart);
              start.setUTCDate(start.getUTCDate() + c * cycleWeeks * 7);
              const end = new Date(start);
              end.setUTCDate(end.getUTCDate() + cycleWeeks * 7 - 1);
              const key = c;
              const slot = phasesByCycle.get(key) ?? {
                start: start.toISOString().slice(0, 10),
                end: end.toISOString().slice(0, 10),
                items: [] as typeof sharedItems,
              };
              slot.items.push(it);
              phasesByCycle.set(key, slot);
            }
          }
          let seq = 1;
          const sortedEntries = Array.from(phasesByCycle.entries()).sort(
            ([a], [b]) => a - b,
          );
          for (const [, slot] of sortedEntries) {
            const [phase] = await db
              .insert(campaignPhases)
              .values({
                campaignId: campaign.id,
                sequence: seq++,
                label: `Ciclo ${seq - 1}`,
                periodStart: slot.start,
                periodEnd: slot.end,
                // Marketplace v2 — fases criadas em estado "planejada" aguardando
                // aprovação do briefing/peças antes de irem para produção.
                status: "planejada",
              })
              .returning();
            for (const it of slot.items) {
              const unitPrice = it.unitPrice ?? "0";
              const total = (parseFloat(unitPrice) * it.quantity).toFixed(2);
              await db.insert(campaignItems).values({
                campaignPhaseId: phase.id,
                productId: it.productId,
                quantity: it.quantity,
                unitPrice,
                totalPrice: total,
                restaurantId: it.restaurantId,
                shareIndex: it.shareIndex,
              });
            }
          }
        }
      } catch (err) {
        console.warn("[markWin] auto phase creation skipped:", (err as Error)?.message);
      }

      await autoCreateInvoice(db, { id: campaign.id, clientId: campaign.clientId }, { totalValue: quotation[0].totalValue, isBonificada: quotation[0].isBonificada });

      // Garante cronograma de faturas previstas para todas as fases criadas
      // a partir dos quotation_items (idempotente — pula fases já com fatura).
      // Falha propaga: cotação não pode ser marcada como ganha sem cronograma.
      await scheduleInvoicesForCampaign(db, { id: campaign.id, clientId: campaign.clientId });

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
      const [cliRow2] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, quotation[0].clientId!)).limit(1);
      const campaignName = buildCampaignName(cliRow2?.name, derivedStartDate);
      const isBonificada = !!quotation[0].isBonificada;

      const [campaign] = await db.insert(campaigns).values({
        campaignNumber,
        clientId: quotation[0].clientId!,
        name: campaignName,
        startDate: derivedStartDate,
        endDate: derivedEndDate,
        status: "producao",
        quotationId: quotation[0].id,
        coastersPerRestaurant: allocatedRestaurants.length > 0 ? Math.round(totalCoasters / allocatedRestaurants.length) : quotation[0].coasterVolume,
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

      await autoCreateInvoice(db, { id: campaign.id, clientId: campaign.clientId }, { totalValue: quotation[0].totalValue, isBonificada: quotation[0].isBonificada });

      // Garante cronograma de faturas previstas para todas as fases da campanha
      // gerada via OS assinada (idempotente — pula fases já com fatura).
      // Falha propaga: assinatura de OS não pode concluir sem cronograma.
      await scheduleInvoicesForCampaign(db, { id: campaign.id, clientId: campaign.clientId });

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
      bonificada: z.boolean().optional(),
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
      // When bonificada: keep the real unit price for reference, but zero out the contract total
      const totalPrice = input.bonificada ? "0.00" : (unitPrice ? String(parseFloat(unitPrice) * input.quantity) : null);

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

  createFromBuilder: protectedProcedure
    .input(z.object({
      clientId: z.number().nullable(),
      source: z.enum(["self_service_anunciante", "self_service_parceiro", "internal"]),
      campaignName: z.string().min(1),
      startDate: z.string().optional(),
      briefing: z.string().optional(),
      venueIds: z.array(z.number().int()).optional(),
      estimatedTotal: z.number().optional(),
      estimatedImpressions: z.number().optional(),
      items: z.array(z.object({
        productId: z.number(),
        productName: z.string(),
        volume: z.number().int().min(1),
        weeks: z.number().int().min(1),
        // Marketplace v2 — opcionais para back-compat com fluxo antigo (single product).
        restaurantId: z.number().int().optional(),
        shareIndex: z.number().int().min(1).optional(),
        cycleWeeks: z.number().int().min(1).optional(),
        cycles: z.number().int().min(1).optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      const userRole = ctx.user.role || "user";
      const INTERNAL_ROLES = ["admin", "comercial", "manager", "operacoes", "financeiro"];
      const isInternal = INTERNAL_ROLES.includes(userRole);

      let client: { name: string; company: string | null; partnerId: number | null } | null = null;
      if (input.clientId != null) {
        const [row] = await db.select({
          name: clients.name,
          company: clients.company,
          partnerId: clients.partnerId,
        })
          .from(clients)
          .where(eq(clients.id, input.clientId))
          .limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        client = row;
      } else if (userRole === "anunciante") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente é obrigatório." });
      }

      const isPartnerFlow = userRole === "parceiro";

      if (userRole === "anunciante") {
        if (ctx.user.clientId !== input.clientId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para criar cotações para este cliente." });
        }
        if (input.source !== "self_service_anunciante") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Source inválida para anunciante." });
        }
      } else if (userRole === "parceiro") {
        const userPartnerId = ctx.user.partnerId;
        if (!userPartnerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a um parceiro." });
        }
        if (client && client.partnerId !== userPartnerId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Este cliente não está vinculado ao seu parceiro." });
        }
        if (input.source !== "self_service_parceiro") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Source inválida para parceiro." });
        }
      } else if (isInternal) {
        if (input.source !== "internal") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Source inválida para usuário interno." });
        }
      } else {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você não tem permissão para usar o campaign builder." });
      }

      const productIds = input.items.map(i => i.productId);
      const productRows = await db.select({
        id: products.id,
        name: products.name,
        irpj: products.irpj,
        comRestaurante: products.comRestaurante,
        comComercial: products.comComercial,
        pricingMode: products.pricingMode,
        isActive: products.isActive,
        visibleToPartners: products.visibleToPartners,
        visibleToAdvertisers: products.visibleToAdvertisers,
      })
        .from(products)
        .where(and(inArray(products.id, productIds), eq(products.isActive, true)));

      const productMap = new Map(productRows.map(p => [p.id, p]));

      for (const item of input.items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Produto ${item.productId} não encontrado ou inativo.` });
        }
        const visibleFlag = isPartnerFlow ? prod.visibleToPartners : prod.visibleToAdvertisers;
        if (!visibleFlag && !isInternal) {
          throw new TRPCError({ code: "FORBIDDEN", message: `Produto "${prod.name}" não está disponível para este perfil.` });
        }
      }

      const pricingTiersRows = await db.select()
        .from(productPricingTiers)
        .where(inArray(productPricingTiers.productId, productIds));

      const discountTiersRows = await db.select()
        .from(productDiscountPriceTiers)
        .where(inArray(productDiscountPriceTiers.productId, productIds));

      const seasonalRows = await db.select()
        .from(seasonalMultipliers)
        .where(inArray(seasonalMultipliers.productId, productIds));

      const venueIdSet = new Set<number>(input.venueIds ?? []);

      function pickSeasonalMultiplier(productId: number, periodStart: string | null, periodEnd: string | null): { mult: number; label: string | null } {
        if (!periodStart || !periodEnd) return { mult: 1, label: null };
        const ps = new Date(periodStart);
        const pe = new Date(periodEnd);
        if (isNaN(ps.getTime()) || isNaN(pe.getTime())) return { mult: 1, label: null };
        const matches = seasonalRows.filter((s) => {
          if (s.productId !== productId) return false;
          if (s.restaurantId != null && !venueIdSet.has(s.restaurantId)) return false;
          const ss = new Date(s.startDate);
          const se = new Date(s.endDate);
          return ss <= pe && ps <= se;
        });
        if (!matches.length) return { mult: 1, label: null };
        // Precedência: específicos por restaurante vencem globais.
        const specific = matches.filter((m) => m.restaurantId != null);
        const pool = specific.length > 0 ? specific : matches;
        let bestMult = 0;
        let bestLabel: string | null = null;
        for (const m of pool) {
          const v = parseFloat(m.multiplier);
          if (isFinite(v) && v > bestMult) { bestMult = v; bestLabel = m.seasonLabel; }
        }
        return { mult: bestMult > 0 ? bestMult : 1, label: bestLabel };
      }

      const BV_AGENCIA = 0.20;
      const DESCONTOS_PRAZO: Record<number, number> = { 4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11 };
      const hasPartner = !!client?.partnerId || isPartnerFlow;

      function computeUnitPrice(prod: { irpj: string | null; comRestaurante: string | null; comComercial: string | null; pricingMode: string | null }, tier: typeof pricingTiersRows[0], volume: number): number {
        const irpj = parseFloat(prod.irpj ?? "6") / 100;
        const comRestaurante = parseFloat(prod.comRestaurante ?? "15") / 100;
        const comComercial = parseFloat(prod.comComercial ?? "10") / 100;
        const comParceiro = BV_AGENCIA; // sempre embutido no preço público
        const custoUnitario = parseFloat(tier.custoUnitario);
        const frete = parseFloat(tier.frete);
        const margem = parseFloat(tier.margem) / 100;
        const artes = tier.artes ?? 1;
        const precoBase = parseFloat(tier.precoBase ?? "0");

        if (prod.pricingMode === "price_based") {
          if (precoBase <= 0) return 0;
          const den = 1 - comParceiro - irpj;
          const total = comParceiro > 0 && den > 0 ? precoBase / den : precoBase;
          return volume > 0 ? total / volume : 0;
        }
        const denominadorBase = 1 - margem - irpj - comRestaurante - comComercial;
        const custoTotal = custoUnitario * artes * volume + frete;
        const precoCalc = denominadorBase > 0 && custoTotal > 0 ? custoTotal / denominadorBase : 0;
        const den = 1 - comParceiro - irpj;
        const precoTotal = comParceiro > 0 && den > 0 ? precoCalc / den : precoCalc;
        return volume > 0 ? precoTotal / volume : 0;
      }

      function applyDiscountTier(price: number, dTiers: typeof discountTiersRows): number {
        if (!dTiers || dTiers.length === 0) return price;
        const t = dTiers.find(d => price >= parseFloat(d.priceMin) && price <= parseFloat(d.priceMax));
        if (!t) return price;
        return price * (1 - parseFloat(t.discountPercent) / 100);
      }

      const computedItems: Array<{ productId: number; productName: string; volume: number; weeks: number; unitPrice: number; totalPrice: number; restaurantId?: number; shareIndex?: number; cycleWeeks?: number; cycles?: number }> = [];

      const appliedSeasonals: Array<{ productName: string; label: string; multiplier: number }> = [];

      for (const item of input.items) {
        const prod = productMap.get(item.productId)!;
        const tiers = pricingTiersRows
          .filter(t => t.productId === item.productId)
          .sort((a, b) => a.volumeMin - b.volumeMin);

        const tier = tiers.find(t => item.volume >= t.volumeMin && (t.volumeMax == null || item.volume <= t.volumeMax))
          || tiers[tiers.length - 1];

        if (!tier) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Sem tabela de preço configurada para o produto "${prod.name}".` });
        }

        let unitPrice = computeUnitPrice(prod, tier, item.volume);
        const dTiersForProduct = discountTiersRows.filter(d => d.productId === item.productId);
        const baseTotal = unitPrice * item.volume;
        const discountedTotal = applyDiscountTier(baseTotal, dTiersForProduct);
        const prazoDiscount = (DESCONTOS_PRAZO[item.weeks] ?? 0) / 100;
        let finalTotal = discountedTotal * (1 - prazoDiscount);

        // Aplica multiplicador sazonal quando o período do item cruza a janela
        let itemPeriodEnd: string | null = null;
        if (input.startDate) {
          const start = new Date(input.startDate);
          if (!isNaN(start.getTime())) {
            const end = new Date(start);
            end.setDate(end.getDate() + item.weeks * 7);
            itemPeriodEnd = end.toISOString().slice(0, 10);
          }
        }
        const seasonal = pickSeasonalMultiplier(item.productId, input.startDate ?? null, itemPeriodEnd);
        if (seasonal.mult !== 1 && seasonal.label) {
          finalTotal = finalTotal * seasonal.mult;
          appliedSeasonals.push({ productName: prod.name, label: seasonal.label, multiplier: seasonal.mult });
        }

        const finalUnitPrice = item.volume > 0 ? finalTotal / item.volume : 0;

        computedItems.push({
          productId: item.productId,
          productName: prod.name,
          volume: item.volume,
          weeks: item.weeks,
          unitPrice: finalUnitPrice,
          totalPrice: finalTotal,
          restaurantId: item.restaurantId,
          shareIndex: item.shareIndex,
          cycleWeeks: item.cycleWeeks,
          cycles: item.cycles,
        });
      }

      const entityName = client?.company || client?.name || "Sem cliente específico";
      const totalVolume = computedItems.reduce((sum, i) => sum + i.volume, 0);
      const totalValue = computedItems.reduce((sum, i) => sum + i.totalPrice, 0);

      const quotationNumber = await generateQuotationNumber(db);
      const quotationName = input.campaignName || generateQuotationName(entityName, totalVolume);

      const briefingParts: string[] = [];
      if (input.briefing) briefingParts.push(input.briefing);
      if (input.venueIds?.length) briefingParts.push(`Locais selecionados (IDs): ${input.venueIds.join(", ")}`);
      if (input.estimatedImpressions != null) briefingParts.push(`Impressões estimadas: ${input.estimatedImpressions.toLocaleString("pt-BR")}`);
      if (input.estimatedTotal != null) briefingParts.push(`Total estimado (cliente): R$ ${input.estimatedTotal.toFixed(2)}`);
      if (appliedSeasonals.length) {
        briefingParts.push(
          "Multiplicadores sazonais aplicados:\n" +
          appliedSeasonals.map(s => `• ${s.productName}: ${s.label} ×${s.multiplier.toFixed(2)}`).join("\n")
        );
      }
      const notesText = briefingParts.length ? briefingParts.join("\n\n") : null;

      const insertValues: any = {
        quotationNumber,
        quotationName,
        clientId: input.clientId,
        partnerId: client?.partnerId ?? null,
        coasterVolume: totalVolume,
        totalValue: totalValue.toFixed(2),
        status: "rascunho",
        notes: notesText,
        periodStart: input.startDate || null,
        source: input.source,
        isBonificada: false,
        hasPartnerDiscount: hasPartner,
        createdBy: "self_service",
      };

      const [created] = await db.insert(quotations).values(insertValues).returning();

      for (const item of computedItems) {
        const ciclosDesc = item.cycles && item.cycleWeeks
          ? ` · ${item.cycles} ciclo(s) de ${item.cycleWeeks}sem`
          : "";
        const localDesc = item.restaurantId
          ? ` · local #${item.restaurantId}${item.shareIndex ? ` share ${item.shareIndex}` : ""}`
          : "";
        await db.insert(quotationItems).values({
          quotationId: created.id,
          productId: item.productId,
          quantity: item.volume,
          quantityPerLocation: item.volume,
          unitPrice: item.unitPrice.toFixed(4),
          totalPrice: item.totalPrice.toFixed(2),
          restaurantId: item.restaurantId ?? null,
          shareIndex: item.shareIndex ?? null,
          cycleWeeks: item.cycleWeeks ?? 4,
          cycles: item.cycles ?? 1,
          notes: `${item.productName} — ${item.volume.toLocaleString("pt-BR")} un. × ${item.weeks} semanas${ciclosDesc}${localDesc}`,
        });
      }

      await createCrmNotification(db, {
        eventType: "quotation_created",
        leadId: null,
        partnerId: client?.partnerId ?? null,
        message: `Nova cotação self-service ${quotationNumber} criada por ${entityName} (${input.source})`,
      });

      return created;
    }),

});
