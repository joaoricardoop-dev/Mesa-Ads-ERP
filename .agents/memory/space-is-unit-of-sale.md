---
name: Space is the unit of sale (not the screen)
description: active_restaurants is the single source for what ecommerce sells; telas are optional inventory.
---

The SPACE (`active_restaurants`) is what gets sold, not the individual `telas` rows.

- `active_restaurants.screensCount` (int, default 0) is the canonical screen count shown in the
  audience/ecommerce builder. `listAvailableLocations` reads this column directly — it does NOT
  count `telas` rows. Migration backfilled it once from active telas count; after that the column
  is authoritative and edited via the space form.
- Space-level photos live in `active_restaurants.photoUrls` (JSON text array, same shape as
  `telas.photoUrls`). `listAvailableLocations` + `getProductsForLocations` source photos from the
  space, not from telas. Migration backfilled space photos from telas only where the space had none.
- Individual `telas` registration is OPTIONAL internal inventory — never required to sell a space.
- The "Config. pendente" / "Mídia incompleta" badge only applies to spaces that actually OFFER a
  screen product, determined by `offersScreenProduct` (productLocations → products.tipo='telas'),
  returned by `listActiveRestaurants` in db.ts. Catalog gating uses presence of a telas productSlot.

**Why:** business sells the physical space/venue; tying screens+photos to per-tela rows forced
redundant registration and made spaces look "incomplete" even when they don't sell screens.

**How to apply:** when touching ecommerce/builder screen counts or photos, read from the space
columns, never recompute from telas. When changing the pending/incomplete badge, gate on
offersScreenProduct, not on telas existence.
