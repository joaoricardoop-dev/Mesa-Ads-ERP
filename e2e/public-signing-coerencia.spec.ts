import { test, expect, type APIRequestContext } from "@playwright/test";

// A tela pública de assinatura (/cotacao/assinar/:token) NUNCA pode exibir
// preços divergentes:
//   • preço/un × qtd = total da linha
//   • Σ(totais das linhas) = total geral exibido no rodapé
//   • Σ(parcelas) = total geral
// O fixture dev `/api/dev-seed-signable-quotation` cria propositalmente um
// total com BV embutido para garantir que o front-end escala os itens. Os
// vencimentos são exibidos VERBATIM (fonte única) — podem ser anteriores ao
// início do período (pagamento antecipado é válido), então isso não é validado.

const TOLERANCE = 0.01; // 1 centavo

// Formata uma data ISO (YYYY-MM-DD) → "DD/MM/AAAA" ancorando em UTC, espelhando
// o formatador canônico `formatIsoDateBR`. Usado para provar que a tela pública
// exibe a data VERBATIM (sem deslocamento de fuso) idêntica à fonte ISO.
function isoToBR(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function parseBRL(text: string): number {
  // "R$ 4.800,00" → 4800.00 ; "R$ 1,5000" → 1.5
  const cleaned = text
    .replace(/[^0-9.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned);
}

async function seedSignableQuotation(request: APIRequestContext): Promise<{
  token: string;
  periodStart: string;
}> {
  const res = await request.post("/api/dev-seed-signable-quotation");
  expect(
    res.ok(),
    `seed falhou (${res.status()}): ${await res.text()}`,
  ).toBeTruthy();
  return res.json();
}

test.describe("tela pública de assinatura — coerência de preços e vencimentos", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("preços por linha somam o total geral e Σ parcelas = total", async ({
    page,
    request,
  }) => {
    const { token } = await seedSignableQuotation(request);

    await page.goto(`/cotacao/assinar/${token}`);

    // A tabela de produtos precisa estar renderizada.
    await expect(page.getByTestId("linha-item-0")).toBeVisible();
    await expect(page.getByTestId("grand-total")).toBeVisible();

    // ── Coerência de preços ────────────────────────────────────────────────
    const rowCount = await page.locator("[data-testid^='linha-item-']").count();
    expect(rowCount).toBeGreaterThan(0);

    let somaLinhas = 0;
    for (let i = 0; i < rowCount; i++) {
      const totalText = await page.getByTestId(`item-total-${i}`).innerText();
      const unitText = await page.getByTestId(`item-unitario-${i}`).innerText();
      const qtyText = await page.getByTestId(`item-qtd-${i}`).innerText();

      const lineTotal = parseBRL(totalText);
      const unit = parseBRL(unitText);
      // "2.000 bolachas" → 2000
      const qty = parseInt(qtyText.replace(/\D/g, ""), 10);

      somaLinhas += lineTotal;

      // preço/un × qtd === total da linha (tolerância de 1 centavo).
      expect(
        Math.abs(unit * qty - lineTotal),
        `linha ${i}: ${unit} × ${qty} = ${unit * qty} ≠ ${lineTotal}`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }

    const grandTotal = parseBRL(await page.getByTestId("grand-total").innerText());

    // Σ(linhas) === total geral.
    expect(
      Math.abs(somaLinhas - grandTotal),
      `Σ linhas (${somaLinhas}) ≠ total geral (${grandTotal})`,
    ).toBeLessThanOrEqual(TOLERANCE);

    // ── Coerência de vencimentos (Σ parcelas) ──────────────────────────────
    // Fonte única: os vencimentos são exibidos verbatim (podem ser anteriores
    // ao início do período — pagamento antecipado é válido). Aqui só validamos
    // que a soma das parcelas bate com o total geral.
    const parcelaRows = page.locator("[data-testid^='parcela-venc-']");
    const parcelaCount = await parcelaRows.count();
    expect(parcelaCount).toBeGreaterThan(0);

    let somaParcelas = 0;
    const valorParcelas = page.locator("[data-testid^='parcela-valor-']");
    for (let i = 0; i < parcelaCount; i++) {
      somaParcelas += parseBRL(await valorParcelas.nth(i).innerText());
    }

    // Σ(parcelas) === total geral.
    expect(
      Math.abs(somaParcelas - grandTotal),
      `Σ parcelas (${somaParcelas}) ≠ total geral (${grandTotal})`,
    ).toBeLessThanOrEqual(TOLERANCE);

    // ── Paridade de data exibida (sem off-by-one de fuso) ───────────────────
    // Cada vencimento renderizado (DD/MM/AAAA) deve bater EXATAMENTE com a data
    // ISO da fonte (GET público), ancorada em UTC — provando que a tela pública
    // não desloca a data em -1 dia no fuso do Brasil.
    const apiRes = await request.get(`/api/public-signing/quotation/${token}`);
    expect(apiRes.ok(), `GET público falhou (${apiRes.status()})`).toBeTruthy();
    const apiBody = await apiRes.json();
    const apiSchedule = (apiBody.billingSchedule ?? []) as Array<{
      sequence: number;
      dueDate: string;
    }>;
    expect(apiSchedule.length).toBe(parcelaCount);
    for (const it of apiSchedule) {
      const shown = (
        await page.getByTestId(`parcela-venc-${it.sequence}`).innerText()
      ).trim();
      expect(
        shown,
        `parcela ${it.sequence}: exibido ${shown} ≠ fonte ISO ${it.dueDate} (${isoToBR(it.dueDate)})`,
      ).toBe(isoToBR(it.dueDate));
    }
  });
});
