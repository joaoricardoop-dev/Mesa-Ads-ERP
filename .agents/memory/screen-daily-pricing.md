---
name: Screen daily pricing & free-calendar periods
description: How "telas" are priced per-day and how free calendar dates map to 4-week cycles underneath.
---

# Screen daily pricing + calendar periods

The campaign builder lets users pick **free start/end calendar dates**. Under the
hood, 4-week cycles ("batches") stay alive for stock availability and DRE.

**Rule:** the datas→ciclos/semanas/dias conversion has ONE origin: `shared/period.ts`
(`daysInRangeInclusive` inclusive count, `cyclesForDays` ceil days/28 min 1,
`weeksForCycles`, `billedScreenDays` max 7, `derivePeriod`). Cycle length is
`CYCLE_DAYS = 28` (= `CYCLE_WEEKS * 7`); batchRouter reuses this constant.

**Screen ("telas") price:** daily, derived from the existing CPM — NOT a new manual
field. `computeScreenDailyPricing(cpmCfg, days)` in `shared/cpm-pricing.ts` returns
`dailyRate = computeCpmPricing().weeklyRevenue / 7`, `billedDays = max(7, days)`,
`totalPrice = dailyRate * billedDays`. CPM stays the single source of truth.
**Why:** user-confirmed to avoid a divergent second cost input.

**Physical products:** still per-cycle. Round the chosen period UP to full 4-week
cycles (`cyclesForDays` → `weeksForCycles`), and physical weeks hit the
`DESCONTOS_PRAZO` keys {4,8,12,16,20,24}.

**How to apply:** read the helper everywhere (wizard pricing.ts, server
createFromBuilder screen branch, any report). Never recompute the CPM÷7 scale or the
days→cycles math inline. Screen quotation_items store the daily `totalPrice`, which
flows through `computeProposalLinePrices` to the PDF (already coherent).

**Known drift:** aba Orçamento (`BudgetCreator.tsx`) still uses its impressions-based
telas engine and per-cycle UI — its full conversion belongs to the downstream
ecommerce task that owns the list/map/media-plan rebuild.
