import { test, expect, type APIRequestContext } from "@playwright/test";
import { ANUNCIANTE_AUTH_FILE } from "./_auth-paths";

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE com o SDK REAL do Google Maps (Task #338).
//
// builder-locais.spec.ts cobre o CatalogMap com um `window.google.maps` FAKE
// (markers/InfoWindow viram DOM simples). Isso prova a fiação data → markers →
// popup → add-to-plan, mas NÃO que o SDK real plota os pins com a nossa config
// (estilo do mapa, fitBounds, InfoWindow, mapId). Este spec fecha essa lacuna:
// carrega o Google Maps DE VERDADE (sem mock), confirma que o container `.gm-style`
// monta, que não há overlay de erro de auth e que clicar num pin abre o popup com
// o mesmo preço da lista e adiciona o local ao plano.
//
// É GATED por dois motivos (custo/billing + flakiness de rede):
//   1. `RUN_REAL_MAPS=1` precisa estar setado (opt-in explícito);
//   2. o dev server precisa ter `VITE_GOOGLE_MAPS_API_KEY` configurada (secret).
//
// Rodando localmente:
//   RUN_REAL_MAPS=1 pnpm exec playwright test builder-locais-real-maps
//
// Sem `RUN_REAL_MAPS`, todos os testes deste arquivo são pulados (skip), então a
// suíte padrão (CI/pre-deploy) continua usando apenas o mock determinístico.
//
// Para clicar nos pins reais usamos `window.__catalogMapTest.clickMarker(title)`
// (hook dev-only exposto pelo CatalogMap via o event system do SDK) em vez de
// adivinhar o DOM interno do Google Maps, que muda entre versões.
// ─────────────────────────────────────────────────────────────────────────────

const RUN = process.env.RUN_REAL_MAPS === "1";

test.use({ storageState: ANUNCIANTE_AUTH_FILE });

async function ensureScreenLocation(
  request: APIRequestContext,
): Promise<{ restaurantId: number }> {
  const res = await request.post("/api/dev-ensure-screen-location", { data: {} });
  expect(
    res.ok(),
    `dev-ensure-screen-location falhou: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return (await res.json()) as { restaurantId: number };
}

function priceFromText(text: string | null): string | null {
  const m = (text ?? "").match(/R\$\s?[\d.,]+/);
  return m ? m[0].replace(/\s/g, "") : null;
}

test.describe("builder /montar-campanha — mapa com SDK real do Google", () => {
  test.skip(
    !RUN,
    "smoke gated: defina RUN_REAL_MAPS=1 e garanta VITE_GOOGLE_MAPS_API_KEY no dev server",
  );

  let seededRestaurantId: number | null = null;

  test.beforeAll(async ({ request }) => {
    const seeded = await ensureScreenLocation(request);
    seededRestaurantId = seeded.restaurantId;
  });

  test.beforeEach(async ({ request }) => {
    // Isola o carrinho persistido por cliente (mesmo motivo do spec mockado):
    // sem limpar, o local semeado abre como "Remover" em vez de "Adicionar".
    const ensure = await request.post("/api/dev-ensure-anunciante", { data: {} });
    expect(ensure.ok(), `dev-ensure-anunciante falhou: ${ensure.status()}`).toBeTruthy();
    const { user } = (await ensure.json()) as { user: { clientId: number | null } };
    const res = await request.post("/api/dev-clear-cart-draft", {
      data: user.clientId != null ? { clientId: user.clientId } : {},
    });
    expect(res.ok(), `dev-clear-cart-draft falhou: ${res.status()}`).toBeTruthy();
  });

  test("plota pins reais, abre o popup pelo SDK e adiciona ao plano", async ({
    page,
  }) => {
    expect(seededRestaurantId, "local de telas semeado indisponível").toBeTruthy();

    // Sem injeção de mock — a página carrega o SDK real do Google.
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/montar-campanha");

    const cta = page.getByRole("button", { name: /montar plano de mídia/i });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page.getByText(/inventário/i).first()).toBeVisible();

    // Captura nome + preço do local semeado na LISTA (fonte de comparação).
    const seededCard = page.locator(`[data-testid="local-card-${seededRestaurantId}"]`);
    await expect(seededCard).toBeVisible({ timeout: 15_000 });
    const cardName = (await seededCard.locator("p").first().textContent())?.trim() ?? "";
    expect(cardName.length, "local semeado deve ter nome").toBeGreaterThan(0);
    const listPrice = priceFromText(await seededCard.textContent());
    expect(listPrice, "local semeado deve exibir preço na lista").toBeTruthy();

    // Troca para o mapa.
    await page.getByRole("button", { name: /mapa/i }).click();

    // (a) O container do SDK real monta — `.gm-style` é injetado pelo Google.
    await expect(page.locator(".gm-style").first()).toBeVisible({ timeout: 20_000 });

    // (b) NÃO há overlay de erro de autenticação do Google (chave inválida etc.).
    await expect(page.locator(".gm-err-container")).toHaveCount(0);
    const authFailed = await page.evaluate(
      () => (window as { _gmapsAuthFailed?: boolean })._gmapsAuthFailed,
    );
    expect(authFailed, "Google Maps sinalizou falha de autenticação").not.toBe(true);

    // (c) Os markers reais foram criados — confirma via o hook dev-only que
    // espelha os markers plotados pelo SDK.
    await expect
      .poll(
        async () =>
          await page.evaluate(
            () =>
              (window as { __catalogMapTest?: { markerTitles: string[] } })
                .__catalogMapTest?.markerTitles.length ?? 0,
          ),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const titles = await page.evaluate(
      () =>
        (window as { __catalogMapTest?: { markerTitles: string[] } }).__catalogMapTest
          ?.markerTitles ?? [],
    );
    expect(titles, "o título do local semeado deve estar entre os pins").toContain(
      cardName,
    );

    // (d) Dispara o click do pin pelo event system real do SDK → abre InfoWindow.
    const clicked = await page.evaluate(
      (title) =>
        (
          window as { __catalogMapTest?: { clickMarker: (t: string) => boolean } }
        ).__catalogMapTest?.clickMarker(title) ?? false,
      cardName,
    );
    expect(clicked, "clickMarker deve encontrar o pin pelo título").toBeTruthy();

    // (e) O InfoWindow real do Google renderiza nosso conteúdo (.gm-style-iw) com
    // o MESMO preço da lista + período, e o botão "Adicionar" insere o local.
    const iw = page.locator(".gm-style-iw").first();
    await expect(iw).toBeVisible({ timeout: 10_000 });
    await expect(iw).toContainText(cardName);
    await expect(iw).toContainText(/dia\(s\)/i);
    expect(priceFromText(await iw.textContent())).toBe(listPrice);

    await iw.getByRole("button", { name: /adicionar/i }).click();
    await expect(page.getByText(/Itens selecionados \(1\)/i)).toBeVisible({
      timeout: 10_000,
    });

    // Sanidade: nenhum erro de auth do Google Maps no console.
    expect(
      consoleErrors.filter((e) => /gm_authFailure|InvalidKey|ApiNotActivated/i.test(e)),
      `erros de auth do Google Maps no console: ${consoleErrors.join(" | ")}`,
    ).toHaveLength(0);
  });
});
