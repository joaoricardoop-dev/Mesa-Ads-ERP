---
name: Screen space derived from telas inventory
description: When a location has ≥1 active tela, active_restaurants.screen* fields are derived/materialized from the telas inventory, never edited manually.
---

Rule: `shared/screen-space.ts` (deriveScreenSpace) is the ONLY origin of a location's Espaço de Mídia fields when the location has ≥1 ACTIVE tela. The server materializer persists derived values into `active_restaurants.screen*` on every tela create/update/delete AND at the end of updateActiveRestaurant (so manual edits are overwritten). Non-derivable fields become NULL — never silently keep old manual values. No active telas → manual mode untouched.

**Why:** the screen* columns are read by catalog, quotations, CPM pricing and portals; letting the form and the inventory both write them created divergent CPM/insertions between screens.

**How to apply:** any new consumer of screen metrics for a location reads the materialized columns or calls deriveScreenSpace — never re-aggregates telas inline. Weighted averages (cost/impacts per insertion) require ALL active telas configured; partial averages are rejected by design (pendências per tela drive "config pendente" badges). Per-tela weekly insertions = (3600/loopDuration)×grid hours, fallback insertionsPerWeek.

Gotcha: the builder-locais e2e spec asserts `local-card-*` testids that no longer exist in InventoryCatalog (catalog was restructured into circuit rows) — those 3 tests fail regardless of changes; stale spec, not a regression signal.
