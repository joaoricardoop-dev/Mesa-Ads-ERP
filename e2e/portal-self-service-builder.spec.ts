import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import {
  devLoginAdmin,
  devLoginAs,
  trpcMutation,
  type DevUser,
} from "./_finance-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Construtores de plano de mídia dos portais (MediaShopBuilder) — Task #318.
//
// Anunciantes e parceiros montam um plano de mídia nos seus portais via
// MediaShopBuilder e enviam pelo quotation.createFromBuilder. Esta suíte cobre,
// de ponta a ponta:
//   1. Anunciante: abre o builder no portal, adiciona um LOCAL DE TELAS + um
//      PRODUTO POR QUANTIDADE, nomeia a campanha e envia a proposta. Confirma
//      que a cotação nasce com source = self_service_anunciante.
//   2. Parceiro: idem, para um cliente do seu portfólio. Confirma source =
//      self_service_parceiro.
//   3. Negativo: createFromBuilder REJEITA uma source que não bate com o
//      papel do usuário (anunciante enviando self_service_parceiro e vice-versa).
//
// Todo o inventário (telas com CPM + produto por quantidade COM tier de preço,
// visíveis a AMBOS os perfis) e o vínculo parceiro→cliente são garantidos por
// /api/dev-ensure-portal-builder, deixando o teste determinístico mesmo num
// banco de teste fresh.
// ─────────────────────────────────────────────────────────────────────────────

type PortalSetup = {
  anuncianteUserId: string;
  anuncianteClientId: number;
  parceiroUserId: string;
  partnerId: number;
  parceiroClientId: number;
  parceiroClientName: string;
  telasProductId: number;
  telasProductName: string;
  quantityProductId: number;
  quantityProductName: string;
  restaurantId: number;
  restaurantName: string;
};

// O portal do anunciante abre um modal "Complete seu cadastro" no load quando o
// perfil está incompleto, e esse overlay intercepta cliques no botão de abrir o
// builder. Pré-marcamos a flag de dispensa (sessionStorage) via addInitScript
// para o modal nunca aparecer. Fonte da chave: AnunciantePortal.tsx.
const COMPLETE_PROFILE_DISMISS_KEY = "mesa-anunciante-complete-profile-dismissed";

async function suppressCompleteProfileDialog(page: Page) {
  await page.addInitScript((key) => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  }, COMPLETE_PROFILE_DISMISS_KEY);
}

type CreatedQuotation = {
  id: number;
  quotationNumber: string;
  source: string | null;
};

