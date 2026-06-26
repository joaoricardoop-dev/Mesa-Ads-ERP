import { test, expect } from "@playwright/test";
import { ANUNCIANTE_AUTH_FILE } from "./_auth-paths";

// Marketplace v2 — cobre a tela "shop" do builder /montar-campanha, que reusa
// o ecommerce de mídia interno (InventoryCatalog + MediaPlanPanel).
// Garante que (a) o anunciante vê pelo menos 1 local com o período padrão,
// (b) trocar as datas dispara nova busca e (c) o endpoint
// listAvailableLocations responde antes de exibir o estado vazio.
//
// Task #179 — refatorado pra rodar com storageState gerado em
// `e2e/global.setup.ts`. Isso elimina a dependência do bootstrap do Clerk
// SDK no caminho crítico do teste (causa-raiz dos timeouts em cloud build
// — bundle 5.8MB + 2 vCPU = cold-start >60s). O cookie dev já vem
// pré-setado no contexto, e o frontend (`useAuth`) agora dispara o probe
// `/api/auth/user` imediatamente em dev sem esperar Clerk.
test.use({ storageState: ANUNCIANTE_AUTH_FILE });

test.describe("builder /montar-campanha — tela de inventário", () => {
  test("lista pelo menos 1 local no período padrão e atualiza ao trocar datas", async ({
    page,
  }) => {
    await page.goto("/montar-campanha");

    // Hero → clica para montar o plano de mídia. Como a sessão já vem pronta
    // via storageState, a CTA aparece em "montar plano de mídia" (não em
    // "quero anunciar") sem que precisemos esperar Clerk inicializar.
    const cta = page.getByRole("button", { name: /montar plano de mídia/i });
    await expect(cta).toBeVisible();
    await cta.click();

    // Tela shop — inventário + plano de mídia
    await expect(page.getByText(/inventário/i).first()).toBeVisible();

    // Para anunciante/parceiro a tela abre direto no Mapa quando há locais com
    // coordenadas; trocamos para a Lista para asserir as linhas (local-card-*).
    await page.getByRole("button", { name: /^lista$/i }).click();

    // Pelo menos 1 card de local visível com o período padrão
    const cards = page.locator("[data-testid^='local-card-']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Trocar a data — a key do useQuery inclui startDate/endDate, então deve
    // disparar uma nova chamada a listAvailableLocations. Aguardamos a
    // resposta de rede para provar que a refetch aconteceu de fato. O
    // httpBatchLink do tRPC mistura procedures e codifica o input no
    // querystring, então procuramos pela procedure no path E pela data nova
    // em qualquer parte da URL (URL-decoded para casar com a string ISO).
    const refetch = page.waitForResponse(
      (r) => {
        if (!r.url().includes("anunciantePortal.listAvailableLocations")) return false;
        try {
          return decodeURIComponent(r.url()).includes("2099-01-01");
        } catch {
          return false;
        }
      },
      { timeout: 15_000 },
    );
    await page.getByTestId("filter-start").fill("2099-01-01");
    await page.getByTestId("filter-end").fill("2099-02-01");
    await page.getByTestId("filter-end").blur();
    const resp = await refetch;
    // tRPC sempre devolve 200 OK mesmo em erro de procedure; aqui basta
    // garantir que a refetch aconteceu (URL com a nova data) — não
    // validamos o payload neste teste.
    expect(resp.status(), `resposta inesperada: ${resp.status()}`).toBeLessThan(500);

    // Como não há ocupação em 2099, os cards continuam listados (100% livre).
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  // Task #334 — bloqueia regressão do default de view por audiência. Para
  // anunciante/parceiro, o catálogo deve abrir DIRETO no Mapa quando há pelo
  // menos um local com coordenadas (ver InventoryCatalog: defaultViewApplied),
  // tornando "escolher por bairro" a primeira ação. O fixture global
  // (dev-ensure-screen-location) sempre semeia locais COM lat/lng, então o
  // caminho padrão exercitado aqui é o do mapa.
  test("abre direto no Mapa por padrão quando há locais com coordenadas", async ({
    page,
  }) => {
    // Garante ≥1 local de telas COM coordenadas (lat/lng) no catálogo. O
    // dev-ensure-restaurante do global.setup cria apenas um produto por
    // quantidade (impressos, sem local de telas), e o banco de teste
    // compartilhado pode conter locais de telas legados sem lat/lng — ambos
    // levariam ao fallback de Lista. Este fixture (idempotente) preenche as
    // coordenadas, tornando o default = Mapa determinístico.
    const ensure = await page.request.post("/api/dev-ensure-screen-location", {
      data: {},
    });
    expect(
      ensure.ok(),
      `dev-ensure-screen-location falhou: ${ensure.status()} ${await ensure.text()}`,
    ).toBeTruthy();

    await page.goto("/montar-campanha");

    const cta = page.getByRole("button", { name: /montar plano de mídia/i });
    await expect(cta).toBeVisible();
    await cta.click();

    // Tela shop carregada.
    await expect(page.getByText(/inventário/i).first()).toBeVisible();

    // O container do mapa deve estar visível SEM nenhuma interação — esse é o
    // default para anunciante. (O mapa só renderiza quando view === "map".)
    await expect(page.getByTestId("catalog-map")).toBeVisible({ timeout: 15_000 });

    // E as linhas de lista NÃO devem estar montadas: elas só existem nas views
    // "list"/"cards", logo a sua ausência prova que o mapa é a view ativa.
    await expect(page.locator("[data-testid^='local-card-']")).toHaveCount(0);

    // Sanidade: trocar para Lista revela as linhas, confirmando que existem
    // locais (i.e. o mapa não estava ativo por falta de dados).
    await page.getByRole("button", { name: /^lista$/i }).click();
    await expect(page.getByTestId("catalog-map")).toHaveCount(0);
    await expect(page.locator("[data-testid^='local-card-']").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // Fallback (sem coordenadas) — NOTA DE FIXTURE:
  // Quando NENHUM local disponível tem lat/lng, o catálogo permanece na Lista
  // (InventoryCatalog: `hasCoords ? setView("map")` — sem coords, mantém o
  // estado inicial "list"). Esse ramo não é exercitado por um teste dedicado
  // porque os fixtures compartilhados da suíte (dev-ensure-screen-location e
  // dev-ensure-restaurante) sempre criam locais COM coordenadas
  // (lat="-23.5505"/lng="-46.6333"); não há, hoje, um endpoint de fixture que
  // semeie um local de telas sem coordenadas sem poluir os demais specs que
  // dependem do default = mapa. Caso esse fixture passe a existir, o teste
  // deve: (1) garantir que o único local visível ao anunciante não tenha
  // lat/lng, (2) abrir /montar-campanha, (3) asserir que as linhas
  // `local-card-*` aparecem sem clique e que `catalog-map` está ausente.
});
