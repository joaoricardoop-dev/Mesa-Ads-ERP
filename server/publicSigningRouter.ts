import express from "express";
import crypto from "crypto";
import { getDb } from "./db";
import { quotations, clients, leads, serviceOrders, quotationRestaurants, activeRestaurants, campaigns, campaignHistory, campaignRestaurants, campaignBatches, campaignBatchAssignments, invoices, quotationItems, products } from "../drizzle/schema";
import { eq, inArray, asc } from "drizzle-orm";
import { buildCampaignName } from "./utils/campaignName";
import { withUniqueRetry, describeDbError, isUniqueViolation } from "./utils/uniqueNumberRetry";
import { nextNumber } from "./utils/numberCounter";
import { scheduleInvoicesForCampaign } from "./utils/scheduleInvoices";
import {
  ensureDefaultQuotationSchedule,
  seedCampaignScheduleFromQuotation,
  readBillingSchedule,
  reconcileQuotationScheduleDueDates,
} from "./billingScheduleRouter";
import { scheduleMatchesTotal } from "../shared/billingSchedule";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
}

// Task #173 — gerador atômico via tabela contadora (number_counters).
// Substitui MAX("campaignNumber") + INSERT (racy) por upsert atômico.
async function generateCampaignNumber(db: any) {
  return nextNumber(db, "campaign");
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

      const items = await db
        .select({
          productName: products.name,
          quantity: quotationItems.quantity,
          unitPrice: quotationItems.unitPrice,
          totalPrice: quotationItems.totalPrice,
          unitLabelPlural: products.unitLabelPlural,
        })
        .from(quotationItems)
        .leftJoin(products, eq(quotationItems.productId, products.id))
        .where(eq(quotationItems.quotationId, quotation[0].id));

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

      // Task #218 — auto-heal de vencimentos legados incoerentes: se alguma
      // parcela vence antes do início do período exibido (OS ou cotação),
      // desloca o cronograma para acompanhar o período. Idempotente/no-op
      // quando já coerente.
      try {
        await reconcileQuotationScheduleDueDates(
          db,
          quotation[0].id,
          os[0].periodStart ?? (quotation[0] as any).periodStart ?? null,
        );
      } catch (e) {
        console.warn("[public-signing] reconcileQuotationScheduleDueDates:", (e as Error)?.message);
      }

      // Task #197 — inclui cronograma de pagamento.
      const billingSchedule = await readBillingSchedule(db, "quotation", quotation[0].id);

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
        items,
        billingSchedule: billingSchedule.map((b: any) => ({
          sequence: b.sequence,
          amount: b.amount,
          dueDate: b.dueDate,
          notes: b.notes,
        })),
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

      // Resolve clientId — cotações criadas via lead podem não ter clientId direto
      let resolvedClientId = quotation[0].clientId;
      if (!resolvedClientId && quotation[0].leadId) {
        const [lead] = await db
          .select({ id: leads.id, name: leads.name, company: leads.company, cnpj: leads.cnpj, contactEmail: leads.contactEmail, contactPhone: leads.contactPhone })
          .from(leads)
          .where(eq(leads.id, quotation[0].leadId));
        if (lead) {
          // Procura cliente existente pelo e-mail do lead
          if (lead.contactEmail) {
            const [existing] = await db
              .select({ id: clients.id })
              .from(clients)
              .where(eq(clients.contactEmail, lead.contactEmail))
              .limit(1);
            if (existing) resolvedClientId = existing.id;
          }
          // Se ainda não achou, cria um cliente a partir do lead
          if (!resolvedClientId) {
            const [newClient] = await db.insert(clients).values({
              name: lead.name || lead.company || "Cliente",
              company: lead.company,
              cnpj: lead.cnpj,
              contactEmail: lead.contactEmail,
              contactPhone: lead.contactPhone,
              status: "active",
            }).returning({ id: clients.id });
            resolvedClientId = newClient.id;
          }
          // Atualiza a cotação com o clientId resolvido
          await db.update(quotations).set({ clientId: resolvedClientId, updatedAt: new Date() })
            .where(eq(quotations.id, quotation[0].id));
        }
      }
      if (!resolvedClientId) {
        return res.status(400).json({ error: "Esta cotação não possui um cliente vinculado. Solicite ao consultor Mesa Ads que vincule um cliente antes de assinar." });
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

      // Task #197 — valida cronograma de pagamento da cotação antes de
       // converter em campanha (assinatura pública é equivalente a signOS).
      if (!quotation[0].isBonificada) {
        const sched = await readBillingSchedule(db, "quotation", quotation[0].id);
        if (sched.length === 0) {
          await ensureDefaultQuotationSchedule(db, quotation[0].id);
        } else if (!scheduleMatchesTotal(sched, quotation[0].totalValue ?? "0")) {
          return res.status(400).json({
            error: "Soma das parcelas não bate com o valor da cotação. Ajuste as condições antes de assinar.",
          });
        }
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

      const [cliRowSign] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, resolvedClientId)).limit(1);
      const campaignName = buildCampaignName(cliRowSign?.name, firstBatch.startDate);
      const maskedCpf = `***.***.${cpfClean.substring(6, 9)}-${cpfClean.substring(9)}`;
      const isBonificada = !!quotation[0].isBonificada;

      let campaignId: number = 0;
      let campaignNumber: string = "";

      // Envolve a transação inteira em retry on-23505: se duas assinaturas
      // concorrentes lerem o mesmo MAX(campaignNumber) e uma delas trombar
      // na constraint UNIQUE `campaigns_campaignNumber_unique`, recomeçamos
      // a transação com um número novo (gerado a partir do MAX já comitado
      // pela vencedora). Em PG, qualquer INSERT que falhe dentro de uma
      // transação a aborta, então o retry precisa ser POR FORA do
      // db.transaction, não dentro.
      await withUniqueRetry(
        () =>
          db.transaction(async (tx) => {
            campaignNumber = await generateCampaignNumber(tx);

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
              clientId: resolvedClientId,
              name: campaignName,
              startDate: firstBatch.startDate,
              endDate: lastBatch.endDate,
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
          }),
        {
          constraintName: "campaigns_campaignNumber_unique",
          maxRetries: 5,
          onRetry: (attempt) => {
            console.warn(
              `[publicSigning] campaignNumber collision (constraint=campaigns_campaignNumber_unique) — retrying transaction (attempt ${attempt})`,
            );
          },
        },
      );

      if (!isBonificada && campaignId > 0 && quotation[0].totalValue && parseFloat(quotation[0].totalValue) > 0) {
        // Task #173 — fatura "emitida" cabeçalho (auditoria/recebimento).
        try {
          const invoiceNumber = await nextNumber(db, "invoice");
          const today = new Date().toISOString().split("T")[0];
          const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          await db.insert(invoices).values({
            campaignId,
            clientId: resolvedClientId,
            invoiceNumber,
            amount: quotation[0].totalValue,
            issueDate: today,
            dueDate,
            status: "emitida",
          });
        } catch (err) {
          console.warn("[publicSigning] Failed to auto-create invoice:", err);
        }

        // Task #197 — herda cronograma configurado na cotação e gera as
        // faturas "prevista" a partir dele (mesma lógica de signOS).
        await seedCampaignScheduleFromQuotation(db, { quotationId: quotation[0].id, campaignId });
        await scheduleInvoicesForCampaign(db, { id: campaignId, clientId: resolvedClientId });
      }

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
      const status = isUniqueViolation(err) ? 409 : 500;
      res.status(status).json({ error: describeDbError(err, "Erro ao processar assinatura") });
    }
  });

  app.use("/api/public-signing", router);
}