async function ensurePortalSetup(request: APIRequestContext): Promise<PortalSetup> {
  const res = await request.post("/api/dev-ensure-portal-builder", { data: {} });
  expect(
    res.ok(),
    `dev-ensure-portal-builder failed: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return (await res.json()) as PortalSetup;
}

async function deleteQuotationAsAdmin(request: APIRequestContext, quotationId: number) {
  try {
    await devLoginAdmin(request);
    await trpcMutation(request, "quotation.delete", { id: quotationId });
  } catch (err) {
    console.warn(`[portal-builder cleanup] falha ao deletar cotação ${quotationId}:`, err);
  }
}

// Adiciona o local de telas COM CPM configurado (pelo nome retornado pelo setup).
// Adicionar "o primeiro" do catálogo seria não-determinístico: outro local sem
// CPM faria o createFromBuilder rejeitar o item de tela ("sem precificação CPM").
async function addScreenLocationByName(page: Page, locationName: string) {
  await expect(page.getByText(/local\(is\) de telas/i)).toBeVisible({ timeout: 20_000 });
  // Nome EXATO: o catálogo pode conter locais antigos cujo nome COMEÇA igual
  // (versões anteriores do fixture criavam "<nome> <timestamp>"); substring
  // casaria um deles (sem CPM). O nó do nome vive na linha/card que também tem o
  // botão "Adicionar"; subimos ao ancestral mais próximo com botão e clicamos —
  // o clique do Playwright cuida do scroll na coluna rolável.
  const nameNode = page.getByText(locationName, { exact: true }).first();
  const row = nameNode.locator("xpath=ancestor::div[.//button][1]");
  const addButton = row.getByRole("button", { name: /adicionar/i }).first();
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();
  // Vira "Adicionado" quando entra no plano.
  await expect(
    row.getByRole("button", { name: /adicionado/i }),
  ).toBeVisible({ timeout: 10_000 });
}

// Adiciona um produto POR QUANTIDADE pelo nome. Localiza a linha via o input de
// quantidade (aria-label "Quantidade de <produto>") e clica no "Adicionar" da
// mesma linha — robusto mesmo com várias linhas de produto no catálogo.
async function addQuantityProduct(page: Page, productName: string) {
  // Label EXATO: evita casar produtos antigos cujo nome começa igual (timestamp).
  const qtyInput = page.getByLabel(`Quantidade de ${productName}`, { exact: true });
  await qtyInput.scrollIntoViewIfNeeded();
  await expect(qtyInput).toBeVisible({ timeout: 20_000 });
  const row = qtyInput.locator(
    'xpath=ancestor::div[contains(@class,"grid")][1]',
  );
  const addButton = row.getByRole("button", { name: /adicionar/i });
  await expect(addButton).toBeEnabled({ timeout: 20_000 });
  await addButton.click();
  // Aparece o selo "Nx no plano" na linha.
  await expect(row.getByText(/no plano/i)).toBeVisible({ timeout: 10_000 });
}

async function fillCampaignNameAndSend(
  page: Page,
  campaignName: string,
  expectedSource: string,
): Promise<CreatedQuotation> {
  await page.getByPlaceholder(/Verão 2026/i).fill(campaignName);

  const send = page.getByRole("button", { name: /enviar proposta/i });
  await expect(send).toBeEnabled();

  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes("quotation.createFromBuilder") &&
      r.request().method() === "POST",
  );
  await send.click();
  const resp = await responsePromise;
  expect(resp.ok(), `createFromBuilder failed: ${resp.status()}`).toBeTruthy();

  const body = await resp.json();
  // httpBatchLink embrulha respostas num array de { result: { data: { json } } }.
  const payload = Array.isArray(body) ? body[0] : body;
  const created = payload?.result?.data?.json as CreatedQuotation | undefined;
  expect(created?.id, "esperado id da cotação na resposta").toBeTruthy();
  expect(
    created?.quotationNumber,
    "esperado número da cotação na resposta",
  ).toBeTruthy();
  expect(
    created?.source,
    `esperado source=${expectedSource} na cotação criada`,
  ).toBe(expectedSource);
  return created!;
}

test.describe("Portais self-service — MediaShopBuilder → createFromBuilder", () => {
  let setup: PortalSetup | null = null;

  test.beforeAll(async ({ request }) => {
    await devLoginAdmin(request);
    setup = await ensurePortalSetup(request);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("anunciante monta plano (tela + quantidade) e envia proposta com source correta", async ({
    page,
  }) => {
    expect(setup, "setup do portal indisponível").toBeTruthy();
    const s = setup!;
    // O primeiro acesso autenticado compila o chunk lazy do portal no Vite dev,
    // que pode passar do timeout padrão de 60s em cold start.
    test.setTimeout(150_000);
    let createdId: number | null = null;
    try {
      await devLoginAs(page.request, s.anuncianteUserId);
      await suppressCompleteProfileDialog(page);
      await page.goto("/");

      // Espera o portal terminar de carregar (perfil + chunk) antes de abrir o
      // builder — o botão só existe depois que `profileLoading` resolve.
      // O corpo do portal vive dentro de um wrapper `.theme-external` marcado
      // com aria-hidden, então getByRole(name) não enxerga seus botões. Usamos
      // locator por texto, que ignora a árvore de acessibilidade.
      const openBuilderBtn = page
        .locator("button")
        .filter({ hasText: /montar minha campanha/i })
        .first();
      await expect(openBuilderBtn).toBeVisible({ timeout: 120_000 });
      await openBuilderBtn.click();
      await expect(
        page.getByRole("heading", { name: /montar minha campanha/i }),
      ).toBeVisible({ timeout: 15_000 });

      await addScreenLocationByName(page, s.restaurantName);
      await addQuantityProduct(page, s.quantityProductName);

      const created = await fillCampaignNameAndSend(
        page,
        `E2E Anunciante ${Date.now()}`,
        "self_service_anunciante",
      );
      createdId = created.id;
    } finally {
      if (createdId != null) {
        await page.context().clearCookies();
        await deleteQuotationAsAdmin(page.request, createdId);
      }
    }
  });

  test("parceiro monta plano (tela + quantidade) para um cliente e envia proposta com source correta", async ({
    page,
  }) => {
    expect(setup, "setup do portal indisponível").toBeTruthy();
    const s = setup!;
    // O primeiro acesso autenticado compila o chunk lazy do portal no Vite dev,
    // que pode passar do timeout padrão de 60s em cold start.
    test.setTimeout(150_000);
    let createdId: number | null = null;
    try {
      await devLoginAs(page.request, s.parceiroUserId);
      await page.goto("/");

      // Abre o builder no portal do parceiro. Com ≥1 cliente vinculado, ou o
      // builder abre direto (1 cliente) ou via seletor de cliente (>1).
      // Corpo do portal está sob `.theme-external` (aria-hidden) — locator por
      // texto em vez de getByRole(name).
      const openBuilderBtn = page
        .locator("button")
        .filter({ hasText: /montar campanha para cliente/i })
        .first();
      await expect(openBuilderBtn).toBeVisible({ timeout: 120_000 });
      await openBuilderBtn.click();

      // Se aparecer o seletor de cliente, escolhe o primeiro.
      const clientOption = page
        .getByRole("dialog")
        .getByRole("button")
        .filter({ hasText: s.parceiroClientName })
        .first();
      if (await clientOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await clientOption.click();
      }

      await expect(
        page.getByRole("heading", { name: /montar campanha para cliente/i }),
      ).toBeVisible({ timeout: 15_000 });

      await addScreenLocationByName(page, s.restaurantName);
      await addQuantityProduct(page, s.quantityProductName);

      const created = await fillCampaignNameAndSend(
        page,
        `E2E Parceiro ${Date.now()}`,
        "self_service_parceiro",
      );
      createdId = created.id;
    } finally {
      if (createdId != null) {
        await page.context().clearCookies();
        await deleteQuotationAsAdmin(page.request, createdId);
      }
    }
  });

  test("createFromBuilder rejeita source que não bate com o papel do usuário", async ({
    request,
  }) => {
    expect(setup, "setup do portal indisponível").toBeTruthy();
    const s = setup!;

    const baseItem = {
      productId: s.quantityProductId,
      productName: s.quantityProductName,
      volume: 1000,
      weeks: 4,
    };

    // Anunciante NÃO pode enviar com source de parceiro.
    await devLoginAs(request, s.anuncianteUserId);
    await expect(
      trpcMutation(request, "quotation.createFromBuilder", {
        clientId: s.anuncianteClientId,
        source: "self_service_parceiro",
        campaignName: "E2E source mismatch anunciante",
        items: [baseItem],
      }),
    ).rejects.toThrow(/Source inválida para anunciante|FORBIDDEN/i);

    // Parceiro NÃO pode enviar com source de anunciante.
    await devLoginAs(request, s.parceiroUserId);
    await expect(
      trpcMutation(request, "quotation.createFromBuilder", {
        clientId: s.parceiroClientId,
        source: "self_service_anunciante",
        campaignName: "E2E source mismatch parceiro",
        items: [baseItem],
      }),
    ).rejects.toThrow(/Source inválida para parceiro|FORBIDDEN/i);
  });
});
