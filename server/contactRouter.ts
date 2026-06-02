import { internalProcedure, comercialProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { contacts, clients, activeRestaurants, leads } from "../drizzle/schema";
import { eq, desc, sql, inArray, isNotNull, or, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { toCsv } from "./_core/csv";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

function buildContactsWhere(input?: {
  search?: string;
  ownerType?: "anunciante" | "restaurante" | "lead";
  clientId?: number;
  restaurantId?: number;
  leadId?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const conditions = [];
  if (input?.clientId) conditions.push(sql`c."clientId" = ${input.clientId}`);
  if (input?.restaurantId) conditions.push(sql`c."restaurantId" = ${input.restaurantId}`);
  if (input?.leadId) conditions.push(sql`c."leadId" = ${input.leadId}`);

  if (input?.ownerType === "anunciante") conditions.push(sql`c."clientId" IS NOT NULL`);
  else if (input?.ownerType === "restaurante") conditions.push(sql`c."restaurantId" IS NOT NULL`);
  else if (input?.ownerType === "lead") conditions.push(sql`c."leadId" IS NOT NULL AND c."clientId" IS NULL AND c."restaurantId" IS NULL`);

  const term = input?.search?.trim();
  if (term) {
    const like = `%${term}%`;
    conditions.push(sql`(
      c."name" ILIKE ${like}
      OR c."email" ILIKE ${like}
      OR c."phone" ILIKE ${like}
      OR cl."name" ILIKE ${like}
      OR r."name" ILIKE ${like}
      OR l."name" ILIKE ${like}
    )`);
  }

  if (input?.dateFrom) conditions.push(sql`c."createdAt" >= ${input.dateFrom}`);
  if (input?.dateTo) conditions.push(sql`c."createdAt" < (${input.dateTo}::date + interval '1 day')`);

  return conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
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
    .input(z.object({
      search: z.string().optional(),
      ownerType: z.enum(["anunciante", "restaurante", "lead"]).optional(),
      clientId: z.number().optional(),
      restaurantId: z.number().optional(),
      leadId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const whereSql = buildContactsWhere(input);

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
        LEFT JOIN active_restaurants r ON c."restaurantId" = r."id"
        LEFT JOIN leads l ON c."leadId" = l."id"
        ${whereSql}
        ORDER BY c."createdAt" DESC
      `);
      return rows.rows as any[];
    }),

  exportCsv: internalProcedure
    .input(z.object({
      search: z.string().optional(),
      ownerType: z.enum(["anunciante", "restaurante", "lead"]).optional(),
      clientId: z.number().optional(),
      restaurantId: z.number().optional(),
      leadId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const whereSql = buildContactsWhere(input);

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
        LEFT JOIN active_restaurants r ON c."restaurantId" = r."id"
        LEFT JOIN leads l ON c."leadId" = l."id"
        ${whereSql}
        ORDER BY c."createdAt" DESC
      `);

      const ownerTypeLabel: Record<string, string> = {
        anunciante: "Anunciante",
        restaurante: "Restaurante",
        lead: "Lead",
        outro: "—",
      };
      const headers = ["ID", "Nome", "Cargo", "E-mail", "Telefone", "Vínculo", "Tipo", "Principal", "Criado em"];
      const data = (rows.rows as any[]).map((r) => [
        r.id,
        r.name,
        r.role,
        r.email,
        r.phone,
        r.clientName || r.restaurantName || r.leadName || "",
        ownerTypeLabel[r.ownerType] ?? r.ownerType,
        r.isPrimary ? "Sim" : "Não",
        r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "",
      ]);
      return { filename: `contatos-${new Date().toISOString().slice(0, 10)}.csv`, csv: toCsv(headers, data) };
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
