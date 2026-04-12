import { internalProcedure, anuncianteProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { campaignReports, campaignReportPhotos, campaigns, clients, crmNotifications } from "../drizzle/schema";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

function calcImpressions(input: {
  reportType: string;
  numRestaurants: number;
  coastersDistributed: number;
  usagePerDay: number;
  daysInPeriod: number;
  numScreens: number;
  spotsPerDay: number;
  activationEvents: number;
  peoplePerEvent: number;
}): number {
  const {
    reportType,
    numRestaurants,
    coastersDistributed,
    usagePerDay,
    daysInPeriod,
    numScreens,
    spotsPerDay,
    activationEvents,
    peoplePerEvent,
  } = input;

  if (reportType === "coaster") {
    return coastersDistributed * usagePerDay * daysInPeriod;
  } else if (reportType === "telas") {
    return numScreens * spotsPerDay * daysInPeriod;
  } else if (reportType === "ativacao") {
    return activationEvents * peoplePerEvent;
  }
  return numRestaurants * coastersDistributed * usagePerDay * daysInPeriod;
}

const reportInputSchema = z.object({
  campaignId: z.number().int().positive(),
  title: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string(),
  reportType: z.enum(["coaster", "telas", "ativacao"]).default("coaster"),
  numRestaurants: z.number().int().min(0).default(0),
  coastersDistributed: z.number().int().min(0).default(0),
  usagePerDay: z.number().int().min(0).default(3),
  daysInPeriod: z.number().int().min(0).default(30),
  numScreens: z.number().int().min(0).default(0),
  spotsPerDay: z.number().int().min(0).default(0),
  spotDurationSeconds: z.number().int().min(0).default(30),
  activationEvents: z.number().int().min(0).default(0),
  peoplePerEvent: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const campaignReportRouter = router({
  list: internalProcedure
    .input(z.object({ campaignId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select()
        .from(campaignReports)
        .where(eq(campaignReports.campaignId, input.campaignId))
        .orderBy(desc(campaignReports.createdAt));

      const reportIds = rows.map(r => r.id);
      let photos: Array<typeof campaignReportPhotos.$inferSelect> = [];
      if (reportIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        photos = await db
          .select()
          .from(campaignReportPhotos)
          .where(inArray(campaignReportPhotos.reportId, reportIds))
          .orderBy(campaignReportPhotos.createdAt);
      }

      return rows.map(r => ({
        ...r,
        photos: photos.filter(p => p.reportId === r.id),
      }));
    }),

  create: internalProcedure
    .input(reportInputSchema)
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const totalImpressions = calcImpressions(input);
      const [created] = await db.insert(campaignReports).values({
        campaignId: input.campaignId,
        title: input.title,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        reportType: input.reportType,
        numRestaurants: input.numRestaurants,
        coastersDistributed: input.coastersDistributed,
        usagePerDay: input.usagePerDay,
        daysInPeriod: input.daysInPeriod,
        numScreens: input.numScreens,
        spotsPerDay: input.spotsPerDay,
        spotDurationSeconds: input.spotDurationSeconds,
        activationEvents: input.activationEvents,
        peoplePerEvent: input.peoplePerEvent,
        totalImpressions,
        notes: input.notes ?? null,
      }).returning();
      return created;
    }),

  update: internalProcedure
    .input(reportInputSchema.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...rest } = input;

      const [existing] = await db
        .select()
        .from(campaignReports)
        .where(eq(campaignReports.id, id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado." });

      const merged = { ...existing, ...rest };
      const totalImpressions = calcImpressions({
        reportType: merged.reportType,
        numRestaurants: merged.numRestaurants,
        coastersDistributed: merged.coastersDistributed,
        usagePerDay: merged.usagePerDay,
        daysInPeriod: merged.daysInPeriod,
        numScreens: merged.numScreens,
        spotsPerDay: merged.spotsPerDay,
        activationEvents: merged.activationEvents,
        peoplePerEvent: merged.peoplePerEvent,
      });

      const [updated] = await db
        .update(campaignReports)
        .set({ ...rest, totalImpressions, updatedAt: new Date() })
        .where(eq(campaignReports.id, id))
        .returning();
      return updated;
    }),

  publish: internalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [report] = await db
        .select({ id: campaignReports.id, campaignId: campaignReports.campaignId, title: campaignReports.title, publishedAt: campaignReports.publishedAt })
        .from(campaignReports)
        .where(eq(campaignReports.id, input.id))
        .limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado." });

      const [updated] = await db
        .update(campaignReports)
        .set({ publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(campaignReports.id, input.id))
        .returning();

      const [campaign] = await db
        .select({ clientId: campaigns.clientId, name: campaigns.name })
        .from(campaigns)
        .where(eq(campaigns.id, report.campaignId))
        .limit(1);

      if (campaign) {
        try {
          await db.insert(crmNotifications).values({
            eventType: "report_published",
            message: `Relatório "${report.title}" publicado para a campanha "${campaign.name}".`,
            leadId: null,
            partnerId: null,
            campaignId: report.campaignId,
            clientId: campaign.clientId ?? null,
          });
        } catch (err) {
          console.error("Failed to create report_published notification:", err);
        }
      }

      return updated;
    }),

  delete: internalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(campaignReports).where(eq(campaignReports.id, input.id));
      return { success: true };
    }),

  addPhoto: internalProcedure
    .input(z.object({
      reportId: z.number().int().positive(),
      url: z.string().min(1),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [photo] = await db.insert(campaignReportPhotos).values({
        reportId: input.reportId,
        url: input.url,
        caption: input.caption ?? null,
      }).returning();
      return photo;
    }),

  deletePhoto: internalProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(campaignReportPhotos).where(eq(campaignReportPhotos.id, input.id));
      return { success: true };
    }),

  getForPortal: anuncianteProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDatabase();

      const userClientId = ctx.user?.clientId;
      if (!userClientId || userClientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso não permitido." });
      }

      const campaignRows = await db
        .select({ id: campaigns.id, name: campaigns.name })
        .from(campaigns)
        .where(eq(campaigns.clientId, input.clientId));

      if (campaignRows.length === 0) return [];

      const { inArray } = await import("drizzle-orm");
      const campaignIds = campaignRows.map(c => c.id);

      const reports = await db
        .select()
        .from(campaignReports)
        .where(and(
          inArray(campaignReports.campaignId, campaignIds),
          isNotNull(campaignReports.publishedAt)
        ))
        .orderBy(desc(campaignReports.publishedAt));

      const reportIds = reports.map(r => r.id);
      let photos: Array<typeof campaignReportPhotos.$inferSelect> = [];
      if (reportIds.length > 0) {
        photos = await db
          .select()
          .from(campaignReportPhotos)
          .where(inArray(campaignReportPhotos.reportId, reportIds))
          .orderBy(campaignReportPhotos.createdAt);
      }

      return reports.map(r => ({
        ...r,
        campaignName: campaignRows.find(c => c.id === r.campaignId)?.name ?? null,
        photos: photos.filter(p => p.reportId === r.id),
      }));
    }),
});
