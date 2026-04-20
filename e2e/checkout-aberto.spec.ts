import { test, expect, type Page } from "@playwright/test";

const HERO_HEADLINE = /tenta me/i;
const PRODUCT_PILL = "[data-testid^='product-pill-']";

async function getProductButtons(page: Page) {
  return page.locator(PRODUCT_PILL);
}

test.describe("checkout aberto em /montar-campanha", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("visitante deslogado vê o hero e a lista de produtos", async ({ page }) => {
    await page.goto("/montar-campanha");

    await expect(page).toHaveURL(/\/montar-campanha$/);
    await expect(page.getByRole("heading", { name: HERO_HEADLINE })).toBeVisible();
    await expect(
      page.getByText(/Porta-copos que viram mídia/i),
    ).toBeVisible();

    const products = await getProductButtons(page);
    await expect(products.first()).toBeVisible();
    expect(await products.count()).toBeGreaterThan(0);

    const cta = page.getByRole("button", { name: /quero anunciar/i });
    await expect(cta).toBeVisible();
    await expect(cta).toBeDisabled();

    await expect(page.getByRole("button", { name: /já tenho conta/i })).toBeVisible();
    await expect(page.getByText(/sua escolha fica salva/i)).toBeVisible();
  });

  test("escolha do produto é preservada após reload", async ({ page }) => {
    await page.goto("/montar-campanha");

    const products = await getProductButtons(page);
    const firstProduct = products.first();
    await expect(firstProduct).toBeVisible();
    const productLabel = (await firstProduct.innerText()).trim();

    await firstProduct.click();

    const cta = page.getByRole("button", { name: /quero anunciar/i });
    await expect(cta).toBeEnabled();

    const persisted = await page.evaluate(() => localStorage.getItem("mesa-wizard-state"));
    expect(persisted).toBeTruthy();
    expect(persisted).toMatch(/"productId":\s*\d+/);

    await page.reload();

    await expect(page.getByRole("heading", { name: HERO_HEADLINE })).toBeVisible();
    await expect(page.getByRole("button", { name: /quero anunciar/i })).toBeEnabled();

    const sameProduct = page
      .locator(PRODUCT_PILL)
      .filter({ hasText: productLabel.split("\n")[0] })
      .first();
    await expect(sameProduct).toBeVisible();

    await page.getByRole("button", { name: /quero anunciar/i }).click();
    await page.waitForURL(/[?&]mode=signup(&|.*)redirect=%2Fmontar-campanha|[?&]mode=signup.*redirect=\/montar-campanha/);
    expect(page.url()).toMatch(/mode=signup/);
    expect(decodeURIComponent(page.url())).toContain("redirect=/montar-campanha");
  });

  test("parceiro/interno cai no seletor de cliente ao abrir o wizard", async ({
    page,
  }) => {
    const dev = await page.request.get("/api/dev-users");
    expect(dev.ok()).toBeTruthy();
    const users = (await dev.json()) as Array<{ id: string; role: string }>;
    const internal = users.find((u) =>
      ["admin", "comercial", "operacoes", "financeiro", "manager", "parceiro"].includes(u.role),
    );
    expect(internal, "no internal/partner user available in dev DB").toBeTruthy();

    const login = await page.request.post("/api/dev-login", {
      data: { userId: internal!.id },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto("/montar-campanha");

    await expect(page).toHaveURL(/\/montar-campanha$/);
    await expect(page.getByRole("heading", { name: HERO_HEADLINE })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /quero anunciar/i })).toHaveCount(0);

    await expect(
      page.getByRole("heading", { name: /Selecione o cliente|Para qual cliente/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/Buscar cliente/i)).toBeVisible();
    await expect(page.getByText(/auto-checkout/i)).toBeVisible();

    await page.request.post("/api/dev-logout");
  });
});
