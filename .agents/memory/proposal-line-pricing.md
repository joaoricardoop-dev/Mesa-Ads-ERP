---
name: Proposal per-line pricing single source
description: Per-line proposal prices (unit + total) must come from computeProposalLinePrices, never recompute the BV scale per screen.
---

# Proposal per-line pricing

The displayed per-line price (preço/un. e total) in proposals embeds the BV/agency
commission by scaling raw DB line totals up to the section's target total
(`itemsSubtotal` or contract total). Use the canonical
`computeProposalLinePrices(items, targetTotal)` in `shared/proposal-line-pricing.ts`
for ALL surfaces (PDF table, "Composição do investimento", internal QuotationDetail).

**Why:** the same scale was historically recomputed independently in 4 places with
different anchors; the pure multi-product "Composição" even printed the raw DB
`totalPrice` with no scale, so lines diverged from the table while only the grand
total matched. The function also distributes the cent residual by largest-remainder
so line totals sum EXACTLY to the target (no centavo drift).

**How to apply:** never write `item.totalPrice * scaleFactor` or
`item.unitPrice * scale` inline. Pass raw items + the section target into
`computeProposalLinePrices` and render `scaledLines[idx].unitPrice/totalPrice`.
Target = `itemsSubtotalForPdf` (PDF, = contractTotal when not mixed) /
`itemsSubtotalEffective` (internal screen).
