---
name: pricingMode vs tipo separation
description: Which product axis drives the PRICE decision vs operational semantics.
---

# pricingMode is the single PRICE driver; tipo drives operational semantics

`products.pricingMode` ∈ {`cost_based`, `price_based`, `cpm`}. The **PRICE** decision
branches ONLY on `pricingMode` (cpm → per-location CPM via the canonical CPM math in
`shared/cpm-pricing.ts`; never recompute inline). `cpm` is available to ANY product,
not just `tipo === "telas"`.

**OPERATIONAL semantics stay keyed off `tipo`** (intentionally NOT switched): digital/VIP
repasse, restaurant/seller commissions, production+freight phase skipping, reports,
audience metrics (impressions/reach/frequency), impression formula, spot duration, catalog
grouping.

**Why:** a product can be priced by CPM without being a screen, and a screen product's
commercial/operational treatment is independent of how its price is computed. The old
`tipo === "telas"` price check conflated the two and blocked CPM for non-screen products.

**How to apply:**
- New pricing path → branch on `pricingMode`. New digital/commission/phase/audience/spot
  logic → branch on `tipo`.
- Any local helper that takes a `pricingMode` param must include `"cpm"` in its union, or
  tsc breaks after the enum widening.
- Per-location CPM pricing needs location selection, which only the media-shop builder has.
  Cost/markup-only surfaces (e.g. the legacy "Orçamento Clássico" simulator) cannot price
  cpm — they must surface a "priced by CPM do local" notice and exclude cpm from their
  cost calc/totals, NOT silently treat cpm as cost (that would show a misleading price and
  violate the user's single-source-of-truth preference).
