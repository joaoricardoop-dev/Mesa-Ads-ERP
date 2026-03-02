import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "@shared/models/auth";
import { getAuth } from "@clerk/express";
import { authStorage } from "../replit_integrations/auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const auth = getAuth(opts.req);
    if (auth?.userId) {
      const dbUser = await authStorage.getUser(auth.userId);
      if (dbUser) {
        user = dbUser;
      } else {
        const clerkModule = await import("@clerk/express");
        const clerkClient = clerkModule.createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY!,
        });
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const role = (clerkUser.publicMetadata as any)?.role || "user";
        const clientId = (clerkUser.publicMetadata as any)?.clientId || null;

        const newUser = await authStorage.upsertUser({
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || null,
          firstName: clerkUser.firstName || null,
          lastName: clerkUser.lastName || null,
          profileImageUrl: clerkUser.imageUrl || null,
          role,
          clientId: clientId ? Number(clientId) : null,
        });
        user = newUser;
      }
    }
  } catch (error) {
    console.error("Context auth error:", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
