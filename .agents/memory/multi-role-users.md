---
name: Multi-role internal users
description: users.roles jsonb array + shared helpers are the single source for role checks; role stays primary.
---
Internal users can hold multiple roles. `users.role` is the primary (compat); `users.roles` (jsonb string[]) is the full set, mirrored in Clerk publicMetadata (`role` + `roles`) everywhere role is written.

**Rule:** all authorization checks (server guards, tRPC role procedures, frontend canSee/menus) must go through `getEffectiveRoles` / `hasAnyRole` / `canAccess` / `isInternalUser` in `shared/const.ts` — never compare `user.role === "x"` for internal-role gating. `canAccess` auto-passes admin; `hasAnyRole` does not.

**Why:** a user can be comercial+financeiro; single-role comparisons silently lock them out of one area.

**How to apply:** when adding a new guarded route/menu, pass the allowed-roles list to `canAccess(user, [...])`. External roles (anunciante/restaurante/parceiro) are exclusive: if primary role is external, `getEffectiveRoles` returns only it — this makes impersonation overrides safe automatically. When writing roles (invite, updateRole, partner link, webhooks, auto-provision), always set both DB `roles` and Clerk metadata `roles`. Members list is Clerk-sourced, so DB-only dev users never appear there.
