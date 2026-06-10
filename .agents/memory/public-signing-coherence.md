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
  >= periodStart).
- **Single reconciliation anchor (fonte única).** ALL reconcile call sites must
  resolve the periodStart through `resolveQuotationPeriodStart` (OS.periodStart if
  an OS exists, else quotation.periodStart) — never hand-pick a different anchor
  per call site. Historically generateOS anchored on quotation.periodStart while
  the public GET anchored on the batch/OS start, so the schedule diverged between
  internal and public screens. Read paths (`quotation.get`,
  `billingSchedule.getForQuotation`, public GET) all go through
  `getReconciledQuotationSchedule` so every screen reads the identical persisted
  schedule regardless of phase.
- **Editing the quotation schedule** (`billingSchedule.setForQuotation`) is allowed
  in ANY phase up to conversion; the ONLY block is when a campaign already exists
  for the quotation (then edit via the campaign, which carries the terminal-invoice
  lock). It enforces Σ parcels = totalValue and re-reconciles after replace.
- E2E: `e2e/public-signing-coerencia.spec.ts` (DOM invariants) and
  `e2e/condicoes-pagamento-edicao.spec.ts` (internal==public schedule + edit in
  os_gerada reflecting on public) both seed via `/api/dev-seed-signable-quotation`.
