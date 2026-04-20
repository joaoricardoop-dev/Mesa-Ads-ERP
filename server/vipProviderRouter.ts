import { comercialProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { vipProviders, products, accountsPayable } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

// Compat alias (finrefac fase 1): aceita tanto `commissionPercent` quanto
// `repassePercent` como input. Internamente normaliza pra `repassePercent`
// (nome correto do glossário). Remover em fase 4 quando todos os clientes
// estiverem migrados.
type RepasseAliasInput = {
  commissionPercent?: string;
  repassePercent?: string;
};

function normalizeRepasseInput<T extends RepasseAliasInput>(
  data: T,
): Omit<T, "commissionPercent" | "repassePercent"> & { repassePercent?: string } {
  const { commissionPercent, repassePercent, ...rest } = data;
  const value = repassePercent ?? commissionPercent;
  if (value !== undefined && commissionPercent !== undefined && repassePercent === undefined) {
    console.warn("[vipProvider] input usando alias legado `commissionPercent` — migrar para `repassePercent`.");
  }
  const base = rest as Omit<T, "commissionPercent" | "repassePercent">;
  return value !== undefined ? { ...base, repassePercent: value } : base;
}

// Adiciona o alias legado `commissionPercent` no output para clientes antigos.
function withLegacyCommissionAlias<T extends { repassePercent: string }>(
  row: T,
): T & { commissionPercent: string } {
  return { ...row, commissionPercent: row.repassePercent };
}

export const vipProviderRouter = router({
  list: comercialProcedure
    .input(z.object({
      status: z.enum(["active", "inactive"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [];
      if (input?.status) conditions.push(eq(vipProviders.status, input.status));

      const rows = await db
        .select()
        .from(vipProviders)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(vipProviders.createdAt));

      // Para cada provider, contar produtos vinculados e total já pago de repasse
      const result = await Promise.all(rows.map(async (p) => {
        const productsCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(products)
          .where(eq(products.vipProviderId, p.id));

        const paidSum = await db
          .select({ total: sql<string>`COALESCE(SUM(${accountsPayable.amount}), 0)` })
          .from(accountsPayable)
          .where(and(
            eq(accountsPayable.vipProviderId, p.id),
            eq(accountsPayable.status, "pago"),
          ));

        return withLegacyCommissionAlias({
          ...p,
          productsCount: Number(productsCount[0]?.count || 0),
          totalPaid: paidSum[0]?.total ?? "0",
        });
      }));

      return result;
    }),

  get: comercialProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const [provider] = await db
        .select()
        .from(vipProviders)
        .where(eq(vipProviders.id, input.id))
        .limit(1);
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provedor Sala VIP não encontrado" });
      return withLegacyCommissionAlias(provider);
    }),

  create: comercialProcedure
    .input(z.object({
      name: z.string().min(1),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      location: z.string().optional(),
      // alias legado aceito por compatibilidade — preferir `repassePercent`
      commissionPercent: z.string().optional(),
      repassePercent: z.string().optional(),
      billingMode: z.enum(["bruto", "liquido"]).default("bruto"),
      status: z.enum(["active", "inactive"]).default("active"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const normalized = normalizeRepasseInput(input);
      const values = { ...normalized, repassePercent: normalized.repassePercent ?? "10.00" };
      const [created] = await db.insert(vipProviders).values(values).returning();
      return withLegacyCommissionAlias(created);
    }),

  update: comercialProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      location: z.string().optional(),
      commissionPercent: z.string().optional(),
      repassePercent: z.string().optional(),
      billingMode: z.enum(["bruto", "liquido"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const { id, ...rest } = input;
      const data = normalizeRepasseInput(rest);
      const [updated] = await db
        .update(vipProviders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(vipProviders.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Provedor Sala VIP não encontrado" });
      return withLegacyCommissionAlias(updated);
    }),

  delete: comercialProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      // Checar se há produtos vinculados antes de deletar
      const [linked] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(eq(products.vipProviderId, input.id));
      if (Number(linked?.count || 0) > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Não é possível excluir: existem produtos vinculados a este provedor. Desvincule-os primeiro.",
        });
      }
      await db.delete(vipProviders).where(eq(vipProviders.id, input.id));
      return { success: true };
    }),

  // Relatório de repasses por provedor
  getPayables: comercialProcedure
    .input(z.object({
      vipProviderId: z.number(),
      status: z.enum(["pendente", "pago", "cancelado"]).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [eq(accountsPayable.vipProviderId, input.vipProviderId)];
      if (input.status) conditions.push(eq(accountsPayable.status, input.status));

      const rows = await db
        .select()
        .from(accountsPayable)
        .where(and(...conditions))
        .orderBy(desc(accountsPayable.createdAt));

      return rows;
    }),
});
