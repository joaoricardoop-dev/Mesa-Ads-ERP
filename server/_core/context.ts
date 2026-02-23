import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "@shared/models/auth";
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
    const reqUser = (opts.req as any).user;
    if (reqUser?.claims?.sub) {
      const dbUser = await authStorage.getUser(reqUser.claims.sub);
      user = dbUser ?? null;
    }
  } catch (error) {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
