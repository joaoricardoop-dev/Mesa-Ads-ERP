import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { campaignBatches, campaignBatchAssignments, campaigns } from "../drizzle/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

function getCycleStart(year: number): Date {
  return new Date(year, 3, 15);
}

interface EventWindow {
  name: string;
  emoji: string;
  getDateRange: (year: number) => { start: Date; end: Date } | null;
}

function getLastFridayOfNovember(year: number): Date {
  const lastDay = new Date(year, 10, 30);
  while (lastDay.getDay() !== 5) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
}

const EVENTS: EventWindow[] = [
  {
    name: "Black Friday",
    emoji: "🛍️",
    getDateRange: (year: number) => {
      const bf = getLastFridayOfNovember(year);
      const start = new Date(bf);
      start.setDate(bf.getDate() - 7);
      const end = new Date(bf);
      end.setDate(bf.getDate() + 2);
      return { start, end };
    },
  },
  {
    name: "Copa do Mundo",
    emoji: "🏆",
    getDateRange: (year: number) => {
      const copaYears: Record<number, { start: Date; end: Date }> = {
        2026: { start: new Date(2026, 5, 11), end: new Date(2026, 6, 19) },
        2030: { start: new Date(2030, 5, 1), end: new Date(2030, 6, 15) },
        2034: { start: new Date(2034, 5, 1), end: new Date(2034, 6, 15) },
      };
      return copaYears[year] || null;
    },
  },
  {
    name: "Festival de Parintins",
    emoji: "🎭",
    getDateRange: (year: number) => {
      return {
        start: new Date(year, 5, 24),
        end: new Date(year, 5, 29),
      };
    },
  },
];

function dateRangesOverlap(
  aStart: Date, aEnd: Date,
  bStart: Date, bEnd: Date
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function getEventLabels(startDate: Date, endDate: Date): string[] {
  const labels: string[] = [];
  const yearsToCheck = new Set([startDate.getFullYear(), endDate.getFullYear()]);
  for (const year of yearsToCheck) {
    for (const event of EVENTS) {
      const range = event.getDateRange(year);
      if (range && dateRangesOverlap(startDate, endDate, range.start, range.end)) {
        labels.push(`${event.emoji} ${event.name}`);
      }
    }
  }
  return labels;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateBatchesForYear(year: number) {
  const cycleStart = getCycleStart(year);
  const batches = [];

  for (let i = 0; i < 13; i++) {
    const startDate = new Date(cycleStart);
    startDate.setDate(cycleStart.getDate() + i * 28);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 27);

    const startMonth = startDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const endMonth = endDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    let label = startMonth === endMonth
      ? `Batch ${i + 1} — ${capitalize(startMonth)}`
      : `Batch ${i + 1} — ${capitalize(startMonth)}/${capitalize(endMonth)}`;

    const eventLabels = getEventLabels(startDate, endDate);
    if (eventLabels.length > 0) {
      label += ` | ${eventLabels.join(" | ")}`;
    }

    batches.push({
      year,
      batchNumber: i + 1,
      label,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    });
  }

  return batches;
}

export const batchRouter = router({
  list: protectedProcedure
    .input(z.object({ year: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const year = input?.year || new Date().getFullYear();

      const existing = await db
        .select()
        .from(campaignBatches)
        .where(eq(campaignBatches.year, year))
        .orderBy(asc(campaignBatches.batchNumber));

      if (existing.length > 0) return existing;

      const generated = generateBatchesForYear(year);
      const inserted = await db
        .insert(campaignBatches)
        .values(generated)
        .returning();

      return inserted.sort((a, b) => a.batchNumber - b.batchNumber);
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;

      const [updated] = await db
        .update(campaignBatches)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(campaignBatches.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Batch não encontrado" });
      return updated;
    }),

  regenerate: adminProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const assignedBatchIds = await db
        .select({ batchId: campaignBatchAssignments.batchId })
        .from(campaignBatchAssignments);
      const usedIds = new Set(assignedBatchIds.map(r => r.batchId));

      const existingBatches = await db
        .select()
        .from(campaignBatches)
        .where(eq(campaignBatches.year, input.year));

      const hasAssigned = existingBatches.some(b => usedIds.has(b.id));
      if (hasAssigned) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não é possível regenerar batches que já têm campanhas atribuídas. Edite-os individualmente.",
        });
      }

      await db.delete(campaignBatches).where(eq(campaignBatches.year, input.year));

      const generated = generateBatchesForYear(input.year);
      const inserted = await db.insert(campaignBatches).values(generated).returning();

      return inserted.sort((a, b) => a.batchNumber - b.batchNumber);
    }),

  getCampaignBatches: protectedProcedure
    .input(z.object({ campaignId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const assignments = await db
        .select({
          id: campaignBatchAssignments.id,
          campaignId: campaignBatchAssignments.campaignId,
          batchId: campaignBatchAssignments.batchId,
          batchNumber: campaignBatches.batchNumber,
          label: campaignBatches.label,
          startDate: campaignBatches.startDate,
          endDate: campaignBatches.endDate,
        })
        .from(campaignBatchAssignments)
        .innerJoin(campaignBatches, eq(campaignBatchAssignments.batchId, campaignBatches.id))
        .where(eq(campaignBatchAssignments.campaignId, input.campaignId))
        .orderBy(asc(campaignBatches.batchNumber));
      return assignments;
    }),

  assignCampaign: protectedProcedure
    .input(z.object({
      campaignId: z.number(),
      batchIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      await db.delete(campaignBatchAssignments)
        .where(eq(campaignBatchAssignments.campaignId, input.campaignId));

      const batchRecords = await db
        .select()
        .from(campaignBatches)
        .where(inArray(campaignBatches.id, input.batchIds))
        .orderBy(asc(campaignBatches.startDate));

      if (batchRecords.length !== input.batchIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Um ou mais batches não encontrados" });
      }

      await db.insert(campaignBatchAssignments).values(
        input.batchIds.map(batchId => ({
          campaignId: input.campaignId,
          batchId,
        }))
      );

      const firstBatch = batchRecords[0];
      const lastBatch = batchRecords[batchRecords.length - 1];
      await db.update(campaigns).set({
        startDate: firstBatch.startDate,
        endDate: lastBatch.endDate,
        updatedAt: new Date(),
      }).where(eq(campaigns.id, input.campaignId));

      return { success: true, count: input.batchIds.length };
    }),

  getBatchCampaigns: protectedProcedure
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const assignments = await db
        .select({
          campaignId: campaignBatchAssignments.campaignId,
          campaignNumber: campaigns.campaignNumber,
          campaignName: campaigns.name,
          status: campaigns.status,
        })
        .from(campaignBatchAssignments)
        .innerJoin(campaigns, eq(campaignBatchAssignments.campaignId, campaigns.id))
        .where(eq(campaignBatchAssignments.batchId, input.batchId));
      return assignments;
    }),
});
