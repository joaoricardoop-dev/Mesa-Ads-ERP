import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { configOptions } from "../drizzle/schema";
import { and, eq, asc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const CONFIG_OPTION_TYPES = ["loss_reason", "origin_category", "screen_category"] as const;
export type ConfigOptionType = (typeof CONFIG_OPTION_TYPES)[number];

const typeSchema = z.enum(CONFIG_OPTION_TYPES);

// Gera um code estável a partir do label. Para origin_category preservamos o
// próprio label como code (compatível com leads.origin legado, que guarda o
// label). Para loss_reason geramos um slug ascii.
function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

function deriveCode(type: ConfigOptionType, label: string): string {
  const trimmed = label.trim();
  if (type === "origin_category") return trimmed.slice(0, 120);
  const slug = slugify(trimmed);
  return slug || "opcao";
}

/**
 * Retorna o conjunto de codes ATIVOS de um tipo. Usado pelos routers de
 * oportunidade/cotação para validar lossReason contra a fonte única.
 */
export async function getActiveConfigCodes(type: ConfigOptionType): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db
    .select({ code: configOptions.code })
    .from(configOptions)
    .where(and(eq(configOptions.type, type), eq(configOptions.isActive, true)));
  return new Set(rows.map((r) => r.code));
}

/**
 * Retorna um mapa code→label de um tipo (inclui inativos, para que registros
 * históricos com código já desativado ainda exibam o label correto). Usado por
 * consumidores server-side que renderizam labels (ex.: dashboard comercial),
 * garantindo que todo display saia da mesma fonte única que o admin edita.
 */
export async function getConfigLabels(type: ConfigOptionType): Promise<Map<string, string>> {
  const db = await getDatabase();
  const rows = await db
    .select({ code: configOptions.code, label: configOptions.label })
    .from(configOptions)
    .where(eq(configOptions.type, type));
  return new Map(rows.map((r) => [r.code, r.label]));
}

export const configOptionRouter = router({
  // Leitura para preencher selects (qualquer usuário interno autenticado).
  list: protectedProcedure
    .input(z.object({
      type: typeSchema,
      includeInactive: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const conditions = [eq(configOptions.type, input.type)];
      if (!input.includeInactive) conditions.push(eq(configOptions.isActive, true));
      return db
        .select()
        .from(configOptions)
        .where(and(...conditions))
        .orderBy(asc(configOptions.sortOrder), asc(configOptions.label));
    }),

  // Admin: lista completa (inclui inativos) para a tela de configurações.
  listAdmin: adminProcedure
    .input(z.object({ type: typeSchema }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      return db
        .select()
        .from(configOptions)
        .where(eq(configOptions.type, input.type))
        .orderBy(asc(configOptions.sortOrder), asc(configOptions.label));
    }),

  create: adminProcedure
    .input(z.object({
      type: typeSchema,
      label: z.string().min(1).max(200),
      sortOrder: z.number().int().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const label = input.label.trim();
      if (!label) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um rótulo." });
      const code = deriveCode(input.type, label);

      const existing = await db
        .select({ id: configOptions.id, isActive: configOptions.isActive })
        .from(configOptions)
        .where(and(eq(configOptions.type, input.type), eq(configOptions.code, code)))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: existing[0].isActive
            ? "Já existe um item com esse rótulo."
            : "Já existe um item (inativo) com esse rótulo. Reative-o em vez de criar um novo.",
        });
      }

      let sortOrder = input.sortOrder;
      if (sortOrder == null) {
        const [{ max }] = await db
          .select({ max: sql<number>`COALESCE(MAX(${configOptions.sortOrder}), -1)` })
          .from(configOptions)
          .where(eq(configOptions.type, input.type));
        sortOrder = (max ?? -1) + 1;
      }

      const [row] = await db.insert(configOptions).values({
        type: input.type,
        code,
        label,
        sortOrder,
      }).returning();
      return row;
    }),

  // Edita label / ordem / ativo. O `code` é imutável (preserva referências
  // já gravadas em oportunidades, cotações e leads).
  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      label: z.string().min(1).max(200).optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.label != null) {
        const label = input.label.trim();
        if (!label) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um rótulo." });
        patch.label = label;
      }
      if (input.sortOrder != null) patch.sortOrder = input.sortOrder;
      if (input.isActive != null) patch.isActive = input.isActive;
      const [row] = await db
        .update(configOptions)
        .set(patch)
        .where(eq(configOptions.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado." });
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.delete(configOptions).where(eq(configOptions.id, input.id)).returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Item não encontrado." });
      return rows[0];
    }),
});
