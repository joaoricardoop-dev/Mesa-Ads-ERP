import type { DbClient } from "./payables";
import { financialAuditLog } from "../../drizzle/schema";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "mark_paid"
  | "revert_payment"
  | "cancel"
  | "generate";

export type AuditEntityType =
  | "invoice"
  | "accounts_payable"
  | "operational_cost"
  | "vip_provider"
  | "partner"
  | "restaurant_payment";

export interface AuditCtx {
  user: { id: string; role: string | null } | null;
}

export interface RecordAuditArgs {
  entityType: AuditEntityType;
  entityId: number | null;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

function toJsonable(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v !== "object") return null;
  // Drizzle row objects with Date / number / string — JSON-serialize through
  // a roundtrip so timestamps become strings and we don't store Date refs.
  return JSON.parse(JSON.stringify(v, (_k, val) => {
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
}

/**
 * Insere uma linha em financial_audit_log. Best-effort: em caso de falha,
 * loga warning mas NÃO interrompe a operação principal (auditoria nunca pode
 * derrubar uma escrita financeira).
 */
export async function recordAudit(
  db: DbClient,
  ctx: AuditCtx,
  args: RecordAuditArgs,
): Promise<void> {
  try {
    await db.insert(financialAuditLog).values({
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      actorUserId: ctx.user?.id ?? null,
      actorRole: ctx.user?.role ?? null,
      before: toJsonable(args.before),
      after: toJsonable(args.after),
      metadata: args.metadata ? toJsonable(args.metadata) : null,
    });
  } catch (err) {
    console.warn("[audit] failed to write audit log:", (err as Error)?.message || err);
  }
}
