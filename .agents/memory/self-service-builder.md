---
name: Self-service media builder
description: Which builder is canonical for advertiser/partner portals and how source/audience gating works
---

# Self-service media plan builder

Advertiser (`anunciante`) and partner (`parceiro`) portals build media plans by reusing the
internal media-shop components (`client/src/components/media-shop/*`) via the
`MediaShopBuilder` wrapper — NOT a separate builder.

**Rule:** there is one builder stack for media plans. Do not resurrect a parallel
per-portal builder (the old `CampaignBuilder.tsx` with its own pricing was deleted).
Confirm always goes through `quotation.createFromBuilder`.

**Why:** the old portal builder duplicated inventory + pricing logic, drifting from the
canonical pricing. Single source of truth (replit.md) requires one pricing/inventory path
read by internal Orçamento, both portals, and PDFs.

**How to apply:**
- `source` MUST match the caller role — server (`quotationRouter.createFromBuilder`) hard-rejects
  mismatches: anunciante→`self_service_anunciante`, parceiro→`self_service_parceiro`,
  internal→`internal`. Anunciante also requires `ctx.user.clientId === clientId`; parceiro
  requires `client.partnerId === ctx.user.partnerId`.
- `InventoryCatalog` takes an `audience` prop (`anunciante` | `parceiro` | internal). For
  parceiro, telas visibility is gated client-side (`showTelas` via product.list) because the
  marketplace location endpoint only filters `visibleToAdvertisers`.
- `MediaPlanPanel` hides internal-only controls (bonificação, payment terms) via props;
  self-service is never bonificada and never sets schedule (backend seeds default).
