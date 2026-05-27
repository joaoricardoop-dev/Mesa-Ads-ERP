import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomBytes } from "node:crypto";

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
    // Aponta o getDb() (neon-serverless Pool) para o banco temporário antes
    // de importar o módulo de migrations. O cache `_db` em server/db.ts ainda
    // está null neste worker do Playwright, então a primeira chamada a getDb()
    // dentro de runMigrations() vai capturar este DATABASE_URL.
    process.env.DATABASE_URL = tempDbUrl;

    const migrations = await import("../server/migrations");
    await migrations.runMigrations();

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
});
