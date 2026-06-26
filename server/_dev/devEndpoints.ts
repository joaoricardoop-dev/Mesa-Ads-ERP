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
        : allUsers.find((u) => u.role === "admin") || null;
      // Em banco fresh (Task #210), o único usuário pode ser o anunciante
      // do setup E2E. Antes caía em allUsers[0] (anunciante) e os finance
      // specs recebiam 403 em financial.* (requireFinancialAccess exige
      // admin/financeiro/manager). Sem userId explícito e sem nenhum
      // admin existente, auto-cria um admin E2E — gateado por sentinel.
      if (!user && !targetId) {
        if (!(await sentinelAllows(res))) return;
        const id = `e2e-admin-${Date.now()}`;
        user = await authStorage.upsertUser({
          id,
          email: `${id}@e2e.test`,
          firstName: "E2E",
          lastName: "Admin",
          role: "admin",
          isActive: true,
          onboardingComplete: true,
        });
      }
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

  // Limpa o draft de carrinho (campaignDrafts) do anunciante de teste. O fluxo
  // /montar-campanha persiste o plano por cliente no servidor (saveCartDraft) e
  // re-hidrata em execuções seguintes — sem isso, itens/datas de um teste
  // anterior vazam para o próximo (ex.: o local já aparece selecionado e o popup
  // do mapa mostra "Remover" em vez de "Adicionar"). Garante isolamento entre runs.
  app.post("/api/dev-clear-cart-draft", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { getDb } = await import("../db");
      const { campaignDrafts, clients } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
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
        return res.json({ ok: true, cleared: 0 });
      }
      const deleted = await db
        .delete(campaignDrafts)
        .where(eq(campaignDrafts.clientId, clientId))
        .returning({ id: campaignDrafts.id });
      res.json({ ok: true, cleared: deleted.length, clientId });
    } catch (error) {
      console.error("Dev clear cart draft error:", error);
      res.status(500).json({ message: "Erro ao limpar draft de carrinho de teste." });
    }
  });

  app.post("/api/dev-ensure-restaurante", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { authStorage } = await import("../replit_integrations/auth");
      const { getDb } = await import("../db");
      const { activeRestaurants, products, productLocations } = await import(
        "../../drizzle/schema"
      );
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available." });

      const requestedId = Number(req.body?.restaurantId);
      let restaurantId: number | null = Number.isFinite(requestedId) ? requestedId : null;
      if (restaurantId == null) {
        const rows = await db.select({ id: activeRestaurants.id }).from(activeRestaurants).limit(1);
        restaurantId = rows[0]?.id ?? null;
      }
      if (restaurantId == null) {
        // active_restaurants tem ~10 colunas NOT NULL sem default (address,
        // neighborhood, contactName/Role, whatsapp, tableCount, seatCount,
        // monthlyCustomers). Em banco fresh (Task #210) NENHUMA linha existe
        // pra herdar valores, então o INSERT minimalista do dev-ensure
        // quebrava com 500. Preenche valores plausíveis pra E2E.
        const [created] = await db
          .insert(activeRestaurants)
          .values({
            name: `E2E Restaurante ${Date.now()}`,
            status: "active",
            address: "Rua E2E Teste, 100",
            neighborhood: "Centro",
            contactName: "E2E Contato",
            contactRole: "Gerente",
            whatsapp: "11999999999",
            tableCount: 20,
            seatCount: 80,
            monthlyCustomers: 5000,
            city: "São Paulo",
            state: "SP",
          })
          .returning({ id: activeRestaurants.id });
        restaurantId = created.id;
      }

      // Garante ≥1 produto visível a anunciantes + product_location ligando
      // ao restaurante. listAvailableLocations (usado pelo wizard de
      // /montar-campanha) cruza product_locations × products onde
      // visibleToAdvertisers=true. Em banco fresh (Task #210), ambas as
      // tabelas nascem vazias e o builder-locais spec falhava por zero cards.
      let productId: number | null = null;
      const visibleProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.visibleToAdvertisers, true)))
        .limit(1);
      productId = visibleProducts[0]?.id ?? null;
      if (productId == null) {
        const [createdProduct] = await db
          .insert(products)
          .values({
            name: `E2E Produto Bolacha ${Date.now()}`,
            tipo: "impressos",
            isActive: true,
            visibleToAdvertisers: true,
          })
          .returning({ id: products.id });
        productId = createdProduct.id;
      }

      // ON CONFLICT DO NOTHING: Playwright roda 4 workers em paralelo e dois
      // podem ambos achar a linha ausente e tentar inserir o mesmo
      // (productId, restaurantId), violando o unique constraint
      // `uq_product_location` → 500. Idempotência via DB resolve a race.
      await db
        .insert(productLocations)
        .values({ productId, restaurantId })
        .onConflictDoNothing({
          target: [productLocations.productId, productLocations.restaurantId],
        });

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
      res.json({ user: safe, restaurantId, productId, created: true });
    } catch (error) {
      console.error("Dev ensure restaurante error:", error);
      // Surfacar mensagem real do erro no body — endpoint é dev-only
      // (sentinel + DEV_FIXTURES gate), então não há risco de vazar
      // detalhes em prod. Sem isso, Playwright só vê "500: Erro ao
      // garantir..." e debug fica cego.
      // Drizzle envolve o erro do pg em DrizzleError com `cause` apontando
      // pro erro original (que tem .code, .detail, .column do Postgres).
      // Sem expor a cause, ficamos só com "Failed query: ..." sem código pg.
      const detail = error instanceof Error ? error.message : String(error);
      const cause = (error as { cause?: unknown })?.cause;
      const causeDetail =
        cause && typeof cause === "object"
          ? {
              message: (cause as Error).message,
              code: (cause as { code?: string }).code,
              detail: (cause as { detail?: string }).detail,
              column: (cause as { column?: string }).column,
              table: (cause as { table?: string }).table,
              constraint: (cause as { constraint?: string }).constraint,
            }
          : String(cause ?? "");
      res.status(500).json({
        message: "Erro ao garantir restaurante de teste.",
        detail,
        cause: causeDetail,
      });
    }
  });

  // Garante ≥1 LOCAL DE TELAS (inventário por local, precificado por CPM)
  // disponível no catálogo de /comercial/orcamento. Diferente de
  // dev-ensure-restaurante (que cria um produto "impressos" por quantidade),
  // aqui precisamos de um produto tipo "telas", um active_restaurant com TODAS
  // as colunas de CPM preenchidas (sem elas computeCpmPricing devolve null e o
  // local some do catálogo), um product_location ligando os dois, e ≥1 tela
  // ativa (telas.status='active' alimenta screensCount). Idempotente: reusa um
  // local de telas existente quando já houver um.
  app.post("/api/dev-ensure-screen-location", async (_req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { getDb } = await import("../db");
      const { activeRestaurants, products, productLocations, telas } =
        await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available." });

      // Produto tipo "telas" visível a anunciantes (fonte do productSlot de telas).
      let screenProduct = (
        await db
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.tipo, "telas"),
              eq(products.isActive, true),
              eq(products.visibleToAdvertisers, true),
            ),
          )
          .limit(1)
      )[0];
      if (!screenProduct) {
        [screenProduct] = await db
          .insert(products)
          .values({
            name: `E2E Telas ${Date.now()}`,
            tipo: "telas",
            isActive: true,
            visibleToAdvertisers: true,
          })
          .returning({ id: products.id });
      }
      const productId = screenProduct.id;

      // Reusa um local que já tenha esse produto de telas vinculado, se houver.
      const existingLink = (
        await db
          .select({ restaurantId: productLocations.restaurantId })
          .from(productLocations)
          .where(eq(productLocations.productId, productId))
          .limit(1)
      )[0];

      let restaurantId: number;
      if (existingLink) {
        restaurantId = existingLink.restaurantId;
        // Garante que as colunas de CPM estejam preenchidas (um local legado
        // pode existir sem elas, o que zeraria o preço e o esconderia do
        // catálogo).
        await db
          .update(activeRestaurants)
          .set({
            lat: "-23.5505",
            lng: "-46.6333",
            screenCpm: "30.00",
            screenInsertionsPerHour: 12,
            screenImpactsPerInsertion: "1.50",
            screenWeeklyHours: "84.00",
            screenExposureSec: 10,
            dailyLoops: 144,
          })
          .where(eq(activeRestaurants.id, restaurantId));
      } else {
        const [restaurant] = await db
          .insert(activeRestaurants)
          .values({
            name: `E2E Local Telas ${Date.now()}`,
            status: "active",
            address: "Rua E2E Telas, 200",
            neighborhood: "Centro",
            lat: "-23.5505",
            lng: "-46.6333",
            contactName: "E2E Contato Telas",
            contactRole: "Gerente",
            whatsapp: "11988888888",
            tableCount: 20,
            seatCount: 80,
            monthlyCustomers: 8000,
            city: "São Paulo",
            state: "SP",
            categoria: "restaurante",
            screenCpm: "30.00",
            screenInsertionsPerHour: 12,
            screenImpactsPerInsertion: "1.50",
            screenWeeklyHours: "84.00",
            screenExposureSec: 10,
            dailyLoops: 144,
          })
          .returning({ id: activeRestaurants.id });
        restaurantId = restaurant.id;

        await db
          .insert(productLocations)
          .values({ productId, restaurantId })
          .onConflictDoNothing({
            target: [productLocations.productId, productLocations.restaurantId],
          });
      }

      // Garante ≥1 tela ativa (screensCount > 0).
      const activeScreen = (
        await db
          .select({ id: telas.id })
          .from(telas)
          .where(and(eq(telas.restaurantId, restaurantId), eq(telas.status, "active")))
          .limit(1)
      )[0];
      if (!activeScreen) {
        await db.insert(telas).values({
          restaurantId,
          nome: "E2E Tela 1",
          categoria: "restaurante",
          status: "active",
        });
      }

      res.json({ restaurantId, productId });
    } catch (error) {
      console.error("Dev ensure screen-location error:", error);
      const detail = error instanceof Error ? error.message : String(error);
      const cause = (error as { cause?: unknown })?.cause;
      const causeDetail =
        cause && typeof cause === "object"
          ? {
              message: (cause as Error).message,
              code: (cause as { code?: string }).code,
              detail: (cause as { detail?: string }).detail,
              column: (cause as { column?: string }).column,
              table: (cause as { table?: string }).table,
              constraint: (cause as { constraint?: string }).constraint,
            }
          : String(cause ?? "");
      res.status(500).json({
        message: "Erro ao garantir local de telas de teste.",
        detail,
        cause: causeDetail,
      });
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

  // Setup completo para os testes E2E dos construtores de plano de mídia dos
  // portais (MediaShopBuilder). Diferente de dev-ensure-screen-location /
  // dev-ensure-restaurante (que só marcam produtos como visíveis a
  // ANUNCIANTES), aqui garantimos inventário visível a AMBOS os perfis
  // (anunciante e parceiro) e com PREÇO determinístico, além do vínculo
  // parceiro→cliente que o fluxo self_service_parceiro exige:
  //   1. Produto "telas" visível a anunciantes+parceiros + local com CPM
  //      completo + ≥1 tela ativa (alimenta a seção de telas do catálogo).
  //   2. Produto por quantidade visível a anunciantes+parceiros COM tier de
  //      preço (custoUnitario+margem) — sem o tier o botão "Adicionar" fica
  //      desabilitado ("Sob consulta").
  //   3. Parceiro + cliente vinculado (clients.partnerId) + usuário parceiro.
  //   4. Usuário anunciante com clientId (reusa um existente se houver).
  // Idempotente via lookup por nome estável + onConflictDoNothing.
  app.post("/api/dev-ensure-portal-builder", async (_req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { authStorage } = await import("../replit_integrations/auth");
      const { getDb } = await import("../db");
      const {
        products,
        productPricingTiers,
        productLocations,
        activeRestaurants,
        telas,
        partners,
        clients,
      } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available." });

      // Nomes E2E FIXOS (sem timestamp): reusados entre execuções e ÚNICOS no
      // catálogo, então a suíte localiza exatamente o local/produto que ESTE
      // endpoint configura (com CPM/tier), sem depender de "o primeiro" do
      // catálogo — que seria não-determinístico e poderia cair num local sem CPM.
      const TELAS_PRODUCT_NAME = "E2E Portal Telas";
      const TELAS_LOCATION_NAME = "E2E Portal Local Telas";
      const QTY_PRODUCT_NAME = "E2E Portal Bolacha";

      // ── 1. Produto de telas DEDICADO, visível a anunciantes + parceiros ────
      let telasProduct = (
        await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.name, TELAS_PRODUCT_NAME), eq(products.tipo, "telas")))
          .limit(1)
      )[0];
      if (!telasProduct) {
        [telasProduct] = await db
          .insert(products)
          .values({
            name: TELAS_PRODUCT_NAME,
            tipo: "telas",
            isActive: true,
            visibleToAdvertisers: true,
            visibleToPartners: true,
          })
          .returning({ id: products.id });
      } else {
        await db
          .update(products)
          .set({ isActive: true, visibleToAdvertisers: true, visibleToPartners: true })
          .where(eq(products.id, telasProduct.id));
      }
      const telasProductId = telasProduct.id;

      // ── Local de telas DEDICADO com CPM completo, ligado ao produto ────────
      const cpmConfig = {
        screenCpm: "30.00",
        screenInsertionsPerHour: 12,
        screenImpactsPerInsertion: "1.50",
        screenWeeklyHours: "84.00",
        screenExposureSec: 10,
        dailyLoops: 144,
      };
      let restaurant = (
        await db
          .select({ id: activeRestaurants.id })
          .from(activeRestaurants)
          .where(eq(activeRestaurants.name, TELAS_LOCATION_NAME))
          .limit(1)
      )[0];
      if (!restaurant) {
        [restaurant] = await db
          .insert(activeRestaurants)
          .values({
            name: TELAS_LOCATION_NAME,
            status: "active",
            address: "Rua E2E Portal, 300",
            neighborhood: "Centro",
            contactName: "E2E Contato Portal",
            contactRole: "Gerente",
            whatsapp: "11977777777",
            tableCount: 20,
            seatCount: 80,
            monthlyCustomers: 8000,
            city: "São Paulo",
            state: "SP",
            categoria: "restaurante",
            ...cpmConfig,
          })
          .returning({ id: activeRestaurants.id });
      } else {
        await db
          .update(activeRestaurants)
          .set({ status: "active", ...cpmConfig })
          .where(eq(activeRestaurants.id, restaurant.id));
      }
      const restaurantId = restaurant.id;
      await db
        .insert(productLocations)
        .values({ productId: telasProductId, restaurantId })
        .onConflictDoNothing({
          target: [productLocations.productId, productLocations.restaurantId],
        });

      const activeScreen = (
        await db
          .select({ id: telas.id })
          .from(telas)
          .where(and(eq(telas.restaurantId, restaurantId), eq(telas.status, "active")))
          .limit(1)
      )[0];
      if (!activeScreen) {
        await db.insert(telas).values({
          restaurantId,
          nome: "E2E Portal Tela 1",
          categoria: "restaurante",
          status: "active",
        });
      }

      // ── 2. Produto por quantidade DEDICADO visível a ambos COM tier ────────
      let qtyProduct = (
        await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.name, QTY_PRODUCT_NAME), eq(products.tipo, "impressos")))
          .limit(1)
      )[0];
      if (!qtyProduct) {
        [qtyProduct] = await db
          .insert(products)
          .values({
            name: QTY_PRODUCT_NAME,
            tipo: "impressos",
            unitLabel: "bolacha",
            unitLabelPlural: "bolachas",
            pricingMode: "cost_based",
            isActive: true,
            visibleToAdvertisers: true,
            visibleToPartners: true,
          })
          .returning({ id: products.id });
      } else {
        await db
          .update(products)
          .set({ isActive: true, visibleToAdvertisers: true, visibleToPartners: true })
          .where(eq(products.id, qtyProduct.id));
      }
      const quantityProductId = qtyProduct.id;

      const existingTier = (
        await db
          .select({ id: productPricingTiers.id })
          .from(productPricingTiers)
          .where(eq(productPricingTiers.productId, quantityProductId))
          .limit(1)
      )[0];
      if (!existingTier) {
        await db.insert(productPricingTiers).values({
          productId: quantityProductId,
          volumeMin: 1,
          volumeMax: null,
          custoUnitario: "2.0000",
          frete: "0.00",
          margem: "50.00",
          artes: 1,
        });
      }

      // ── 3. Parceiro + cliente vinculado + usuário parceiro ─────────────────
      let partner = (
        await db
          .select({ id: partners.id })
          .from(partners)
          .where(eq(partners.status, "active"))
          .limit(1)
      )[0];
      if (!partner) {
        [partner] = await db
          .insert(partners)
          .values({
            name: `E2E Portal Parceiro ${Date.now()}`,
            status: "active",
            commissionPercent: "20.00",
          })
          .returning({ id: partners.id });
      }
      const partnerId = partner.id;

      let parceiroClient = (
        await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.partnerId, partnerId))
          .limit(1)
      )[0];
      if (!parceiroClient) {
        [parceiroClient] = await db
          .insert(clients)
          .values({
            name: `E2E Portal Cliente Parceiro ${Date.now()}`,
            company: `E2E Portal Cliente Parceiro ${Date.now()}`,
            partnerId,
            status: "active",
          })
          .returning({ id: clients.id });
      }
      const parceiroClientId = parceiroClient.id;

      const allUsers = await authStorage.listUsers();
      let parceiroUser = allUsers.find(
        (u) => u.role === "parceiro" && u.partnerId === partnerId,
      );
      if (!parceiroUser) {
        const pid = `e2e-portal-parceiro-${Date.now()}`;
        parceiroUser = await authStorage.upsertUser({
          id: pid,
          email: `${pid}@e2e.test`,
          firstName: "E2E",
          lastName: "Parceiro Portal",
          role: "parceiro",
          partnerId,
          isActive: true,
          onboardingComplete: true,
        });
      }

      // ── 4. Usuário anunciante (reusa existente ou cria com cliente novo) ────
      let anuncianteUser = allUsers.find(
        (u) => u.role === "anunciante" && u.clientId != null,
      );
      if (!anuncianteUser) {
        const [seedClient] = await db
          .insert(clients)
          .values({
            name: `E2E Portal Cliente Anunciante ${Date.now()}`,
            company: `E2E Portal Cliente Anunciante ${Date.now()}`,
            status: "active",
          })
          .returning({ id: clients.id });
        const aid = `e2e-portal-anunciante-${Date.now()}`;
        anuncianteUser = await authStorage.upsertUser({
          id: aid,
          email: `${aid}@e2e.test`,
          firstName: "E2E",
          lastName: "Anunciante Portal",
          role: "anunciante",
          clientId: seedClient.id,
          isActive: true,
          onboardingComplete: true,
        });
      }

      // Nomes reais (o endpoint pode reusar produtos/clientes pré-existentes,
      // então a suíte NÃO pode assumir nomes fixos — fonte única: estes selects).
      const quantityProductName = (
        await db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, quantityProductId))
          .limit(1)
      )[0]?.name;
      const telasProductName = (
        await db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, telasProductId))
          .limit(1)
      )[0]?.name;
      const parceiroClientName = (
        await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, parceiroClientId))
          .limit(1)
      )[0]?.name;
      // Nome do local de telas com CPM configurado — a suíte adiciona ESTE local
      // específico (e não "o primeiro" do catálogo), garantindo que o item de
      // tela tenha precificação CPM no createFromBuilder.
      const restaurantName = (
        await db
          .select({ name: activeRestaurants.name })
          .from(activeRestaurants)
          .where(eq(activeRestaurants.id, restaurantId))
          .limit(1)
      )[0]?.name;

      res.json({
        anuncianteUserId: anuncianteUser.id,
        anuncianteClientId: anuncianteUser.clientId,
        parceiroUserId: parceiroUser.id,
        partnerId,
        parceiroClientId,
        parceiroClientName,
        telasProductId,
        telasProductName,
        quantityProductId,
        quantityProductName,
        restaurantId,
        restaurantName,
      });
    } catch (error) {
      console.error("Dev ensure portal-builder error:", error);
      const detail = error instanceof Error ? error.message : String(error);
      const cause = (error as { cause?: unknown })?.cause;
      const causeDetail =
        cause && typeof cause === "object"
          ? {
              message: (cause as Error).message,
              code: (cause as { code?: string }).code,
              detail: (cause as { detail?: string }).detail,
              column: (cause as { column?: string }).column,
              table: (cause as { table?: string }).table,
              constraint: (cause as { constraint?: string }).constraint,
            }
          : String(cause ?? "");
      res.status(500).json({
        message: "Erro ao garantir setup do portal builder.",
        detail,
        cause: causeDetail,
      });
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
        (rows as unknown as { rows?: Array<{ id: number; clientId: number; name: string }> })
          .rows?.[0] ??
        (Array.isArray(rows)
          ? (rows as unknown as Array<{ id: number; clientId: number; name: string }>)[0]
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

  // Task #218 — semeia uma cotação assinável com BV embutido (totalValue >
  // soma dos itens brutos) e um cronograma de vencimentos LEGADO incoerente
  // (parcelas vencendo antes do início do período). Usado pelo e2e
  // public-signing-coerencia.spec.ts pra validar que a tela pública nunca
  // mostra preços/vencimentos divergentes: o auto-heal do GET reconcilia os
  // vencimentos e o front-end escala os itens para fechar com o total geral.
  app.post("/api/dev-seed-signable-quotation", async (_req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { getDb } = await import("../db");
      const {
        clients,
        products,
        quotations,
        quotationItems,
        serviceOrders,
        campaignBatches,
        billingScheduleItems,
      } = await import("../../drizzle/schema");
      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available." });

      const stamp = Date.now();

      // ISO YYYY-MM-DD helper (offset em dias a partir de hoje, UTC).
      const isoDay = (offsetDays: number): string => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + offsetDays);
        return d.toISOString().slice(0, 10);
      };

      // Cliente
      const [client] = await db
        .insert(clients)
        .values({ name: `E2E Cliente Assinatura ${stamp}` })
        .returning({ id: clients.id });

      // Produto com rótulo de unidade no plural
      const [product] = await db
        .insert(products)
        .values({
          name: `E2E Bolacha Premium ${stamp}`,
          tipo: "impressos",
          isActive: true,
          visibleToAdvertisers: true,
          unitLabelPlural: "bolachas",
        })
        .returning({ id: products.id });

      // Período no futuro — qualquer vencimento legado antes disso é incoerente.
      const periodStart = isoDay(40);
      const periodEnd = isoDay(68);

      // Batch (período) — necessário pro batchSelectionJson da OS.
      const [batch] = await db
        .insert(campaignBatches)
        .values({
          year: new Date().getUTCFullYear(),
          batchNumber: 1,
          label: `E2E Batch ${stamp}`,
          startDate: periodStart,
          endDate: periodEnd,
          isActive: true,
        })
        .returning({ id: campaignBatches.id });

      // Cotação: totalValue (4800) já traz BV/comissão de agência embutido —
      // diverge da soma dos itens brutos (4000) → fator de escala 1.2.
      const publicToken = `e2e-token-${stamp}-${Math.random().toString(36).slice(2, 10)}`;
      const [quotation] = await db
        .insert(quotations)
        .values({
          quotationNumber: `E2E-${stamp}`,
          quotationName: `E2E Cotação BV ${stamp}`,
          clientId: client.id,
          productId: product.id,
          status: "os_gerada",
          totalValue: "4800.00",
          agencyCommissionPercent: "20",
          periodStart,
          publicToken,
        })
        .returning({ id: quotations.id });

      // Itens BRUTOS: soma = 4000.00 (≠ totalValue 4800.00).
      await db.insert(quotationItems).values([
        {
          quotationId: quotation.id,
          productId: product.id,
          quantity: 2000,
          unitPrice: "1.5000",
          totalPrice: "3000.00",
        },
        {
          quotationId: quotation.id,
          productId: product.id,
          quantity: 1000,
          unitPrice: "1.0000",
          totalPrice: "1000.00",
        },
      ]);

      // OS vinculada com período no futuro + batch selecionado.
      const [os] = await db
        .insert(serviceOrders)
        .values({
          orderNumber: `E2E-OS-${stamp}`,
          type: "anunciante",
          clientId: client.id,
          quotationId: quotation.id,
          description: `E2E OS Assinatura ${stamp}`,
          periodStart,
          periodEnd,
          totalValue: "4800.00",
          status: "rascunho",
          batchSelectionJson: JSON.stringify([batch.id]),
          productId: product.id,
        })
        .returning({ id: serviceOrders.id });

      // Cronograma LEGADO incoerente: parcelas vencendo antes do período.
      // Σ parcelas = 4800.00 (bate com totalValue), mas vencimentos são
      // anteriores ao início (today-10 e today+20 < periodStart today+40).
      await db.insert(billingScheduleItems).values([
        {
          ownerType: "quotation",
          ownerId: quotation.id,
          sequence: 1,
          amount: "2400.00",
          dueDate: isoDay(-10),
        },
        {
          ownerType: "quotation",
          ownerId: quotation.id,
          sequence: 2,
          amount: "2400.00",
          dueDate: isoDay(20),
        },
      ]);

      res.json({
        token: publicToken,
        quotationId: quotation.id,
        serviceOrderId: os.id,
        clientId: client.id,
        productId: product.id,
        periodStart,
        totalValue: "4800.00",
      });
    } catch (error) {
      console.error("Dev seed signable quotation error:", error);
      const detail = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: "Erro ao semear cotação assinável de teste.", detail });
    }
  });

  // Cria um usuário interno de teste com tags configuráveis (isCloser/isSdr).
  // Usado pelos specs de handoff (Task #248) que precisam de um Closer real e
  // de um interno SEM a tag para exercitar tanto o seletor (lead.listClosers)
  // quanto a recusa server-side (handoffToCloser). Gateado por sentinel como
  // todas as rotas /api/dev-*; o id sempre nasce com prefixo "e2e-" para que o
  // cleanup via dev-delete-user consiga removê-lo.
  app.post("/api/dev-create-internal-user", async (req, res) => {
    try {
      if (!(await sentinelAllows(res))) return;
      const { authStorage } = await import("../replit_integrations/auth");
      const role = typeof req.body?.role === "string" ? req.body.role : "comercial";
      const isCloser = req.body?.isCloser === true;
      const isSdr = req.body?.isSdr === true;
      const isActive = req.body?.isActive === false ? false : true;
      const firstName = typeof req.body?.firstName === "string" ? req.body.firstName : "E2E";
      const lastName = typeof req.body?.lastName === "string" ? req.body.lastName : "Interno";
      const id = `e2e-internal-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const user = await authStorage.upsertUser({
        id,
        email: `${id}@e2e.test`,
        firstName,
        lastName,
        role,
        isCloser,
        isSdr,
        isActive,
        onboardingComplete: true,
      });
      const { passwordHash: _, ...safe } = user;
      res.json({ user: safe, created: true });
    } catch (error) {
      console.error("Dev create internal user error:", error);
      res.status(500).json({ message: "Erro ao criar usuário interno de teste." });
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
