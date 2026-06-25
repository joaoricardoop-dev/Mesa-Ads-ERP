import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { clients, leads, quotations } from "../drizzle/schema";

// Garante a invariante da Task #288: depois que o backfill (Task #286) roda,
// nenhuma cotação com `leadId` resolvível continua com `clientId` NULL. O teste
// sobe um banco fresh isolado, semeia cotações órfãs e exercita o MESMO
// backfill que o boot executa (`backfillQuotationClientIdsFromLeads`).
//
// Reusa o padrão de banco temporário de `migrations-fresh-db.spec.ts`: cria um
// database descartável no cluster de teste, aplica o schema completo via
// `runMigrations()` e dropa tudo no final. Nada toca produção nem o banco de
// teste compartilhado.

const FORBIDDEN_HOST_PATTERNS = (process.env.PROD_DB_HOSTS?.split(",") ?? [".neon.tech"])
  .map((s) => s.trim())
  .filter(Boolean);

function pickBaseUrl(): string | null {
  const candidates = [process.env.DATABASE_URL_TEST, process.env.DATABASE_URL].filter(
    Boolean,
  ) as string[];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const host = (url.hostname || "").toLowerCase();
      if (FORBIDDEN_HOST_PATTERNS.some((p) => p && host.includes(p))) continue;
      return candidate;
    } catch {
      // ignore malformed URL
    }
  }
  return null;
}

const TRACKER = "backfill_quotation_client_id_from_lead_task_286";

const baseUrl = pickBaseUrl();
const tempDbName = `mesa_ads_backfill_${randomBytes(6).toString("hex")}`;
let tempDbUrl = "";

