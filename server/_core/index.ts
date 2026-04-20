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
          // Sem restaurante? cria um. Mantém o teste 100% determinístico
          // (acceptance criterion "CI sem skip" — finrefac #9).
          const [created] = await db
            .insert(activeRestaurants)
            .values({
              name: `E2E Restaurante ${Date.now()}`,
              status: "active",
              city: "São Paulo",
              state: "SP",
            })
            .returning({ id: activeRestaurants.id });
          restaurantId = created.id;
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
          // SEMPRE cria um partner novo quando nenhum id é informado.
          // Reusar partner pré-existente vaza estado: APs de partner_commission
          // são agregadas por (partnerId, competenceMonth), então outros testes
          // pré-existentes nesta competência aglutinariam os valores num único
          // AP cujo campaignId é o do primeiro invoice — mascarando a campanha
          // do nosso teste no dashboard. Determinismo > custo de 1 row extra.
          const [created] = await db
            .insert(partners)
            .values({
              name: `E2E Parceiro ${Date.now()}`,
              status: "active",
              commissionPercent: "10.00",
            })
            .returning({ id: partners.id });
          partnerId = created.id;
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

    // Test fixture: insere uma restaurant_payment pendente para o restaurante
    // informado, para que finance-restaurant-portal.spec.ts possa exercitar
    // markPaymentPaid sem depender do estado pré-existente do banco.
    app.post("/api/dev-seed-restaurant-payment", async (req, res) => {
      try {
        const { getDb, addRestaurantPayment } = await import("../db");
        const { campaigns } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });

        const restaurantId = Number(req.body?.restaurantId);
        if (!Number.isFinite(restaurantId)) {
          return res.status(400).json({ message: "restaurantId inválido." });
        }
        const amount = String(req.body?.amount ?? "123.45");
        const refMonth = String(
          req.body?.referenceMonth ?? new Date().toISOString().slice(0, 7),
        );

        // Precisa de uma campanha porque o mirror para accounts_payable
        // dispara dual-write — a primeira disponível serve.
        const [camp] = await db.select({ id: campaigns.id }).from(campaigns).limit(1);
        if (!camp) {
          return res.status(412).json({ message: "Nenhuma campanha cadastrada." });
        }

        // Usa o helper oficial (addRestaurantPayment) p/ que o ledger
        // (accounts_payable) seja sincronizado já no seed — o portal do
        // restaurante lê o pending dali, então sem mirror totalPending=0.
        const [row] = await addRestaurantPayment({
          restaurantId,
          campaignId: camp.id,
          amount,
          referenceMonth: refMonth,
          status: "pending",
          notes: "e2e fixture",
        });
        res.json(row);
      } catch (error) {
        console.error("Dev seed restaurant payment error:", error);
        res.status(500).json({ message: "Erro ao criar restaurant_payment de teste." });
      }
    });

    // Test fixture: garante que existe ao menos uma campanha cadastrada,
    // criando client+campaign genéricos se preciso. Usado pelas specs que
    // só precisam de "qualquer campanha" para emitir uma invoice (lifecycle,
    // dre, audit, bank-reconciliation). Nunca devolve 412 — o teste roda
    // determinístico em CI sem skip (acceptance finrefac #9).
    app.post("/api/dev-ensure-campaign", async (_req, res) => {
      try {
        const { getDb } = await import("../db");
        const { clients, campaigns } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });

        const existing = await db.select({ id: campaigns.id }).from(campaigns).limit(1);
        if (existing[0]) return res.json({ id: existing[0].id, created: false });

        const tag = `e2e-${Date.now()}`;
        const [client] = await db
          .insert(clients)
          .values({ name: `E2E Client ${tag}`, status: "active" })
          .returning();

        const today = new Date();
        const startDate = today.toISOString().slice(0, 10);
        const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const [campaign] = await db
          .insert(campaigns)
          .values({
            clientId: client.id,
            name: `E2E Campaign ${tag}`,
            startDate,
            endDate,
            status: "draft",
          })
          .returning({ id: campaigns.id });

        res.json({ id: campaign.id, created: true });
      } catch (error) {
        console.error("Dev ensure campaign error:", error);
        res.status(500).json({ message: "Erro ao garantir campanha de teste." });
      }
    });

    // Test fixture: cria client + campaign vinculados ao parceiro informado
    // (via campaigns.partnerId), garantindo que finance-partner-portal.spec.ts
    // sempre tenha contra que emitir uma invoice.
    app.post("/api/dev-seed-campaign-for-partner", async (req, res) => {
      try {
        const { getDb } = await import("../db");
        const { clients, campaigns } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });

        const partnerId = Number(req.body?.partnerId);
        if (!Number.isFinite(partnerId)) {
          return res.status(400).json({ message: "partnerId inválido." });
        }

        const tag = `e2e-${Date.now()}`;
        const [client] = await db
          .insert(clients)
          .values({ name: `E2E Client ${tag}`, partnerId, status: "active" })
          .returning();

        const today = new Date();
        const startDate = today.toISOString().slice(0, 10);
        const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const [campaign] = await db
          .insert(campaigns)
          .values({
            clientId: client.id,
            partnerId,
            name: `E2E Campaign ${tag}`,
            startDate,
            endDate,
            status: "draft",
            // Trava taxa de BV explícita p/ que calcPartnerCommission
            // sempre gere AP > 0 (sem depender de partner.commissionPercent
            // pré-existente). Acceptance "CI sem skip" — finrefac #9.
            hasAgencyBv: true,
            agencyBvPercent: "10.00",
          })
          .returning();

        res.json({ id: campaign.id, clientId: client.id, name: campaign.name });
      } catch (error) {
        console.error("Dev seed campaign-for-partner error:", error);
        res.status(500).json({ message: "Erro ao criar campanha de teste." });
      }
    });

    // Test fixture: garante que existe um bank_account para reconciliação
    // bancária e2e. Reaproveita o primeiro disponível ou cria um novo.
    app.post("/api/dev-ensure-bank-account", async (_req, res) => {
      try {
        const { getDb } = await import("../db");
        const { bankAccounts } = await import("../../drizzle/schema");
        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available." });

        const existing = await db.select({ id: bankAccounts.id }).from(bankAccounts).limit(1);
        if (existing[0]) return res.json({ id: existing[0].id, created: false });

        const [row] = await db
          .insert(bankAccounts)
          .values({
            name: "E2E Bank Account",
            bank: "Itau",
            initialBalance: "0",
            currency: "BRL",
            active: true,
          })
          .returning();
        res.json({ id: row.id, created: true });
      } catch (error) {
        console.error("Dev ensure bank-account error:", error);
        res.status(500).json({ message: "Erro ao garantir bank account de teste." });
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
