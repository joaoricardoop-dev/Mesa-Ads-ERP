---
name: Single source of truth (data + config)
description: One piece of information = one origin. No duplicated constants, configs, calculations, mappings, or derivations across screens. Covers the general rule plus the config_options instance.
---

# Single source of truth

One piece of information = one origin. The recurring failure mode is creating multiple sources for the same datum (constants, configs, calculations, mappings, derivations), which produces divergent values across internal screens, public screens, and PDFs (e.g. the same date computed with different anchors in three places).

**Rules (checkable):**
1. **Search before creating.** Before adding any constant/config/calculation/mapping/derivation, `rg`/grep for it. If it already exists, reuse it — never recreate.
2. **One datum, one origin.** Every derived value comes from a single canonical function/source read by ALL screens (internal, public, PDF). Screens never recompute on their own.
3. **No recompute in more than one place.** Don't reimplement the same calculation/derivation with its own logic or anchor in different spots. Extract to `shared/` (or a canonical helper) and call it everywhere.
4. **When in doubt, ask.** If unsure whether a new value is the same datum as an existing one, ask before duplicating.
5. **List sources on completion.** When finishing a feature, list the data sources used and confirm there's no duplicated origin.

**Why:** Tasks repeatedly introduced parallel sources for the same value, causing screen-to-screen divergence (most concretely, a payment schedule reconciled at three points with different date anchors). This rule is mirrored in `replit.md` under User Preferences → "Fonte única de verdade (OBRIGATÓRIO)" so it loads every session.

**How to apply:** Triggers whenever you're about to introduce a value/calc that might already exist, or to wire a derived value into a screen/PDF.

## Instance: config_options (loss reasons + origin categories)

Loss reasons and opportunity origin categories are admin-editable lists stored in the database (one row per option, keyed by type + code). They are the canonical source for both validation and display.

**Rule:** Any consumer that validates codes or renders labels for these two lists must read from the DB-backed config — never from the legacy static `shared/loss-reasons` module (which still exists but is display-legacy). This applies to client selects, server-side validation, and any server-side report/dashboard that shows labels.

**Why:** The feature requirement was that ALL consumers share one source so admin edits (renames, new options) propagate everywhere. A review caught a dashboard still resolving loss labels from the static module, which would show stale labels after an admin rename.

**Edge cases:**
- Label lookups for display should include inactive options, so historical records whose code was later deactivated still resolve a label.
- Writing a known-seeded constant code (e.g. the auto-expire reason) is fine — that is not a divergence, only label *display* must come from the single source.
- `origin_category` stores code == label (legacy compat); loss-reason codes are slugs. Code is immutable after creation; only label/order/active toggle are editable.
