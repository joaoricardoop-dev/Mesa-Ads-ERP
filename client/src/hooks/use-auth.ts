import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import type { User } from "@shared/models/auth";
import { useQuery } from "@tanstack/react-query";
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

export function useAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();

  const { data: dbUser, isLoading: isDbLoading, isError: isDbError, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user", clerkUser?.id],
    queryFn: fetchDbUser,
    enabled: isLoaded && isSignedIn,
    retry: (failureCount, err) => {
      if (err instanceof NotRegisteredError) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
  });

  const user: User | null = isSignedIn && dbUser ? dbUser : null;
  const isNotRegistered = isLoaded && isSignedIn && isDbError && error instanceof NotRegisteredError;

  return {
    user,
    isLoading: !isLoaded || (isSignedIn && isDbLoading),
    isAuthenticated: isLoaded && isSignedIn && !!user,
    isAuthError: isLoaded && isSignedIn && isDbError && !isNotRegistered && !user,
    isNotRegistered,
    logout: () => signOut(),
    isLoggingOut: false,
    clerkUser,
  };
}
