---
name: Google Maps loader & key behavior
description: How the app loads Google Maps, the missing/invalid key contract, and the parallel-loader gotcha.
---

# Google Maps loader & key behavior

Canonical loader: `client/src/lib/googleMaps.ts` → `loadGoogleMaps()`. Short-circuits if `window.google.maps` already exists (this is why e2e can pre-inject a fake `window.google.maps` via `addInitScript` to avoid loading the real SDK).

## Key contract (`VITE_GOOGLE_MAPS_API_KEY`, a secret)
- **Missing/empty** → `loadGoogleMaps()` rejects with `GoogleMapsKeyMissingError` BEFORE injecting any script (never injects `key=undefined`). `MapView` catches and renders a fallback (`data-testid="map-load-error"`); list/cards keep working.
- **Invalid / no billing** → script still loads (onload fires), Google overlays its own `.gm-err-container` error and calls `window.gm_authFailure`; we register that hook to log a clear console error and set `window._gmapsAuthFailed`.

## Single loader everywhere (parallel loader removed)
`RestaurantsMap.tsx` now uses `loadGoogleMaps()` like every other map screen — its old `loadMapScript()` + duplicate `gm_authFailure`/`_gmapsAuthFailed`/`window.google` Window augmentation are gone. Key/auth behavior lives ONLY in `googleMaps.ts`; never reintroduce a second loader. The Window globals are declared in `googleMaps.ts` and apply app-wide via its import.
**Why:** the shared loader and RestaurantsMap had diverged (different libraries, different missing-key handling); consolidating removes the two-places-to-fix debt.
**How to apply:** RestaurantsMap wraps `loadGoogleMaps()` in try/catch and shows its own fallback overlay on rejection (missing key). Its "Tentar novamente" button resets `window._gmapsLoading`/`window._gmapsAuthFailed` and re-calls `initMap` (a `usePersistFn`).

## Verifying real pins
`e2e/builder-locais.spec.ts` = FAKE SDK (deterministic wiring). `e2e/builder-locais-real-maps.spec.ts` = REAL SDK, gated by `RUN_REAL_MAPS=1` + a key on the dev server. It drives marker clicks via the dev-only hook `window.__catalogMapTest.clickMarker(title)` (guarded by `import.meta.env.DEV`, tree-shaken out of prod) instead of guessing Google's internal marker DOM, which is version-unstable.
**How to apply:** run `RUN_REAL_MAPS=1 pnpm exec playwright test builder-locais-real-maps`. Note: full Playwright runs in the Replit sandbox are flaky to boot (cold start >60s + background-process reaping across the 2-min shell limit); prefer the documented manual checklist when a full run won't complete.
