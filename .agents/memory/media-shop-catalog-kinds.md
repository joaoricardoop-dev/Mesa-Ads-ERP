---
name: Media-shop catalog item kinds
description: Why the internal Orçamento (media-shop) splits inventory into location-based telas vs quantity-based products, and how each is priced.
---

# Media-shop catalog: two item kinds

The internal Orçamento (`/comercial/orcamento`, `client/src/components/media-shop/`) has TWO inventory kinds:

- **Screens (telas)** — location-based. The location *is* the inventory unit (physical screens + per-location CPM). Browsed per-location (list rows / cards / map). Priced EXCLUSIVELY by CPM daily pricing.
- **Quantity products (bolachas/impressos and any non-telas)** — NOT tied to a location. Bought by quantity, distributed later. So the buy unit is qty, not a venue. Priced by volume tiers.

**Why:** Coasters/printed media are purchased in bulk by quantity then distributed across venues afterward — modeling them per-location at catalog time is wrong. This mirrors the backend `createFromBuilder`: only `tipo === "telas"` takes the CPM path; every other product falls through to volume-tier pricing with `restaurantId` optional/null.

**How to apply:**
- Quantity items carry `restaurantId = null` into `createFromBuilder`; `volume = quantity`, `weeks` derived from the period.
- Client display price for quantity items goes through the single bridge `quoteQuantityItem()` (mediaShopStore) → canonical `quotePrice()`; never recompute tier math inline.
- Bulk tier data for the quantity catalog comes from `product.getPricingBundle` (one read, avoids N+1).
