---
name: Campaign builder pricing dual-path
description: New pricing rules must be applied in BOTH client quotePrice (display) and server createFromBuilder (real quotation), because checkout sends no per-line prices.
---

# Campaign builder: client estimate vs server price are two paths

The open-checkout/campaign-wizard submits the cart via `quotation.createFromBuilder`
sending each item with only `{productId, productName, volume, weeks, restaurantId,
shareIndex, cycleWeeks, cycles}` plus an aggregate `estimatedTotal`. **No per-line
price is sent.** The server recomputes every line price from scratch inside
`createFromBuilder` (server/quotationRouter.ts), and that server number is what
persists into `quotation_items.unitPrice/totalPrice`.

The client-side `quotePrice` (client/src/components/campaign-wizard/pricing.ts) only
drives the on-screen estimate/preview — it never reaches the database.

**Rule:** any new pricing rule (e.g. CPM pricing for `tipo==="telas"`) must be
implemented in BOTH places, calling the same canonical shared helper:
- client `quotePrice` → live estimate
- server `createFromBuilder` → the real quoted price

**Why:** implementing only the client branch makes the preview look right while the
saved quotation silently falls back to the generic tier/markup math (or throws "sem
tabela de preço" for telas with no tiers). This is the single-source-of-truth trap:
the math helper is shared, but it must be *invoked* on both code paths.

**How to apply:** for telas, both paths read the per-local CPM config and call
`computeCpmPricing` (shared/cpm-pricing.ts); total = weeklyRevenue × weeks,
unitPrice = total/volume (keeps downstream `quantity × unitPrice = total` intact).
