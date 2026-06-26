import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { ANUNCIANTE_AUTH_FILE } from "./_auth-paths";

// Marketplace v2 — cobre o checkout completo de /montar-campanha pela tela
// "shop" (StepShop): seleciona inventário → preenche o plano → "Enviar cotação"
// → tela de sucesso, exercitando o submit real via quotation.createFromBuilder.
//
// Substitui os testes antigos (step-based wizard), que ficaram stale após o
// commit 243b16f (feat(marketplace-v2)) e estavam `test.describe.skip`. Cobre
// os dois caminhos do done-looks-like: o anunciante (clientId auto-vinculado,
// sem picker) e o usuário interno (ClientPicker → cliente → shop).

type DevUser = {
  id: string;
  role: string;
  clientId: number | null;
  partnerId: number | null;
};

type CreatedQuotation = { id: number; quotationNumber: string };

async function fetchDevUsers(request: APIRequestContext): Promise<DevUser[]> {
  const r = await request.get("/api/dev-users");
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as DevUser[];
}

async function devLogin(request: APIRequestContext, userId: string) {
  const r = await request.post("/api/dev-login", { data: { userId } });
  expect(r.ok(), `dev-login failed for ${userId}`).toBeTruthy();
}

async function devLogout(request: APIRequestContext) {
  await request.post("/api/dev-logout");
}

async function ensureRestaurante(request: APIRequestContext) {
  // Garante ≥1 local de telas no inventário (idempotente). O global.setup já
  // chama isto, mas reforçamos aqui para o spec não depender da ordem de boot.
  const r = await request.post("/api/dev-ensure-restaurante", { data: {} });
  if (!r.ok()) {
    console.warn(`[checkout-wizard] dev-ensure-restaurante falhou: ${r.status()}`);
  }
}

async function createInternalUser(request: APIRequestContext): Promise<DevUser> {
  const r = await request.post("/api/dev-create-internal-user", {
    data: { role: "comercial" },
  });
  expect(r.ok(), `dev-create-internal-user failed: ${r.status()}`).toBeTruthy();
  const body = (await r.json()) as { user: DevUser };
  return body.user;
}

async function deleteDevUser(request: APIRequestContext, userId: string) {
  const res = await request.post("/api/dev-delete-user", { data: { userId } });
  if (!res.ok()) {
    console.warn(
      `[checkout-wizard cleanup] failed to delete dev user ${userId}:`,
      await res.text(),
    );
  }
}

async function deleteQuotationAsAdmin(
  request: APIRequestContext,
  adminUserId: string,
  quotationId: number,
) {
  await devLogin(request, adminUserId);
  const res = await request.post("/api/trpc/quotation.delete?batch=1", {
    data: { "0": { json: { id: quotationId } } },
    headers: { "content-type": "application/json" },
  });
  if (!res.ok()) {
    // Cleanup é best-effort: registra o erro mas não derruba o teste por uma
    // falha de teardown.
    console.warn(
      `[checkout-wizard cleanup] failed to delete quotation ${quotationId}:`,
      await res.text(),
    );
  }
  await devLogout(request);
}

// ─── Helpers de UI da tela "shop" ────────────────────────────────────────────

async function startMediaPlan(page: Page) {
  // StepHero — usuário autenticado vê "montar plano de mídia" (guests veriam
  // "quero anunciar" e seriam redirecionados ao signup).
  const cta = page.getByRole("button", { name: /montar plano de mídia/i });
  await expect(cta).toBeVisible();
  await cta.click();
  // StepShop — cabeçalho do inventário/plano de mídia.
  await expect(page.getByText(/inventário · plano de mídia/i)).toBeVisible();
}

async function addFirstLocation(page: Page) {
  const firstLocal = page.locator("[data-testid^='local-card-']").first();
  await expect(firstLocal).toBeVisible({ timeout: 15_000 });
  // LocationListRow (view "list", padrão) tem exatamente um botão: o toggle de
  // adicionar/remover. Clica nele para incluir o local no plano.
  await firstLocal.getByRole("button").click();
}

async function fillCampaignName(page: Page, name: string) {
  await page.getByPlaceholder(/Verão 2026/i).fill(name);
}

