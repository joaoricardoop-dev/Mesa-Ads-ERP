---
name: Margem unit convention (pricing tiers)
description: product_pricing_tiers.margem is stored as a percent (50.00 = 50%) but calcUnitPriceAdv expects a decimal fraction — every call site must divide by 100.
---

# Margem is stored as percent, consumed as fraction

`product_pricing_tiers.margem` is persisted as a **percent** string (e.g. `"50.00"` = 50%). `calcUnitPriceAdv` (client/src/lib/campaign-builder-utils.ts) expects a **decimal fraction** (0.5). So every caller must pass `parseFloat(tier.margem) / 100`.

**Why:** If you pass the raw percent (50), `denominadorBase = 1 - margem - irpj - comRestaurante - comComercial` goes negative, `calcUnitPriceAdv` returns 0, and the UI shows "Sob consulta" with the Add button disabled — i.e. the product looks unpriceable. This is exactly how the shared `quotePrice` (campaign-wizard/pricing.ts) was silently broken for ALL non-telas products until the media-shop quantity-products feature became its first real non-telas consumer (telas take a CPM path that returns before the margem code).

**How to apply:** The canonical server `createFromBuilder` (server/quotationRouter.ts) and every direct `calcUnitPriceAdv` caller (AnunciantePortal, BudgetCreator) already divide by 100 — match them. When introducing a new pricing call site, divide margem by 100; never pass the raw tier value.
