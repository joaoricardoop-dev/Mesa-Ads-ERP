import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const HERO_HEADLINE = /tenta me/i;

type DevUser = {
  id: string;
  role: string;
  clientId: number | null;
  partnerId: number | null;
};

type CreatedQuotation = { id: number; quotationNumber: string };

const INTERNAL_ROLES = ["admin", "comercial", "manager", "operacoes", "financeiro"];

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
    // Cleanup is best-effort; surface the error so it shows up in logs but
    // don't fail the test on a teardown problem.
    console.warn(
      `[checkout-wizard cleanup] failed to delete quotation ${quotationId}:`,
      await res.text(),
    );
  }
  await devLogout(request);
}

async function pickFirstProductAndStart(page: Page) {
  const products = page.locator("[data-testid^='product-pill-']");
  await expect(products.first()).toBeVisible();
  await products.first().click();

  const cta = page.getByRole("button", { name: /começar checkout/i });
  await expect(cta).toBeEnabled();
  await cta.click();
}

async function completeWizardThroughConfirm(page: Page) {
  // 02 · locais — pick the first venue card (filtered by its MapPin icon)
  await expect(page.getByText(/02 · locais/i)).toBeVisible();
  const venueCards = page
    .locator("main button")
    .filter({ has: page.locator("svg.lucide-map-pin") });
  await expect(venueCards.first()).toBeVisible();
  await venueCards.first().click();
  await page.getByRole("button", { name: /^continuar$/i }).click();

  // 03 · volume — defaults satisfy the >=100 rule
  await expect(page.getByText(/03 · volume/i)).toBeVisible();
  await page.getByRole("button", { name: /^continuar$/i }).click();

  // 04 · duração — default 12 weeks is preselected
  await expect(page.getByText(/04 · duração/i)).toBeVisible();
  await page.getByRole("button", { name: /^continuar$/i }).click();

  // 05 · adicionais — skip
  await expect(page.getByText(/05 · adicionais/i)).toBeVisible();
  await page.getByRole("button", { name: /pular adicionais/i }).click();

  // 06 · arte — choose "agency" and fill briefing
  await expect(page.getByText(/06 · arte/i)).toBeVisible();
  await page.getByRole("button", { name: /quero que a agência crie/i }).click();
  const briefing = page.getByPlaceholder(/Sobre a marca/i);
  await expect(briefing).toBeVisible();
  await briefing.fill(
    "Briefing automatizado de teste ponta-a-ponta para validar o fluxo de checkout.",
  );
  await page.getByRole("button", { name: /^continuar$/i }).click();

  // 07 · revisão — campaign name is pre-filled, just set start date
  await expect(page.getByText(/07 · revisão/i)).toBeVisible();
  const today = new Date().toISOString().slice(0, 10);
  await page.locator('input[type="date"]').fill(today);
}

async function submitAndCaptureQuotation(page: Page): Promise<CreatedQuotation> {
  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("quotation.createFromBuilder") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /enviar cotação/i }).click();
  const resp = await responsePromise;
  expect(resp.ok(), `createFromBuilder failed: ${resp.status()}`).toBeTruthy();
  const body = await resp.json();
  // httpBatchLink wraps responses in an array of { result: { data: { json } } }
  const payload = Array.isArray(body) ? body[0] : body;
  const created = payload?.result?.data?.json as CreatedQuotation | undefined;
  expect(created?.id, "expected quotation id in response").toBeTruthy();
  expect(created?.quotationNumber, "expected quotation number in response").toBeTruthy();
  return created!;
}

