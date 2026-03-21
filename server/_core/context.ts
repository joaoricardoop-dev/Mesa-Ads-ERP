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
    if (process.env.NODE_ENV === "development") {
      const devUserId = (opts.req as any).cookies?.dev_user_id;
      if (devUserId) {
        const devUser = await authStorage.getUser(devUserId);
        if (devUser) {
          user = devUser;
        }
      }
    }

    if (!user) {
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
          const role = meta.role || "anunciante";
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

  const INTERNAL_ROLES = ["admin", "comercial", "operacoes", "financeiro", "manager"];
  if (user && INTERNAL_ROLES.includes(user.role || "")) {
    const impClientId = opts.req.headers["x-impersonate-client-id"];
    const impRestaurantId = opts.req.headers["x-impersonate-restaurant-id"];
    if (impClientId) {
      user = { ...user, role: "anunciante", clientId: parseInt(String(impClientId), 10) };
    }
    if (impRestaurantId) {
      user = { ...user, role: "restaurante", restaurantId: parseInt(String(impRestaurantId), 10) };
    }
  }

  if (user && user.role === "restaurante") {
    const activeRestaurantId = opts.req.headers["x-active-restaurant-id"];
    if (activeRestaurantId) {
      const requestedId = parseInt(String(activeRestaurantId), 10);
      if (!isNaN(requestedId)) {
        try {
          const { getDb } = await import("../db");
          const db = await getDb();
          if (db) {
            const { userRestaurants } = await import("../../drizzle/schema");
            const { and, eq } = await import("drizzle-orm");
            const link = await db
              .select()
              .from(userRestaurants)
              .where(and(eq(userRestaurants.userId, user.id), eq(userRestaurants.restaurantId, requestedId)))
              .limit(1);
            if (link.length > 0) {
              user = { ...user, restaurantId: requestedId };
            }
          }
        } catch {}
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
