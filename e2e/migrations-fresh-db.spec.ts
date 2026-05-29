import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../drizzle/schema";

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

/**
 * Extrai o conjunto de colunas declaradas em `drizzle/schema.ts` — a fonte
 * de verdade do ORM. Itera sobre todos os exports do módulo, mantém apenas
 * os que são tabelas Drizzle (`pgTable`) e usa a introspecção do próprio
 * Drizzle (`getTableName` / `getTableColumns`) para obter os nomes REAIS das
 * colunas no banco (a propriedade `.name`, não a chave do objeto JS).
 */
function declaredColumns(): Array<{ table: string; column: string }> {
  const out: Array<{ table: string; column: string }> = [];
  for (const value of Object.values(schema)) {
    if (value && is(value, PgTable)) {
      const tableName = getTableName(value);
      const cols = getTableColumns(value);
      for (const col of Object.values(cols)) {
        out.push({ table: tableName, column: (col as { name: string }).name });
      }
    }
  }
  return out;
}

const baseUrl = pickBaseUrl();
const tempDbName = `mesa_ads_fresh_${randomBytes(6).toString("hex")}`;
let tempDbUrl = "";

test.describe("runMigrations bootstrap em banco fresh (Task #212)", () => {
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

    // Aponta o getDb() (neon-serverless Pool) para o banco temporário antes
    // de importar o módulo de migrations. O cache `_db` em server/db.ts ainda
    // está null neste worker do Playwright, então a primeira chamada a getDb()
    // dentro de runMigrations() vai capturar este DATABASE_URL.
    process.env.DATABASE_URL = tempDbUrl;

    // Rodar 27 arquivos Drizzle + ~80 migrations customizadas contra um banco
    // recém-criado no cluster Neon de teste passa do timeout default; por isso
    // a migration roda aqui no beforeAll (com timeout estendido) e os testes
    // abaixo reaproveitam o banco já migrado.
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
      console.warn(`[task-212] falha ao dropar DB temporário ${tempDbName}:`, err);
    } finally {
      await admin.end();
    }
  });

  test("aplica schema completo num banco zerado e é idempotente em re-execução", async () => {
    // A re-execução de runMigrations() faz outra rodada de ~200 statements
    // serverless; 180s dá folga sem mascarar regressão real de performance.
    test.setTimeout(180_000);

    const migrations = await import("../server/migrations");

    const probe = new Client({ connectionString: tempDbUrl });
    await probe.connect();
    try {
      const keyTables = ["users", "quotations", "campaigns", "partners", "invoices"];
      for (const t of keyTables) {
        const { rows } = await probe.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
          [t],
        );
        expect(rows.length, `tabela "${t}" deveria existir após runMigrations()`).toBe(1);
      }

      const snapshot = async () => {
        const tables = await probe.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
        );
        const cols = await probe.query(
          `SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, column_name`,
        );
        const idx = await probe.query(
          `SELECT indexname FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`,
        );
        const applied = await probe.query(
          `SELECT name FROM _applied_migrations ORDER BY name`,
        );
        return {
          tableCount: tables.rows.length,
          tables: tables.rows.map((r) => r.table_name),
          cols: cols.rows.map(
            (r) => `${r.table_name}.${r.column_name}:${r.data_type}:${r.is_nullable}`,
          ),
          idx: idx.rows.map((r) => r.indexname),
          applied: applied.rows.map((r) => r.name),
        };
      };

      const first = await snapshot();
      expect(first.tableCount, "deveria criar várias tabelas").toBeGreaterThan(5);
      expect(first.applied.length, "deveria registrar migrations aplicadas").toBeGreaterThan(0);

      // Segunda execução: deve ser totalmente idempotente — nenhuma tabela,
      // coluna, índice ou linha de _applied_migrations muda.
      await migrations.runMigrations();
      const second = await snapshot();

      expect(second.tables).toEqual(first.tables);
      expect(second.cols).toEqual(first.cols);
      expect(second.idx).toEqual(first.idx);
      expect(second.applied).toEqual(first.applied);
    } finally {
      await probe.end();
    }
  });

  test("toda coluna de drizzle/schema.ts existe num banco criado só por runMigrations() (Task #224)", async () => {
    // Guardrail para a classe de bug das tasks #213/#221: uma coluna que
    // existe no schema.ts (e portanto no dev DB, via drizzle-kit push) mas
    // nunca foi adicionada por uma migration. O dev DB esconde o problema;
    // um banco fresh (E2E/produção) quebra com 500 no primeiro INSERT do ORM.
    const declared = declaredColumns();
    expect(
      declared.length,
      "não conseguimos extrair colunas de drizzle/schema.ts — a introspecção falhou?",
    ).toBeGreaterThan(0);

    const probe = new Client({ connectionString: tempDbUrl });
    await probe.connect();
    try {
      const actual = await probe.query(
        `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'`,
      );
      const actualSet = new Set(
        actual.rows.map((r) => `${r.table_name}.${r.column_name}`),
      );

      const missing = declared.filter(
        (d) => !actualSet.has(`${d.table}.${d.column}`),
      );

      const detail = missing
        .map((m) => `  - ${m.table}.${m.column}`)
        .join("\n");

      expect(
        missing,
        `Colunas declaradas em drizzle/schema.ts mas AUSENTES de um banco criado ` +
          `apenas por runMigrations():\n${detail}\n\n` +
          `Cada uma quebraria um INSERT do ORM num banco fresh (E2E/produção) com 500. ` +
          `Adicione uma migration custom em server/migrations.ts (ALTER TABLE ... ADD COLUMN ` +
          `IF NOT EXISTS) para cada coluna acima — siga o padrão de ` +
          `task_221_reconcile_quotations_table_with_schema.`,
      ).toEqual([]);
    } finally {
      await probe.end();
    }
  });
});
