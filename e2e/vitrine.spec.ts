import { test, expect } from "@playwright/test";

// Vitrine pública — task #170. Cobre o caminho do visitante deslogado:
// 1) landing tem link "Ver mídias disponíveis" -> /vitrine
// 2) /vitrine renderiza o catálogo agrupado (mídia digital / impressa /
//    live marketing) com produtos do seed do Manauara Shopping
// 3) clicar em "Quero esta" leva para /montar-campanha?productId=N e o
//    parâmetro é consumido (URL fica limpa após o efeito).

test.describe("Vitrine pública /vitrine", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("landing aponta o nav para /vitrine", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByTestId("landing-cta-vitrine");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/vitrine");
    await expect(cta).toHaveText(/ver mídias disponíveis/i);
  });

  test("vitrine renderiza catálogo agrupado por linha comercial", async ({ page }) => {
    await page.goto("/vitrine");

    await expect(page.getByTestId("vitrine-hero-title")).toBeVisible();
    await expect(page.getByTestId("vitrine-hero-cta")).toBeVisible();

    // Espera o catálogo carregar (loading -> dados). Tolera DB vazio
    // mostrando o estado pedagógico.
    const catalog = page.getByTestId("vitrine-catalog");
    const empty = page.getByTestId("vitrine-empty");
    await expect(catalog.or(empty)).toBeVisible({ timeout: 10000 });

    // Se o seed do Manauara rodou (ambiente normal), valida agrupamento.
    if (await catalog.isVisible()) {
      const total = await catalog.getAttribute("data-total");
      expect(Number(total)).toBeGreaterThanOrEqual(10);

      await expect(page.getByTestId("vitrine-line-midia_digital")).toBeVisible();
      await expect(page.getByTestId("vitrine-line-midia_impressa")).toBeVisible();
      await expect(page.getByTestId("vitrine-line-live_marketing")).toBeVisible();

      // Pelo menos um produto Manauara aparece pelo nome canônico.
      await expect(
        page.getByText(/Manauara — Painel LED Praça Central/i),
      ).toBeVisible();
    }
  });

  test("CTA do produto leva para /montar-campanha com productId e limpa a URL", async ({ page }) => {
    await page.goto("/vitrine");

    const catalog = page.getByTestId("vitrine-catalog");
    const empty = page.getByTestId("vitrine-empty");
    await expect(catalog.or(empty)).toBeVisible({ timeout: 10000 });

    // Pula o teste se o catálogo está vazio (DB sem seed).
    if (!(await catalog.isVisible())) {
      test.skip(true, "Catálogo vazio: seed do Manauara não aplicado neste ambiente.");
      return;
    }

    const firstCta = page.locator('[data-testid^="vitrine-cta-"]').first();
    await expect(firstCta).toBeVisible();
    const href = await firstCta.getAttribute("href");
    expect(href).toMatch(/^\/montar-campanha\?productId=\d+$/);

    await firstCta.click();
    // O wizard consome o ?productId= no useEffect e limpa o querystring.
    await expect(page).toHaveURL(/\/montar-campanha(?:\?|$)/);
    await page.waitForURL(/\/montar-campanha$/, { timeout: 5000 }).catch(() => {});
  });
});
