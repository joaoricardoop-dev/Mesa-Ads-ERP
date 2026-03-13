import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import type { User } from "@shared/models/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";

class NotRegisteredError extends Error {
  constructor() {
    super("NOT_REGISTERED");
    this.name = "NotRegisteredError";
  }
}

async function fetchDbUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    if (data.code === "NOT_REGISTERED") {
      throw new NotRegisteredError();
    }
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

const IS_DEV = import.meta.env.DEV;

export function useAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const [devLoggedIn, setDevLoggedIn] = useState(false);

  const devProbe = useQuery<User | null>({
    queryKey: ["/api/auth/user", "dev-probe"],
    queryFn: fetchDbUser,
    enabled: IS_DEV && isLoaded && !isSignedIn && !devLoggedIn,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const hasDevCookie = IS_DEV && !isSignedIn && !!devProbe.data;
  const isEffectivelySignedIn = isSignedIn || devLoggedIn || hasDevCookie;

  const { data: dbUser, isLoading: isDbLoading, isError: isDbError, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user", clerkUser?.id, devLoggedIn || hasDevCookie ? "dev" : "clerk"],
    queryFn: fetchDbUser,
    enabled: isLoaded && (isSignedIn || devLoggedIn),
    retry: (failureCount, err) => {
      if (err instanceof NotRegisteredError) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
  });

  const effectiveUser = hasDevCookie ? devProbe.data : dbUser;
  const user: User | null = isEffectivelySignedIn && effectiveUser ? effectiveUser : null;
  const isNotRegistered = isLoaded && isEffectivelySignedIn && isDbError && error instanceof NotRegisteredError;

  const devLogin = useCallback(async (userId?: string) => {
    const res = await fetch("/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Dev login failed");
    setDevLoggedIn(true);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    return res.json();
  }, [queryClient]);

  const devLogout = useCallback(async () => {
    await fetch("/api/dev-logout", { method: "POST", credentials: "include" });
    setDevLoggedIn(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, [queryClient]);

  const effectivelyLoading = !isLoaded
    || (isSignedIn && isDbLoading)
    || (IS_DEV && !isSignedIn && !devLoggedIn && devProbe.isLoading);

  return {
    user,
    isLoading: effectivelyLoading,
    isAuthenticated: isLoaded && isEffectivelySignedIn && !!user,
    isAuthError: isLoaded && isEffectivelySignedIn && isDbError && !isNotRegistered && !user,
    isNotRegistered,
    logout: (devLoggedIn || hasDevCookie) ? devLogout : () => signOut(),
    isLoggingOut: false,
    clerkUser,
    devLogin,
    devLoggedIn: devLoggedIn || hasDevCookie,
  };
}