async function submitAndCaptureQuotation(page: Page): Promise<CreatedQuotation> {
  const submit = page.getByRole("button", { name: /enviar cotação/i });
  await expect(submit).toBeEnabled();

  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes("quotation.createFromBuilder") &&
      r.request().method() === "POST",
  );
  await submit.click();
  const resp = await responsePromise;
  expect(resp.ok(), `createFromBuilder failed: ${resp.status()}`).toBeTruthy();
  const body = await resp.json();
  // httpBatchLink encapsula em array de { result: { data: { json } } }.
  const payload = Array.isArray(body) ? body[0] : body;
  const created = payload?.result?.data?.json as CreatedQuotation | undefined;
  expect(created?.id, "expected quotation id in response").toBeTruthy();
  expect(
    created?.quotationNumber,
    "expected quotation number in response",
  ).toBeTruthy();
  return created!;
}

async function expectSuccessScreen(
  page: Page,
  quotationNumber: string,
  opts: { internal: boolean },
) {
  await expect(
    page.getByRole("heading", { name: /cotação/i }),
  ).toBeVisible();
  await expect(page.getByText(quotationNumber, { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("button-go-portal")).toBeVisible();
  if (opts.internal) {
    // O atalho "ver cotação" só aparece para usuários internos.
    await expect(page.getByTestId("button-view-quotation")).toBeVisible();
  } else {
    await expect(page.getByTestId("button-view-quotation")).toHaveCount(0);
  }
}

// ─── Caminho anunciante (clientId auto-vinculado, sem picker) ─────────────────

test.describe("checkout /montar-campanha — anunciante", () => {
  test.use({ storageState: ANUNCIANTE_AUTH_FILE });

  let adminUserId: string | null = null;

  test.beforeAll(async ({ request }) => {
    await ensureRestaurante(request);
    const users = await fetchDevUsers(request);
    adminUserId =
      users.find((u) => u.role === "admin")?.id ??
      users.find((u) =>
        ["comercial", "manager", "operacoes", "financeiro"].includes(u.role),
      )?.id ??
      null;
  });

  test("anunciante monta o plano e cria a cotação", async ({ page }) => {
    let createdId: number | null = null;
    try {
      await page.goto("/montar-campanha");
      await startMediaPlan(page);
      await addFirstLocation(page);
      await fillCampaignName(
        page,
        "E2E Checkout Anunciante " + Date.now(),
      );

      const created = await submitAndCaptureQuotation(page);
      createdId = created.id;
      await expectSuccessScreen(page, created.quotationNumber, {
        internal: false,
      });
    } finally {
      if (createdId != null && adminUserId) {
        await deleteQuotationAsAdmin(page.request, adminUserId, createdId);
      }
    }
  });
});

// ─── Caminho interno (ClientPicker → cliente → shop) ──────────────────────────

test.describe("checkout /montar-campanha — interno (client picker)", () => {
  let internalUser: DevUser | null = null;
  let adminUserId: string | null = null;

  test.beforeAll(async ({ request }) => {
    await ensureRestaurante(request);
    // Garante que exista ao menos um cliente para o picker (o anunciante de
    // teste do global.setup já tem clientId, mas reforçamos chamando o
    // ensure — idempotente).
    await request.post("/api/dev-ensure-anunciante", { data: {} });

    internalUser = await createInternalUser(request);

    const users = await fetchDevUsers(request);
    adminUserId =
      users.find((u) => u.role === "admin")?.id ?? internalUser.id;
  });

  test.afterAll(async ({ request }) => {
    if (internalUser) {
      await deleteDevUser(request, internalUser.id);
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("interno seleciona um cliente no picker e cria a cotação", async ({
    page,
  }) => {
    let createdId: number | null = null;
    try {
      await devLogin(page.request, internalUser!.id);
      await page.goto("/montar-campanha");

      // ClientPicker é a primeira tela para usuários internos.
      await expect(
        page.getByRole("heading", { name: /Selecione o cliente/i }),
      ).toBeVisible();

      // Escolhe o primeiro cliente real da lista (não o atalho "sem cliente").
      const pick = page.locator("[data-testid^='button-pick-client-']").first();
      await expect(pick).toBeVisible();
      await pick.click();

      await startMediaPlan(page);
      await addFirstLocation(page);
      await fillCampaignName(page, "E2E Checkout Interno " + Date.now());

      const created = await submitAndCaptureQuotation(page);
      createdId = created.id;
      await expectSuccessScreen(page, created.quotationNumber, {
        internal: true,
      });
    } finally {
      if (createdId != null && adminUserId) {
        await deleteQuotationAsAdmin(page.request, adminUserId, createdId);
      }
    }
  });
});
