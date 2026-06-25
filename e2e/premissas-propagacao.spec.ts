import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";
import {
  devLoginAdmin,
  devEnsureCampaign,
  pickAnyCampaign,
  trpcMutation,
  trpcQuery,
  todayIso,
} from "./_finance-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Premissas globais — FONTE ÚNICA ponta-a-ponta (Task #293 / guard da #301).
//
// Prova que alterar uma premissa global em `system_config` (via Admin
// Premissas) propaga para TODAS as superfícies de precificação/finanças, sem
// nenhum valor re-hardcoded pelo caminho:
//   • caminho servidor  → getSystemConfig()  (snapshot da cotação + AP de imposto)
//   • caminho cliente    → useSystemPremissas (Admin Premissas + simulador)
//   • PDFs               → tabela de preços (bytes do PDF refletem o IRPJ vivo);
//                          proposta usa o snapshot da cotação (asserido no
//                          caminho servidor — generateProposalPdf consome
//                          data.irpj = premissasSnapshot.irpj).
//
// Valores distintos dos defaults (6/15/10/20%) para que uma regressão que
// re-hardcode os antigos defaults seja capturada.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  irpj: 0.06,
  comissaoRestaurante: 0.15,
  comissaoComercial: 0.1,
  bvPadraoAgencia: 0.2,
};

const NEW = {
  irpj: 0.08, // default 0.06 → 8%
  comissaoRestaurante: 0.18, // default 0.15 → 18%
  comissaoComercial: 0.12, // default 0.10 → 12%
  bvPadraoAgencia: 0.25, // default 0.20 → 25%
};

type Premissas = typeof DEFAULTS;

async function setPremissas(request: APIRequestContext, p: Premissas) {
  await trpcMutation(request, "systemConfig.setMany", [
    { key: "irpj", value: String(p.irpj) },
    { key: "comissaoRestaurante", value: String(p.comissaoRestaurante) },
    { key: "comissaoComercial", value: String(p.comissaoComercial) },
    { key: "bvPadraoAgencia", value: String(p.bvPadraoAgencia) },
  ]);
}

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5000";

