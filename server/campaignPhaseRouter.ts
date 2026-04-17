import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import {
  campaigns,
  campaignPhases,
  campaignItems,
  products,
  invoices,
  accountsPayable,
} from "../drizzle/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const PHASE_STATUS_ENUM = ["planejada", "ativa", "concluida", "cancelada"] as const;

export const campaignPhaseRouter = router({
  // ── Fases ─────────────────────────────────────────────────────────────────

  listByCampaign: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const phases = await db
        .select()
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId))
        .orderBy(asc(campaignPhases.sequence));

      if (phases.length === 0) return [];

      // Busca itens e agrega por fase
      const phaseIds = phases.map((p) => p.id);
      const itemRows = await db
        .select({
          item: campaignItems,
          productName: products.name,
          productTipo: products.tipo,
          productUnitLabel: products.unitLabel,
          productUnitLabelPlural: products.unitLabelPlural,
        })
        .from(campaignItems)
        .leftJoin(products, eq(products.id, campaignItems.productId))
        .where(sql`${campaignItems.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`);

      const itemsByPhase: Record<number, typeof itemRows> = {};
      for (const r of itemRows) {
        const phaseId = r.item.campaignPhaseId;
        if (!itemsByPhase[phaseId]) itemsByPhase[phaseId] = [];
        itemsByPhase[phaseId].push(r);
      }

      // Agrega totais financeiros por fase (faturado e pago) do que já existe
      const invoiceAgg = await db
        .select({
          campaignPhaseId: invoices.campaignPhaseId,
          totalInvoiced: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} <> 'cancelada' THEN ${invoices.amount}::numeric ELSE 0 END), 0)`,
          totalReceived: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paga' THEN ${invoices.amount}::numeric ELSE 0 END), 0)`,
          invoiceCount: sql<number>`COUNT(*)::int`,
        })
        .from(invoices)
        .where(sql`${invoices.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(invoices.campaignPhaseId);

      const invoiceAggMap: Record<number, { totalInvoiced: number; totalReceived: number; invoiceCount: number }> = {};
      for (const row of invoiceAgg) {
        if (row.campaignPhaseId != null) {
          invoiceAggMap[row.campaignPhaseId] = {
            totalInvoiced: parseFloat(row.totalInvoiced),
            totalReceived: parseFloat(row.totalReceived),
            invoiceCount: row.invoiceCount,
          };
        }
      }

      const payableAgg = await db
        .select({
          campaignPhaseId: accountsPayable.campaignPhaseId,
          totalDue: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.status} <> 'cancelado' THEN ${accountsPayable.amount}::numeric ELSE 0 END), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${accountsPayable.status} = 'pago' THEN ${accountsPayable.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(accountsPayable)
        .where(sql`${accountsPayable.campaignPhaseId} IN (${sql.join(phaseIds.map((id) => sql`${id}`), sql`, `)})`)
        .groupBy(accountsPayable.campaignPhaseId);

      const payableAggMap: Record<number, { totalDue: number; totalPaid: number }> = {};
      for (const row of payableAgg) {
        if (row.campaignPhaseId != null) {
          payableAggMap[row.campaignPhaseId] = {
            totalDue: parseFloat(row.totalDue),
            totalPaid: parseFloat(row.totalPaid),
          };
        }
      }

      return phases.map((p) => {
        const items = (itemsByPhase[p.id] ?? []).map((r) => ({
          ...r.item,
          productName: r.productName ?? "—",
          productTipo: r.productTipo ?? null,
          productUnitLabel: r.productUnitLabel ?? "unidade",
          productUnitLabelPlural: r.productUnitLabelPlural ?? "unidades",
          // Preço total "resolvido": usa totalPrice se setado, senão calcula
          resolvedTotalPrice: r.item.totalPrice != null
            ? parseFloat(r.item.totalPrice)
            : r.item.quantity * parseFloat(r.item.unitPrice),
        }));

        const expectedRevenue = items.reduce((sum, it) => sum + it.resolvedTotalPrice, 0);
        const expectedCosts = items.reduce(
          (sum, it) => sum + parseFloat(it.productionCost) + parseFloat(it.freightCost),
          0,
        );

        return {
          ...p,
          items,
          itemCount: items.length,
          expectedRevenue,
          expectedCosts,
          expectedMargin: expectedRevenue - expectedCosts,
          financial: {
            totalInvoiced: invoiceAggMap[p.id]?.totalInvoiced ?? 0,
            totalReceived: invoiceAggMap[p.id]?.totalReceived ?? 0,
            invoiceCount: invoiceAggMap[p.id]?.invoiceCount ?? 0,
            totalDue: payableAggMap[p.id]?.totalDue ?? 0,
            totalPaid: payableAggMap[p.id]?.totalPaid ?? 0,
          },
        };
      });
    }),

  getPhase: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.id));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada" });
      return phase;
    }),

  createPhase: comercialProcedure
    .input(z.object({
      campaignId: z.number(),
      label: z.string().min(1),
      periodStart: z.string(),
      periodEnd: z.string(),
      status: z.enum(PHASE_STATUS_ENUM).default("planejada"),
      notes: z.string().optional(),
      // sequence é calculado automaticamente (próximo disponível)
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Verifica campanha
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      // Próximo sequence
      const [maxSeq] = await db
        .select({ max: sql<number>`COALESCE(MAX(${campaignPhases.sequence}), 0)::int` })
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId));

      const [created] = await db
        .insert(campaignPhases)
        .values({
          campaignId: input.campaignId,
          sequence: (maxSeq?.max ?? 0) + 1,
          label: input.label,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: input.status,
          notes: input.notes ?? null,
        })
        .returning();
      return created;
    }),

  updatePhase: comercialProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().min(1).optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      status: z.enum(PHASE_STATUS_ENUM).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(campaignPhases)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(campaignPhases.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada" });
      return updated;
    }),

  deletePhase: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Checa se há faturas ou contas a pagar vinculadas
      const [invoiceCount] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(invoices)
        .where(eq(invoices.campaignPhaseId, input.id));
      if ((invoiceCount?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: há faturas vinculadas a esta fase. Cancele ou desvincule primeiro.",
        });
      }
      const [payableCount] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(accountsPayable)
        .where(eq(accountsPayable.campaignPhaseId, input.id));
      if ((payableCount?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: há contas a pagar vinculadas. Remova-as primeiro.",
        });
      }
      await db.delete(campaignPhases).where(eq(campaignPhases.id, input.id));
      return { success: true };
    }),

  // ── Itens ─────────────────────────────────────────────────────────────────

  createItem: comercialProcedure
    .input(z.object({
      campaignPhaseId: z.number(),
      productId: z.number(),
      quantity: z.number().int().min(1).default(1),
      unitPrice: z.string().default("0"),
      totalPrice: z.string().nullable().optional(),
      productionCost: z.string().default("0"),
      freightCost: z.string().default("0"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [phase] = await db.select().from(campaignPhases).where(eq(campaignPhases.id, input.campaignPhaseId));
      if (!phase) throw new TRPCError({ code: "NOT_FOUND", message: "Fase não encontrada" });

      const [created] = await db
        .insert(campaignItems)
        .values({
          campaignPhaseId: input.campaignPhaseId,
          productId: input.productId,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalPrice: input.totalPrice ?? null,
          productionCost: input.productionCost,
          freightCost: input.freightCost,
          notes: input.notes ?? null,
        })
        .returning();
      return created;
    }),

  updateItem: comercialProcedure
    .input(z.object({
      id: z.number(),
      quantity: z.number().int().min(1).optional(),
      unitPrice: z.string().optional(),
      totalPrice: z.string().nullable().optional(),
      productionCost: z.string().optional(),
      freightCost: z.string().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(campaignItems)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(campaignItems.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado" });
      return updated;
    }),

  deleteItem: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Checa se há contas a pagar vinculadas ao item
      const [payableCount] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(accountsPayable)
        .where(eq(accountsPayable.campaignItemId, input.id));
      if ((payableCount?.c ?? 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: há contas a pagar vinculadas a este item.",
        });
      }
      await db.delete(campaignItems).where(eq(campaignItems.id, input.id));
      return { success: true };
    }),

  // ── Wizard: cria campanha completa com fases e itens de uma vez ──────────
  // Não cria a campanha (isso é do campaignRouter); apenas fases + itens em
  // lote. Útil pro wizard de criação/edição em massa.
  bulkCreate: comercialProcedure
    .input(z.object({
      campaignId: z.number(),
      phases: z.array(z.object({
        label: z.string().min(1),
        periodStart: z.string(),
        periodEnd: z.string(),
        status: z.enum(PHASE_STATUS_ENUM).default("planejada"),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().int().min(1).default(1),
          unitPrice: z.string().default("0"),
          productionCost: z.string().default("0"),
          freightCost: z.string().default("0"),
        })).default([]),
      })),
      replaceExisting: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.campaignId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada" });

      if (input.replaceExisting) {
        // Limpa fases atuais (e itens em cascata). Cuidado: isso também
        // zera invoiceId/accountsPayable.campaignPhaseId via ON DELETE SET NULL
        // preservando as faturas/contas existentes porém sem vínculo.
        await db.delete(campaignPhases).where(eq(campaignPhases.campaignId, input.campaignId));
      }

      // Próximo sequence (caso não seja replace)
      const [maxSeq] = await db
        .select({ max: sql<number>`COALESCE(MAX(${campaignPhases.sequence}), 0)::int` })
        .from(campaignPhases)
        .where(eq(campaignPhases.campaignId, input.campaignId));
      let nextSeq = (maxSeq?.max ?? 0) + 1;

      const createdPhases: Array<{ phaseId: number; itemIds: number[] }> = [];

      for (const ph of input.phases) {
        const [createdPhase] = await db
          .insert(campaignPhases)
          .values({
            campaignId: input.campaignId,
            sequence: nextSeq++,
            label: ph.label,
            periodStart: ph.periodStart,
            periodEnd: ph.periodEnd,
            status: ph.status,
          })
          .returning();

        const itemIds: number[] = [];
        for (const it of ph.items) {
          const total = (parseFloat(it.unitPrice) * it.quantity).toFixed(2);
          const [createdItem] = await db
            .insert(campaignItems)
            .values({
              campaignPhaseId: createdPhase.id,
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: total,
              productionCost: it.productionCost,
              freightCost: it.freightCost,
            })
            .returning();
          itemIds.push(createdItem.id);
        }

        createdPhases.push({ phaseId: createdPhase.id, itemIds });
      }

      return { createdPhases, count: createdPhases.length };
    }),
});