async function expectSuccessScreen(page: Page, quotationNumber: string) {
  await expect(page.getByRole("heading", { name: /cotação/i })).toBeVisible();
  await expect(page.getByText(/enviada/i)).toBeVisible();
  await expect(page.getByText(quotationNumber, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("button-go-portal")).toBeVisible();
}

test.describe("checkout wizard ponta-a-ponta", () => {
  let adminUserId: string | null = null;
  let anuncianteUser: DevUser | null = null;
  let internalUser: DevUser | null = null;
  let venueAvailable = false;
  let firstClientName: string | null = null;

  test.beforeAll(async ({ request }) => {
    const users = await fetchDevUsers(request);
    const admin = users.find((u) => u.role === "admin") ??
      users.find((u) => INTERNAL_ROLES.includes(u.role));
    adminUserId = admin?.id ?? null;
    anuncianteUser = users.find((u) => u.role === "anunciante" && u.clientId != null) ?? null;
    internalUser = users.find((u) => INTERNAL_ROLES.includes(u.role)) ?? null;

    // Both probes below need an authenticated session (procedures are protected).
    if (adminUserId) {
      await devLogin(request, adminUserId);

      const venuesRes = await request.get(
        "/api/trpc/activeRestaurant.list?input=" +
          encodeURIComponent(JSON.stringify({ json: null })),
      );
      if (venuesRes.ok()) {
        const data = await venuesRes.json();
        const list = data?.result?.data?.json ?? [];
        venueAvailable = Array.isArray(list) && list.length > 0;
      }

      const clientsRes = await request.get(
        "/api/trpc/advertiser.listByPartner?input=" +
          encodeURIComponent(JSON.stringify({ json: {} })),
      );
      if (clientsRes.ok()) {
        const data = await clientsRes.json();
        const list = (data?.result?.data?.json ?? []) as Array<{
          name: string | null;
          company: string | null;
        }>;
        const first = list[0];
        if (first) {
          firstClientName = first.company || first.name || null;
        }
      }

      await devLogout(request);
    }
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("anunciante percorre o wizard até a cotação criada", async ({ page }) => {
    test.skip(!anuncianteUser, "no anunciante user with clientId in dev DB");
    test.skip(!venueAvailable, "no active restaurants in dev DB");
    test.skip(!adminUserId, "no internal user available for cleanup");

    let createdId: number | null = null;
    try {
      await devLogin(page.request, anuncianteUser!.id);
      await page.goto("/montar-campanha");

      await expect(page.getByRole("heading", { name: HERO_HEADLINE })).toBeVisible();
      await pickFirstProductAndStart(page);
      await completeWizardThroughConfirm(page);

      const created = await submitAndCaptureQuotation(page);
      createdId = created.id;
      await expectSuccessScreen(page, created.quotationNumber);
    } finally {
      if (createdId != null && adminUserId) {
        await devLogout(page.request);
        await deleteQuotationAsAdmin(page.request, adminUserId, createdId);
      }
    }
  });

  test("usuário interno seleciona um cliente no ClientPicker e percorre o wizard", async ({
    page,
  }) => {
    test.skip(!internalUser, "no internal user available in dev DB");
    test.skip(!venueAvailable, "no active restaurants in dev DB");
    test.skip(!adminUserId, "no internal user available for cleanup");
    test.skip(!firstClientName, "no client available in dev DB to pick");

    let createdId: number | null = null;
    try {
      await devLogin(page.request, internalUser!.id);
      await page.goto("/montar-campanha");

      // ClientPicker is the first screen for internal users
      await expect(
        page.getByRole("heading", { name: /Selecione o cliente|Para qual cliente/i }),
      ).toBeVisible();

      // Pick a real client from the list (not the "skip" shortcut). The grid
      // contains one button per client; we click the first by its company name.
      const clientButton = page
        .getByRole("button")
        .filter({ hasText: firstClientName! })
        .first();
      await expect(clientButton).toBeVisible();
      await clientButton.click();

      await expect(page.getByRole("heading", { name: HERO_HEADLINE })).toBeVisible();
      await pickFirstProductAndStart(page);
      await completeWizardThroughConfirm(page);

      const created = await submitAndCaptureQuotation(page);
      createdId = created.id;
      await expectSuccessScreen(page, created.quotationNumber);

      // Internal users see the "ver cotação" shortcut
      await expect(page.getByTestId("button-view-quotation")).toBeVisible();
    } finally {
      if (createdId != null && adminUserId) {
        await deleteQuotationAsAdmin(page.request, adminUserId, createdId);
      }
    }
  });
});
