---
name: Proposal/OS PDF data assembler
description: The single canonical source for proposal/OS PDF data shape and derivations.
---

# Proposal/OS PDF data assembler

`shared/proposalData.ts` → `assembleProposalData(input)` is the single canonical
builder for the data passed to `generateProposalPdf`. It owns the parse of
`item.notes` (semanas / spot seconds / impressions) and the math
(`monthlyTotal`, `pricePerRestaurant`, `coastersPerRestaurant`, top-level
`semanas = duration*4` when there is no items array). It returns `ProposalPDFData`
**without** `signature` — callers add the signature block themselves for signed docs.

**Rule:** every PDF caller must call `assembleProposalData` and never re-parse notes
or recompute monthly/per-rest inline. Current callers: `QuotationDetail.tsx`,
`Quotations.tsx`, and the public signing screen `QuotationSign.tsx`.
(`QuotationPreview` = unsaved simulator and `AnunciantePortal` = compact doc are
intentionally out of scope — different data sources/documents.)

## Veiculação period (quotations with items)
For itemized quotations, top-level `semanas` is derived from the persisted
quotation period `periodStart→periodEnd` (builder convention: inclusive days,
`circuitWeeksForDays` = ceil/7); legacy rows without `periodEnd` fall back to
the max item weeks parsed from notes. The PDF's lote table clamps the last
lote's end date to `periodEnd`. **Why:** before this, `semanas` was undefined
with items and the PDF defaulted to `cycles*4 = 4` weeks (1 lote), diverging
from the registered period. Any new builder entrypoint MUST send `endDate` so
`createFromBuilder` persists `quotations.periodEnd` (single source of the
displayed period).

**Why:** replit.md mandates "fonte única de verdade". Previously the same parse+math
was duplicated inline across the internal screens and diverged (e.g. top-level
`semanas` was set in one screen and left undefined in another).

**How to apply:** when changing what the proposal/OS PDF shows or how a derived field
is computed, edit `assembleProposalData` only; all screens + the public signed PDF
inherit it. `generateProposalPdf` returns `{ fileName, base64 }` (autosave defaults
true) so the public flow can both download and email the same bytes.
