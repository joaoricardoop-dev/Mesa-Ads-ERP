---
name: VIP room repasse = local (not provider)
description: Where the VIP repasse config lives, how it's split, and the bruto-projection vs liquido-ledger single-source boundary.
---

# VIP room is a LOCAL, not a separate provider

The VIP-room repasse config (is-vip-room flag, repasse percent default 30
editable, billing mode bruto/liquido default bruto) lives on the location record
(`active_restaurants`), not on a separate provider table. The old `vip_providers`
table is no longer the *source* of the config, but its rows and any historical
`accounts_payable` carrying a provider reference are kept intact — financial
history is never deleted. The legacy "custom" VIP slice (for sob-medida
quotations) is preserved untouched alongside the new "local" slice.

Repasse is **split per VIP room**, proportional to revenue attributed to each
location via `campaign_items` (phase scope when the invoice is phase-specific,
else whole-campaign scope). The canonical math is one shared function
(`calcVipRepasseLocal`): bruto = share × rate; liquido = (share − taxes×ratio −
sellerComm×ratio) × rate.

## AP idempotency key MUST include slice + recipient
**Rule:** the natural/unique key for a `vip_repasse` accounts-payable row is
`(invoiceId, slice, recipient)` — NOT invoiceId alone.
**Why:** the per-room split creates N AP rows per invoice (one per VIP local). An
invoiceId-only unique index silently drops every row after the first via
`ON CONFLICT DO NOTHING`, collapsing the split. This bit once.
**How to apply:** recipient = restaurantId for local slice, providerId for
custom/legacy; COALESCE to a non-null string in the index (Postgres treats NULLs
as distinct, which would let true duplicates through). Slice defaults to
'standard' for legacy rows with no slice.

## Single-source boundary: bruto projection vs liquido ledger
**Rule:** the authoritative realized repasse is the `accounts_payable` ledger
(materialized by the per-local math, honoring BOTH modes). The financial-
dashboard aggregate SQL is a **projection** that assumes bruto only.
**Why:** porting the liquido branch into SQL would re-implement the whole tax
stack in SQL — a *second* source of truth for taxes, a worse violation of the
"fonte única de verdade" mandate than the bounded projection gap. All rooms are
bruto by default + migration, so a liquido room is a rare manual override.
**How to apply:** keep the dashboard projection bruto-only; never duplicate tax
math in SQL. The real single-source fix is aggregates reading the AP ledger, but
that breaks projection for not-yet-paid invoices — left as a deliberate gap.

## Per-phase DRE VIP repasse = per-local (single source with the ledger)
**Rule:** the per-phase DRE financials derive VIP repasse from the LOCATION
(`active_restaurants` is-vip-room / repasse percent / billing mode), summing
`calcVipRepasseLocal` over each digital VIP-room item — the SAME canonical math
the AP ledger materializer uses. There is NO product→provider derivation in the
DRE path.
**Why:** the canonical digital product (`DOOH`) has no provider link, so a
provider-based DRE yields repasse = 0 for every digital campaign — a live
financial error. Anchoring on the location keeps the DRE, the ledger, and the
public/PDF surfaces on one source.
**How to apply:** a legacy single-rate VIP *override* still applies that rate to a
net base (legacy behavior, preserved); absent an override, sum per-local repasse
per digital VIP item, honoring each room's bruto/liquido mode. Never reintroduce a
provider-keyed branch here.

## DOOH consolidation: one canonical product, gated by enum-ordering
**Rule:** the canonical digital product is the MIN-id row with `name='DOOH' AND
tipo='telas'`; all other telas/janelas_digitais products are inactivated (history
kept, never deleted) and their `product_locations` repointed to DOOH.
**Why:** "fonte única de verdade" — one digital product, one CPM source (the
location's `screenCpm`). Surfaces (tela/janela names) live per-location in `telas`,
not as product types; there is no `janelas_digitais` product going forward.
**How to apply:** the consolidation migration MUST run AFTER the migration that
does `ALTER TYPE pricing_mode ADD VALUE 'cpm'` — Postgres forbids ADD VALUE + use
of the new enum value in the same transaction (55P04), so the ADD VALUE lives in
its own committed migration and any `pricingMode='cpm'` write must come in a later
one. Putting the consolidation before it silently fails on a FRESH db (runner
logs+continues), leaving the catalog unconsolidated.

## Provider→local backfill matching
Backfill marks a local as VIP by matching provider→local on normalized CNPJ then
exact name. No match → NOT auto-linked (would misroute repasse money); a one-time
log lists unmatched providers so an operator marks the room manually. Exact name
match is intentional: a provider named "X" vs a local "X - Sala VIP ..."
legitimately does NOT auto-match.
