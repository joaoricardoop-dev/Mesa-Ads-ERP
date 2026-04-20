import { test, expect } from "@playwright/test";
import {
  devEnsureCampaign,
  devLoginAdmin,
  pickAnyCampaign,
  trpcMutation,
  trpcQuery,
  todayIso,
} from "./_finance-helpers";

type Campaign = { id: number; name: string };

type Invoice = { id: number; status: string };
type Dre = {
  regime: "competencia" | "caixa";
  startDate: string;
  endDate: string;
  lines: { grossRevenue: number; netRevenue: number; netProfit: number };
};

// Finrefac #9 — DRE dual: regime competência (issueDate) vs caixa (paymentDate).
// Cenário: emite fatura em data X, paga em data Y (>X), e aponta a janela
// para incluir só X — competência conta a receita, caixa não.
test.describe("finance — DRE dual (competência vs caixa)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("competência reconhece pelo issueDate, caixa pelo paymentDate", async ({ request }) => {
    await devLoginAdmin(request);

    let campaign = await pickAnyCampaign(request);
    if (!campaign) {
      const ensured = await devEnsureCampaign(request);
      const list = await trpcQuery<Campaign[]>(request, "campaign.list");
      campaign = list.find((c) => c.id === ensured.id) ?? list[0];
    }
    expect(campaign, "devEnsureCampaign deve garantir ao menos uma campanha").toBeDefined();
    if (!campaign) return;

    const issueDate = todayIso(-40);
    const dueDate = todayIso(-10);
    const paymentDate = todayIso(-1);
    const amount = "7777.00";

    // Snapshot DRE antes da emissão (mês de issueDate, regime competência).
    const startDate = `${issueDate.slice(0, 7)}-01`;
    const endDate = lastDayOfMonth(issueDate);

    const dreCompBefore = await trpcQuery<Dre>(request, "financial.dre", {
      regime: "competencia",
      startDate,
      endDate,
    });
    const dreCaixaBefore = await trpcQuery<Dre>(request, "financial.dre", {
      regime: "caixa",
      startDate,
      endDate,
    });

    // Emite e paga.
    const invoice = await trpcMutation<Invoice>(request, "financial.createInvoice", {
      campaignId: campaign.id,
      amount,
      dueDate,
      issueDate,
    });
    await trpcMutation<Invoice>(request, "financial.markInvoicePaid", {
      id: invoice.id,
      paymentDate,
    });

    const dreCompAfter = await trpcQuery<Dre>(request, "financial.dre", {
      regime: "competencia",
      startDate,
      endDate,
    });
    const dreCaixaAfter = await trpcQuery<Dre>(request, "financial.dre", {
      regime: "caixa",
      startDate,
      endDate,
    });

    const compDelta = dreCompAfter.lines.grossRevenue - dreCompBefore.lines.grossRevenue;
    const caixaDelta = dreCaixaAfter.lines.grossRevenue - dreCaixaBefore.lines.grossRevenue;

    // Competência: receita reconhecida no mês do issueDate (~ 40 dias atrás).
    expect(compDelta).toBeGreaterThanOrEqual(parseFloat(amount) - 0.01);

    // Caixa: paymentDate é "ontem" (fora da janela do issueDate), portanto
    // a receita NÃO deve aparecer nessa janela em regime caixa.
    expect(caixaDelta).toBeLessThan(parseFloat(amount) - 0.01);
  });
});

function lastDayOfMonth(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  return last.toISOString().split("T")[0];
}
