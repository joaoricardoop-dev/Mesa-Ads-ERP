import { test, expect, type Page } from "@playwright/test";
import { devLoginAdmin, trpcMutation } from "./_finance-helpers";

// Listas paramétricas (config_options) — categorias de origem e motivos de
// perda. Este spec prova a FONTE ÚNICA: o que o admin cria em
// /configuracoes/listas aparece imediatamente em TODOS os selects que
// consomem essas listas — Origem (Leads + Oportunidades) e Motivo de perda
// (Oportunidades + Cotação). Todos os consumidores leem de
// trpc.configOption.list via o hook useConfigOptions.

const stamp = Date.now();
const ORIGIN_LABEL = `E2E Origem ${stamp}`;
const LOSS_LABEL = `E2E Motivo ${stamp}`;

async function addOption(page: Page, type: "origin_category" | "loss_reason", label: string) {
  await page.goto("/configuracoes/listas");
  await page.getByTestId(`button-add-${type}`).click();
  const input = page.getByTestId(`input-label-${type}`);
  await expect(input).toBeVisible();
  await input.fill(label);
  await page.getByTestId(`button-save-${type}`).click();
  // O item recém-criado aparece na tabela da própria página de admin.
  await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe("Listas & Categorias — fonte única", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("origem criada no admin aparece nos selects de Leads e Oportunidades", async ({ page }) => {
    await devLoginAdmin(page.request);

    await addOption(page, "origin_category", ORIGIN_LABEL);

    // Consumidor 1 — formulário de Lead (Origem). O diálogo abre no passo de
    // busca por CNPJ; pulamos para o formulário manual onde vive o select.
    await page.goto("/comercial/leads");
    await page.getByRole("button", { name: /Novo Lead/i }).click();
    await page.getByRole("button", { name: /Pular e cadastrar manualmente/i }).click();
    await page.getByTestId("select-lead-origin").click();
    await expect(
      page.getByRole("option", { name: ORIGIN_LABEL, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    // Fecha o dropdown e o diálogo.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // Consumidor 2 — formulário de Oportunidade (Origem).
    await page.goto("/comercial/leads");
    await page.getByRole("tab", { name: /Oportunidades/i }).click();
    await page.getByRole("button", { name: /Nova Oportunidade/i }).click();
    await page.getByTestId("select-opportunity-origin").click();
    await expect(
      page.getByRole("option", { name: ORIGIN_LABEL, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("motivo de perda criado no admin aparece nos selects de Oportunidade e Cotação", async ({ page }) => {
    await devLoginAdmin(page.request);

    await addOption(page, "loss_reason", LOSS_LABEL);

    // Consumidor 1 — detalhe de Oportunidade ("Marcar como perdida").
    const opp = await trpcMutation<{ id: number }>(page.request, "opportunity.create", {
      title: `E2E Opp Loss ${stamp}`,
      stage: "qualificada",
    });
    expect(opp.id).toBeGreaterThan(0);

    await page.goto("/comercial/leads");
    await page.getByRole("tab", { name: /Oportunidades/i }).click();
    await page.getByText(`E2E Opp Loss ${stamp}`, { exact: true }).first().click();
    await page.getByTestId("select-opportunity-loss").click();
    await expect(
      page.getByRole("option", { name: LOSS_LABEL, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    // Consumidor 2 — detalhe de Cotação (diálogo "Perdida").
    const seed = await page.request.post("/api/dev-seed-signable-quotation", { data: {} });
    expect(seed.ok(), `dev-seed-signable-quotation falhou: ${seed.status()}`).toBeTruthy();
    const { quotationId } = (await seed.json()) as { quotationId: number };
    expect(quotationId).toBeGreaterThan(0);

    await page.goto(`/comercial/cotacoes/${quotationId}`);
    await page.getByRole("button", { name: /Perdida/i }).first().click();
    await page.getByTestId("select-quotation-loss").click();
    await expect(
      page.getByRole("option", { name: LOSS_LABEL, exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
