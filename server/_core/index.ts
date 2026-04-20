import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { setupClerkAuth } from "../replit_integrations/auth";
import { clerkWebhookHandler } from "../clerkWebhook";
import { setupRestaurantOnboardingRoutes } from "../restaurantOnboardingRouter";
import { setupPublicSigningRoutes } from "../publicSigningRouter";
import { setupPublicLogoUploadRoutes, setupAuthenticatedLogoUploadRoutes } from "../logoUploadRouter";
import { registerObjectStorageRoutes } from "../replit_integrations/object_storage";
import { runMigrations } from "../migrations";
import { exchangeCode } from "../melhorEnvioService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  await runMigrations();

  const app = express();
  const server = createServer(app);
  app.post(
    "/api/webhooks/clerk",
    express.raw({ type: "application/json" }),
    clerkWebhookHandler
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  setupRestaurantOnboardingRoutes(app);
  setupPublicSigningRoutes(app);
  setupPublicLogoUploadRoutes(app);
  registerObjectStorageRoutes(app);

  app.get("/api/melhor-envio/callback", async (req, res) => {
    const { code, error, error_description } = req.query as Record<string, string>;

    const domain = process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN;
    const baseUrl = domain?.startsWith("http") ? domain : `https://${domain}`;
    const callbackUrl = `${baseUrl}/api/melhor-envio/callback`;
    const settingsUrl = `${baseUrl}/configuracoes/integracoes`;

    if (error) {
      console.error("[MelhorEnvio] OAuth error:", error, error_description);
      return res.redirect(`${settingsUrl}?me_error=${encodeURIComponent(error_description || error)}`);
    }

    if (!code) {
      return res.redirect(`${settingsUrl}?me_error=Código de autorização não recebido`);
    }

    try {
      await exchangeCode(code, callbackUrl);
      res.redirect(`${settingsUrl}?me_connected=1`);
    } catch (err: any) {
      console.error("[MelhorEnvio] Token exchange error:", err.message);
      res.redirect(`${settingsUrl}?me_error=${encodeURIComponent(err.message)}`);
    }
  });

  if (process.env.NODE_ENV === "development") {
    const cookieParser = await import("cookie-parser");
    app.use(cookieParser.default());

    app.post("/api/dev-login", async (req, res) => {
      try {
        const { authStorage } = await import("../replit_integrations/auth");
        const allUsers = await authStorage.listUsers();
        const targetId = req.body?.userId;
        let user = targetId
          ? allUsers.find((u) => u.id === targetId)
          : allUsers.find((u) => u.role === "admin") || allUsers[0];
        if (!user) {
          return res.status(404).json({ message: "Nenhum usuário encontrado no banco." });
        }
        res.cookie("dev_user_id", user.id, {
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 24 * 7,
          sameSite: "lax",
          path: "/",
        });
        const { passwordHash: _, ...safeUser } = user;
        res.json(safeUser);
      } catch (error) {
        console.error("Dev login error:", error);
        res.status(500).json({ message: "Erro no dev login." });
      }
    });

    app.post("/api/dev-logout", (_req, res) => {
      res.clearCookie("dev_user_id", { path: "/" });
      res.json({ ok: true });
    });

    app.get("/api/dev-users", async (_req, res) => {
      try {
        const { authStorage } = await import("../replit_integrations/auth");
        const allUsers = await authStorage.listUsers();
        const safeUsers = allUsers.map(({ passwordHash: _, ...u }) => u);
        res.json(safeUsers);
      } catch (error) {
        console.error("Dev users error:", error);
        res.status(500).json({ message: "Erro ao listar usuários." });
      }
    });

    // Test fixture endpoint: ensures an anunciante user exists with a clientId
    // so e2e specs (e.g. checkout-wizard) can run reliably even on a fresh dev
    // DB. The created user uses a stable `e2e-` prefix so /api/dev-delete-user
    // can clean it up afterwards. Only available in development.
    app.post("/api/dev-ensure-anunciante", async (req, res) => {
      try {
        const { authStorage } = await import("../replit_integrations/auth");
        const { getDb } = await import("../db");
        const { clients } = await import("../../drizzle/schema");
        const allUsers = await authStorage.listUsers();
        const existing = allUsers.find(
          (u) => u.role === "anunciante" && u.clientId != null,
        );
        if (existing) {
          const { passwordHash: _, ...safe } = existing;
          return res.json({ user: safe, created: false });
        }

        const db = await getDb();
        if (!db) {
          return res.status(500).json({ message: "Database not available." });
        }
        const requestedClientId = Number(req.body?.clientId);
        let clientId: number | null = Number.isFinite(requestedClientId)
          ? requestedClientId
          : null;
        if (clientId == null) {
          const rows = await db.select({ id: clients.id }).from(clients).limit(1);
          clientId = rows[0]?.id ?? null;
        }
        if (clientId == null) {
          return res
            .status(412)
            .json({ message: "Nenhum cliente cadastrado para vincular ao anunciante de teste." });
        }

        const id = `e2e-anunciante-${Date.now()}`;
        const user = await authStorage.upsertUser({
          id,
          email: `${id}@e2e.test`,
          firstName: "E2E",
          lastName: "Anunciante",
          role: "anunciante",
          clientId,
          isActive: true,
          onboardingComplete: true,
        });
        const { passwordHash: _, ...safe } = user;
        res.json({ user: safe, created: true });
      } catch (error) {
        console.error("Dev ensure anunciante error:", error);
        res.status(500).json({ message: "Erro ao garantir anunciante de teste." });
      }
    });

    // Test fixture: cria/garante usuário restaurante e2e vinculado a um
    // active_restaurants existente. Sem restaurantes cadastrados retorna 412.
    app.post("/api/dev-ensure-restaurante", async (req, res) => {
      try {
        const { authStorage } = await import("../replit_integrations/auth");
        const { getDb } = await import("../db");
        const { activeRestaurants } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });

        const requestedId = Number(req.body?.restaurantId);
        let restaurantId: number | null = Number.isFinite(requestedId) ? requestedId : null;
        if (restaurantId == null) {
          const rows = await db.select({ id: activeRestaurants.id }).from(activeRestaurants).limit(1);
          restaurantId = rows[0]?.id ?? null;
        }
        if (restaurantId == null) {
          return res.status(412).json({ message: "Nenhum restaurante cadastrado." });
        }

        const id = `e2e-restaurante-${Date.now()}`;
        const user = await authStorage.upsertUser({
          id,
          email: `${id}@e2e.test`,
          firstName: "E2E",
          lastName: "Restaurante",
          role: "restaurante",
          restaurantId,
          isActive: true,
          onboardingComplete: true,
        });
        const { passwordHash: _, ...safe } = user;
        res.json({ user: safe, restaurantId, created: true });
      } catch (error) {
        console.error("Dev ensure restaurante error:", error);
        res.status(500).json({ message: "Erro ao garantir restaurante de teste." });
      }
    });

    // Test fixture: cria/garante usuário parceiro e2e vinculado a um partner
    // existente. Sem parceiros cadastrados retorna 412.
    app.post("/api/dev-ensure-parceiro", async (req, res) => {
      try {
        const { authStorage } = await import("../replit_integrations/auth");
        const { getDb } = await import("../db");
        const { partners } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });

        const requestedId = Number(req.body?.partnerId);
        let partnerId: number | null = Number.isFinite(requestedId) ? requestedId : null;
        if (partnerId == null) {
          const rows = await db.select({ id: partners.id }).from(partners).limit(1);
          partnerId = rows[0]?.id ?? null;
        }
        if (partnerId == null) {
          return res.status(412).json({ message: "Nenhum parceiro cadastrado." });
        }

        const id = `e2e-parceiro-${Date.now()}`;
        const user = await authStorage.upsertUser({
          id,
          email: `${id}@e2e.test`,
          firstName: "E2E",
          lastName: "Parceiro",
          role: "parceiro",
          partnerId,
          isActive: true,
          onboardingComplete: true,
        });
        const { passwordHash: _, ...safe } = user;
        res.json({ user: safe, partnerId, created: true });
      } catch (error) {
        console.error("Dev ensure parceiro error:", error);
        res.status(500).json({ message: "Erro ao garantir parceiro de teste." });
      }
    });

    // Test fixture: encontra uma campanha cuja resolução de parceiro
    // (via campaign.partnerId, quotation.partnerId ou client.partnerId)
    // case com o partnerId informado. Espelha resolvePartnerForCampaign
    // do materializer para garantir que a AP de partner_commission será
    // atribuída a esse parceiro.
    app.get("/api/dev-find-campaign-for-partner", async (req, res) => {
      try {
        const partnerId = Number(req.query.partnerId);
        if (!Number.isFinite(partnerId)) {
          return res.status(400).json({ message: "partnerId inválido." });
        }
        const { getDb } = await import("../db");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });
        const { sql } = await import("drizzle-orm");
        const rows = await db.execute(sql`
          SELECT c.id, c."clientId", c.name
          FROM campaigns c
          LEFT JOIN quotations q ON q.id = c."quotationId"
          LEFT JOIN clients cl ON cl.id = c."clientId"
          WHERE c."partnerId" = ${partnerId}
             OR q."partnerId" = ${partnerId}
             OR cl."partnerId" = ${partnerId}
          LIMIT 1;
        `);
        const row = (rows as { rows?: Array<{ id: number; clientId: number; name: string }> })
          .rows?.[0]
          ?? (Array.isArray(rows) ? (rows as Array<{ id: number; clientId: number; name: string }>)[0] : undefined);
        if (!row) return res.status(412).json({ message: "Nenhuma campanha vinculada a esse parceiro." });
        res.json(row);
      } catch (error) {
        console.error("Dev find-campaign-for-partner error:", error);
        res.status(500).json({ message: "Erro ao buscar campanha do parceiro." });
      }
    });

    app.post("/api/dev-delete-user", async (req, res) => {
      try {
        const id = String(req.body?.userId ?? "");
        if (!id.startsWith("e2e-")) {
          return res
            .status(400)
            .json({ message: "Apenas usuários de teste (prefixo 'e2e-') podem ser removidos." });
        }
        const { getDb } = await import("../db");
        const { users } = await import("@shared/models/auth");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) {
          return res.status(500).json({ message: "Database not available." });
        }
        await db.delete(users).where(eq(users.id, id));
        res.json({ ok: true });
      } catch (error) {
        console.error("Dev delete user error:", error);
        res.status(500).json({ message: "Erro ao remover usuário de teste." });
      }
    });
  }

  setupClerkAuth(app);

  setupAuthenticatedLogoUploadRoutes(app);

  app.get("/api/auth/user", async (req, res) => {
    try {
      let userId: string | null = null;

      if (process.env.NODE_ENV === "development") {
        const devUserId = (req as any).cookies?.dev_user_id;
        if (devUserId) {
          userId = devUserId;
        }
      }

      if (!userId) {
        const { getAuth } = await import("@clerk/express");
        const auth = getAuth(req);
        if (auth?.userId) {
          userId = auth.userId;
        }
      }

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { authStorage } = await import("../replit_integrations/auth");
      let user = await authStorage.getUser(userId);
      if (!user) {
        if (process.env.NODE_ENV === "development" && (req as any).cookies?.dev_user_id) {
          return res.status(401).json({ message: "Dev user not found in DB" });
        }
        try {
          const clerkModule = await import("@clerk/express");
          const clerkClient = clerkModule.createClerkClient({
            secretKey: process.env.CLERK_SECRET_KEY!,
          });
          const clerkUser = await clerkClient.users.getUser(userId);
          const meta = (clerkUser.publicMetadata || {}) as any;
          const role = meta.role || "anunciante";
          const isSelfRegistered = !meta.role;

          const clientId = meta.clientId || null;
          const restaurantId = meta.restaurantId || null;
          const partnerId = meta.partnerId || null;
          user = await authStorage.upsertUser({
            id: clerkUser.id,
            email: clerkUser.emailAddresses?.[0]?.emailAddress || null,
            firstName: clerkUser.firstName || meta.firstName || null,
            lastName: clerkUser.lastName || meta.lastName || null,
            profileImageUrl: clerkUser.imageUrl || null,
            role,
            clientId: clientId ? Number(clientId) : null,
            restaurantId: restaurantId ? Number(restaurantId) : null,
            partnerId: partnerId ? Number(partnerId) : null,
            onboardingComplete: !isSelfRegistered,
            selfRegistered: isSelfRegistered,
          });

          if (isSelfRegistered) {
            try {
              await clerkClient.users.updateUserMetadata(clerkUser.id, {
                publicMetadata: { ...meta, role: "anunciante" },
              });
            } catch (metaErr) {
              console.error("Failed to set anunciante role in Clerk metadata:", metaErr);
            }
          }
        } catch (err) {
          console.error("Failed to auto-provision user from Clerk:", err);
          return res.status(403).json({ code: "NOT_REGISTERED", message: "Usuário não cadastrado na plataforma." });
        }
      }
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/auth/lookup-client", async (req, res) => {
    try {
      const cnpj = (req.query.cnpj as string || "").replace(/\D/g, "");
      if (cnpj.length !== 14) {
        return res.status(400).json({ message: "CNPJ invalido." });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available" });
      const { clients } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const formattedCnpj = cnpj.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
      );
      const results = await db.select({
        id: clients.id,
        name: clients.name,
        company: clients.company,
        razaoSocial: clients.razaoSocial,
        cnpj: clients.cnpj,
        segment: clients.segment,
        city: clients.city,
        state: clients.state,
      }).from(clients).where(eq(clients.cnpj, formattedCnpj));
      let client = results[0];
      if (!client) {
        const results2 = await db.select({
          id: clients.id,
          name: clients.name,
          company: clients.company,
          razaoSocial: clients.razaoSocial,
          cnpj: clients.cnpj,
          segment: clients.segment,
          city: clients.city,
          state: clients.state,
        }).from(clients).where(eq(clients.cnpj, cnpj));
        client = results2[0];
      }
      if (!client) {
        return res.status(404).json({ message: "CNPJ nao cadastrado no sistema." });
      }
      res.json(client);
    } catch (error) {
      console.error("Lookup client error:", error);
      res.status(500).json({ message: "Erro interno." });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "5000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

}

startServer().catch(console.error);
