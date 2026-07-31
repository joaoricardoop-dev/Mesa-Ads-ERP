---
name: Business dates in America/Sao_Paulo
description: Server-side "today"/week logic must use business timezone, not UTC
---
Rule: any server logic that classifies data by "hoje" or by Mon–Sun week (daily checklists, resets, pending/overdue windows) must derive the date in America/Sao_Paulo (e.g. `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })`), never `new Date().toISOString().slice(0,10)`.

**Why:** UTC is 3h ahead of Brazil; after ~21h local the UTC date rolls over, so UTC-based logic resets daily lists early and stores completions under the wrong day. Caught by architect review on the backoffice daily checklist.

**How to apply:** search for `toISOString().slice(0, 10)` in server code whenever adding day/week-based features; note formatIsoDateBR display formatting is UTC-anchored on purpose (see public-signing-coherence) — that rule is about formatting stored ISO dates, this one is about generating "today".
