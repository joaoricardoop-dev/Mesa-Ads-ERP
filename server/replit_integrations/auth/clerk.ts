import { clerkMiddleware } from "@clerk/express";
import type { Express } from "express";

export function setupClerkAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(clerkMiddleware());
}
