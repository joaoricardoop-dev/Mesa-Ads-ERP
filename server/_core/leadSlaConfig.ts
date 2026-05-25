import { getDb } from "../db";
import { users } from "../../shared/models/auth";
import { and, eq, sql } from "drizzle-orm";

export const LEAD_SLA_WARNING_DAYS = 7;
export const LEAD_SLA_REASSIGN_DAYS = 14;
export const LEAD_SLA_STAGE = "novo";

const FALLBACK_ROLES = ["admin", "comercial"] as const;

let cachedFallbackUserId: string | null = null;

export async function resolveLeadSlaFallbackUserId(
  options: { force?: boolean } = {},
): Promise<string | null> {
  if (!options.force && cachedFallbackUserId) return cachedFallbackUserId;

  const fromEnv = process.env.LEAD_SLA_FALLBACK_USER_ID?.trim();
  const db = await getDb();
  if (!db) {
    if (fromEnv) {
      cachedFallbackUserId = fromEnv;
      return fromEnv;
    }
    return null;
  }

  if (fromEnv) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, fromEnv), eq(users.isActive, true)))
      .limit(1);
    if (row) {
      cachedFallbackUserId = row.id;
      return row.id;
    }
    console.warn(
      `[LeadSLA] LEAD_SLA_FALLBACK_USER_ID="${fromEnv}" não encontrado em users (ou inativo). Caindo pra primeiro admin.`,
    );
  }

  const [adminRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        sql`${users.role} IN (${sql.join(
          FALLBACK_ROLES.map((r) => sql`${r}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(users.createdAt)
    .limit(1);

  if (adminRow) {
    cachedFallbackUserId = adminRow.id;
    return adminRow.id;
  }

  return null;
}

export async function validateLeadSlaFallbackOnBoot(): Promise<void> {
  const id = await resolveLeadSlaFallbackUserId({ force: true });
  if (!id) {
    console.warn(
      "[LeadSLA] Nenhum usuário fallback disponível (sem LEAD_SLA_FALLBACK_USER_ID e nenhum admin/comercial ativo). Reatribuição automática de leads ficará desabilitada até existir um responsável válido.",
    );
    return;
  }
  console.log(`[LeadSLA] Fallback user id resolvido: ${id}`);
}
