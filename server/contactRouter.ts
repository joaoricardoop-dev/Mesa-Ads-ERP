import { internalProcedure, comercialProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { contacts, clients } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const contactRouter = router({
  list: internalProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select()
        .from(contacts)
        .where(eq(contacts.clientId, input.clientId))
        .orderBy(desc(contacts.isPrimary), desc(contacts.createdAt));
    }),

  listAll: internalProcedure
    .query(async () => {
      const db = await getDatabase();
      const rows = await db
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
        .orderBy(desc(contacts.createdAt));
      return rows;
    }),

  create: comercialProcedure
    .input(z.object({
      clientId: z.number(),
      name: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
      notes: z.string().optional(),
      isPrimary: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      if (input.isPrimary) {
        await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.clientId, input.clientId));
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
        const [existing] = await db.select({ clientId: contacts.clientId }).from(contacts).where(eq(contacts.id, id));
        if (existing) {
          await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.clientId, existing.clientId));
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
});
