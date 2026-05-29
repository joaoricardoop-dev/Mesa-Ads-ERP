---
name: Silent try/catch swallows import errors
description: Warn-only try/catch around a helper can hide a ReferenceError caused by a missing import; only real-path e2e surfaces it.
---

A helper function used a module-level constant that was NOT in the file's import
list. Calling it threw `ReferenceError: <CONST> is not defined`. Every call site
wrapped the helper in `try { ... } catch (e) { console.warn(...) }`, so the
feature silently did nothing in production-like flows and unit/typecheck passed
(TS does not flag a missing runtime import when the symbol is also a valid type
reference elsewhere, and the throw only happens at runtime on a specific branch).

**Why:** The bug was invisible until an end-to-end test exercised the actual
public page path and asserted the *observable outcome* (due dates reconciled),
not just "no exception thrown".

**How to apply:**
- Be suspicious of `catch { console.warn }` wrappers around business logic — they
  convert hard failures into silent no-ops. Prefer letting unexpected errors
  propagate, or at least assert outcomes in tests rather than absence of throw.
- When wiring a new helper, double-check ALL symbols it uses are imported in its
  own module (constants especially — TS won't always catch a missing value
  import if the name resolves elsewhere as a type).
- For "screen must never show X" guarantees, write an e2e that seeds a bad
  fixture and asserts the rendered result, so swallowed errors can't pass.
