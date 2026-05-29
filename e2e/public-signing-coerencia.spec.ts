import { test, expect, type APIRequestContext } from "@playwright/test";

// Task #218 — a tela pública de assinatura (/cotacao/assinar/:token) NUNCA
// pode exibir preços ou vencimentos divergentes:
//   • preço/un × qtd = total da linha
//   • Σ(totais das linhas) = total geral exibido no rodapé
//   • nenhum vencimento é anterior ao início do período
// O fixture dev `/api/dev-seed-signable-quotation` cria propositalmente um
// cenário "ruim" (BV embutido no total + cronograma legado com vencimentos
// antes do início) para garantir que o front-end (escala dos itens) e o
// auto-heal do GET (reconciliação dos vencimentos) corrigem ambos.

const TOLERANCE = 0.01; // 1 centavo

function parseBRL(text: string): number {
  // "R$ 4.800,00" → 4800.00 ; "R$ 1,5000" → 1.5
  const cleaned = text
    .replace(/[^0-9.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned);
}

function parseBRDate(text: string): Date {
  // "08/07/2026" → Date(2026, 6, 8)
  const [d, m, y] = text.trim().split("/").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
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

  test("preços por linha somam o total geral e vencimentos respeitam o início", async ({
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

    // ── Coerência de vencimentos ───────────────────────────────────────────
    const inicio = parseBRDate(
      await page.getByTestId("periodo-inicio").innerText(),
    );

    const parcelaRows = page.locator("[data-testid^='parcela-venc-']");
    const parcelaCount = await parcelaRows.count();
    expect(parcelaCount).toBeGreaterThan(0);

    let somaParcelas = 0;
    for (let i = 0; i < parcelaCount; i++) {
      const vencText = await parcelaRows.nth(i).innerText();
      const venc = parseBRDate(vencText);
      // Nenhum vencimento anterior ao início do período.
      expect(
        venc.getTime(),
        `parcela ${i}: vencimento ${vencText} é anterior ao início do período`,
      ).toBeGreaterThanOrEqual(inicio.getTime());
    }

    const valorParcelas = page.locator("[data-testid^='parcela-valor-']");
    for (let i = 0; i < parcelaCount; i++) {
      somaParcelas += parseBRL(await valorParcelas.nth(i).innerText());
    }

    // Σ(parcelas) === total geral.
    expect(
      Math.abs(somaParcelas - grandTotal),
      `Σ parcelas (${somaParcelas}) ≠ total geral (${grandTotal})`,
    ).toBeLessThanOrEqual(TOLERANCE);
  });
});
