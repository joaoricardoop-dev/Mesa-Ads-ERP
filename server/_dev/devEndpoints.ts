import type { Express, Response, Request, NextFunction } from "express";
import { sql } from "drizzle-orm";

// Lista de hosts (substring match) considerados de PRODUÇÃO. Se a
// DATABASE_URL atual bater com qualquer um, o sentinel NUNCA é inserido
// e os endpoints /api/dev-* recusam servir — defesa em profundidade
// contra um dev server bootado contra o banco errado.
//
// Configurável via env var `PROD_DB_HOSTS` (CSV de substrings). Quando
// definida, usa só ela (override total). Quando ausente, fallback
// histórico para `.neon.tech` — válido só se o banco de teste rodar
// fora do Neon (ex.: Postgres nativo Replit `helium`). Se o teste
// também é Neon (caso comum: branch dedicado ou projeto Neon separado
// pra E2E), seta `PROD_DB_HOSTS=<substring-unica-do-host-prod>` (ex.:
// "empty-scene-ae775drh") pra distinguir.
function getForbiddenPatterns(): string[] {
  const raw = process.env.PROD_DB_HOSTS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  }
  return [".neon.tech"];
}

function hostOf(connStr: string | undefined): string | null {
  if (!connStr) return null;
  try {
    return new URL(connStr).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProductionHost(host: string | null): boolean {
  if (!host) return false;
  return getForbiddenPatterns().some((p) => host.includes(p));
}

/**
 * Insere a linha sentinel `(true)` em `e2e_test_db_sentinel` se e somente se:
 *  - DEV_FIXTURES === "1" (o caller já garantiu isso ao chamar register)
 *  - O host da DATABASE_URL atual NÃO bate com nenhum host de produção
 *    conhecido (FORBIDDEN_HOST_PATTERNS).
 *
 * O sentinel é a última camada de defesa: mesmo se NODE_ENV, DEV_FIXTURES
 * e a inclusão do módulo vazarem todos juntos pra produção, o banco prod
 * fisicamente não tem essa linha e qualquer endpoint /api/dev-* aborta
 * antes de fazer INSERT.
 */
async function ensureSentinel(): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  const host = hostOf(process.env.DATABASE_URL);
  if (isProductionHost(host)) {
    console.warn(
      `[devEndpoints] Recusando inserir sentinel: DATABASE_URL host "${host}" bate com padrão de produção. Endpoints /api/dev-* permanecerão desabilitados.`,
    );
    return;
  }
  await db.execute(
    sql`INSERT INTO "e2e_test_db_sentinel" ("allowed") VALUES (true) ON CONFLICT DO NOTHING;`,
  );
}

async function sentinelAllows(res: Response): Promise<boolean> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) {
      res.status(503).json({ message: "Database indisponível." });
      return false;
    }
    const rows: any = await db.execute(
      sql`SELECT 1 AS ok FROM "e2e_test_db_sentinel" WHERE "allowed" = true LIMIT 1;`,
    );
    const found =
      (rows?.rows && rows.rows.length > 0) ||
      (Array.isArray(rows) && rows.length > 0);
    if (!found) {
      res.status(503).json({
        message:
          "Endpoint /api/dev-* desabilitado: banco atual não está marcado como banco de teste (sentinel ausente).",
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[devEndpoints] sentinel check error:", err);
    res.status(503).json({ message: "Sentinel check falhou." });
    return false;
  }
}

export async function registerDevEndpoints(app: Express): Promise<void> {
  // Camada 1 (registro condicional por host): se a DATABASE_URL atual bate
  // com qualquer padrão de produção conhecido, NÃO registramos nenhuma
  // rota /api/dev-*. Isso garante que mesmo com DEV_FIXTURES=1 + NODE_ENV
  // =development vazando para um boot de produção, todos os endpoints
  // — incluindo dev-login/dev-logout/dev-users — respondem 404 (rota
  // inexistente) em vez de servir auth-bypass ou listagem de usuários.
  const host = hostOf(process.env.DATABASE_URL);
  if (isProductionHost(host)) {
    console.warn(
      `[devEndpoints] RECUSANDO registrar /api/dev-*: DATABASE_URL host "${host}" bate com padrão de produção. As rotas ficarão como 404.`,
    );
    return;
  }

  await ensureSentinel();

  const cookieParser = await import("cookie-parser");
  app.use(cookieParser.default());

  // Camada 2 (gate global por sentinel): TODAS as rotas /api/dev-* só
  // respondem se o sentinel estiver presente no banco atual. Isso cobre
  // dev-login/dev-logout/dev-users também — eles não fazem INSERT mas
  // expõem auth bypass via cookie dev_user_id, e precisam falhar fechado
  // se o banco atual não for o banco de teste marcado.
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/dev-")) return next();
    if (!(await sentinelAllows(res))) return;
    next();
  });

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

  app.post("/api/dev-ensure-anunciante", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
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
      // Banco de teste recém-criado pode estar 100% vazio (sem clients).
      // Cria um cliente seed E2E em vez de falhar — mesmo padrão usado em
      // /api/dev-ensure-restaurante. Mantém o setup do Playwright robusto
      // contra cenário fresh-DB (Task #210).
      if (clientId == null) {
        const [created] = await db
          .insert(clients)
          .values({
            name: `E2E Cliente Seed ${Date.now()}`,
          })
          .returning({ id: clients.id });
        clientId = created.id;
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

  app.post("/api/dev-ensure-restaurante", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
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

  app.post("/api/dev-ensure-parceiro", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { authStorage } = await import("../replit_integrations/auth");
      const { getDb } = await import("../db");
      const { partners } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available." });

      const requestedId = Number(req.body?.partnerId);
      let partnerId: number | null = Number.isFinite(requestedId) ? requestedId : null;
      if (partnerId == null) {
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

  app.get("/api/dev-find-campaign-for-partner", async (req, res) => {
    try {
      const partnerId = Number(req.query.partnerId);
      if (!Number.isFinite(partnerId)) {
        return res.status(400).json({ message: "partnerId inválido." });
      }
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available." });
      const { sql: dsql } = await import("drizzle-orm");
      const rows = await db.execute(dsql`
        SELECT c.id, c."clientId", c.name
        FROM campaigns c
        LEFT JOIN quotations q ON q.id = c."quotationId"
        LEFT JOIN clients cl ON cl.id = c."clientId"
        WHERE c."partnerId" = ${partnerId}
           OR q."partnerId" = ${partnerId}
           OR cl."partnerId" = ${partnerId}
        LIMIT 1;
      `);
      const row =
        (rows as { rows?: Array<{ id: number; clientId: number; name: string }> })
          .rows?.[0] ??
        (Array.isArray(rows)
          ? (rows as Array<{ id: number; clientId: number; name: string }>)[0]
          : undefined);
      if (!row) return res.status(412).json({ message: "Nenhuma campanha vinculada a esse parceiro." });
      res.json(row);
    } catch (error) {
      console.error("Dev find-campaign-for-partner error:", error);
      res.status(500).json({ message: "Erro ao buscar campanha do parceiro." });
    }
  });

  app.post("/api/dev-seed-restaurant-payment", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
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

      const { clients } = await import("../../drizzle/schema");
      let [camp] = await db.select({ id: campaigns.id }).from(campaigns).limit(1);
      if (!camp) {
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
        [camp] = await db
          .insert(campaigns)
          .values({
            clientId: client.id,
            name: `E2E Campaign ${tag}`,
            startDate,
            endDate,
            status: "draft",
          })
          .returning({ id: campaigns.id });
      }

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

  app.post("/api/dev-ensure-campaign", async (_req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
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

  app.post("/api/dev-seed-campaign-for-partner", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
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

  app.post("/api/dev-ensure-bank-account", async (_req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
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
      if (!(await sentinelAllows(res))) return;
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
