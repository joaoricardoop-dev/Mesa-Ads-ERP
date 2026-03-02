import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import type { User } from "@shared/models/auth";
import { useQuery } from "@tanstack/react-query";

async function fetchDbUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
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

  const { data: dbUser, isLoading: isDbLoading, isError: isDbError } = useQuery<User | null>({
    queryKey: ["/api/auth/user", clerkUser?.id],
    queryFn: fetchDbUser,
    enabled: isLoaded && isSignedIn,
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
  });

  const user: User | null = isSignedIn && dbUser ? dbUser : null;

  return {
    user,
    isLoading: !isLoaded || (isSignedIn && isDbLoading),
    isAuthenticated: isLoaded && isSignedIn && !!user,
    isAuthError: isLoaded && isSignedIn && isDbError && !user,
    logout: () => signOut(),
    isLoggingOut: false,
    clerkUser,
  };
}
