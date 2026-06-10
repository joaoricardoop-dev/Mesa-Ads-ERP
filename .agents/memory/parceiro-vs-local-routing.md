---
name: Parceiro (role) vs Local (venue) routing
description: The overloaded "parceiro" term split public venue onboarding to /locais; /parceiro is now a redirect only.
---

The word "parceiro" is overloaded in this app and has caused the same class of bug twice:
- **Role `parceiro`** = comercial partner (sales). Logged-in routing at root mounts `ParceiroRouter` (`/`, `/portal`, `/tabela-precos`, `/leads`). Partners are invite-only (no public self-signup).
- **"Local parceiro"** = venue/restaurant. Public self-registration form is `RestaurantOnboarding`.

**Rule:** public venue onboarding lives at `/locais` (and venue invite accept at `/locais/convite/:token`). `/parceiro` must NEVER render the venue form again — it is a compatibility redirect only:
- `/parceiro` → `<Redirect to={"/" + window.location.search}>` (preserves Clerk `__clerk_ticket` query so legacy/buggy invites land at root and sign-up processes with the real role).
- `/parceiro/convite/:token` → `/locais/convite/:token`.

**Why:** a commercial-partner Clerk invite whose `redirectUrl` pointed at `/parceiro` dumped the invitee onto the venue registration form. Even after fixing the invite redirect to root, a stale ticket or any future link to `/parceiro` would re-trigger the bug if `/parceiro` still served the venue form. Separating the namespace removes the failure mode structurally.

**How to apply:** when generating any venue onboarding/invite link, emit `/locais...`. Never point invites (any role) at a path that renders an onboarding form for a *different* entity. Clerk appends `?__clerk_ticket=...` to `redirectUrl`, so the redirect target must be a path that role-routes correctly (root `/`), not a public form route.
