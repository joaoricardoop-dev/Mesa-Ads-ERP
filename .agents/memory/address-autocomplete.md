---
name: Address autocomplete (Google Places)
description: How address search/autocomplete works across forms and which Google API it depends on
---

# Address autocomplete

Reusable search-bar component lives in `client/src/components/AddressAutocomplete.tsx`
and is the SINGLE source for parsing Google `address_components` (exported
`parseGoogleAddressComponents`). Used by restaurant onboarding, internal restaurant
form, leads form, clients form, and the media-points (telas) manager.

**Which Google API:** uses the **Places API (New)** via the JS SDK —
`AutocompleteSuggestion.fetchAutocompleteSuggestions()` + `place.fetchFields()`,
NOT the deprecated `google.maps.places.Autocomplete` widget.
**Why:** legacy Autocomplete is blocked for new Cloud projects (post Mar 2025);
the new API is the supported path and gives a custom-styled dropdown.
**Verified:** `VITE_GOOGLE_MAPS_API_KEY` has Places API (New) enabled (tested
against `places.googleapis.com/v1/places:autocomplete`). Brazil bias via
`includedRegionCodes: ["br"]`.

The Maps JS bootstrap loader is now a single source: `client/src/lib/googleMaps.ts`
(`loadGoogleMaps`), shared by `Map.tsx` and `AddressAutocomplete.tsx`.

**How to apply:** any new address field should reuse `AddressAutocomplete` +
`parseGoogleAddressComponents`; never re-parse address_components inline and never
add a second Maps script loader. The telas manager no longer uses Nominatim.
