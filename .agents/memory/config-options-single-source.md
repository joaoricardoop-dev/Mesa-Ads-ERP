---
name: config_options single source
description: Loss reasons and opportunity origin categories are DB-backed editable lists; all consumers must read from config_options, not the legacy static file.
---

# config_options is the single source for loss reasons + origin categories

The `config_options` table (type ∈ {`loss_reason`, `origin_category`}, columns code/label/sortOrder/isActive) is the canonical, admin-editable source for these two lists. Admins edit them at `/configuracoes/listas`.

**Rule:** Any consumer that reads codes or renders labels for loss reasons or origin categories MUST read from `config_options`:
- Client: `useConfigOptions(type)` (`client/src/lib/configOptions.ts`) → `{options, labelOf}`.
- Server validation: `getActiveConfigCodes(type)` from `configOptionRouter`.
- Server label display: `getConfigLabels(type)` from `configOptionRouter` (includes inactive codes so historical rows still resolve a label).

**Why:** The request mandated that ALL consumers read one single source so admin edits (renames, new options) propagate everywhere. A code review caught the comercial dashboard still mapping loss codes→labels via the static `shared/loss-reasons.ts`, which would show stale labels after an admin rename.

**How to apply:** `shared/loss-reasons.ts` still exists but is legacy. Do NOT import `LOSS_REASON_LABELS` for display. It is acceptable for `quotationScheduler.ts` to *write* the constant `LOSS_REASON_AUTO_EXPIRED` ("sem_retorno") since that code is a seeded option — writing a canonical seeded code is not a divergence. When adding any new screen/report that shows these labels, wire it to the helpers above.

**Storage quirk:** `origin_category` stores `code == label` (compat with legacy `leads.origin` which stored the label); `loss_reason` codes are slugs. `code` is immutable after creation; only label/sortOrder/isActive are editable.
