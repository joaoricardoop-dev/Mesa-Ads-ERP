import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { ANUNCIANTE_AUTH_FILE } from "./_auth-paths";
import { resetTestAdvertiserState } from "./_builder-helpers";

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

// ─────────────────────────────────────────────────────────────────────────────
// Mapa do builder (CatalogMap dentro de InventoryCatalog).
//
// O anunciante pode trocar a visualização do inventário para "Mapa" e escolher
// locais clicando nos pins. O mapa usa Google Maps JS (Marker + InfoWindow), que
// não queremos (nem podemos) carregar de verdade no e2e — sem chave válida ele
// falharia e mesmo com chave seria flaky/billável. Seguimos o MESMO padrão de
// `address-autocomplete.spec.ts`: pré-injetamos um `window.google.maps` fake via
// `addInitScript` ANTES de qualquer script da página. Como `loadGoogleMaps()`
// curto-circuita quando `window.google?.maps` já existe, o script real nunca é
// baixado. O fake renderiza cada Marker como um <button data-testid="map-marker">
// e o conteúdo do InfoWindow num host data-testid="map-infowindow", de modo que
// o Playwright consegue ver os pins, clicar e ler o preço do popup.
//
// Isso prova: (a) os pins renderizam, (b) o preço/período do popup bate com o da
// lista (ambos saem de locationMetrics — fonte única) e (c) "Adicionar" pelo
// mapa coloca o local no plano de mídia.
// ─────────────────────────────────────────────────────────────────────────────

async function installGoogleMapsMock(page: Page) {
  await page.addInitScript(() => {
    // Layer onde os markers viram DOM real, para o Playwright interagir.
    function markerLayerFor(map: { __layer?: HTMLElement; __container: HTMLElement }) {
      if (!map.__layer) {
        const layer = document.createElement("div");
        layer.setAttribute("data-testid", "map-marker-layer");
        map.__container.appendChild(layer);
        map.__layer = layer;
      }
      return map.__layer;
    }

    class FakeMap {
      __container: HTMLElement;
      __layer?: HTMLElement;
      constructor(container: HTMLElement) {
        this.__container = container;
      }
      fitBounds() {}
      setCenter() {}
      setZoom() {}
    }

    class FakeMarker {
      opts: { position: unknown; map?: FakeMap; title?: string };
      listeners: Record<string, Array<() => void>> = {};
      el: HTMLButtonElement | null = null;
      constructor(opts: { position: unknown; map?: FakeMap; title?: string }) {
        this.opts = opts;
        if (opts.map) this.render(opts.map);
      }
      private render(map: FakeMap) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("data-testid", "map-marker");
        btn.setAttribute("data-title", this.opts.title ?? "");
        btn.textContent = this.opts.title ?? "marker";
        btn.addEventListener("click", () => {
          (this.listeners["click"] ?? []).forEach((fn) => fn());
        });
        markerLayerFor(map).appendChild(btn);
        this.el = btn;
      }
      setMap(map: FakeMap | null) {
        if (map === null && this.el) {
          this.el.remove();
          this.el = null;
        }
      }
      addListener(event: string, fn: () => void) {
        (this.listeners[event] ??= []).push(fn);
        return { remove() {} };
      }
    }

    class FakeInfoWindow {
      content: string | HTMLElement | null = null;
      setContent(content: string | HTMLElement) {
        this.content = content;
      }
      open() {
        let host = document.querySelector('[data-testid="map-infowindow"]');
        if (!host) {
          host = document.createElement("div");
          host.setAttribute("data-testid", "map-infowindow");
          document.body.appendChild(host);
        }
        host.innerHTML = "";
        if (typeof this.content === "string") host.innerHTML = this.content;
        else if (this.content) host.appendChild(this.content);
      }
      close() {
        document.querySelector('[data-testid="map-infowindow"]')?.remove();
      }
    }

    class FakeLatLngBounds {
      extend() {}
    }

    (window as unknown as { google: unknown }).google = {
      maps: {
        Map: FakeMap,
        Marker: FakeMarker,
        InfoWindow: FakeInfoWindow,
        LatLngBounds: FakeLatLngBounds,
      },
    };
  });
}

