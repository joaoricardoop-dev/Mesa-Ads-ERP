import express from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { quotations, clients, serviceOrders, quotationRestaurants, activeRestaurants, campaigns, campaignHistory, campaignRestaurants, campaignBatches, campaignBatchAssignments } from "../drizzle/schema";
import { eq, inArray, asc, sql } from "drizzle-orm";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
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

export function setupPublicSigningRoutes(app: express.Express) {
  const router = express.Router();

  router.get("/quotation/:token", async (req, res) => {
    try {
      const db = await getDatabase();
      const { token } = req.params;

      const quotation = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          quotationName: quotations.quotationName,
          coasterVolume: quotations.coasterVolume,
          totalValue: quotations.totalValue,
          unitPrice: quotations.unitPrice,
          isBonificada: quotations.isBonificada,
          status: quotations.status,
          signedAt: quotations.signedAt,
          clientName: clients.name,
          clientCompany: clients.company,
          clientCnpj: clients.cnpj,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .where(eq(quotations.publicToken, token))
        .limit(1);

      if (!quotation[0]) {
        return res.status(404).json({ error: "Link de assinatura inválido ou expirado" });
      }

      if (quotation[0].signedAt) {
        return res.status(400).json({ error: "Esta ordem de serviço já foi assinada", alreadySigned: true });
      }

      const os = await db
        .select()
        .from(serviceOrders)
        .where(eq(serviceOrders.quotationId, quotation[0].id))
        .limit(1);

      if (!os[0]) {
        return res.status(404).json({ error: "Ordem de serviço não encontrada" });
      }

      const restaurants = await db
        .select({
          restaurantName: activeRestaurants.name,
          coasterQuantity: quotationRestaurants.coasterQuantity,
        })
        .from(quotationRestaurants)
        .leftJoin(activeRestaurants, eq(quotationRestaurants.restaurantId, activeRestaurants.id))
        .where(eq(quotationRestaurants.quotationId, quotation[0].id));

      let batchInfo: any[] = [];
      if (os[0].batchSelectionJson) {
        const batchIds = JSON.parse(os[0].batchSelectionJson) as number[];
        if (batchIds.length > 0) {
          batchInfo = await db
            .select({
              id: campaignBatches.id,
              label: campaignBatches.label,
              startDate: campaignBatches.startDate,
              endDate: campaignBatches.endDate,
            })
            .from(campaignBatches)
            .where(inArray(campaignBatches.id, batchIds))
            .orderBy(asc(campaignBatches.startDate));
        }
      }

      res.json({
        quotation: quotation[0],
        serviceOrder: {
          orderNumber: os[0].orderNumber,
          description: os[0].description,
          periodStart: os[0].periodStart,
          periodEnd: os[0].periodEnd,
          totalValue: os[0].totalValue,
          paymentTerms: os[0].paymentTerms,
          coasterVolume: os[0].coasterVolume,
        },
        restaurants,
        batches: batchInfo,
      });
    } catch (err: any) {
      console.error("Error fetching public quotation:", err);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.post("/quotation/:token/sign", async (req, res) => {
    try {
      const db = await getDatabase();
      const { token } = req.params;
      const { signerName, signerCpf } = req.body;

      if (!signerName || !signerCpf) {
        return res.status(400).json({ error: "Nome e CPF são obrigatórios" });
      }

      const cpfClean = signerCpf.replace(/\D/g, "");
      if (cpfClean.length !== 11) {
        return res.status(400).json({ error: "CPF inválido" });
      }

      const quotation = await db.select().from(quotations).where(eq(quotations.publicToken, token)).limit(1);
      if (!quotation[0]) {
        return res.status(404).json({ error: "Link de assinatura inválido ou expirado" });
      }
      if (quotation[0].signedAt) {
        return res.status(400).json({ error: "Esta ordem de serviço já foi assinada", alreadySigned: true });
      }
      if (quotation[0].status !== "os_gerada") {
        return res.status(400).json({ error: "Cotação em status inválido para assinatura" });
      }

      const os = await db.select().from(serviceOrders).where(eq(serviceOrders.quotationId, quotation[0].id)).limit(1);
      if (!os[0]) {
        return res.status(404).json({ error: "Ordem de serviço não encontrada" });
      }

      const allocatedRestaurants = await db.select().from(quotationRestaurants).where(eq(quotationRestaurants.quotationId, quotation[0].id));
      if (allocatedRestaurants.length === 0) {
        return res.status(400).json({ error: "Nenhum restaurante alocado" });
      }

      if (!os[0].batchSelectionJson) {
        return res.status(400).json({ error: "Nenhum período selecionado para esta OS" });
      }
      const batchIds = JSON.parse(os[0].batchSelectionJson) as number[];
      const batchRecords = await db
        .select()
        .from(campaignBatches)
        .where(inArray(campaignBatches.id, batchIds))
        .orderBy(asc(campaignBatches.startDate));

      if (batchRecords.length === 0 || batchRecords.length !== batchIds.length) {
        return res.status(400).json({ error: "Um ou mais batches não encontrados" });
      }

      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";
      const signedAt = new Date();

      const contentForHash = JSON.stringify({
        quotationId: quotation[0].id,
        orderNumber: os[0].orderNumber,
        description: os[0].description,
        totalValue: os[0].totalValue,
        coasterVolume: os[0].coasterVolume,
        signerName,
        signerCpf: cpfClean,
        signedAt: signedAt.toISOString(),
      });
      const signatureHash = crypto.createHash("sha256").update(contentForHash).digest("hex");

      const signatureData = JSON.stringify({
        name: signerName,
        cpf: cpfClean,
        ip: typeof ip === "string" ? ip : ip[0],
        userAgent,
        hash: signatureHash,
      });

      const firstBatch = batchRecords[0];
      const lastBatch = batchRecords[batchRecords.length - 1];

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
      const maskedCpf = `***.***.${cpfClean.substring(6, 9)}-${cpfClean.substring(9)}`;
      const isBonificada = !!quotation[0].isBonificada;

      let campaignId: number = 0;

      await db.transaction(async (tx) => {
        await tx.update(quotations).set({
          signedAt,
          signedBy: signerName,
          signatureData,
          status: "win",
          updatedAt: new Date(),
        }).where(eq(quotations.id, quotation[0].id));

        await tx.update(serviceOrders).set({
          status: "assinada",
          signedByName: signerName,
          signedByCpf: signerCpf,
          signedAt,
          signatureHash,
          signatureUrl: `digital:${signatureHash.substring(0, 16)}`,
          updatedAt: new Date(),
        }).where(eq(serviceOrders.id, os[0].id));

        const [campaign] = await tx.insert(campaigns).values({
          campaignNumber,
          clientId: quotation[0].clientId,
          name: campaignName,
          startDate: firstBatch.startDate,
          endDate: lastBatch.endDate,
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
          contractDuration: batchIds.length,
          batchSize: quotation[0].coasterVolume,
          batchCost: "1200.00",
          notes: quotation[0].notes,
          isBonificada,
          productId: quotation[0].productId,
        }).returning();

        campaignId = campaign.id;

        await tx.insert(campaignBatchAssignments).values(
          batchIds.map(batchId => ({ campaignId: campaign.id, batchId }))
        );

        await tx.insert(campaignHistory).values({
          campaignId: campaign.id,
          action: "created_from_quotation",
          details: `Campanha criada via assinatura digital por ${signerName} (CPF: ${maskedCpf}) — ${batchRecords.length} batch(es)`,
        });

        if (allocatedRestaurants.length > 0) {
          await tx.insert(campaignRestaurants).values(
            allocatedRestaurants.map(r => ({
              campaignId: campaign.id,
              restaurantId: r.restaurantId,
              coastersCount: r.coasterQuantity,
            }))
          );
        }

        await tx.update(serviceOrders).set({
          campaignId: campaign.id,
          updatedAt: new Date(),
        }).where(eq(serviceOrders.id, os[0].id));
      });

      res.json({
        success: true,
        campaignId,
        campaignNumber,
        signatureHash,
        signedAt: signedAt.toISOString(),
        signerName,
        signerCpf,
        orderNumber: os[0].orderNumber,
        quotationNumber: quotation[0].quotationNumber,
        quotationName: quotation[0].quotationName,
        totalValue: os[0].totalValue,
        coasterVolume: os[0].coasterVolume,
        periodStart: firstBatch.startDate,
        periodEnd: lastBatch.endDate,
        description: os[0].description,
      });
    } catch (err: any) {
      console.error("Error signing quotation:", err);
      res.status(500).json({ error: "Erro ao processar assinatura" });
    }
  });

  app.use("/api/public-signing", router);
}
