import { internalProcedure, comercialProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { contacts, clients, restaurants, leads } from "../drizzle/schema";
import { eq, desc, sql, inArray, isNotNull, or, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const contactRouter = router({
  list: internalProcedure
    .input(z.object({ clientId: z.number().optional(), restaurantId: z.number().optional(), leadId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      if (input.leadId) {
        return db.select().from(contacts).where(eq(contacts.leadId, input.leadId))
          .orderBy(desc(contacts.isPrimary), desc(contacts.createdAt));
      }
      if (input.clientId) {
        return db.select().from(contacts).where(eq(contacts.clientId, input.clientId))
          .orderBy(desc(contacts.isPrimary), desc(contacts.createdAt));
      }
      if (input.restaurantId) {
        return db.select().from(contacts).where(eq(contacts.restaurantId, input.restaurantId))
          .orderBy(desc(contacts.isPrimary), desc(contacts.createdAt));
      }
      return [];
    }),

  listByClients: internalProcedure
    .input(z.object({ clientIds: z.array(z.number()).min(1) }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select({
          id: contacts.id,
          clientId: contacts.clientId,
          clientName: clients.name,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          role: contacts.role,
          notes: contacts.notes,
          isPrimary: contacts.isPrimary,
          createdAt: contacts.createdAt,
        })
        .from(contacts)
        .leftJoin(clients, eq(contacts.clientId, clients.id))
        .where(inArray(contacts.clientId, input.clientIds))
        .orderBy(desc(contacts.isPrimary), desc(contacts.createdAt));
    }),

  listAll: internalProcedure
    .query(async () => {
      const db = await getDatabase();
      const rows = await db.execute(sql`
        SELECT c.*,
          cl."name" AS "clientName",
          r."name" AS "restaurantName",
          l."name" AS "leadName",
          CASE
            WHEN c."clientId" IS NOT NULL THEN 'anunciante'
            WHEN c."restaurantId" IS NOT NULL THEN 'restaurante'
            WHEN c."leadId" IS NOT NULL THEN 'lead'
            ELSE 'outro'
          END AS "ownerType"
        FROM contacts c
        LEFT JOIN clients cl ON c."clientId" = cl."id"
        LEFT JOIN restaurants r ON c."restaurantId" = r."id"
        LEFT JOIN leads l ON c."leadId" = l."id"
        ORDER BY c."createdAt" DESC
      `);
      return rows.rows as any[];
    }),

  create: comercialProcedure
    .input(z.object({
      clientId: z.number().optional(),
      restaurantId: z.number().optional(),
      leadId: z.number().optional(),
      name: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
      notes: z.string().optional(),
      isPrimary: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      if (!input.clientId && !input.restaurantId && !input.leadId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "clientId, restaurantId ou leadId é obrigatório" });
      }
      if (input.isPrimary) {
        if (input.clientId) {
          await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.clientId, input.clientId));
        } else if (input.restaurantId) {
          await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.restaurantId, input.restaurantId));
        } else if (input.leadId) {
          await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.leadId, input.leadId));
        }
      }
      const [created] = await db.insert(contacts).values(input).returning();
      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
      notes: z.string().optional(),
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      if (data.isPrimary) {
        const [existing] = await db.select({ clientId: contacts.clientId, restaurantId: contacts.restaurantId, leadId: contacts.leadId }).from(contacts).where(eq(contacts.id, id));
        if (existing) {
          if (existing.clientId) {
            await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.clientId, existing.clientId));
          } else if (existing.restaurantId) {
            await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.restaurantId, existing.restaurantId));
          } else if (existing.leadId) {
            await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.leadId, existing.leadId));
          }
        }
      }
      const [updated] = await db
        .update(contacts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado" });
      return updated;
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(contacts).where(eq(contacts.id, input.id));
      return { success: true };
    }),

  copyToClient: comercialProcedure
    .input(z.object({ contactId: z.number(), clientId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [existing] = await db.select().from(contacts).where(eq(contacts.id, input.contactId));
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado" });
      const [copied] = await db.insert(contacts).values({
        clientId: input.clientId,
        name: existing.name,
        email: existing.email,
        phone: existing.phone,
        role: existing.role,
        notes: existing.notes,
        isPrimary: false,
      }).returning();
      return copied;
    }),
});
