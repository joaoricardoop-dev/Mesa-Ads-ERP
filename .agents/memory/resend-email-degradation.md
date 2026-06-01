---
name: Resend email graceful degradation
description: Why Resend sends can 403 in dev/e2e even when RESEND_API_KEY is set, and why that is expected.
---

# Resend email in this project

`server/email.ts` `sendEmail()` never throws — on missing key or API failure it logs and returns, so callers (e.g. lead handoff to closer) always complete.

**Expected non-bug:** e2e/dev handoff logs a Resend **403 "testing email"** warning. This is NOT a failure.
**Why:** with no verified domain, the sender falls back to `onboarding@resend.dev`, which Resend's test mode only allows delivering to the account owner's own email. Sending to any other address 403s.
**How to apply (production email):** verify a sending domain in the Resend dashboard, then set the `RESEND_FROM` env var to an address on that domain. Until then, treat the 403 as benign; the in-app notification still fires regardless.