test.describe("Premissas globais — propagação ponta-a-ponta", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // Restaura os defaults para não vazar estado global para outros specs
  // (a suíte roda serialmente, então isolar por arquivo é suficiente).
  test.afterAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
    try {
      await devLoginAdmin(ctx);
      await setPremissas(ctx, DEFAULTS);
    } finally {
      await ctx.dispose();
    }
  });

  test("caminho servidor (getSystemConfig): getAll + snapshot da cotação + AP de imposto", async ({
    request,
  }) => {
    await devLoginAdmin(request);
    await setPremissas(request, NEW);

    // (1) getAll reflete os novos decimais — mesma query que useSystemPremissas
    //     consome no cliente e que getSystemConfig lê no servidor.
    const cfg = await trpcQuery<{ values: Record<string, string> }>(
      request,
      "systemConfig.getAll",
    );
    expect(parseFloat(cfg.values.irpj)).toBeCloseTo(NEW.irpj, 6);
    expect(parseFloat(cfg.values.comissaoRestaurante)).toBeCloseTo(
      NEW.comissaoRestaurante,
      6,
    );
    expect(parseFloat(cfg.values.comissaoComercial)).toBeCloseTo(
      NEW.comissaoComercial,
      6,
    );
    expect(parseFloat(cfg.values.bvPadraoAgencia)).toBeCloseTo(
      NEW.bvPadraoAgencia,
      6,
    );

    // (2) Cotação criada DEPOIS da mudança grava o snapshot com os novos
    //     valores — precificação da cotação + fonte do IRPJ do PDF de proposta.
    const ensure = await request.post("/api/dev-ensure-anunciante", { data: {} });
    expect(ensure.ok(), `dev-ensure-anunciante: ${ensure.status()}`).toBeTruthy();
    const { user } = (await ensure.json()) as { user: { clientId: number } };
    expect(user.clientId).toBeGreaterThan(0);

    const quotation = await trpcMutation<{ id: number }>(
      request,
      "quotation.create",
      {
        clientId: user.clientId,
        coasterVolume: 5000,
        cycles: 1,
        unitPrice: "1.0000",
        totalValue: "5000.00",
        includesProduction: true,
      },
    );
    expect(quotation.id).toBeGreaterThan(0);

    const fetched = await trpcQuery<{
      premissasSnapshot: Premissas | null;
      irpj: number;
    }>(request, "quotation.get", { id: quotation.id });
    expect(fetched.premissasSnapshot).not.toBeNull();
    const snap = fetched.premissasSnapshot!;
    expect(snap.irpj).toBeCloseTo(NEW.irpj, 6);
    expect(snap.comissaoRestaurante).toBeCloseTo(NEW.comissaoRestaurante, 6);
    expect(snap.comissaoComercial).toBeCloseTo(NEW.comissaoComercial, 6);
    expect(snap.bvPadraoAgencia).toBeCloseTo(NEW.bvPadraoAgencia, 6);
    // O IRPJ canônico exposto na cotação (consumido por generateProposalPdf).
    expect(fetched.irpj).toBeCloseTo(NEW.irpj, 6);

    // (3) Engine financeiro / materialização de AP: ao emitir uma fatura,
    //     materializePayablesForInvoice usa getSystemConfig().irpj para a AP de
    //     imposto. Valor esperado = bruto × novo IRPJ.
    let campaign = await pickAnyCampaign(request);
    if (!campaign) {
      await devEnsureCampaign(request);
      campaign = await pickAnyCampaign(request);
    }
    expect(campaign, "deve existir ao menos uma campanha").toBeTruthy();
    if (!campaign) return;

    const invoiceAmount = 1000;
    const invoice = await trpcMutation<{ id: number }>(
      request,
      "financial.createInvoice",
      {
        campaignId: campaign.id,
        amount: invoiceAmount.toFixed(2),
        issueDate: todayIso(-5),
        dueDate: todayIso(20),
      },
    );
    expect(invoice.id).toBeGreaterThan(0);

    const payables = await trpcQuery<
      Array<{
        amount: string;
        sourceType: string;
        invoiceId: number | null;
        sourceRef: { invoiceId?: number; kind?: string } | null;
      }>
    >(request, "financial.listAccountsPayable");
    const irpjAp = payables.find(
      (p) =>
        p.sourceType === "tax" &&
        p.invoiceId === invoice.id &&
        p.sourceRef?.kind === "irpj",
    );
    expect(
      irpjAp,
      `esperado AP de imposto IRPJ vinculada à fatura ${invoice.id}`,
    ).toBeTruthy();
    // Bruto × novo IRPJ (0.08) = 80.00 — provaria 60.00 se o default re-hardcoded.
    expect(parseFloat(irpjAp!.amount)).toBeCloseTo(invoiceAmount * NEW.irpj, 2);
  });

  test("caminho cliente (useSystemPremissas): Admin Premissas grava e simulador reflete", async ({
    page,
  }) => {
    await devLoginAdmin(page.request);

    // (1) Escreve as premissas pela tela real de Admin (AdminConfiguracoes →
    //     systemConfig.setMany). Valores em PERCENTUAL nos inputs.
    await page.goto("/configuracoes/premissas");
    await expect(page.locator("#irpj")).toBeVisible();
    await page.locator("#irpj").fill(String(NEW.irpj * 100));
    await page
      .locator("#comissaoRestaurante")
      .fill(String(NEW.comissaoRestaurante * 100));
    await page
      .locator("#comissaoComercial")
      .fill(String(NEW.comissaoComercial * 100));
    await page
      .locator("#bvPadraoAgencia")
      .fill(String(NEW.bvPadraoAgencia * 100));
    await page.getByRole("button", { name: /Salvar/i }).click();
    await expect(page.getByText(/Premissas atualizadas/i)).toBeVisible({
      timeout: 10_000,
    });

    // (2) Recarrega: o form re-semeia a partir de systemConfig.getAll (mesma
    //     query do useSystemPremissas) — prova persistência + leitura.
    await page.reload();
    await expect
      .poll(async () => parseFloat(await page.locator("#irpj").inputValue()))
      .toBeCloseTo(NEW.irpj * 100, 3);

    // (3) Simulador (Tabela de Preços) lê via useSystemPremissas. A seção
    //     "Receita Líquida GPC" rotula cada dedução com o percentual VIVO:
    //     o label e o valor são <span> adjacentes, então o texto da linha é
    //     "IRPJ8% = …". Os percentuais novos (8/18/12) ≠ defaults (6/15/10).
    //     A tolerância (\.\d+)? cobre o resíduo de ponto flutuante (8 → 8.0000…2).
    await page.goto("/comercial/tabela-precos");
    await expect(page.getByText(/IRPJ\s*8(\.\d+)?% =/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Restaurante\s*18(\.\d+)?% =/),
    ).toBeVisible();
    await expect(
      page.getByText(/Comercial\s*12(\.\d+)?% =/),
    ).toBeVisible();
  });

  test("PDF da tabela de preços reflete o IRPJ vivo (system_config)", async ({
    page,
  }) => {
    await devLoginAdmin(page.request);
    await setPremissas(page.request, NEW);

    await page.goto("/producao");
    const pdfButton = page.getByRole("button", { name: /Tabela de Pre[çc]os/i });
    await expect(pdfButton).toBeVisible({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      pdfButton.click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const pdf = Buffer.concat(chunks).toString("latin1");

    // A caixa "EXEMPLO" do PDF imprime os percentuais VIVOS (system_config):
    // "IRPJ (8%)" e "Com. rest. (18%)" — 8/18 (novo) ≠ 6/15 (default), provando
    // a propagação. Procuramos essas linhas (ASCII puro) e NÃO o cabeçalho de
    // composição: ele contém "→" (U+2192), que o jsPDF serializa como string hex
    // UTF-16, tornando o texto não-localizável em bytes latin1. O jsPDF também
    // escapa "(" → "\(" em strings literais, então toleramos a barra opcional.
    expect(pdf).toMatch(/IRPJ \\?\(8%\\?\)/);
    expect(pdf).toMatch(/Com\. rest\. \\?\(18%\\?\)/i);
  });
});
