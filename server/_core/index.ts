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

  app.post("/api/_migrate-products", async (req, res) => {
    const SECRET = "mesa-migrate-2025";
    if (req.headers["x-migrate-key"] !== SECRET) {
      return res.status(403).json({ error: "Forbidden" });
    }
    try {
      const { getDb } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();

      const devProducts = [
        { id: 1, name: "Bolacha de Chopp", tipo: "coaster" as const, description: "Porta-copos publicitários para bares e restaurantes", isActive: true, defaultSemanas: 12, categoryId: null },
        { id: 2, name: "Jogo Americano", tipo: "outro" as const, description: null, isActive: true, defaultSemanas: 4, categoryId: null },
        { id: 3, name: "Janela Digital", tipo: "display" as const, description: null, isActive: true, defaultSemanas: 12, categoryId: null },
        { id: 4, name: "Telas", tipo: "display" as const, description: null, isActive: true, defaultSemanas: 12, categoryId: null },
        { id: 5, name: "Ativações Físicas", tipo: "outro" as const, description: null, isActive: true, defaultSemanas: 12, categoryId: null },
      ];

      const devTiers = [
        { productId: 1, volumeMin: 1000, volumeMax: 1000, custoUnitario: "0.4190", frete: "80.38", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 2000, volumeMax: 2000, custoUnitario: "0.3495", frete: "138.16", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 3000, volumeMax: 3000, custoUnitario: "0.3330", frete: "219.03", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 4000, volumeMax: 4000, custoUnitario: "0.3248", frete: "299.41", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 5000, volumeMax: 5000, custoUnitario: "0.2998", frete: "357.19", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 6000, volumeMax: 6000, custoUnitario: "0.2998", frete: "438.06", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 7000, volumeMax: 7000, custoUnitario: "0.2998", frete: "518.44", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 8000, volumeMax: 8000, custoUnitario: "0.2998", frete: "576.22", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 9000, volumeMax: 9000, custoUnitario: "0.2998", frete: "657.09", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 10000, volumeMax: 10000, custoUnitario: "0.2700", frete: "737.47", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 11000, volumeMax: 11000, custoUnitario: "0.2700", frete: "876.12", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 12000, volumeMax: 12000, custoUnitario: "0.2700", frete: "956.50", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 13000, volumeMax: 13000, custoUnitario: "0.2700", frete: "1094.66", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 14000, volumeMax: 14000, custoUnitario: "0.2700", frete: "1175.53", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 15000, volumeMax: 15000, custoUnitario: "0.2700", frete: "1255.91", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 16000, volumeMax: 16000, custoUnitario: "0.2700", frete: "1313.69", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 17000, volumeMax: 17000, custoUnitario: "0.2700", frete: "1394.56", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 18000, volumeMax: 18000, custoUnitario: "0.2700", frete: "1474.94", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 19000, volumeMax: 19000, custoUnitario: "0.2700", frete: "1532.72", margem: "50.00", artes: 1 },
        { productId: 1, volumeMin: 20000, volumeMax: null, custoUnitario: "0.2600", frete: "1613.59", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 1000, volumeMax: 1999, custoUnitario: "0.7300", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 2000, volumeMax: 2999, custoUnitario: "0.5400", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 3000, volumeMax: 3999, custoUnitario: "0.4740", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 4000, volumeMax: 4999, custoUnitario: "0.4400", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 5000, volumeMax: 5999, custoUnitario: "0.4200", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 6000, volumeMax: 6999, custoUnitario: "0.4050", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 7000, volumeMax: 7999, custoUnitario: "0.3960", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 8000, volumeMax: 8999, custoUnitario: "0.3880", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 9000, volumeMax: 9999, custoUnitario: "0.3820", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 2, volumeMin: 10000, volumeMax: null, custoUnitario: "0.3760", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 3, volumeMin: 1, volumeMax: null, custoUnitario: "2280.0000", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 4, volumeMin: 1, volumeMax: null, custoUnitario: "1710.0000", frete: "0.00", margem: "50.00", artes: 1 },
        { productId: 5, volumeMin: 1, volumeMax: null, custoUnitario: "3202.2472", frete: "0.00", margem: "50.00", artes: 1 },
      ];

      await db.transaction(async (tx) => {
        await tx.execute(sql`DELETE FROM product_pricing_tiers`);
        await tx.execute(sql`DELETE FROM products`);
        await tx.execute(sql`ALTER SEQUENCE products_id_seq RESTART WITH 1`);
        await tx.execute(sql`ALTER SEQUENCE product_pricing_tiers_id_seq RESTART WITH 1`);
        for (const p of devProducts) {
          await tx.execute(sql`INSERT INTO products (id, name, tipo, description, "isActive", "defaultSemanas", "categoryId") VALUES (${p.id}, ${p.name}, ${p.tipo}, ${p.description}, ${p.isActive}, ${p.defaultSemanas}, ${p.categoryId})`);
        }
        await tx.execute(sql`SELECT setval('products_id_seq', (SELECT MAX(id) FROM products))`);
        for (const t of devTiers) {
          await tx.execute(sql`INSERT INTO product_pricing_tiers ("productId", "volumeMin", "volumeMax", "custoUnitario", "frete", "margem", "artes") VALUES (${t.productId}, ${t.volumeMin}, ${t.volumeMax}, ${t.custoUnitario}, ${t.frete}, ${t.margem}, ${t.artes})`);
        }
      });

      const finalProducts = await db.execute(sql`SELECT id, name, tipo FROM products ORDER BY id`);
      const finalTiers = await db.execute(sql`SELECT COUNT(*) as c FROM product_pricing_tiers`);
      return res.json({ ok: true, products: finalProducts.rows, tiersCount: finalTiers.rows[0] });
    } catch (err: any) {
      console.error("Migration error:", err);
      return res.status(500).json({ error: err.message });
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
          user = await authStorage.upsertUser({
            id: clerkUser.id,
            email: clerkUser.emailAddresses?.[0]?.emailAddress || null,
            firstName: clerkUser.firstName || meta.firstName || null,
            lastName: clerkUser.lastName || meta.lastName || null,
            profileImageUrl: clerkUser.imageUrl || null,
            role,
            clientId: clientId ? Number(clientId) : null,
            restaurantId: restaurantId ? Number(restaurantId) : null,
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
