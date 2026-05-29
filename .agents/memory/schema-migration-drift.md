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
and `task_221_reconcile_quotations_table_with_schema`. Drift is now caught
automatically: the e2e spec `e2e/migrations-fresh-db.spec.ts` builds a fresh DB
via `runMigrations()` and diffs `information_schema.columns` against every
column declared in `drizzle/schema.ts` (via Drizzle introspection —
`getTableColumns`/`getTableName`). Any column in `schema.ts` but missing from
the fresh DB fails the test naming the exact `table.column`. Run it with
`pnpm exec playwright test e2e/migrations-fresh-db.spec.ts`.
