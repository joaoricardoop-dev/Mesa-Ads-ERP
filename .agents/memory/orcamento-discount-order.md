---
name: Orçamento cotas + line discount + mixed PDF tables
description: Canonical discount order in media Orçamento, how the global coupon is persisted into totalValue, and why a mixed-type proposal PDF must render one table per product type.
---

# Media Orçamento: cotas, per-line discount, and mixed PDF

## Discount order (canonical, do not reorder)
1. Per-line discount % (per circuit + per quantity product) — applied first, per line.
2. Global "Cupom %" — applied on the subtotal of net line totals.
3. BV/commission scaling — applied last, over the already-net contract total.
**Why:** the three layers compound; reordering changes the charged price. The per-line net helper lives in `shared/proposal-line-pricing.ts`; cotas multiplication for circuits in `shared/cpm-pricing.ts`. Always reuse these — never recompute a price inline (single-source-of-truth rule in replit.md).

## Global coupon MUST be persisted into the contract total
`createFromBuilder` accepts `couponPercent` and applies it as a uniform factor AFTER the per-line net (line discount), scaling each line's `totalPrice`/`unitPrice` and the quotation `totalValue`. So `sum(lines) == totalValue` and the PDF (which re-scales lines to `contractTotal`) matches the on-screen plan total exactly.
**Why:** the coupon used to be client-side only (never written), so the saved quotation + PDF diverged from the on-screen total whenever coupon > 0 — a single-source-of-truth violation. The fix keeps one charged total across screen, persisted quotation, and PDF.
**How to apply:** any new global discount must be applied server-side in the same spot (after line nets, before BV scaling) and flow into `totalValue` — never only client-side.

## Mixed-type proposal PDF must render ONE table per product type
A proposal can mix circuits (DOOH), telas, and quantity products in one budget. The PDF must partition items by type and render a separate table per non-empty type, each with its own reference-cost column (circuits → custo/semana; quantity → custo/un.). Do NOT pick a single table layout for the whole budget — that hides the other types' reference costs.
**Why:** a regression once rendered all lines in the circuit table when any circuit existed, so quantity lines lost their custo/un. column.
**How to apply:** compute the BV-scaled line prices ONCE over all items, then index that same scaled array from each per-type table so per-group subtotals reconcile exactly to the items subtotal (no per-group re-scaling). Show a combined items-total line only when more than one type is present.

## PDF reference values come from item marker tokens (display only)
cotas / custo-semana / custo-un / line-discount-% are carried in the item `notes` marker and parsed for DISPLAY. The printed money always comes from the BV-scaling step over persisted `totalPrice`, never from the marker.
