/**
 * Atomic, race-free generator for human-readable, sequential business numbers
 * (campaignNumber, quotationNumber, invoiceNumber, orderNumber).
 *
 * Backed by the `number_counters` table — one row per (scope, year). The
 * Postgres `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` is atomic per
 * row: concurrent transactions race for the row lock and each gets a distinct
 * incremented value back, eliminating the SELECT MAX → INSERT race that
 * required `withUniqueRetry` to clean up after collisions.
 *
 * Sub-task #173 follow-up: `withUniqueRetry` is kept around the call sites as
 * a safety belt (e.g. for legacy rows inserted with the old generator that
 * could in theory still collide), but the happy path no longer relies on it.
 */

import { sql } from "drizzle-orm";

export type CounterScope =
  | "campaign"
  | "quotation"
  | "invoice"
  | "os_anunciante"
  | "os_producao"
  | "os_distribuicao";

const SCOPE_PREFIX: Record<CounterScope, string> = {
  campaign: "CMP",
  quotation: "QOT",
  invoice: "FAT",
  os_anunciante: "OS-ANT",
  os_producao: "OS-PROD",
  os_distribuicao: "OS-DIST",
};

type DbLike = {
  execute: (query: any) => Promise<unknown>;
};

/**
 * Returns the next integer in the (scope, year) counter, atomically.
 *
 * The first caller for a (scope, year) pair inserts `last_value=1` and gets 1
 * back. Every subsequent caller bumps the existing row by 1 and gets the new
 * value back. The `RETURNING last_value` is evaluated AFTER the row has been
 * locked-and-incremented, so two concurrent transactions are guaranteed to
 * see distinct values.
 */
export async function nextCounterValue(
  db: DbLike,
  scope: CounterScope,
  year: number,
): Promise<number> {
  const result = (await db.execute(sql`
    INSERT INTO "number_counters" ("scope", "year", "last_value")
    VALUES (${scope}, ${year}, 1)
    ON CONFLICT ("scope", "year")
    DO UPDATE SET "last_value" = "number_counters"."last_value" + 1,
                  "updatedAt" = NOW()
    RETURNING "last_value" AS "next_value"
  `)) as unknown;

  // drizzle/neon retorna { rows: [...] } no driver serverless; outros drivers
  // podem retornar Array direto. Suportamos ambos pra robustez (igual padrão
  // já usado em server/_core/index.ts).
  const rows =
    (result as { rows?: Array<{ next_value: number | string }> }).rows ??
    (Array.isArray(result) ? (result as Array<{ next_value: number | string }>) : []);
  const raw = rows[0]?.next_value;
  if (raw == null) {
    throw new Error(
      `[numberCounter] Falha ao obter próximo valor para scope=${scope} year=${year}`,
    );
  }
  return typeof raw === "number" ? raw : parseInt(String(raw), 10);
}

/**
 * Format a counter value into the canonical "PREFIX-YYYY-NNNN" string used
 * across campaigns, quotations, invoices and service orders.
 */
export function formatNumber(scope: CounterScope, year: number, value: number): string {
  return `${SCOPE_PREFIX[scope]}-${year}-${String(value).padStart(4, "0")}`;
}

/**
 * Convenience: next number string for a scope, defaulting to current year.
 */
export async function nextNumber(
  db: DbLike,
  scope: CounterScope,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const value = await nextCounterValue(db, scope, year);
  return formatNumber(scope, year, value);
}
