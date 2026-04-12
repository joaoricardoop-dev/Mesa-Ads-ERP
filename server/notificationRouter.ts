import { adminProcedure, anuncianteProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { crmNotifications, leads, partners, clients } from "../drizzle/schema";
import { eq, isNull, desc, and, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/neon-serverless";

type Db = ReturnType<typeof drizzle>;

async function getDatabase(): Promise<Db> {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d as Db;
}

export async function createCrmNotification(db: Db, data: {
  eventType: string;
  leadId?: number | null;
  partnerId?: number | null;
  campaignId?: number | null;
  clientId?: number | null;
  message: string;
}) {
  try {
    await db.insert(crmNotifications).values({
      eventType: data.eventType,
      leadId: data.leadId ?? null,
      partnerId: data.partnerId ?? null,
      campaignId: data.campaignId ?? null,
      clientId: data.clientId ?? null,
      message: data.message,
    });
  } catch (err) {
    console.error("Failed to create CRM notification:", err);
  }
}

export async function createCampaignStatusNotification(data: {
  campaignId: number;
  clientId: number;
  status: string;
  message: string;
}) {
  try {
    const db = await getDb();
    if (!db) return;

    const eventType = `campaign_status:${data.status}`;
    const dedupeWindowMs = 60 * 60 * 1000;
    const since = new Date(Date.now() - dedupeWindowMs);
    const existing = await db
      .select({ id: crmNotifications.id })
      .from(crmNotifications)
      .where(
        and(
          eq(crmNotifications.campaignId, data.campaignId),
          eq(crmNotifications.eventType, eventType),
          gte(crmNotifications.createdAt, since)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.insert(crmNotifications).values({
      eventType,
      leadId: null,
      partnerId: null,
      campaignId: data.campaignId,
      clientId: data.clientId,
      message: data.message,
    });
  } catch (err) {
    console.error("Failed to create campaign status notification:", err);
  }
}

export const notificationRouter = router({
  list: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
      eventType: z.enum(["lead_created", "stage_changed", "quotation_created"]).optional(),
      unreadOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();

      const conditions = [];
      if (input?.eventType) conditions.push(eq(crmNotifications.eventType, input.eventType));
      if (input?.unreadOnly) conditions.push(isNull(crmNotifications.readAt));

      const rows = await db
        .select({
          id: crmNotifications.id,
          eventType: crmNotifications.eventType,
          leadId: crmNotifications.leadId,
          partnerId: crmNotifications.partnerId,
          campaignId: crmNotifications.campaignId,
          clientId: crmNotifications.clientId,
          message: crmNotifications.message,
          readAt: crmNotifications.readAt,
          createdAt: crmNotifications.createdAt,
          leadName: leads.name,
          leadCompany: leads.company,
          partnerName: partners.name,
          clientName: clients.name,
        })
        .from(crmNotifications)
        .leftJoin(leads, eq(crmNotifications.leadId, leads.id))
        .leftJoin(partners, eq(crmNotifications.partnerId, partners.id))
        .leftJoin(clients, eq(crmNotifications.clientId, clients.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(crmNotifications.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      return rows;
    }),

  unreadCount: adminProcedure
    .query(async () => {
      const db = await getDatabase();
      const result = await db
        .select({ id: crmNotifications.id })
        .from(crmNotifications)
        .where(isNull(crmNotifications.readAt));
      return { count: result.length };
    }),

  markRead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db
        .update(crmNotifications)
        .set({ readAt: new Date() })
        .where(and(eq(crmNotifications.id, input.id), isNull(crmNotifications.readAt)));
      return { success: true };
    }),

  markAllRead: adminProcedure
    .mutation(async () => {
      const db = await getDatabase();
      await db
        .update(crmNotifications)
        .set({ readAt: new Date() })
        .where(isNull(crmNotifications.readAt));
      return { success: true };
    }),

  listForAnunciante: anuncianteProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
      unreadOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDatabase();
      const clientId = ctx.user?.clientId;
      if (!clientId) return [];

      const conditions = [
        eq(crmNotifications.clientId, clientId),
        sql`${crmNotifications.eventType} LIKE ${"campaign_status:%"}`,
      ];
      if (input?.unreadOnly) conditions.push(isNull(crmNotifications.readAt));

      const rows = await db
        .select({
          id: crmNotifications.id,
          eventType: crmNotifications.eventType,
          campaignId: crmNotifications.campaignId,
          clientId: crmNotifications.clientId,
          message: crmNotifications.message,
          readAt: crmNotifications.readAt,
          createdAt: crmNotifications.createdAt,
        })
        .from(crmNotifications)
        .where(and(...conditions))
        .orderBy(desc(crmNotifications.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      return rows;
    }),

  unreadCountForAnunciante: anuncianteProcedure
    .query(async ({ ctx }) => {
      const db = await getDatabase();
      const clientId = ctx.user?.clientId;
      if (!clientId) return { count: 0 };

      const result = await db
        .select({ id: crmNotifications.id })
        .from(crmNotifications)
        .where(
          and(
            eq(crmNotifications.clientId, clientId),
            sql`${crmNotifications.eventType} LIKE ${"campaign_status:%"}`,
            isNull(crmNotifications.readAt)
          )
        );
      return { count: result.length };
    }),

  markReadForAnunciante: anuncianteProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      const clientId = ctx.user?.clientId;
      if (!clientId) throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(crmNotifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(crmNotifications.id, input.id),
            eq(crmNotifications.clientId, clientId),
            isNull(crmNotifications.readAt)
          )
        );
      return { success: true };
    }),

  markAllReadForAnunciante: anuncianteProcedure
    .mutation(async ({ ctx }) => {
      const db = await getDatabase();
      const clientId = ctx.user?.clientId;
      if (!clientId) throw new TRPCError({ code: "FORBIDDEN" });

      await db
        .update(crmNotifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(crmNotifications.clientId, clientId),
            sql`${crmNotifications.eventType} LIKE ${"campaign_status:%"}`,
            isNull(crmNotifications.readAt)
          )
        );
      return { success: true };
    }),
});
