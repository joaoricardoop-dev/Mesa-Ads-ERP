---
name: Toast convention (sonner, not a hook)
description: This codebase has no @/hooks/use-toast; toasts use sonner's toast directly.
---

# Toasts use sonner directly

There is NO `@/hooks/use-toast` / `useToast()` in this repo. Toasts are done with sonner:

```ts
import { toast } from "sonner";
toast.success("..."); toast.error(err.message);
```

`<Toaster />` (from `@/components/ui/sonner`) is mounted in `client/src/App.tsx`.

**Why:** importing the shadcn-style `useToast` hook fails to resolve and costs a build iteration.

**How to apply:** in any new client component, import `toast` from `sonner` and call `toast.success/error/...` — do not scaffold a `useToast` hook.
