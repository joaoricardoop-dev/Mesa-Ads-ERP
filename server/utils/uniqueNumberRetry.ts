/**
 * Shared helpers for resilient generation of human-readable, sequential
 * business numbers (campaignNumber, quotationNumber, invoiceNumber, orderNumber).
 *
 * The generators in this codebase follow the pattern:
 *   1. SELECT MAX(<col>) WHERE <col> LIKE 'PREFIX-%'
 *   2. Increment the suffix
 *   3. INSERT row with the new number
 *
 * Steps 1–3 are NOT atomic across concurrent transactions: two requests can
 * read the same MAX before either commits, then race to INSERT and one of them
 * trips the UNIQUE constraint with PostgreSQL error code 23505.
 *
 * `withUniqueRetry` wraps the entire "generate + insert" operation in a small
 * retry loop, so on a unique-violation we regenerate the number from a fresh
 * SELECT MAX (which now sees the winner's commit) and try again.
 *
 * Inside a Drizzle transaction, a failed INSERT aborts the whole transaction,
 * so the retry must be wrapped AROUND `db.transaction(...)` (not inside it).
 */

export const PG_UNIQUE_VIOLATION = "23505";

export type PgError = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  detail?: string;
  table?: string;
  message?: string;
};

export function isUniqueViolation(err: unknown, constraintName?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as PgError & { cause?: unknown };
  const code = e.code ?? (e.cause && typeof e.cause === "object" ? (e.cause as PgError).code : undefined);
  if (code !== PG_UNIQUE_VIOLATION) return false;
  if (!constraintName) return true;
  const c =
    e.constraint ||
    e.constraint_name ||
    (e.cause && typeof e.cause === "object"
      ? (e.cause as PgError).constraint || (e.cause as PgError).constraint_name
      : undefined);
  return c === constraintName;
}

export type WithUniqueRetryOptions = {
  /** Optional UNIQUE constraint name to scope the retry. If omitted, retries on ANY 23505. */
  constraintName?: string;
  /** Total attempts including the first one. Default 5. */
  maxRetries?: number;
  /** Optional callback invoked on each retry (after a 23505 was caught). Useful for logging/tests. */
  onRetry?: (attempt: number, err: unknown) => void;
};

/**
 * Run `fn` and retry on PostgreSQL unique-violation errors. Any other error
 * propagates immediately.
 */
export async function withUniqueRetry<T>(
  fn: () => Promise<T>,
  opts: WithUniqueRetryOptions = {},
): Promise<T> {
  const { constraintName, maxRetries = 5, onRetry } = opts;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isUniqueViolation(err, constraintName)) throw err;
      onRetry?.(attempt, err);
    }
  }
  throw lastErr;
}

/**
 * Build a user-facing error message from a database/system error so that
 * frontends and operators can tell which constraint or condition tripped,
 * instead of seeing a single generic "Erro ao processar assinatura".
 */
export function describeDbError(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const e = err as PgError & { cause?: unknown };
  const code = e.code ?? (e.cause && typeof e.cause === "object" ? (e.cause as PgError).code : undefined);
  const constraint =
    e.constraint ||
    e.constraint_name ||
    (e.cause && typeof e.cause === "object"
      ? (e.cause as PgError).constraint || (e.cause as PgError).constraint_name
      : undefined);
  const detail =
    e.detail || (e.cause && typeof e.cause === "object" ? (e.cause as PgError).detail : undefined);
  const message =
    e.message || (e.cause && typeof e.cause === "object" ? (e.cause as PgError).message : undefined);

  if (code === PG_UNIQUE_VIOLATION) {
    const target = constraint ? ` (${constraint})` : "";
    return `Conflito de unicidade no banco${target}. Por favor, tente novamente.`;
  }
  if (code) {
    const parts = [`Erro de banco (${code})`];
    if (constraint) parts.push(`constraint=${constraint}`);
    if (detail) parts.push(detail);
    else if (message) parts.push(message);
    return parts.join(" — ");
  }
  if (message) return `${fallback}: ${message}`;
  return fallback;
}
