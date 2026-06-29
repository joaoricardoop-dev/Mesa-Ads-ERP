---
name: VIP room repasse = local (not provider)
description: Where the VIP repasse config lives, how it's split, and the bruto-projection vs liquido-ledger single-source boundary.
---

# VIP room is a LOCAL (active_restaurants), not a separate provider

A "sala VIP" is a location row in `active_restaurants` with `is_vip_room`,
`vip_repasse_percent` (default 30, editable) and `vip_billing_mode`
(`bruto`/`liquido`, default `bruto`). This replaces the old `vip_providers`
table as the *source* of the repasse config. Old `vip_providers` rows and old
`accounts_payable` APs carrying `vipProviderId` are kept intact (financial
history is never deleted); the legacy `custom` VIP slice
(`calcCustomVipRepasse` / `materializeCustomVipRepasse`) is preserved untouched.

Repasse is **split per VIP room**, proportional to revenue attributed to each
location via `campaign_items` (phase scope when the invoice is phase-specific,
else whole-campaign scope). Canonical math = `calcVipRepasseLocal` in
`server/finance/calc.ts`:
- `bruto`  = attributedShare × rate
- `liquido`= (attributedShare − taxes×ratio − sellerComm×ratio) × rate

## Single-source boundary: bruto projection vs liquido ledger
**Rule:** the authoritative realized repasse lives in the `accounts_payable`
ledger, materialized by `materializeVipRepasse` using `calcVipRepasseLocal`
(honors BOTH modes). The financial-dashboard aggregate
(`VIP_REPASSE_DEDUCTION_SQL` in `server/financialRouter.ts`) is a **projection**
that assumes `bruto` only.

**Why:** porting the `liquido` branch into SQL would require re-implementing the
whole `calcTaxes` stack in SQL — a *second* source of truth for taxes, which is
a worse violation of the project's OBRIGATÓRIO "fonte única de verdade" mandate
than the bounded projection gap. User decision was bruto everywhere (default +
migration standardizes all rooms to bruto), so a `liquido` room is a rare manual
override.

**How to apply:** keep the dashboard projection bruto-only; never duplicate the
tax math in SQL. The real single-source fix is to have aggregates read the AP
ledger (covers liquido), but that breaks projection for not-yet-paid invoices —
deferred as a follow-up.

## Known DRE gap (must fix before unlinking products from vipProviderId)
`calcPhaseFinancials` (DRE batch, `server/finance/calc.ts`) still computes VIP
from `products.vipProviderId` + provider rate on a liquido-style base — NOT the
new per-local attribution. It was deliberately not aligned. **It HARD-BLOCKS the
DOOH consolidation phase:** once products stop linking to `vipProviderId`, DRE
VIP would collapse to 0. Align DRE to `calcVipRepasseLocal`/per-local
attribution before that phase.

## Provider→local backfill matching
Backfill marks a local as VIP by matching provider→local on normalized CNPJ then
exact name. No match → NOT auto-linked (would misroute repasse money); instead
`logUnmatchedVipProviders` logs it once so an operator marks the room manually in
the location form. Real data seen: provider "Harmony Lounge" (no CNPJ) vs local
"Harmony Lounge - Sala VIP ..." legitimately does NOT auto-match.
