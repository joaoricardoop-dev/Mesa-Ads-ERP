---
name: Server auto-geocode hook
description: How locations get map coordinates filled automatically on the server, and the rules that keep coords single-source.
---

# Server auto-geocode hook

`autoGeocodeIfMissing(restaurant)` in `server/db.ts` geocodes a location's stored
address and writes lat/lng — but only when ALL of these hold:
- `status === "active"`
- has a non-empty `address`
- lat/lng are missing (null or empty string)

It is wired into `createActiveRestaurant` and `updateActiveRestaurant` (the
chokepoint for `activeRestaurant.create`/`update`, lead conversion in
`client/src/pages/Leads.tsx`, and advertiser-portal updates), plus the public
self-registration insert in `server/restaurantOnboardingRouter.ts`.

**Why:** Locations created without the AddressAutocomplete widget (lead
conversion plain text input, future bulk imports) arrived with NULL coords and
needed a manual "Preencher coordenadas" click before showing on the map.

**How to apply / invariants:**
- NEVER overwrite coords that already exist — AddressAutocomplete on the client
  is the single origin for chosen coords; this hook only fills gaps.
- `buildGeocodeQuery()` in `server/_core/geocode.ts` is the single source for the
  textual address string (address, neighborhood, city, state, cep, "Brasil");
  both the manual backfill (`backfillCoordinates`) and this hook use it — don't
  re-inline the join.
- Degrades safely: geocode failure (missing `VITE_GOOGLE_MAPS_API_KEY`, network,
  ZERO_RESULTS) only logs a warning and returns the record unchanged. Saves must
  never break because geocoding failed.
- The hook re-runs on every update while coords are still missing (idempotent);
  once coords are set it short-circuits.
