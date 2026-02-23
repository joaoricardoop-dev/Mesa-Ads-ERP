import type { Express, Request, Response } from "express";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (_req: Request, res: Response) => {
    res.redirect(302, "/");
  });
}
