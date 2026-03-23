import { getDb } from "./db";
import { sql } from "drizzle-orm";

const MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: "add_quotation_period_start",
    sql: `ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "periodStart" date; ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "batchWeeks" integer DEFAULT 4;`,
  },
];

export async function runMigrations() {
  const db = await getDb();
  if (!db) {
    console.warn("[Migrations] Database not available, skipping migrations.");
    return;
  }

  for (const migration of MIGRATIONS) {
    try {
      await db.execute(sql.raw(migration.sql));
      console.log(`[Migrations] Applied: ${migration.name}`);
    } catch (err: any) {
      console.warn(`[Migrations] ${migration.name} skipped or failed:`, err?.message || err);
    }
  }
}
