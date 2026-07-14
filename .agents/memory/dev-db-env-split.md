---
name: Dev workflow DB vs shell DATABASE_URL
description: Which database each environment actually hits in this project
---
The "Start application" workflow overrides `DATABASE_URL="$DATABASE_URL_TEST"` in `.replit`, so the dev server runs against the isolated Neon test DB — NOT the shell's `DATABASE_URL` (Replit-native helium PG), which the app never migrates.

**Why:** debugging "migration ran but column missing" is misleading if you query the shell's DATABASE_URL; the app's tracker/state lives in DATABASE_URL_TEST. Production uses its own Neon DATABASE_URL and applies migrations at boot after publish.

**How to apply:** when verifying schema/migrations in dev, point scripts at `process.env.DATABASE_URL_TEST`; check `.replit` workflow args before trusting shell env.
