---
name: Portal self-service builder E2E
description: Hard-won patterns for testing MediaShopBuilder (anunciante/parceiro) checkout flows end-to-end.
---

# Portal self-service builder E2E

Covers the advertiser/partner self-service media plan builder tests
(MediaShopBuilder → quotation.createFromBuilder).

## Fixtures must be deterministic AND uniquely matchable
A dev fixture endpoint that "reuses the first existing product/location" is a
trap: telas pricing is gated on per-restaurant CPM, and an arbitrary first
location often has no CPM → createFromBuilder returns 400 "sem precificação CPM".

**Rule:** seed dedicated rows with FIXED names (no timestamps) and look them up
by exact name, so they are reusable across runs, unique in the catalog, and
provably configured (CPM on the restaurant, price tier on the qty product).

**Why:** earlier versions named rows `"<name> <Date.now()>"`; those leftovers
pollute the test DB forever and break substring matching.

## Locators must use EXACT text matching
The builder catalog can contain stale fixtures whose names START with the same
prefix. `filter({ hasText })` and `getByLabel(...)` default to SUBSTRING match
and will silently grab the wrong (CPM-less) row.

**How to apply:** use `getByText(name, { exact: true })` then
`xpath=ancestor::div[.//button][1]` to reach the row, and
`getByLabel(\`Quantidade de ${name}\`, { exact: true })` for qty products.

## "Complete seu cadastro" modal intercepts clicks (anunciante only)
Suppress it BEFORE goto with `page.addInitScript` setting sessionStorage
`mesa-anunciante-complete-profile-dismissed="1"`. Otherwise it overlays the
builder and intercepts pointer events.

## createFromBuilder response shape & sources
httpBatchLink returns an array; the quotation row is at
`body[0].result.data.json`, with `.source` =
`self_service_anunciante` / `self_service_parceiro` (server-enforced per role).
The portal page sits under `.theme-external` (aria-hidden) so trigger buttons
need `page.locator("button").filter({ hasText })`; the builder dialog is
portaled at body level so in-dialog `getByRole` works.