test.describe("backfill de clientId em cotações órfãs (Task #288)", () => {
  test.skip(
    !baseUrl,
    "Nenhum DATABASE_URL/DATABASE_URL_TEST seguro disponível (host bate com padrão de produção ou não setado).",
  );

  test.beforeAll(async () => {
    const tmp = new URL(baseUrl!);
    tmp.pathname = "/" + tempDbName;
    tempDbUrl = tmp.toString();

    const admin = new Client({ connectionString: baseUrl! });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE "${tempDbName}"`);
    } finally {
      await admin.end();
    }

    // Aponta o getDb() para o banco temporário antes de importar o módulo de
    // migrations (cache `_db` ainda null neste worker do Playwright).
    process.env.DATABASE_URL = tempDbUrl;

    // Schema completo num banco zerado passa do timeout default.
    test.setTimeout(180_000);
    const migrations = await import("../server/migrations");
    await migrations.runMigrations();
  });

  test.afterAll(async () => {
    if (!tempDbUrl) return;
    const admin = new Client({ connectionString: baseUrl! });
    await admin.connect();
    try {
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`,
        [tempDbName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${tempDbName}"`);
    } catch (err) {
      console.warn(`[task-288] falha ao dropar DB temporário ${tempDbName}:`, err);
    } finally {
      await admin.end();
    }
  });

  test("resolve órfãs (cliente reusado por e-mail, cliente novo, lead removido) e é idempotente", async () => {
    test.setTimeout(120_000);

    const pg = new Client({ connectionString: tempDbUrl });
    await pg.connect();
    const db = drizzle(pg, { schema: { clients, leads, quotations } });

    const { backfillQuotationClientIdsFromLeads } = await import("../server/migrations");

    // Marcadores únicos para escopar asserts e cleanup, isolando de qualquer
    // dado que o `runMigrations()` (backfill no boot) tenha tocado.
    const tag = randomBytes(4).toString("hex");
    const emailExisting = `bf-existing-${tag}@example.com`;
    const emailNew = `bf-new-${tag}@example.com`;

    try {
      // ── Seed ────────────────────────────────────────────────────────────
      // (1) Cliente já existente + lead com o MESMO e-mail → deve reusar.
      const [existingClient] = await db
        .insert(clients)
        .values({ name: "Cliente Existente", contactEmail: emailExisting, status: "active" })
        .returning({ id: clients.id });

      const [leadExisting] = await db
        .insert(leads)
        .values({ type: "anunciante", name: "Lead Existente", contactEmail: emailExisting })
        .returning({ id: leads.id });

      // (2) Lead sem cliente correspondente → deve CRIAR cliente novo.
      const [leadNew] = await db
        .insert(leads)
        .values({ type: "anunciante", name: "Lead Novo", contactEmail: emailNew })
        .returning({ id: leads.id });

      // (3) Lead que será REMOVIDO → órfã não resolvível.
      const [leadGone] = await db
        .insert(leads)
        .values({ type: "anunciante", name: "Lead Removido", contactEmail: `bf-gone-${tag}@example.com` })
        .returning({ id: leads.id });
      const leadGoneId = leadGone.id;
      await db.delete(leads).where(eq(leads.id, leadGoneId));

      // Cotações órfãs (clientId NULL + leadId preenchido).
      const [qReuse] = await db
        .insert(quotations)
        .values({ quotationNumber: `BF-${tag}-1`, clientId: null, leadId: leadExisting.id })
        .returning({ id: quotations.id });
      const [qCreate] = await db
        .insert(quotations)
        .values({ quotationNumber: `BF-${tag}-2`, clientId: null, leadId: leadNew.id })
        .returning({ id: quotations.id });
      const [qUnresolved] = await db
        .insert(quotations)
        .values({ quotationNumber: `BF-${tag}-3`, clientId: null, leadId: leadGoneId })
        .returning({ id: quotations.id });
      // Cotação já vinculada — não deve ser tocada.
      const [qLinked] = await db
        .insert(quotations)
        .values({ quotationNumber: `BF-${tag}-4`, clientId: existingClient.id, leadId: leadExisting.id })
        .returning({ id: quotations.id });

      // O backfill no boot já marcou o tracker; removemos para reexecutá-lo
      // contra as órfãs recém-semeadas.
      await db.execute(
        sql`DELETE FROM "_applied_migrations" WHERE "name" = ${TRACKER}`,
      );

      // ── Run #1 ──────────────────────────────────────────────────────────
      await backfillQuotationClientIdsFromLeads(db);

      const readQuotation = async (id: number) => {
        const [row] = await db
          .select({ id: quotations.id, clientId: quotations.clientId, leadId: quotations.leadId })
          .from(quotations)
          .where(eq(quotations.id, id));
        return row;
      };
      const countNewClients = async () => {
        const rows = await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.contactEmail, emailNew));
        return rows;
      };

      // (1) cliente existente reusado.
      expect((await readQuotation(qReuse.id)).clientId).toBe(existingClient.id);

      // (2) cliente novo criado a partir do lead.
      const newClients = await countNewClients();
      expect(newClients).toHaveLength(1);
      expect((await readQuotation(qCreate.id)).clientId).toBe(newClients[0].id);

      // (3) lead removido → órfã permanece sem clientId (não quebra).
      expect((await readQuotation(qUnresolved.id)).clientId).toBeNull();

      // (4) cotação já vinculada permanece inalterada.
      expect((await readQuotation(qLinked.id)).clientId).toBe(existingClient.id);

      // tracker marcado ao final.
      const trackerRows = await db.execute(
        sql`SELECT 1 FROM "_applied_migrations" WHERE "name" = ${TRACKER}`,
      );
      const trackerCount = Array.isArray(trackerRows)
        ? (trackerRows as any[]).length
        : ((trackerRows as any)?.rows?.length ?? 0);
      expect(trackerCount).toBeGreaterThan(0);

      // ── Idempotência ────────────────────────────────────────────────────
      // (a) com o tracker presente, o backfill é no-op imediato.
      await backfillQuotationClientIdsFromLeads(db);
      expect(await countNewClients()).toHaveLength(1);

      // (b) mesmo forçando a reexecução (tracker removido), não cria clientes
      //     duplicados nem altera cotações já vinculadas — as órfãs agora têm
      //     clientId, então deixam de ser candidatas.
      await db.execute(
        sql`DELETE FROM "_applied_migrations" WHERE "name" = ${TRACKER}`,
      );
      await backfillQuotationClientIdsFromLeads(db);

      expect(await countNewClients()).toHaveLength(1);
      expect((await readQuotation(qReuse.id)).clientId).toBe(existingClient.id);
      expect((await readQuotation(qCreate.id)).clientId).toBe(newClients[0].id);
      expect((await readQuotation(qUnresolved.id)).clientId).toBeNull();
      expect((await readQuotation(qLinked.id)).clientId).toBe(existingClient.id);
    } finally {
      await pg.end();
    }
  });
});
