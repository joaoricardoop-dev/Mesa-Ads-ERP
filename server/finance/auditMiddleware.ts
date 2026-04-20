import { protectedProcedure } from "../_core/trpc";
import { getDb as getCoreDb } from "../db";
import { recordAudit, type AuditAction, type AuditEntityType, type RecordAuditArgs } from "./audit";
import type { DbClient } from "./payables";

async function getDb(): Promise<DbClient> {
  const d = await getCoreDb();
  if (!d) throw new Error("Database not available");
  return d as unknown as DbClient;
}

export interface AuditMutationConfig<TInput = unknown, TOutput = unknown> {
  entityType: AuditEntityType;
  action: AuditAction;
  /**
   * Carrega o snapshot ANTES da mutação (para diff em update/delete/mark_paid).
   * Pode retornar null. Erros são silenciados — auditoria nunca derruba a escrita.
   */
  loadBefore?: (input: TInput, db: DbClient) => Promise<unknown> | unknown;
  /**
   * Resolve o entityId a registrar. Por padrão usa input.id ou output.id.
   */
  resolveEntityId?: (input: TInput, output: TOutput) => number | null;
  /**
   * Permite reescrever o "after" (ex: pegar primeiro item de array).
   */
  resolveAfter?: (output: TOutput) => unknown;
  /**
   * Metadata extra. Útil pra ações tipo "generate" que afetam vários registros.
   */
  buildMetadata?: (input: TInput, output: TOutput) => Record<string, unknown> | undefined;
  /**
   * Quando true (default), pula a auditoria se o output for null/undefined
   * (mutação que não afetou linhas). Setar false pra ações como "delete"
   * que retornam {ok:true} mas têm before populado.
   */
  skipWhenEmpty?: boolean;
}

/**
 * Aplica o middleware de auditoria sobre QUALQUER procedure base
 * (protectedProcedure, comercialProcedure, financeiroProcedure, etc.)
 * preservando suas checagens de role.
 *
 * Uso:
 *   audited(comercialProcedure, { entityType: "vip_provider", action: "create" })
 *     .input(...)
 *     .mutation(async ({ ctx, input }) => { ... return created; });
 *
 * Captura before -> roda a mutation -> grava em financial_audit_log
 * via recordAudit (best-effort: nunca derruba a mutação principal).
 */
export function audited<P extends { use: (mw: never) => unknown }, TInput = unknown, TOutput = unknown>(
  base: P,
  config: AuditMutationConfig<TInput, TOutput>,
): ReturnType<P["use"]> {
  const middleware = async (opts: {
    ctx: { user: { id: string; role: string | null } | null };
    next: () => Promise<{ ok: boolean; data?: unknown }>;
    getRawInput: () => Promise<unknown>;
  }) => {
    const { ctx, next, getRawInput } = opts;
    const rawInput = (await getRawInput()) as TInput;
    let before: unknown = null;
    if (config.loadBefore) {
      try {
        const db = await getDb();
        before = await config.loadBefore(rawInput, db);
      } catch {
        before = null;
      }
    }

    const result = await next();

    if (result.ok) {
      const out = (result as { ok: true; data: TOutput }).data;
      const after = config.resolveAfter ? config.resolveAfter(out) : (out as unknown);
      const skipEmpty = config.skipWhenEmpty !== false;
      const isEmpty = after === null || after === undefined;
      const hasBefore = before !== null && before !== undefined;
      const shouldRecord = skipEmpty ? !isEmpty : (hasBefore || !isEmpty);

      if (shouldRecord) {
        const inputObj = rawInput as Record<string, unknown> | null;
        const afterObj = after as Record<string, unknown> | null;
        const entityId = config.resolveEntityId
          ? config.resolveEntityId(rawInput, out)
          : ((inputObj?.id as number | undefined)
              ?? (afterObj?.id as number | undefined)
              ?? null);

        const args: RecordAuditArgs = {
          entityType: config.entityType,
          action: config.action,
          entityId,
          before,
          after: skipEmpty ? after : (isEmpty ? null : after),
          metadata: config.buildMetadata?.(rawInput, out),
        };

        try {
          const db = await getDb();
          await recordAudit(db, ctx, args);
        } catch (err) {
          console.warn("[auditMiddleware] failed:", (err as Error)?.message || err);
        }
      }
    }

    return result;
  };

  return base.use(middleware as never) as ReturnType<P["use"]>;
}

/**
 * Atalho para mutações que usam protectedProcedure como base.
 */
export function auditedMutation<TInput = unknown, TOutput = unknown>(
  config: AuditMutationConfig<TInput, TOutput>,
) {
  return audited(protectedProcedure, config);
}
