import { adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { crmNotifications, leads, partners } from "../drizzle/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
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
  message: string;
}) {
  try {
    await db.insert(crmNotifications).values({
      eventType: data.eventType,
      leadId: data.leadId ?? null,
      partnerId: data.partnerId ?? null,
      message: data.message,
    });
  } catch (err) {
    console.error("Failed to create CRM notification:", err);
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
          message: crmNotifications.message,
          readAt: crmNotifications.readAt,
          createdAt: crmNotifications.createdAt,
          leadName: leads.name,
          leadCompany: leads.company,
          partnerName: partners.name,
        })
        .from(crmNotifications)
        .leftJoin(leads, eq(crmNotifications.leadId, leads.id))
        .leftJoin(partners, eq(crmNotifications.partnerId, partners.id))
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
});
