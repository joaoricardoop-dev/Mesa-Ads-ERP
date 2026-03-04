import { comercialProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { leads, leadInteractions } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const VALID_STAGES = ["novo", "contato", "qualificado", "proposta", "negociacao", "ganho", "perdido"] as const;

export const leadRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.enum(["anunciante", "restaurante"]).optional(),
      stage: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.type) conditions.push(eq(leads.type, input.type));
      if (input?.stage) conditions.push(eq(leads.stage, input.stage));
      return db
        .select()
        .from(leads)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(leads.updatedAt));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const result = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      return result[0];
    }),

  create: comercialProcedure
    .input(z.object({
      type: z.enum(["anunciante", "restaurante"]),
      name: z.string().min(1),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      razaoSocial: z.string().optional(),
      address: z.string().optional(),
      addressNumber: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      contactWhatsApp: z.string().optional(),
      instagram: z.string().optional(),
      origin: z.string().optional(),
      stage: z.string().default("novo"),
      assignedTo: z.string().optional(),
      nextFollowUp: z.string().optional(),
      tags: z.string().optional(),
      notes: z.string().optional(),
      opportunityType: z.enum(["new", "upsell"]).optional(),
      revenueType: z.enum(["mrr", "oneshot"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [created] = await db.insert(leads).values(input).returning();
      return created;
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      type: z.enum(["anunciante", "restaurante"]).optional(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      razaoSocial: z.string().optional(),
      address: z.string().optional(),
      addressNumber: z.string().optional(),
      neighborhood: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      contactWhatsApp: z.string().optional(),
      instagram: z.string().optional(),
      origin: z.string().optional(),
      stage: z.string().optional(),
      assignedTo: z.string().optional(),
      nextFollowUp: z.string().nullable().optional(),
      tags: z.string().optional(),
      notes: z.string().optional(),
      opportunityType: z.enum(["new", "upsell"]).nullable().optional(),
      revenueType: z.enum(["mrr", "oneshot"]).nullable().optional(),
      convertedToId: z.number().optional(),
      convertedToType: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...data } = input;
      const [updated] = await db
        .update(leads)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(leads.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });
      return updated;
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      await db.delete(leadInteractions).where(eq(leadInteractions.leadId, input.id));
      await db.delete(leads).where(eq(leads.id, input.id));
      return { success: true };
    }),

  changeStage: comercialProcedure
    .input(z.object({
      id: z.number(),
      stage: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [updated] = await db
        .update(leads)
        .set({ stage: input.stage, updatedAt: new Date() })
        .where(eq(leads.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado" });

      await db.insert(leadInteractions).values({
        leadId: input.id,
        type: "note",
        content: `Estágio alterado para: ${input.stage}`,
      });

      return updated;
    }),

  listInteractions: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select()
        .from(leadInteractions)
        .where(eq(leadInteractions.leadId, input.leadId))
        .orderBy(desc(leadInteractions.createdAt));
    }),

  addInteraction: comercialProcedure
    .input(z.object({
      leadId: z.number(),
      type: z.string(),
      content: z.string().optional(),
      contactedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [created] = await db.insert(leadInteractions).values(input).returning();

      await db
        .update(leads)
        .set({ updatedAt: new Date() })
        .where(eq(leads.id, input.leadId));

      return created;
    }),
});
