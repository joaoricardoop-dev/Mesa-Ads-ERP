---
name: Builder shares media-shop store
description: Client checkout /montar-campanha reuses the internal media-shop store/components; consequences of that single-source coupling.
---

The client-facing builder (`client/src/components/campaign-wizard/StepShop.tsx`)
renders the SAME `InventoryCatalog` + `MediaPlanPanel` and reads the SAME
`useMediaShopStore` as the internal Orçamento (`client/src/pages/MediaBudget.tsx`).
`MediaPlanPanel` branches only via `variant: "internal" | "client"` (client hides
Bonificação + payment-terms editor, relabels notes). One datum = one origin.

**Why:** STRICT single-source-of-truth requirement — never recompute pricing or
period in two places. Pricing/period derive from shared helpers; the client sends
NO per-line price (server `quotation.createFromBuilder` is the price authority).

**How to apply:**
- Any pricing/period/metric rule change must hold for BOTH screens automatically
  because they share the store/panel — verify both, don't fork logic.
- `mediaShopStore` is wrapped in zustand `persist` (key `mesa-mediashop-v1`,
  localStorage), partializing selection/plan fields. This means the internal
  Orçamento ALSO persists its in-progress plan across reloads (intended drift,
  harmless). Don't add clientId/leadId/isBonificada/schedule to partialize.
- Client observations map to `briefing` (not `notes`) in `createFromBuilder`;
  that zod input strips unknown keys silently, so a wrong field name is dropped
  with no error — double-check field names against the input schema.
