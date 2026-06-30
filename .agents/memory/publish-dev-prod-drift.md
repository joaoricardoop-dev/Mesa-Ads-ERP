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
