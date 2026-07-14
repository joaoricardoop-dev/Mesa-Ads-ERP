// Detecta drift entre drizzle/schema.ts e as migrations (Task #401).
//
// Contexto: o bug da Task #399 (coluna periodEnd declarada só no schema.ts,
// sem migration correspondente em server/migrations.ts) só apareceu em
// produção. Este script pega esse tipo de drift em dev:
//
//   1. Resolve o banco de teste ISOLADO (mesma lógica/guardas da suíte E2E,
//      via e2e/test-db.ts — nunca roda contra produção).
//   2. Roda runMigrations() nesse banco (idempotente; num banco vazio o
//      runner aplica o schema base drizzle/ + todas as migrations custom).
//   3. Compara o resultado real (information_schema) com as tabelas/colunas
//      declaradas em drizzle/schema.ts.
//   4. Falha (exit 1) listando toda tabela/coluna presente no schema.ts mas
//      ausente no banco migrado.
//
// Rodar: pnpm run check:schema-drift
import { resolveTestDatabaseUrl } from "../e2e/test-db";

async function main() {
  // Aponta TODO o processo para o banco de teste isolado ANTES de importar
  // qualquer módulo do server (getDb lê DATABASE_URL na primeira chamada).
  const testUrl = resolveTestDatabaseUrl();
  process.env.DATABASE_URL = testUrl;

  const { runMigrations } = await import("../server/migrations");
  const { getDb } = await import("../server/db");
  const { sql } = await import("drizzle-orm");
  const { getTableConfig, PgTable } = await import("drizzle-orm/pg-core");
  const schema = await import("../drizzle/schema");

  console.log("[schema-drift] Rodando runMigrations() no banco de teste isolado...");
  await runMigrations();

  const db = await getDb();
  if (!db) throw new Error("[schema-drift] Não foi possível conectar ao banco de teste.");

  // Estado real do banco após migrations.
  const res = await db.execute(sql.raw(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `));
  const rows: any[] = Array.isArray(res) ? (res as any[]) : ((res as any)?.rows ?? []);
  const dbColumns = new Map<string, Set<string>>();
  for (const r of rows) {
    const t = String(r.table_name);
    if (!dbColumns.has(t)) dbColumns.set(t, new Set());
    dbColumns.get(t)!.add(String(r.column_name));
  }

  // Estado declarado no drizzle/schema.ts.
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  let tableCount = 0;
  let columnCount = 0;

  for (const [exportName, value] of Object.entries(schema)) {
    if (!(value instanceof PgTable)) continue;
    const config = getTableConfig(value as any);
    tableCount++;
    const dbCols = dbColumns.get(config.name);
    if (!dbCols) {
      missingTables.push(`${config.name} (export: ${exportName})`);
      continue;
    }
    for (const col of config.columns) {
      columnCount++;
      if (!dbCols.has(col.name)) {
        missingColumns.push(`${config.name}.${col.name} (export: ${exportName})`);
      }
    }
  }

  console.log(
    `[schema-drift] Comparadas ${tableCount} tabelas / ${columnCount} colunas do drizzle/schema.ts contra o banco migrado.`,
  );

  if (missingTables.length === 0 && missingColumns.length === 0) {
    console.log("[schema-drift] OK — nenhum drift: tudo que o schema.ts declara existe após runMigrations().");
    process.exit(0);
  }

  console.error("");
  console.error("[schema-drift] DRIFT DETECTADO entre drizzle/schema.ts e as migrations!");
  if (missingTables.length > 0) {
    console.error("");
    console.error("  Tabelas declaradas no schema.ts mas AUSENTES no banco migrado:");
    for (const t of missingTables) console.error(`    - ${t}`);
  }
  if (missingColumns.length > 0) {
    console.error("");
    console.error("  Colunas declaradas no schema.ts mas AUSENTES no banco migrado:");
    for (const c of missingColumns) console.error(`    - ${c}`);
  }
  console.error("");
  console.error(
    "  Correção: adicione uma migration idempotente em server/migrations.ts " +
      "(ALTER TABLE ... ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS) " +
      "para cada item acima. O schema.ts sozinho NÃO altera o banco — foi " +
      "exatamente esse drift que quebrou produção na Task #399.",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[schema-drift] Falha ao executar o check:", err?.message ?? err);
  process.exit(1);
});
