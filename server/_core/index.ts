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
  setupClerkAuth(app);

  app.get("/api/auth/user", async (req, res) => {
    try {
      const { getAuth } = await import("@clerk/express");
      const auth = getAuth(req);
      if (!auth?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { authStorage } = await import("../replit_integrations/auth");
      let user = await authStorage.getUser(auth.userId);
      if (!user) {
        return res.status(403).json({ code: "NOT_REGISTERED", message: "Usuário não cadastrado na plataforma." });
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
