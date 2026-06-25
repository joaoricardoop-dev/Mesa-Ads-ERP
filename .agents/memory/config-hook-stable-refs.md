---
name: Config hooks must return stable references
description: Hooks that derive config objects must memoize their return, or consumer effects that setState on [hook] loop infinitely.
---

# Config hooks must return stable references

A hook that reads config and returns a freshly-built object/array each render
(e.g. `return { premissas: { irpj: pct(...) }, ... }`) hands a NEW reference to
every consumer on every render. Any consumer with
`useEffect(() => { ...setState... }, [hookValue])` then re-fires every render →
`setState` → re-render → new reference → effect again → infinite loop →
React throws "Maximum update depth exceeded" and the page hits the global error
boundary ("An unexpected error occurred").

**Why:** This is exactly how the price simulator (`PriceTable.tsx`) crashed: it
seeds local `premissas` from `useSystemPremissas()` via
`useEffect(() => { if (selectedProduct) setPremissas(sysPremissas) }, [selectedProduct, sysPremissas])`.
`useSystemPremissas` built its return object inline, so `sysPremissas` changed
identity every render and the effect looped whenever a product was selected. The
crash only surfaces when there IS data to select (the isolated E2E DB has
products), which is why it was invisible until an e2e test loaded the page with
real data.

**How to apply:** Wrap the derived return of any config/derivation hook in
`useMemo` keyed on the underlying raw inputs (e.g. React Query `data?.values` +
`isLoading`), not on derived values. React Query already returns a stable `data`
ref between renders (structural sharing), so memoizing on it gives consumers a
stable object. The return shape is identical, so memoization is transparent and
strictly safer for all consumers. Prefer fixing the hook over patching each
consumer effect's deps.
