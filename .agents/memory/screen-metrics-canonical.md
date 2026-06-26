---
name: Screen (DOOH) metrics canonical source
description: Where screen insertions/day defaults and exibições/alcance/frequência derivations live; do not recompute inline.
---

# Screen metrics single source

`shared/screen-metrics.ts` is the ONLY origin for DOOH screen projections:
- `defaultInsertionsPerDay(reg)` — default inserções/dia derived from registration. Priority: CPM `insertionsPerHour × weeklyHours / 7` → fallback `dailyLoops` → 0. There is NO fixed constant (a previous coaster-vs-screen simulator used hardcoded `TELAS_INSERCOES`; that legacy path in `useBudgetCalculator` is separate and out of scope — do not conflate).
- `computeScreenMetrics({insertionsPerDay, impactsPerInsertion, monthlyCustomers, days, screens})` → `{exibicoes, alcance, frequencia}`. exibições = insPerDay×days×screens×impacts; alcance = monthlyCustomers×days/30; frequência = exibições/alcance.

**Why:** replit.md single-source mandate — the same projection was at risk of being recomputed in the card, the plan panel, and any report with diverging anchors.

**How to apply:** any screen card / media plan / report needing inserções/dia default or projections MUST call these helpers. Per-item insertions/day can be overridden in the media plan WITHOUT touching registration — pass the edited number into `computeScreenMetrics`; pricing stays CPM-fixed (`shared/cpm-pricing.ts` `computeScreenDailyPricing`) and is unaffected by the override.
