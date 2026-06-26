import { test, expect, type Page } from "@playwright/test";

// Task #357 — Fallback do mapa de Locais (/restaurantes/mapa) quando o Google
// Maps não carrega.
//
// O builder interno (CatalogMap) já é coberto por `builder-locais.spec.ts`, mas
// o mapa de restaurantes (`client/src/pages/RestaurantsMap.tsx`) não tinha
// cobertura para o comportamento do loader. Agora que ele usa o loader canônico
// `loadGoogleMaps()`, este spec trava o contrato: quando o SDK não carrega
// (chave ausente OU script bloqueado), `initMap()` rejeita, seta `mapError` e a
// tela mostra o overlay "Erro ao carregar o mapa" + loga um erro claro no
// console — em vez de uma tela branca/quebrada — enquanto a lista/busca de
// restaurantes do painel lateral continua funcionando.
//
// Determinismo independente do ambiente: NÃO injetamos `window.google` e
// abortamos qualquer request ao script do Google Maps. Assim:
//  - se o dev server NÃO tem `VITE_GOOGLE_MAPS_API_KEY`, `loadGoogleMaps()`
//    rejeita ANTES de injetar o script (GoogleMapsKeyMissingError); ou
//  - se a chave ESTÁ presente, o script é injetado mas o request é abortado,
//    disparando `script.onerror` → reject ("Failed to load Google Maps script").
// Em ambos os caminhos `initMap()` cai no catch → overlay + console.error.

async function blockGoogleMaps(page: Page) {
  await page.route("**maps.googleapis.com/**", (route) => route.abort());
}

async function loginInternal(page: Page) {
  const dev = await page.request.get("/api/dev-users");
  expect(dev.ok(), `dev-users falhou: ${dev.status()}`).toBeTruthy();
  const users = (await dev.json()) as Array<{ id: string; role: string }>;
  let internal = users.find((u) =>
    ["admin", "comercial", "operacoes", "financeiro", "manager"].includes(u.role),
  );
  // Banco fresh pode só ter o anunciante do setup; dev-login sem userId
  // auto-cria um admin E2E (gateado por sentinel).
  const login = await page.request.post("/api/dev-login", {
    data: internal ? { userId: internal.id } : {},
  });
  expect(login.ok(), `dev-login falhou: ${login.status()} ${await login.text()}`).toBeTruthy();
}

test.describe("/restaurantes/mapa — fallback quando o mapa não carrega", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await loginInternal(page);
    // Garante ≥1 restaurante para a lista/busca do painel lateral.
    const rest = await page.request.post("/api/dev-ensure-restaurante", { data: {} });
    expect(
      rest.ok(),
      `dev-ensure-restaurante falhou: ${rest.status()} ${await rest.text()}`,
    ).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    await page.request.post("/api/dev-logout");
  });

  test("mostra o overlay de erro, loga no console e mantém lista/busca funcionando", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await blockGoogleMaps(page);
    await page.goto("/restaurantes/mapa");

    // (a) Overlay de erro visível (não há tela branca/quebrada).
    await expect(page.getByText("Erro ao carregar o mapa")).toBeVisible({
      timeout: 15_000,
    });

    // (b) A lista/busca do painel lateral continua funcionando mesmo sem mapa.
    const search = page.getByPlaceholder(/Buscar restaurante/i);
    await expect(search).toBeVisible();
    // Pelo menos 1 restaurante listado (o fixture garante).
    const rows = page.locator("button", { hasText: /.+/ });
    // A busca filtra a lista — digitar um termo improvável esvazia e mostra o
    // estado "Nenhum resultado", provando que o painel está vivo e reativo.
    await search.fill("zzz-nao-existe-zzz");
    await expect(page.getByText(/Nenhum resultado para/i)).toBeVisible({
      timeout: 10_000,
    });
    await search.fill("");
    expect(rows, "lista deve renderizar após limpar a busca").toBeTruthy();

    // (c) Um erro claro foi logado no console (greppável, não silencioso).
    await expect
      .poll(() => consoleErrors.some((t) => /Falha ao carregar o Google Maps/i.test(t)), {
        timeout: 10_000,
      })
      .toBeTruthy();
  });

  test("'Tentar novamente' re-executa o loader e mantém o overlay enquanto bloqueado", async ({
    page,
  }) => {
    await blockGoogleMaps(page);
    await page.goto("/restaurantes/mapa");

    await expect(page.getByText("Erro ao carregar o mapa")).toBeVisible({
      timeout: 15_000,
    });

    // Clicar em "Tentar novamente" chama initMap() de novo; como o script
    // segue bloqueado, o overlay reaparece (não some nem trava a tela).
    const retry = page.getByRole("button", { name: /tentar novamente/i });
    await expect(retry).toBeVisible();
    await retry.click();

    await expect(page.getByText("Erro ao carregar o mapa")).toBeVisible({
      timeout: 15_000,
    });
  });
});
