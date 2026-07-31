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
  backofficeChecklistCompletions,
  backofficeProductionLogs,
  backofficeScreenCheckLogs,
  permutas,
  permutaConsumptions,
  campaigns,
  suppliers,
  activeRestaurants,
  telas,
} from "../drizzle/schema";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

function ctxUserName(ctx: any): string | null {
  const u = ctx?.user;
  if (!u) return null;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || null;
}

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
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const [row] = await db.insert(backofficeProductionOrders).values(input).returning();
      await db.insert(backofficeProductionLogs).values({
        productionOrderId: row.id,
        action: "criado",
        details: `Pedido criado: ${row.label} (${row.quantity} un)`,
        performedBy: ctxUserName(ctx),
      });
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
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [before] = await db
        .select()
        .from(backofficeProductionOrders)
        .where(eq(backofficeProductionOrders.id, id))
        .limit(1);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const [row] = await db
        .update(backofficeProductionOrders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(backofficeProductionOrders.id, id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      // Trilha de auditoria: descreve só o que efetivamente mudou.
      const FIELD_LABELS: Record<string, string> = {
        status: "status",
        campaignId: "campanha",
        supplierId: "fornecedor",
        label: "rótulo",
        quantity: "quantidade",
        artReceivedAt: "arte recebida em",
        artSentToSupplierAt: "arte enviada em",
        proofReceivedAt: "prova recebida em",
        proofApprovedAt: "prova aprovada em",
        shippedAt: "despachado em",
        receivedAt: "recebido em",
        trackingCode: "rastreio",
        freightProvider: "transportadora",
        notes: "observações",
      };
      const changes: string[] = [];
      for (const key of Object.keys(data) as Array<keyof typeof data>) {
        const prev = (before as any)[key];
        const next = (data as any)[key];
        if (next !== undefined && String(prev ?? "") !== String(next ?? "")) {
          changes.push(`${FIELD_LABELS[key as string] ?? key}: ${prev ?? "—"} → ${next ?? "—"}`);
        }
      }
      if (changes.length > 0) {
        await db.insert(backofficeProductionLogs).values({
          productionOrderId: id,
          action: "atualizado",
          details: changes.join("; "),
          performedBy: ctxUserName(ctx),
        });
      }
      return row;
    }),

  logs: backofficeProcedure
    .input(z.object({ productionOrderId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select()
        .from(backofficeProductionLogs)
        .where(eq(backofficeProductionLogs.productionOrderId, input.productionOrderId))
        .orderBy(desc(backofficeProductionLogs.createdAt));
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
          campaignId: backofficeStockCounts.campaignId,
          campaignName: campaigns.name,
          weekOf: backofficeStockCounts.weekOf,
          countedQuantity: backofficeStockCounts.countedQuantity,
          needsRestock: backofficeStockCounts.needsRestock,
          needsPickup: backofficeStockCounts.needsPickup,
          resolvedAt: backofficeStockCounts.resolvedAt,
          notes: backofficeStockCounts.notes,
        })
        .from(backofficeStockCounts)
        .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeStockCounts.restaurantId))
        .leftJoin(campaigns, eq(campaigns.id, backofficeStockCounts.campaignId))
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
        campaignId: z.number().int().nullable().optional(),
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
            campaignId: input.campaignId ?? null,
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
    const today = businessToday();
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
      // Se já existe check pra tela×dia, loga os valores anteriores antes de
      // sobrescrever — edições ficam rastreáveis.
      const [existing] = await db
        .select()
        .from(backofficeScreenChecks)
        .where(and(eq(backofficeScreenChecks.telaId, input.telaId), eq(backofficeScreenChecks.checkDate, input.checkDate)))
        .limit(1);
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
      if (existing) {
        const fmt = (c: any) =>
          `online=${c.isOnline ? "sim" : "não"}, internet=${c.internetOk ? "sim" : "não"}` +
          (c.issue ? `, problema: ${c.issue}` : "") +
          (c.actionTaken ? `, ação: ${c.actionTaken}` : "");
        await db.insert(backofficeScreenCheckLogs).values({
          checkId: row.id,
          telaId: input.telaId,
          details: `Check de ${input.checkDate} editado. Antes: ${fmt(existing)}. Depois: ${fmt(row)}.`,
          performedBy: input.performedBy ?? null,
        });
      }
      return row;
    }),

  // Histórico completo de uma tela: linha do tempo de checks + log de edições.
  history: backofficeProcedure
    .input(z.object({ telaId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [checks, editLogs] = await Promise.all([
        db
          .select()
          .from(backofficeScreenChecks)
          .where(eq(backofficeScreenChecks.telaId, input.telaId))
          .orderBy(desc(backofficeScreenChecks.checkDate)),
        db
          .select()
          .from(backofficeScreenCheckLogs)
          .where(eq(backofficeScreenCheckLogs.telaId, input.telaId))
          .orderBy(desc(backofficeScreenCheckLogs.createdAt)),
      ]);
      return { checks, editLogs };
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
          attachmentUrl: backofficeScreenMaterial.attachmentUrl,
          attachmentName: backofficeScreenMaterial.attachmentName,
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
        attachmentUrl: z.string().nullable().optional(),
        attachmentName: z.string().nullable().optional(),
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
            // Anexo só é sobrescrito quando enviado explicitamente — um upsert
            // sem anexo não apaga o arquivo já registrado.
            ...(input.attachmentUrl !== undefined ? { attachmentUrl: input.attachmentUrl, attachmentName: input.attachmentName ?? null } : {}),
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
        telaId: permutas.telaId,
        telaNome: telas.nome,
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
      .leftJoin(telas, eq(telas.id, permutas.telaId))
      .orderBy(desc(permutas.createdAt));
    return rows.map((r) => ({ ...r, balance: Number(r.totalValue) - Number(r.consumed) }));
  }),

  create: backofficeProcedure
    .input(
      z.object({
        restaurantId: z.number().int(),
        telaId: z.number().int().nullable().optional(),
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
      // Permuta por tela: a tela precisa pertencer ao restaurante do acordo.
      if (input.telaId) {
        const [tela] = await db.select({ restaurantId: telas.restaurantId }).from(telas).where(eq(telas.id, input.telaId)).limit(1);
        if (!tela) throw new TRPCError({ code: "NOT_FOUND", message: "Tela não encontrada." });
        if (tela.restaurantId !== input.restaurantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A tela selecionada não pertence a esse restaurante." });
        }
      }
      const [row] = await db.insert(permutas).values(input).returning();
      return row;
    }),

  update: backofficeProcedure
    .input(
      z.object({
        id: z.number().int(),
        telaId: z.number().int().nullable().optional(),
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
      if (data.telaId) {
        const [existing] = await db.select({ restaurantId: permutas.restaurantId }).from(permutas).where(eq(permutas.id, id)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const [tela] = await db.select({ restaurantId: telas.restaurantId }).from(telas).where(eq(telas.id, data.telaId)).limit(1);
        if (!tela) throw new TRPCError({ code: "NOT_FOUND", message: "Tela não encontrada." });
        if (tela.restaurantId !== existing.restaurantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A tela selecionada não pertence ao restaurante da permuta." });
        }
      }
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
    .input(z.object({ reportType: z.enum(REPORT_TYPES).optional(), campaignId: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conds = [];
      if (input?.reportType) conds.push(eq(backofficeReports.reportType, input.reportType));
      if (input?.campaignId) conds.push(eq(backofficeReports.campaignId, input.campaignId));
      return db
        .select({
          id: backofficeReports.id,
          campaignId: backofficeReports.campaignId,
          campaignName: campaigns.name,
          reportType: backofficeReports.reportType,
          referenceLabel: backofficeReports.referenceLabel,
          recipientLabel: backofficeReports.recipientLabel,
          sentAt: backofficeReports.sentAt,
          sentBy: backofficeReports.sentBy,
          linkUrl: backofficeReports.linkUrl,
          notes: backofficeReports.notes,
        })
        .from(backofficeReports)
        .leftJoin(campaigns, eq(campaigns.id, backofficeReports.campaignId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(backofficeReports.sentAt));
    }),

  create: backofficeProcedure
    .input(
      z.object({
        campaignId: z.number().int().optional(),
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

// ─── Checklist diário ──────────────────────────────────────────────────────
// Itens DERIVADOS dos dados reais (nada de lista estática que fica obsoleta):
// telas sem check hoje, contagem semanal em atraso, relatorias pendentes,
// produção parada. A tabela backoffice_checklist_completions guarda só a
// marcação manual "feito" por item×dia — por isso o checklist "reseta" sozinho
// a cada dia. done = auto-resolvido pelos dados OU marcado manualmente.
// "Hoje" no fuso do negócio (America/Sao_Paulo), não UTC — senão às 21h+
// locais o checklist resetaria cedo e as marcações cairiam no dia errado.
export function businessToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function mondayOfISO(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

const checklistRouter = router({
  today: backofficeProcedure.query(async () => {
    const db = await getDatabase();
    const today = businessToday();
    const weekStart = mondayOfISO(today);
    const weekEndDate = new Date(`${weekStart}T00:00:00Z`);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
    const weekEnd = weekEndDate.toISOString().slice(0, 10);

    const [
      activeTelas,
      todayChecks,
      restaurantsWithBolachas,
      weekCounts,
      weekReports,
      stalledOrders,
      dailyFreqRows,
      manualCompletions,
    ] = await Promise.all([
      db.select({ id: telas.id }).from(telas).where(eq(telas.status, "active")),
      db.select({ telaId: backofficeScreenChecks.telaId }).from(backofficeScreenChecks).where(eq(backofficeScreenChecks.checkDate, today)),
      db
        .selectDistinct({ restaurantId: backofficeDistributionMovements.restaurantId })
        .from(backofficeDistributionMovements),
      db
        .select({ restaurantId: backofficeStockCounts.restaurantId })
        .from(backofficeStockCounts)
        .where(eq(backofficeStockCounts.weekOf, weekStart)),
      db
        .select({ reportType: backofficeReports.reportType, sentAt: backofficeReports.sentAt })
        .from(backofficeReports)
        .where(and(gte(backofficeReports.sentAt, weekStart), lte(backofficeReports.sentAt, weekEnd))),
      db
        .select({ id: backofficeProductionOrders.id })
        .from(backofficeProductionOrders)
        .where(
          and(
            sql`${backofficeProductionOrders.status} <> 'recebida'`,
            sql`${backofficeProductionOrders.updatedAt} < NOW() - INTERVAL '3 days'`,
          ),
        ),
      db
        .select({ id: backofficeScreenMaterial.id })
        .from(backofficeScreenMaterial)
        .where(eq(backofficeScreenMaterial.reportingFrequency, "diaria")),
      db
        .select()
        .from(backofficeChecklistCompletions)
        .where(eq(backofficeChecklistCompletions.itemDate, today)),
    ]);

    const checkedTelaIds = new Set(todayChecks.map((c) => c.telaId));
    const telasPendentes = activeTelas.filter((t) => !checkedTelaIds.has(t.id)).length;

    const countedRestaurantIds = new Set(weekCounts.map((c) => c.restaurantId));
    const contagensPendentes = restaurantsWithBolachas.filter((r) => !countedRestaurantIds.has(r.restaurantId)).length;

    const reportTypesThisWeek = new Set(weekReports.map((r) => r.reportType));
    const reportSentToday = (type: string) => weekReports.some((r) => r.reportType === type && r.sentAt === today);
    const manualDone = new Set(manualCompletions.map((c) => c.itemKey));

    type Item = {
      key: string;
      label: string;
      detail: string | null;
      frequency: "diaria" | "semanal";
      autoDone: boolean;
      manualDone: boolean;
      done: boolean;
      link: string | null;
    };
    const mk = (key: string, label: string, detail: string | null, frequency: "diaria" | "semanal", autoDone: boolean, link: string | null): Item => ({
      key,
      label,
      detail,
      frequency,
      autoDone,
      manualDone: manualDone.has(key),
      done: autoDone || manualDone.has(key),
      link,
    });

    const items: Item[] = [
      mk(
        "telas_check",
        "Verificar as telas do dia",
        telasPendentes > 0 ? `${telasPendentes} tela(s) sem verificação hoje` : "Todas as telas verificadas",
        "diaria",
        activeTelas.length > 0 && telasPendentes === 0,
        "/backoffice/telas",
      ),
      mk(
        "contagem_semanal",
        "Contagem semanal de bolachas",
        contagensPendentes > 0 ? `${contagensPendentes} restaurante(s) sem contagem na semana` : "Contagens da semana em dia",
        "semanal",
        restaurantsWithBolachas.length > 0 && contagensPendentes === 0,
        "/backoffice/distribuicao",
      ),
      mk(
        "producao_andamento",
        "Revisar produção parada",
        stalledOrders.length > 0 ? `${stalledOrders.length} pedido(s) sem avanço há 3+ dias` : "Nenhum pedido parado",
        "diaria",
        stalledOrders.length === 0,
        "/backoffice/producao",
      ),
    ];

    if (dailyFreqRows.length > 0) {
      items.push(
        mk(
          "relatoria_diaria_telas",
          "Relatoria diária de telas",
          reportSentToday("relatoria_diaria_telas") ? "Enviada hoje" : "Ainda não registrada hoje",
          "diaria",
          reportSentToday("relatoria_diaria_telas"),
          "/backoffice/relatorios",
        ),
      );
    }

    const weeklyReports: Array<[string, string]> = [
      ["relatoria_semanal_telas", "Relatoria semanal — Telas"],
      ["relatorio_semanal_bolachas", "Relatório semanal — Bolachas"],
      ["relatorio_semanal_interno", "Relatório semanal — Interno"],
    ];
    for (const [type, label] of weeklyReports) {
      items.push(
        mk(
          type,
          label,
          reportTypesThisWeek.has(type as any) ? "Registrado nesta semana" : "Pendente nesta semana",
          "semanal",
          reportTypesThisWeek.has(type as any),
          "/backoffice/relatorios",
        ),
      );
    }

    return { date: today, weekStart, items };
  }),

  toggle: backofficeProcedure
    .input(z.object({ itemKey: z.string().min(1), done: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const today = businessToday();
      if (input.done) {
        await db
          .insert(backofficeChecklistCompletions)
          .values({ itemKey: input.itemKey, itemDate: today, completedBy: ctxUserName(ctx) })
          .onConflictDoNothing();
      } else {
        await db
          .delete(backofficeChecklistCompletions)
          .where(and(eq(backofficeChecklistCompletions.itemKey, input.itemKey), eq(backofficeChecklistCompletions.itemDate, today)));
      }
      return { ok: true };
    }),
});

// ─── Campanhas (visão backoffice) ──────────────────────────────────────────
const backofficeCampaignsRouter = router({
  // Lista campanhas que têm QUALQUER atividade de backoffice (produção,
  // material, contagem, relatório) ou estão em fase operacional.
  list: backofficeProcedure.query(async () => {
    const db = await getDatabase();
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        startDate: campaigns.startDate,
        productionOrders: sql<number>`(SELECT COUNT(*)::int FROM "backoffice_production_orders" po WHERE po."campaignId" = ${campaigns.id})`,
        materialsTotal: sql<number>`(SELECT COUNT(*)::int FROM "backoffice_screen_material" m WHERE m."campaignId" = ${campaigns.id})`,
        materialsReceived: sql<number>`(SELECT COUNT(*)::int FROM "backoffice_screen_material" m WHERE m."campaignId" = ${campaigns.id} AND m."materialReceived")`,
        reportsCount: sql<number>`(SELECT COUNT(*)::int FROM "backoffice_reports" r WHERE r."campaignId" = ${campaigns.id})`,
        stockCountsCount: sql<number>`(SELECT COUNT(*)::int FROM "backoffice_stock_counts" sc WHERE sc."campaignId" = ${campaigns.id})`,
      })
      .from(campaigns)
      .orderBy(desc(campaigns.id));
    return rows.filter(
      (r) =>
        r.productionOrders > 0 ||
        r.materialsTotal > 0 ||
        r.reportsCount > 0 ||
        r.stockCountsCount > 0 ||
        !["completed", "archived", "cancelada", "inativa"].includes(String(r.status)),
    );
  }),

  // Detalhe por campanha: log de relatórios + consumo semanal de bolachas
  // (movimentos via pedidos de produção da campanha + contagens vinculadas)
  // + status de material por local.
  detail: backofficeProcedure
    .input(z.object({ campaignId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const orderRows = await db
        .select({ id: backofficeProductionOrders.id })
        .from(backofficeProductionOrders)
        .where(eq(backofficeProductionOrders.campaignId, input.campaignId));
      const orderIds = orderRows.map((o) => o.id);

      const [reports, movements, counts, materials] = await Promise.all([
        db
          .select()
          .from(backofficeReports)
          .where(eq(backofficeReports.campaignId, input.campaignId))
          .orderBy(desc(backofficeReports.sentAt)),
        orderIds.length
          ? db
              .select({
                id: backofficeDistributionMovements.id,
                restaurantName: activeRestaurants.name,
                movementType: backofficeDistributionMovements.movementType,
                quantity: backofficeDistributionMovements.quantity,
                movementDate: backofficeDistributionMovements.movementDate,
              })
              .from(backofficeDistributionMovements)
              .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeDistributionMovements.restaurantId))
              .where(inArray(backofficeDistributionMovements.productionOrderId, orderIds))
              .orderBy(desc(backofficeDistributionMovements.movementDate))
          : Promise.resolve([] as any[]),
        db
          .select({
            id: backofficeStockCounts.id,
            restaurantName: activeRestaurants.name,
            weekOf: backofficeStockCounts.weekOf,
            countedQuantity: backofficeStockCounts.countedQuantity,
            needsRestock: backofficeStockCounts.needsRestock,
            needsPickup: backofficeStockCounts.needsPickup,
          })
          .from(backofficeStockCounts)
          .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeStockCounts.restaurantId))
          .where(eq(backofficeStockCounts.campaignId, input.campaignId))
          .orderBy(desc(backofficeStockCounts.weekOf)),
        db
          .select({
            id: backofficeScreenMaterial.id,
            restaurantName: activeRestaurants.name,
            materialReceived: backofficeScreenMaterial.materialReceived,
            materialReceivedAt: backofficeScreenMaterial.materialReceivedAt,
            attachmentUrl: backofficeScreenMaterial.attachmentUrl,
            attachmentName: backofficeScreenMaterial.attachmentName,
            reportingFrequency: backofficeScreenMaterial.reportingFrequency,
          })
          .from(backofficeScreenMaterial)
          .leftJoin(activeRestaurants, eq(activeRestaurants.id, backofficeScreenMaterial.restaurantId))
          .where(eq(backofficeScreenMaterial.campaignId, input.campaignId)),
      ]);

      // Consumo semanal: entregas/reposições agregadas por semana (segunda).
      const weekly = new Map<string, { weekOf: string; delivered: number; withdrawn: number; counted: number | null }>();
      for (const m of movements as any[]) {
        const wk = mondayOfISO(String(m.movementDate));
        const entry = weekly.get(wk) ?? { weekOf: wk, delivered: 0, withdrawn: 0, counted: null };
        if (m.movementType === "retirada") entry.withdrawn += m.quantity;
        else entry.delivered += m.quantity;
        weekly.set(wk, entry);
      }
      for (const c of counts) {
        const wk = String(c.weekOf);
        const entry = weekly.get(wk) ?? { weekOf: wk, delivered: 0, withdrawn: 0, counted: null };
        entry.counted = (entry.counted ?? 0) + c.countedQuantity;
        weekly.set(wk, entry);
      }
      const weeklyConsumption = Array.from(weekly.values()).sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1));

      return { reports, movements, counts, materials, weeklyConsumption };
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
  checklist: checklistRouter,
  campaigns: backofficeCampaignsRouter,

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
