---
name: /montar-campanha server-side cart draft
description: The builder persists the cart to the DB per client, so e2e tests must clear it for isolation.
---

# /montar-campanha cart draft leaks across e2e runs

The `/montar-campanha` wizard (CampaignWizard) persists the in-progress plan to a
**server-side** table `campaign_drafts`, keyed by `clientId`, via
`anunciantePortal.saveCartDraft` (autosaves whenever there are items) and
re-hydrates it on next load via `loadCartDraft` → `mediaShopStore.hydrate(...)`.
The mediaShopStore ALSO persists to `localStorage` (`mesa-mediashop-v1`), but for
e2e that is a red herring: `global.setup` builds storageState from an API request
context, so browser localStorage is always empty — the contaminating state comes
from the DB draft.

**Why this bites e2e:** the test advertiser's draft survives across runs. A prior
run that added a venue + set dates (e.g. the list test sets 2099-01-01) saves a
draft; the next run hydrates it, so the venue shows as already-selected (map popup
button reads "Remover" not "Adicionar") and dates are stale. Symptom: a map/builder
test passes the first 1-2 times then fails forever at the "add" step.

**How to apply:** any e2e touching `/montar-campanha` as an advertiser must clear
the draft for isolation. Use the dev endpoint `POST /api/dev-clear-cart-draft`
(in `server/_dev/devEndpoints.ts`) in `beforeEach`. The draft is keyed by the
**advertiser's** clientId, NOT the first row of `clients` — resolve it via
`POST /api/dev-ensure-anunciante` (returns `user.clientId`) and pass
`{ clientId }` explicitly, or the wrong draft gets cleared.

**Map mock:** `e2e/builder-locais.spec.ts` fakes `window.google.maps` with an
addInitScript (FakeMap/FakeMarker/FakeInfoWindow) that renders markers as
`<button data-testid="map-marker" data-title="...">` and infowindow content into
`[data-testid="map-infowindow"]`, mirroring `e2e/address-autocomplete.spec.ts`.
