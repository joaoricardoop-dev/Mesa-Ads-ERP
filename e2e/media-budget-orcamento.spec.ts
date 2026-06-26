import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { devLoginAdmin, trpcQuery, trpcMutation, type DevUser } from "./_finance-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// /comercial/orcamento — ecommerce interno de mídia (Task #310).
//
// Cobre o caminho catálogo → plano de mídia → createFromBuilder do MediaBudget:
// um usuário interno escolhe um cliente, adiciona um LOCAL DE TELAS do
// inventário, nomeia a campanha e gera a cotação. Prova de ponta-a-ponta que o
// fluxo inventory→plan→quotation.createFromBuilder cria uma cotação real.
//
// O inventário de telas é garantido via /api/dev-ensure-screen-location (produto
// tipo "telas" + active_restaurant com CPM completo + product_location + tela
// ativa) para que o teste seja determinístico mesmo num banco de teste fresh.
// ─────────────────────────────────────────────────────────────────────────────

type CreatedQuotation = { id: number; quotationNumber: string };
type ClientRow = { id: number; name: string | null; company: string | null };

async function ensureScreenLocation(
  request: APIRequestContext,
): Promise<{ restaurantId: number; productId: number }> {
  const res = await request.post("/api/dev-ensure-screen-location", { data: {} });
  expect(res.ok(), `dev-ensure-screen-location failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as { restaurantId: number; productId: number };
}

async function ensureClient(request: APIRequestContext): Promise<ClientRow> {
  // Garante ≥1 cliente no DB (dev-ensure-anunciante cria um cliente seed se
  // necessário) e devolve o primeiro listado por advertiser.list — exatamente
  // a mesma query que popula o dropdown de cliente do MediaBudget.
  const ensure = await request.post("/api/dev-ensure-anunciante", { data: {} });
  expect(ensure.ok(), `dev-ensure-anunciante failed: ${ensure.status()}`).toBeTruthy();

  const list = await trpcQuery<{ items: ClientRow[] }>(request, "advertiser.list", {});
  const first = list.items?.[0];
  expect(first, "esperado ≥1 cliente no banco de teste").toBeTruthy();
  return first!;
}

async function deleteQuotationAsAdmin(request: APIRequestContext, quotationId: number) {
  try {
    await devLoginAdmin(request);
    await trpcMutation(request, "quotation.delete", { id: quotationId });
  } catch (err) {
    // Cleanup é best-effort: registra mas não derruba o teste.
    console.warn(`[media-budget cleanup] falha ao deletar cotação ${quotationId}:`, err);
  }
}

async function pickClient(page: Page, clientLabel: string) {
  const trigger = page
    .getByRole("combobox")
    .filter({ hasText: /Selecione o anunciante/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const option = page.getByRole("option").filter({ hasText: clientLabel }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function addFirstScreenLocation(page: Page) {
  // Espera o catálogo carregar (some "Carregando inventário…") e mostrar o
  // contador "N local(is) de telas".
  await expect(page.getByText(/local\(is\) de telas/i)).toBeVisible({ timeout: 15_000 });
  // A seção de telas é renderizada antes de "Produtos por quantidade", então o
  // primeiro botão "Adicionar" pertence a um local de telas.
  const addButton = page.getByRole("button", { name: /^adicionar$/i }).first();
  await expect(addButton).toBeVisible({ timeout: 15_000 });
  await addButton.click();
  // Vira "Adicionado" quando o item entra no plano.
  await expect(
    page.getByRole("button", { name: /^adicionado$/i }).first(),
  ).toBeVisible();
}

async function submitAndCaptureQuotation(page: Page): Promise<CreatedQuotation> {
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().includes("quotation.createFromBuilder") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /gerar orçamento/i }).click();
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
  return created!;
}

test.describe("MediaBudget /comercial/orcamento — catálogo → plano → cotação", () => {
  let admin: DevUser | null = null;
  let client: ClientRow | null = null;

  test.beforeAll(async ({ request }) => {
    admin = await devLoginAdmin(request);
    await ensureScreenLocation(request);
    client = await ensureClient(request);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("usuário interno escolhe cliente, adiciona local de telas e gera a cotação", async ({
    page,
  }) => {
    expect(admin, "admin de teste indisponível").toBeTruthy();
    expect(client, "cliente de teste indisponível").toBeTruthy();
    const clientLabel = client!.company || client!.name || "";
    expect(clientLabel.length, "cliente sem rótulo legível").toBeGreaterThan(0);

    let createdId: number | null = null;
    try {
      await devLoginAdmin(page.request);
      await page.goto("/comercial/orcamento");

      // Cabeçalho da página de orçamento.
      await expect(
        page.getByRole("heading", { name: /^orçamento$/i }),
      ).toBeVisible();

      await pickClient(page, clientLabel);
      await addFirstScreenLocation(page);

      // Nome da campanha (obrigatório para habilitar "Gerar orçamento").
      const campaignName = `E2E Orçamento ${Date.now()}`;
      await page.getByPlaceholder(/Verão 2026/i).fill(campaignName);

      const generate = page.getByRole("button", { name: /gerar orçamento/i });
      await expect(generate).toBeEnabled();

      const created = await submitAndCaptureQuotation(page);
      createdId = created.id;

      // Após sucesso, MediaBudget navega para o detalhe da cotação criada.
      await expect(page).toHaveURL(
        new RegExp(`/comercial/cotacoes/${created.id}\\b`),
        { timeout: 15_000 },
      );
    } finally {
      if (createdId != null) {
        await page.context().clearCookies();
        await deleteQuotationAsAdmin(page.request, createdId);
      }
    }
  });
});
