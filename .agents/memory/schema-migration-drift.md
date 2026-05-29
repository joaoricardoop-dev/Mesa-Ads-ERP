---
name: Schema.ts vs runMigrations drift
description: Columns added to drizzle/schema.ts must also get a custom migration, or fresh DBs (E2E test DB) break ORM inserts with 500.
---

# Schema.ts vs runMigrations drift

Any column added to `drizzle/schema.ts` MUST also be persisted via a custom
idempotent migration in `server/migrations.ts` (`ALTER TABLE ... ADD COLUMN IF
NOT EXISTS ...`). The `drizzle/*.sql` base files are reference-only and are NOT
regenerated; a fresh DB is built by `runMigrations()` = drizzle base SQL +
custom MIGRATIONS[].

**Why:** The dev workspace DB gets schema changes via `drizzle-kit push`, so it
silently stays in sync with `schema.ts`. But the isolated E2E test DB (and any
fresh DB) is built ONLY by `runMigrations()`. If a column lives in `schema.ts`
but has no migration, the fresh DB lacks it. The Drizzle ORM ALWAYS lists every
schema column in an INSERT (with `default` for unprovided ones), so the very
first ORM insert into that table fails with a 500 — even though every column the
caller explicitly set looks valid. This is exactly how the signable-quotation
seed broke: `quotations.manualDiscountPercent` was in `schema.ts` with no
migration.

**How to apply:** When you add/rename a column in `schema.ts`, append a
reconcile migration. Precedent: `task_213_reconcile_products_table_with_schema`
and `task_221_reconcile_quotations_table_with_schema`. To detect drift, diff
`information_schema.columns` of a fresh `runMigrations()` DB against the
schema-complete dev DB — any "missing in fresh" column is an un-migrated schema
edit waiting to 500.
