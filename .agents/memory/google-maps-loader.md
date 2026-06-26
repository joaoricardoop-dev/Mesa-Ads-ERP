---
name: Google Maps loader & key behavior
description: How the app loads Google Maps, the missing/invalid key contract, and the parallel-loader gotcha.
---

# Google Maps loader & key behavior

Canonical loader: `client/src/lib/googleMaps.ts` → `loadGoogleMaps()`. Short-circuits if `window.google.maps` already exists (this is why e2e can pre-inject a fake `window.google.maps` via `addInitScript` to avoid loading the real SDK).

## Key contract (`VITE_GOOGLE_MAPS_API_KEY`, a secret)
- **Missing/empty** → `loadGoogleMaps()` rejects with `GoogleMapsKeyMissingError` BEFORE injecting any script (never injects `key=undefined`). `MapView` catches and renders a fallback (`data-testid="map-load-error"`); list/cards keep working.
- **Invalid / no billing** → script still loads (onload fires), Google overlays its own `.gm-err-container` error and calls `window.gm_authFailure`; we register that hook to log a clear console error and set `window._gmapsAuthFailed`.

## Parallel-loader gotcha (single-source debt)
`client/src/pages/RestaurantsMap.tsx` has its OWN `loadMapScript()` + its own `gm_authFailure`/`_gmapsAuthFailed`/`window.google` Window augmentation — it does NOT use `loadGoogleMaps()`. So Google-Maps key/auth behavior lives in TWO places; touch both when changing it.
**Why:** found while adding missing/invalid-key handling — the shared loader and RestaurantsMap diverged. Pre-existing `TS2790` on `delete window.google` in RestaurantsMap is unrelated to key changes.

## Verifying real pins
`e2e/builder-locais.spec.ts` = FAKE SDK (deterministic wiring). `e2e/builder-locais-real-maps.spec.ts` = REAL SDK, gated by `RUN_REAL_MAPS=1` + a key on the dev server. It drives marker clicks via the dev-only hook `window.__catalogMapTest.clickMarker(title)` (guarded by `import.meta.env.DEV`, tree-shaken out of prod) instead of guessing Google's internal marker DOM, which is version-unstable.
**How to apply:** run `RUN_REAL_MAPS=1 pnpm exec playwright test builder-locais-real-maps`. Note: full Playwright runs in the Replit sandbox are flaky to boot (cold start >60s + background-process reaping across the 2-min shell limit); prefer the documented manual checklist when a full run won't complete.
