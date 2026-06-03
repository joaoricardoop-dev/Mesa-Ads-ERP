---
name: config_options single source
description: Loss reasons and opportunity origin categories are DB-backed editable lists; all consumers must read from the DB, not the legacy static loss-reasons module.
---

# config_options is the single source for loss reasons + origin categories

Loss reasons and opportunity origin categories are admin-editable lists stored in the database (one row per option, keyed by type + code). They are the canonical source for both validation and display.

**Rule:** Any consumer that validates codes or renders labels for these two lists must read from the DB-backed config — never from the legacy static `shared/loss-reasons` module (which still exists but is display-legacy). This applies to client selects, server-side validation, and any server-side report/dashboard that shows labels.

**Why:** The feature requirement was that ALL consumers share one source so admin edits (renames, new options) propagate everywhere. A review caught a dashboard still resolving loss labels from the static module, which would show stale labels after an admin rename.

**Edge cases:**
- Label lookups for display should include inactive options, so historical records whose code was later deactivated still resolve a label.
- Writing a known-seeded constant code (e.g. the auto-expire reason) is fine — that is not a divergence, only label *display* must come from the single source.
- `origin_category` stores code == label (legacy compat); loss-reason codes are slugs. Code is immutable after creation; only label/order/active toggle are editable.
