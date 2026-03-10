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
        const meta = (clerkUser.publicMetadata as any) || {};
        const role = meta.role || "user";
        const clientId = meta.clientId || null;
        const restaurantId = meta.restaurantId || null;

        const newUser = await authStorage.upsertUser({
          id: clerkUser.id,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || null,
          firstName: clerkUser.firstName || null,
          lastName: clerkUser.lastName || null,
          profileImageUrl: clerkUser.imageUrl || null,
          role,
          clientId: clientId ? Number(clientId) : null,
          restaurantId: restaurantId ? Number(restaurantId) : null,
        });
        user = newUser;
      }
    }
  } catch (error) {
    console.error("Context auth error:", error);
    user = null;
  }

  if (process.env.NODE_ENV !== "production" && user && user.role === "admin") {
    const devClientId = opts.req.headers["x-dev-client-id"];
    if (devClientId) {
      user = { ...user, clientId: parseInt(String(devClientId), 10) };
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
