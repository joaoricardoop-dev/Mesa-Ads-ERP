---
name: Circuit pricing required by builder e2e fixtures
description: Telas circuits need insertionsPerWeek+costPerInsertion or createFromBuilder rejects; dev fixture backfills them.
---

The DOOH circuit price is `telas.insertionsPerWeek × costPerInsertion` (computeCircuitLineTotal). `quotation.createFromBuilder` rejects with BAD_REQUEST any circuit item whose tela lacks either field.

**Why:** the checkout-wizard e2e suite silently drifted twice: (a) catalog list rows were renamed `local-card-*` → `circuito-card-*`, and (b) seeded "E2E Tela 1" rows had no circuit pricing, so every submit 400'd.

**How to apply:**
- `/api/dev-ensure-screen-location` now seeds circuit pricing on new telas AND backfills all active telas missing it — call it from any builder/checkout spec (checkout-wizard's `ensureRestaurante` does both endpoints).
- Catalog rows/cards use `circuito-card-${telaId}`; the view (Lista/Cards/Mapa) is persisted per user, so specs must click "Lista" before asserting rows.
- Lead-linked quotations (`leadId` in createFromBuilder) are internal-only; anunciante/parceiro get FORBIDDEN.
