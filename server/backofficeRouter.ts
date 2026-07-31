import { backofficeProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  backofficeProductionOrders,
  backofficeDistributionMovements,
  backofficeStockCounts,
  backofficeScreenChecks,
  backofficeScreenMaterial,
  backofficeReports,
  permutas,
  permutaConsumptions,
  campaigns,
  suppliers,
  activeRestaurants,
  telas,
} from "../drizzle/schema";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const PRODUCTION_STATUSES = [
  "aguardando_arte",
  "arte_enviada_fornecedor",
  "prova_recebida",
  "prova_aprovada",
  "em_producao",
  "em_transporte",
  "recebida",
] as const;

const MOVEMENT_TYPES = ["entrega_inicial", "reposicao", "retirada"] as const;
const REPORTING_FREQUENCIES = ["diaria", "semanal"] as const;
const REPORT_TYPES = [
  "relatoria_diaria_telas",
  "relatoria_semanal_telas",
  "relatorio_semanal_bolachas",
  "relatorio_semanal_interno",
  "relatoria_mensal_telas",
  "relatorio_mensal_geral",
] as const;

// ─── Produção de Bolachas ─────────────────────────────────────────────────
// Acompanhamento granular (arte → fornecedor → prova → produção → frete →
// recebimento). Convive, sem sincronizar, com campaigns.status/campaignPhases
// (pipeline formal de OS) — ver client/src/pages/backoffice/ProductionBoard.tsx,
// que exibe campaigns.status como contexto somente-leitura.
const productionRouter = router({
  list: backofficeProcedure
    .input(z.object({ status: z.enum(PRODUCTION_STATUSES).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = input?.status ? [eq(backofficeProductionOrders.status, input.status)] : [];
      return db
        .select({
          id: backofficeProductionOrders.id,
          campaignId: backofficeProductionOrders.campaignId,
          campaignName: campaigns.name,
          campaignStatus: campaigns.status,
          campaignMaterialReceivedDate: campaigns.materialReceivedDate,
          supplierId: backofficeProductionOrders.supplierId,
          supplierName: suppliers.name,
          label: backofficeProductionOrders.label,
          quantity: backofficeProductionOrders.quantity,
          status: backofficeProductionOrders.status,
          artReceivedAt: backofficeProductionOrders.artReceivedAt,
          artSentToSupplierAt: backofficeProductionOrders.artSentToSupplierAt,
          proofReceivedAt: backofficeProductionOrders.proofReceivedAt,
          proofApprovedAt: backofficeProductionOrders.proofApprovedAt,
          shippedAt: backofficeProductionOrders.shippedAt,
          receivedAt: backofficeProductionOrders.receivedAt,
          trackingCode: backofficeProductionOrders.trackingCode,
          freightProvider: backofficeProductionOrders.freightProvider,
          notes: backofficeProductionOrders.notes,
          createdAt: backofficeProductionOrders.createdAt,
        })
        .from(backofficeProductionOrders)
        .leftJoin(campaigns, eq(campaigns.id, backofficeProductionOrders.campaignId))
        .leftJoin(suppliers, eq(suppliers.id, backofficeProductionOrders.supplierId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeProductionOrders.createdAt));
    }),

  create: backofficeProcedure
    .input(
      z.object({
        campaignId: z.number().int().optional(),
        supplierId: z.number().int().optional(),
        label: z.string().min(1),
        quantity: z.number().int().min(1),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db.insert(backofficeProductionOrders).values(input).returning();
      return row;
    }),

  update: backofficeProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(PRODUCTION_STATUSES).optional(),
        campaignId: z.number().int().nullable().optional(),
        supplierId: z.number().int().nullable().optional(),
        label: z.string().min(1).optional(),
        quantity: z.number().int().min(1).optional(),
        artReceivedAt: z.string().nullable().optional(),
        artSentToSupplierAt: z.string().nullable().optional(),
        proofReceivedAt: z.string().nullable().optional(),
        proofApprovedAt: z.string().nullable().optional(),
        shippedAt: z.string().nullable().optional(),
        receivedAt: z.string().nullable().optional(),
        trackingCode: z.string().nullable().optional(),
        freightProvider: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [row] = await db
        .update(backofficeProductionOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(backofficeProductionOrders.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
});

// ─── Distribuição de Bolachas ─────────────────────────────────────────────
const distributionRouter = router({
  list: backofficeProcedure
    .input(
      z.object({
        restaurantId: z.number().int().optional(),
        movementType: z.enum(MOVEMENT_TYPES).optional(),
      }).optional(),
    )
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = [];
      if (input?.restaurantId) conds.push(eq(backofficeDistributionMovements.restaurantId, input.restaurantId));
      if (input?.movementType) conds.push(eq(backofficeDistributionMovements.movementType, input.movementType));
      return db
        .select({
          id: backofficeDistributionMovements.id,
          productionOrderId: backofficeDistributionMovements.productionOrderId,
          productionOrderLabel: backofficeProductionOrders.label,
          restaurantId: backofficeDistributionMovements.restaurantId,
          restaurantName: activeRestaurants.name,
          movementType: backofficeDistributionMovements.movementType,
          quantity: backofficeDistributionMovements.quantity,
          movementDate: backofficeDistributionMovements.movementDate,
          performedBy: backofficeDistributionMovements.performedBy,
          notes: backofficeDistributionMovements.notes,
        })
        .from(backofficeDistributionMovements)
        .leftJoin(backofficeProductionOrders, eq(backofficeProductionOrders.id, backofficeDistributionMovements.productionOrderId))
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeDistributionMovements.restaurantId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeDistributionMovements.movementDate));
    }),

  create: backofficeProcedure
    .input(
      z.object({
        productionOrderId: z.number().int().optional(),
        restaurantId: z.number().int(),
        movementType: z.enum(MOVEMENT_TYPES),
        quantity: z.number().int().min(1),
        movementDate: z.string(),
        performedBy: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db.insert(backofficeDistributionMovements).values(input).returning();
      return row;
    }),
});

// ─── Contagem Semanal de Estoque ──────────────────────────────────────────
const stockCountRouter = router({
  list: backofficeProcedure
    .input(z.object({ weekOf: z.string().optional(), onlyPending: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = [];
      if (input?.weekOf) conds.push(eq(backofficeStockCounts.weekOf, input.weekOf));
      if (input?.onlyPending) {
        conds.push(
          and(
            isNull(backofficeStockCounts.resolvedAt),
            or(eq(backofficeStockCounts.needsRestock, true), eq(backofficeStockCounts.needsPickup, true)),
          )!,
        );
      }
      return db
        .select({
          id: backofficeStockCounts.id,
          restaurantId: backofficeStockCounts.restaurantId,
          restaurantName: activeRestaurants.name,
          weekOf: backofficeStockCounts.weekOf,
          countedQuantity: backofficeStockCounts.countedQuantity,
          needsRestock: backofficeStockCounts.needsRestock,
          needsPickup: backofficeStockCounts.needsPickup,
          resolvedAt: backofficeStockCounts.resolvedAt,
          notes: backofficeStockCounts.notes,
        })
        .from(backofficeStockCounts)
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeStockCounts.restaurantId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeStockCounts.weekOf));
    }),

  upsert: backofficeProcedure
    .input(
      z.object({
        restaurantId: z.number().int(),
        weekOf: z.string(),
        countedQuantity: z.number().int().min(0),
        needsRestock: z.boolean().default(false),
        needsPickup: z.boolean().default(false),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .insert(backofficeStockCounts)
        .values(input)
        .onConflictDoUpdate({
          target: [backofficeStockCounts.restaurantId, backofficeStockCounts.weekOf],
          set: {
            countedQuantity: input.countedQuantity,
            needsRestock: input.needsRestock,
            needsPickup: input.needsPickup,
            notes: input.notes,
          },
        })
        .returning();
      return row;
    }),

  resolve: backofficeProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .update(backofficeStockCounts)
        .set({ resolvedAt: new Date() })
        .where(eq(backofficeStockCounts.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
});

// ─── Verificação Diária de Telas ──────────────────────────────────────────
// Por tela física (telas.id) — um restaurante pode ter mais de uma tela.
const screenCheckRouter = router({
  list: backofficeProcedure
    .input(z.object({ checkDate: z.string().optional(), onlyProblems: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = [];
      if (input?.checkDate) conds.push(eq(backofficeScreenChecks.checkDate, input.checkDate));
      if (input?.onlyProblems) {
        conds.push(
          and(
            isNull(backofficeScreenChecks.resolvedAt),
            or(eq(backofficeScreenChecks.isOnline, false), eq(backofficeScreenChecks.internetOk, false)),
          )!,
        );
      }
      return db
        .select({
          id: backofficeScreenChecks.id,
          telaId: backofficeScreenChecks.telaId,
          telaNome: telas.nome,
          restaurantId: telas.restaurantId,
          restaurantName: activeRestaurants.name,
          checkDate: backofficeScreenChecks.checkDate,
          isOnline: backofficeScreenChecks.isOnline,
          internetOk: backofficeScreenChecks.internetOk,
          issue: backofficeScreenChecks.issue,
          actionTaken: backofficeScreenChecks.actionTaken,
          resolvedAt: backofficeScreenChecks.resolvedAt,
          performedBy: backofficeScreenChecks.performedBy,
        })
        .from(backofficeScreenChecks)
        .leftJoin(telas, eq(telas.id, backofficeScreenChecks.telaId))
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, telas.restaurantId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeScreenChecks.checkDate));
    }),

  // Lista todas as telas ativas com o check de hoje (se houver) — pro Gabriel
  // ver de relance quais faltam verificar.
  today: backofficeProcedure.query(async () => {
    const db = await getDatabase();
    const today = new Date().toISOString().slice(0, 10);
    return db
      .select({
        telaId: telas.id,
        telaNome: telas.nome,
        restaurantId: telas.restaurantId,
        restaurantName: activeRestaurants.name,
        checkId: backofficeScreenChecks.id,
        isOnline: backofficeScreenChecks.isOnline,
        internetOk: backofficeScreenChecks.internetOk,
        resolvedAt: backofficeScreenChecks.resolvedAt,
      })
      .from(telas)
      .leftJoin(activeRestaurants, eq(activeRestaurants.id, telas.restaurantId))
      .leftJoin(
        backofficeScreenChecks,
        and(eq(backofficeScreenChecks.telaId, telas.id), eq(backofficeScreenChecks.checkDate, today)),
      )
      .where(eq(telas.status, "active"))
      .orderBy(asc(activeRestaurants.name));
  }),

  upsert: backofficeProcedure
    .input(
      z.object({
        telaId: z.number().int(),
        checkDate: z.string(),
        isOnline: z.boolean(),
        internetOk: z.boolean(),
        issue: z.string().optional(),
        actionTaken: z.string().optional(),
        performedBy: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .insert(backofficeScreenChecks)
        .values(input)
        .onConflictDoUpdate({
          target: [backofficeScreenChecks.telaId, backofficeScreenChecks.checkDate],
          set: {
            isOnline: input.isOnline,
            internetOk: input.internetOk,
            issue: input.issue,
            actionTaken: input.actionTaken,
            performedBy: input.performedBy,
          },
        })
        .returning();
      return row;
    }),

  resolve: backofficeProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .update(backofficeScreenChecks)
        .set({ resolvedAt: new Date() })
        .where(eq(backofficeScreenChecks.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),
});

// ─── Material de Telas (veiculação) ───────────────────────────────────────
const screenMaterialRouter = router({
  list: backofficeProcedure
    .input(z.object({ campaignId: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = input?.campaignId ? [eq(backofficeScreenMaterial.campaignId, input.campaignId)] : [];
      return db
        .select({
          id: backofficeScreenMaterial.id,
          campaignId: backofficeScreenMaterial.campaignId,
          campaignName: campaigns.name,
          campaignStatus: campaigns.status,
          restaurantId: backofficeScreenMaterial.restaurantId,
          restaurantName: activeRestaurants.name,
          materialReceived: backofficeScreenMaterial.materialReceived,
          materialReceivedAt: backofficeScreenMaterial.materialReceivedAt,
          reportingFrequency: backofficeScreenMaterial.reportingFrequency,
          notes: backofficeScreenMaterial.notes,
        })
        .from(backofficeScreenMaterial)
        .leftJoin(campaigns, eq(campaigns.id, backofficeScreenMaterial.campaignId))
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeScreenMaterial.restaurantId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeScreenMaterial.id));
    }),

  upsert: backofficeProcedure
    .input(
      z.object({
        campaignId: z.number().int(),
        restaurantId: z.number().int(),
        materialReceived: z.boolean().default(false),
        materialReceivedAt: z.string().optional(),
        reportingFrequency: z.enum(REPORTING_FREQUENCIES).optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .insert(backofficeScreenMaterial)
        .values(input)
        .onConflictDoUpdate({
          target: [backofficeScreenMaterial.campaignId, backofficeScreenMaterial.restaurantId],
          set: {
            materialReceived: input.materialReceived,
            materialReceivedAt: input.materialReceivedAt,
            reportingFrequency: input.reportingFrequency,
            notes: input.notes,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
    }),
});

// ─── Permutas ──────────────────────────────────────────────────────────────
const permutaRouter = router({
  list: backofficeProcedure.query(async () => {
    const db = await getDatabase();
    const rows = await db
      .select({
        id: permutas.id,
        restaurantId: permutas.restaurantId,
        restaurantName: activeRestaurants.name,
        description: permutas.description,
        totalValue: permutas.totalValue,
        startDate: permutas.startDate,
        endDate: permutas.endDate,
        contractSigned: permutas.contractSigned,
        notes: permutas.notes,
        consumed: sql<string>`COALESCE((SELECT SUM(${permutaConsumptions.amount}) FROM ${permutaConsumptions} WHERE ${permutaConsumptions.permutaId} = ${permutas.id}), 0)`,
      })
      .from(permutas)
      .leftJoin(activeRestaurants, eq(activeRestaurants.id, permutas.restaurantId))
      .orderBy(desc(permutas.createdAt));
    return rows.map((r) => ({ ...r, balance: Number(r.totalValue) - Number(r.consumed) }));
  }),

  create: backofficeProcedure
    .input(
      z.object({
        restaurantId: z.number().int(),
        description: z.string().min(1),
        totalValue: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        contractSigned: z.boolean().default(false),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db.insert(permutas).values(input).returning();
      return row;
    }),

  update: backofficeProcedure
    .input(
      z.object({
        id: z.number().int(),
        description: z.string().min(1).optional(),
        totalValue: z.string().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        contractSigned: z.boolean().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [row] = await db
        .update(permutas)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(permutas.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  listConsumptions: backofficeProcedure
    .input(z.object({ permutaId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select()
        .from(permutaConsumptions)
        .where(eq(permutaConsumptions.permutaId, input.permutaId))
        .orderBy(desc(permutaConsumptions.consumptionDate));
    }),

  addConsumption: backofficeProcedure
    .input(
      z.object({
        permutaId: z.number().int(),
        consumptionDate: z.string(),
        description: z.string().optional(),
        amount: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db.insert(permutaConsumptions).values(input).returning();
      return row;
    }),
});

// ─── Log de Relatórios ─────────────────────────────────────────────────────
const reportRouter = router({
  list: backofficeProcedure
    .input(z.object({ reportType: z.enum(REPORT_TYPES).optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = input?.reportType ? [eq(backofficeReports.reportType, input.reportType)] : [];
      return db
        .select()
        .from(backofficeReports)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeReports.sentAt));
    }),

  create: backofficeProcedure
    .input(
      z.object({
        reportType: z.enum(REPORT_TYPES),
        referenceLabel: z.string().min(1),
        recipientLabel: z.string().optional(),
        sentAt: z.string(),
        sentBy: z.string().optional(),
        linkUrl: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db.insert(backofficeReports).values(input).returning();
      return row;
    }),
});

export const backofficeRouter = router({
  production: productionRouter,
  distribution: distributionRouter,
  stockCount: stockCountRouter,
  screenCheck: screenCheckRouter,
  screenMaterial: screenMaterialRouter,
  permuta: permutaRouter,
  report: reportRouter,

  // Revisão mensal: permutas com saldo baixo/estourado + contagem de
  // relatórios enviados no mês. Agregador de leitura — sem tabela própria,
  // mesmo padrão de economics.monthly/campaignPhase.campaignOverview.
  monthlyReview: backofficeProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const monthStart = `${input.year}-${String(input.month).padStart(2, "0")}-01`;
      const nextMonth = input.month === 12 ? 1 : input.month + 1;
      const nextYear = input.month === 12 ? input.year + 1 : input.year;
      const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const permutasWithBalance = await db
        .select({
          id: permutas.id,
          restaurantName: activeRestaurants.name,
          totalValue: permutas.totalValue,
          consumed: sql<string>`COALESCE((SELECT SUM(${permutaConsumptions.amount}) FROM ${permutaConsumptions} WHERE ${permutaConsumptions.permutaId} = ${permutas.id}), 0)`,
        })
        .from(permutas)
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, permutas.restaurantId));
      const lowBalancePermutas = permutasWithBalance
        .map((p) => ({ ...p, balance: Number(p.totalValue) - Number(p.consumed) }))
        .filter((p) => p.balance <= Number(p.totalValue) * 0.1);

      const [{ count: reportsSent }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(backofficeReports)
        .where(and(gte(backofficeReports.sentAt, monthStart), lte(backofficeReports.sentAt, monthEnd)));

      return { lowBalancePermutas, reportsSentThisMonth: reportsSent };
    }),
});
