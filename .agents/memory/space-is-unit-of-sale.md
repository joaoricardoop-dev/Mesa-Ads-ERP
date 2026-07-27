---
name: Space is the unit of sale (telas = fonte única)
description: Ecommerce sells the space, but ALL space screen* fields are derived from the telas inventory — no manual mode anymore.
---

The unit of sale is still the **space** (`active_restaurants` + photos), but since the inventory-unification work (2026-07) the telas inventory is the **only** source of the space's screen* fields:

- `screensCount`, `screenCpm`, `screenInsertionsPerHour`, `screenImpactsPerInsertion`, `screenWeeklyHours`, `screenOperatingHours` are **materialized** from telas (`server/screenSpace.ts`) on every tela create/update/delete and on location update.
- **No manual mode**: the location form has no screen* inputs; the tRPC create/update schemas for activeRestaurant reject/strip screen* keys. Zero active telas ⇒ materialization CLEARS the fields (screensCount=0, rest NULL) — the space becomes unpriced/pendente.
- A one-shot migration backfilled telas from legacy manual values (grade, impactos, custo = CPM×impactos/1000, inserções/semana split across N telas with remainder on Tela 1) and re-materialized all spaces.

**Why:** user mandated one merged section, 100% auto-calculated, never typed; manual values silently diverging from inventory caused wrong prices.
**How to apply:** to change a space's price/audience, edit its telas — never write screen* columns directly (except read-only consumers: quotation, portals, catalog badges which keep reading the materialized columns).
