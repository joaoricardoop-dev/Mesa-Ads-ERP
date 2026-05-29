---
name: Public signing coherence rules
description: Invariants the public quotation/OS signing screen must satisfy so it never shows divergent prices or due dates.
---

The public signing screen (`/cotacao/assinar/:token`, served by
`publicSigningRouter` GET + `QuotationSign.tsx`) must NEVER display divergent
prices or due dates. Invariants:
- preço/un × qtd = total da linha
- Σ(totais das linhas) = total geral (footer) = Σ(parcelas)
- nenhum vencimento é anterior ao início do período

**Why:** `quotation_items` store RAW unitPrice/totalPrice, but `quotations.totalValue`
already embeds BV / agency commission. The final (BV-embedded) price is the
source of truth, so the line items must be SCALED to that total, never shown raw.
Legacy billing schedules can have due dates seeded before the period start.

**How to apply:**
- Front-end derives line totals by distributing `totalValue` across items
  (weights: totalPrice → unitPrice×qty → uniform), reconciling cents on the last
  weighted line, then unit = lineTotal/qty.
- Server auto-heals due dates via `reconcileQuotationScheduleDueDates` (anchor the
  shift on the EARLIEST due date, not the lowest sequence, so all parcels end up
  >= periodStart). Called in generateOS, generateSigningLink, and the public GET.
- E2E `e2e/public-signing-coerencia.spec.ts` seeds a bad fixture via dev endpoint
  `/api/dev-seed-signable-quotation` and asserts all three invariants in the DOM.
