---
name: Publish dev↔prod schema drift
description: Why Replit's publish-time DB diff proposes destructive drops here, and how to neutralize it safely.
---

# Publish-time dev→prod diff vs the custom migration runner

Replit's Publish flow introspects the **Replit-managed development database** and diffs it against production, then applies the diff to prod. This project does NOT keep that dev DB current: the app runs `runMigrations()` (custom runner) on boot against `DATABASE_URL_TEST` (a separate Neon test DB) in dev and against Neon prod in production — it **never** migrates the Replit-managed dev DB. So that dev DB lags behind prod.

**Symptom:** On Publish, the diff sees columns/enum-values/indexes that exist only in prod (because the runner added them there on a prior prod boot) and proposes to **DROP them from prod** — destructive false positives. It also fails outright when it tries to recreate the `pricing_mode` enum without `cpm` (`invalid input value for enum pricing_mode: "cpm"`).

**Why:** two competing schema-management systems (custom runner + Replit publish diff) with the Replit dev DB as a stale third schema neither side keeps in sync.

**How to apply / fix when this recurs:**
1. NEVER let the user apply the destructive publish migration (it drops prod columns that still hold data and still exist in `drizzle/schema.ts`).
2. Compute the real diff: `executeSql` the same column/enum/index queries against `environment:"development"` and `environment:"production"`, diff the sets.
3. Sync the **dev** DB to match prod (additive `ADD COLUMN/ADD VALUE/CREATE INDEX IF NOT EXISTS` using the runner's canonical DDL in `server/migrations.ts`; `DROP INDEX` any stale index dev has that prod replaced). `executeSql environment:"development"` allows DDL incl. DROP; production is read-only.
4. Re-verify the diff is empty → the Publish diff becomes a no-op (or purely additive), so publish is safe.
5. Brand-new columns not yet in either DB reach prod via `runMigrations()` on the next deploy boot (run = `npm run start` → `runMigrations()` awaited before listen). No publish-time schema change needed for them.

**Note:** the app's DB layer uses the Neon serverless driver bound to `DATABASE_URL`, so you can't simply point `runMigrations()` at the native dev DB; replay canonical DDL via `executeSql` instead. The manual `db:push` script was neutralized (echo + exit) so drizzle-kit can't fight the custom runner either.

## CRITICAL recurrence trap: boot-migrations create prod-only drift → next Publish DROPS them
When syncing dev to prod, you MUST bring dev up to the **full `drizzle/schema.ts`** — every column the schema declares — NOT merely to whatever prod currently has. Reason: `runMigrations()` runs on each deploy boot and adds any still-missing columns to **prod**. If those columns are absent from the stale Replit dev DB, then *after* that deploy prod has columns dev lacks → the **next** Publish diff sees them as prod-only and **DROPS them from prod**. And `runMigrations()` will NOT restore them, because it tracks applied migrations by name and reports them `skipped` once run — so a dropped column stays dropped, and the deployed app 500s on insert ("column does not exist").

**Concrete incident:** `telas.insertions_per_week` + `cost_per_insertion` were left out of a dev→prod sync (expecting boot `runMigrations` to add them to prod, which it did on deploy #1). That left dev behind on exactly those 2 cols; Publish #2 dropped them from prod; boot migrations didn't recreate them (already `skipped`); screen registration started failing.

**Rule:** dev must hold the complete `schema.ts` set BEFORE any publish, so every Publish diff is additive (dev-only cols → ADD to prod) or empty — never prod-only. Don't rely on boot `runMigrations` to introduce columns to prod that dev is missing; that *creates* the drop-on-next-publish trap. Recovery for an already-dropped prod column: add it to the dev DB (canonical DDL), then re-publish so the additive diff restores it on prod (never DDL prod directly).
