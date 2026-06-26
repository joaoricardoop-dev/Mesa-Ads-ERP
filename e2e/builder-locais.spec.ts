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
});
