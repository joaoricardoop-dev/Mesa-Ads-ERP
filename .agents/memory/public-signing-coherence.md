---
name: Public signing coherence rules
description: Invariants the public quotation/OS signing screen must satisfy so it never shows divergent prices, and the rule that billing due dates are a verbatim single source.
---

The public signing screen (`/cotacao/assinar/:token`, served by
`publicSigningRouter` GET + `QuotationSign.tsx`) must NEVER display prices that
diverge from the internal source. Price invariants:
- preço/un × qtd = total da linha
- Σ(totais das linhas) = total geral (footer) = Σ(parcelas)

**Why (prices):** `quotation_items` store RAW unitPrice/totalPrice, but
`quotations.totalValue` already embeds BV / agency commission. The final
(BV-embedded) price is the source of truth, so line items must be SCALED to that
total on the front-end, never shown raw.

**How to apply (prices):** Front-end derives line totals by distributing
`totalValue` across items (weights: totalPrice → unitPrice×qty → uniform),
reconciling cents on the last weighted line, then unit = lineTotal/qty.

## Billing due dates = verbatim single source (NO auto-shift)

The persisted quotation billing schedule (`billing_schedule_items`) is the ONE
source of truth for payment dates. Every surface — internal detail
(`billingSchedule.getForQuotation`), `quotation.get`, public signing GET, PDF —
reads it verbatim via `readBillingSchedule(db, "quotation", id)`. Saving
(`billingSchedule.setForQuotation`) persists the user's dates exactly as sent
(only invariant: Σ parcels = totalValue). Generating the OS or the signing link
must NOT touch the schedule.

**Why:** Due dates may legitimately fall BEFORE the campaign period start
(advance payment). An earlier "no due date before period start" invariant
auto-shifted the whole schedule forward to anchor the first installment at
periodStart + N days, silently overriding deliberate user edits and making the
public link diverge from the internal editor. That violated the single-source
rule ("um dado, uma origem; nunca recalcular/mutar em vários lugares").

**How to apply:** NEVER reintroduce any reconcile/auto-heal that mutates stored
due dates based on a derived period anchor. The editor allows saving dates in any
pre-conversion phase (including before period start); the only save block is when
a campaign already exists (edit via the campaign, which carries the
terminal-invoice lock). If a stored schedule looks wrong, the user fixes it in
the editor — code must not "correct" it.

E2E: `e2e/public-signing-coerencia.spec.ts` (price/Σ invariants only) and
`e2e/condicoes-pagamento-edicao.spec.ts` (internal == public schedule, and a
pre-period due date preserved verbatim after edit) seed via
`/api/dev-seed-signable-quotation`.