async function ensureScreenLocation(
  request: APIRequestContext,
): Promise<{ restaurantId: number; productId: number }> {
  const res = await request.post("/api/dev-ensure-screen-location", { data: {} });
  expect(
    res.ok(),
    `dev-ensure-screen-location falhou: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return (await res.json()) as { restaurantId: number; productId: number };
}

function priceFromText(text: string | null): string | null {
  const m = (text ?? "").match(/R\$\s?[\d.,]+/);
  return m ? m[0].replace(/\s/g, "") : null;
}

test.describe("builder /montar-campanha — visualização em mapa", () => {
  let seededRestaurantId: number | null = null;

  test.beforeAll(async ({ request }) => {
    // Garante o local de telas semeado COM coordenadas (lat/lng) — sem coords o
    // CatalogMap filtra o local e nenhum pin aparece.
    const seeded = await ensureScreenLocation(request);
    seededRestaurantId = seeded.restaurantId;
  });

  test.beforeEach(async ({ request }) => {
    // Isolamento entre runs: o /montar-campanha persiste o carrinho por cliente
    // no servidor (anunciantePortal.saveCartDraft) e re-hidrata na próxima
    // execução. Sem limpar, o local semeado já aparece selecionado e as datas
    // ficam as de um teste anterior (ex.: 2099 do teste de lista) — o popup do
    // mapa abriria "Remover" em vez de "Adicionar". O helper compartilhado
    // resolve o clientId do anunciante de teste e zera o draft (ver
    // _builder-helpers.ts).
    await resetTestAdvertiserState(request);
  });

  test("anunciante troca para o mapa, vê pins, confere o preço e adiciona pelo popup", async ({
    page,
  }) => {
    expect(seededRestaurantId, "local de telas semeado indisponível").toBeTruthy();
    await installGoogleMapsMock(page);
    await page.goto("/montar-campanha");

    const cta = page.getByRole("button", { name: /montar plano de mídia/i });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page.getByText(/inventário/i).first()).toBeVisible();

    // Captura nome + preço do local SEMEADO na LISTA (fonte de comparação).
    // Alvejamos pelo restaurantId para não pegar um local legado sem preço.
    const seededCard = page.locator(`[data-testid="local-card-${seededRestaurantId}"]`);
    await expect(seededCard).toBeVisible({ timeout: 15_000 });
    const cardName = (await seededCard.locator("p").first().textContent())?.trim() ?? "";
    expect(cardName.length, "local semeado deve ter nome legível").toBeGreaterThan(0);
    const listPrice = priceFromText(await seededCard.textContent());
    expect(listPrice, "local semeado deve exibir um preço na lista").toBeTruthy();

    // Troca para a visualização em mapa.
    await page.getByRole("button", { name: /mapa/i }).click();

    // (a) Pelo menos um pin renderiza.
    const markers = page.locator('[data-testid="map-marker"]');
    await expect(markers.first()).toBeVisible({ timeout: 15_000 });
    expect(await markers.count()).toBeGreaterThan(0);

    // Clica no pin do local capturado (casa pelo título = nome do local).
    const marker = page.locator(`[data-testid="map-marker"][data-title="${cardName}"]`);
    await expect(marker).toBeVisible();
    await marker.click();

    // (b) O popup mostra o MESMO preço da lista + período em dia(s).
    const popup = page.locator('[data-testid="map-infowindow"]');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(cardName);
    await expect(popup).toContainText(/dia\(s\)/i);
    const popupPrice = priceFromText(await popup.textContent());
    expect(popupPrice, "popup deve exibir o preço").toBe(listPrice);

    // (c) "Adicionar" pelo popup coloca o local no plano de mídia.
    await popup.getByRole("button", { name: /adicionar/i }).click();
    await expect(page.getByText(/Itens selecionados \(1\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
