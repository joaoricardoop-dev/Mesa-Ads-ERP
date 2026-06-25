import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { systemConfig } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { PREMISSAS_DEFAULTS, type SystemPremissas } from "../shared/premissas";

/**
 * Valores padrão usados como fallback quando a tabela ainda não foi populada.
 * Reexporta a fonte canônica única (`shared/premissas.ts`) — não duplicar.
 */
export const SYSTEM_CONFIG_DEFAULTS = PREMISSAS_DEFAULTS;

export type { SystemPremissas };

/**
 * Fonte de verdade das premissas globais (IRPJ/comissões/BV) em formato decimal.
 * Lê de `system_config`; cai nos defaults se ausente. Nunca lança — sempre
 * retorna um snapshot utilizável.
 */
export async function getSystemConfig(): Promise<SystemPremissas> {
  try {
    const db = await getDb();
    if (!db) return { ...SYSTEM_CONFIG_DEFAULTS };
    const rows = await db.select().from(systemConfig);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    const num = (key: keyof SystemPremissas) => {
      const parsed = parseFloat(map[key] ?? "");
      return Number.isFinite(parsed) ? parsed : SYSTEM_CONFIG_DEFAULTS[key];
    };
    return {
      irpj: num("irpj"),
      comissaoRestaurante: num("comissaoRestaurante"),
      comissaoComercial: num("comissaoComercial"),
      bvPadraoAgencia: num("bvPadraoAgencia"),
    };
  } catch (err) {
    console.error("getSystemConfig failed, using defaults:", err);
    return { ...SYSTEM_CONFIG_DEFAULTS };
  }
}

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

const ALLOWED_KEYS = ["irpj", "comissaoRestaurante", "comissaoComercial", "bvPadraoAgencia"] as const;

export const systemConfigRouter = router({
  /** Retorna { key: value } cru + metadados de última atualização. */
  getAll: protectedProcedure.query(async () => {
    const db = await getDatabase();
    const rows = await db.select().from(systemConfig);
    const values: Record<string, string> = {};
    let updatedAt: Date | null = null;
    let updatedBy: string | null = null;
    for (const row of rows) {
      values[row.key] = row.value;
      if (!updatedAt || (row.updatedAt && row.updatedAt > updatedAt)) {
        updatedAt = row.updatedAt;
        updatedBy = row.updatedBy ?? null;
      }
    }
    return { values, updatedAt, updatedBy };
  }),

  set: adminProcedure
    .input(z.object({ key: z.enum(ALLOWED_KEYS), value: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      await db
        .insert(systemConfig)
        .values({ key: input.key, value: input.value, updatedBy: ctx.user?.id ?? null })
        .onConflictDoUpdate({
          target: systemConfig.key,
          set: { value: input.value, updatedAt: new Date(), updatedBy: ctx.user?.id ?? null },
        });
      return { success: true };
    }),

  setMany: adminProcedure
    .input(z.array(z.object({ key: z.enum(ALLOWED_KEYS), value: z.string() })))
    .mutation(async ({ input, ctx }) => {
      const db = await getDatabase();
      for (const entry of input) {
        await db
          .insert(systemConfig)
          .values({ key: entry.key, value: entry.value, updatedBy: ctx.user?.id ?? null })
          .onConflictDoUpdate({
            target: systemConfig.key,
            set: { value: entry.value, updatedAt: new Date(), updatedBy: ctx.user?.id ?? null },
          });
      }
      return { success: true };
    }),
});
