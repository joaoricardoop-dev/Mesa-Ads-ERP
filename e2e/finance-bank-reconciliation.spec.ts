import { test, expect } from "@playwright/test";
import {
  devLoginAdmin,
  devEnsureBankAccount,
  devEnsureCampaign,
  pickAnyCampaign,
  trpcMutation,
  trpcQuery,
  todayIso,
} from "./_finance-helpers";

type Campaign = { id: number; name: string };

type Invoice = { id: number; invoiceNumber: string; amount: string; status: string };
type Payable = {
  id: number;
  amount: string;
  status: string;
  sourceType: string;
  invoiceId: number | null;
};
type DsoSummary = {
  currentDso: number;
  currentSampleSize: number;
};
type ConfirmImportResp = {
  imported: number;
  skipped: number;
  importBatchId: string | null;
};
type BankTx = {
  id: number;
  amount: string;
  type: "credit" | "debit";
  description: string;
  externalId: string | null;
  reconciled: boolean;
};
type ReconcileResp = { ok: boolean };

// Finrefac #9 — Fluxo completo com reconciliação bancária.
// Cenário: emite fatura → confirma payables (tax) materializadas → importa
// 1 transação de crédito casando o valor → reconcilia → invoice vira paga,
// payables são liquidadas (ou continuam coerentes), DSO conta a fatura.
test.describe("finance — reconciliação bancária", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("emit → import CSV → reconcile → invoice paga + payables coerentes + DSO", async ({
    request,
  }) => {
    await devLoginAdmin(request);

    let campaign = await pickAnyCampaign(request);
    if (!campaign) {
      const ensured = await devEnsureCampaign(request);
      const list = await trpcQuery<Campaign[]>(request, "campaigns.list");
      campaign = list.find((c) => c.id === ensured.id) ?? list[0];
    }
    expect(campaign, "devEnsureCampaign deve garantir ao menos uma campanha").toBeDefined();
    if (!campaign) return;

    const bank = await devEnsureBankAccount(request);

    // Valor único pra evitar colisão com sugestões de match em históricos.
    const cents = 10_000 + Math.floor(Math.random() * 89_999);
    const amount = (cents / 100).toFixed(2);
    const issueDate = todayIso(-7);
    const dueDate = todayIso(20);
    const paymentDate = todayIso(-1);

    // 1) Emite a fatura.
    const created = await trpcMutation<Invoice>(request, "financial.createInvoice", {
      campaignId: campaign.id,
      amount,
      dueDate,
      issueDate,
    });
    expect(created.status).toBe("emitida");

    // 2) Payables de tax devem ter sido materializadas no emit.
    const payablesAfterEmit = await trpcQuery<Payable[]>(
      request,
      "financial.listAccountsPayable",
    );
    const taxBefore = payablesAfterEmit.filter(
      (p) => p.sourceType === "tax" && p.invoiceId === created.id,
    );
    expect(
      taxBefore.length,
      `esperado ≥1 AP de tax vinculada à invoice ${created.id} após emitida`,
    ).toBeGreaterThanOrEqual(1);

    // 3) Importa um extrato CSV com 1 crédito casando o valor exato.
    // Formato BR genérico: data;descricao;valor (sem header — fallback do parser).
    const dataBr = `${paymentDate.slice(8, 10)}/${paymentDate.slice(5, 7)}/${paymentDate.slice(0, 4)}`;
    const csv = `${dataBr};Recebimento ref ${created.invoiceNumber};${amount.replace(".", ",")}`;
    const filename = `e2e-${created.invoiceNumber}.csv`;

    const importResp = await trpcMutation<ConfirmImportResp>(
      request,
      "bank.confirmImport",
      {
        bankAccountId: bank.id,
        filename,
        encoding: "utf8",
        content: csv,
        kind: "csv",
      },
    );
    expect(importResp.imported + importResp.skipped).toBeGreaterThanOrEqual(1);
    expect(importResp.imported).toBeGreaterThanOrEqual(1);

    // Lista as transações dessa conta e localiza a recém-importada por valor.
    const txs = await trpcQuery<BankTx[]>(request, "bank.listTransactions", {
      bankAccountId: bank.id,
      reconciled: false,
      type: "credit",
    });
    const tx = txs.find((t) => Number(t.amount) === Number(amount));
    expect(tx, `transação de crédito ${amount} deve estar na conta ${bank.id}`).toBeDefined();

    // 4) Reconcilia a transação 1↔1 com a invoice.
    const reconciled = await trpcMutation<ReconcileResp>(request, "bank.reconcile", {
      transactionId: tx!.id,
      matches: [{ kind: "invoice", id: created.id }],
    });
    expect(reconciled.ok).toBe(true);

    // Re-busca a transação para confirmar que foi marcada como conciliada
    // com o tipo/id corretos (o mutation só retorna {ok}; estado real fica no BD).
    const txnsAfter = await trpcQuery<BankTx[]>(request, "bank.listTransactions", {
      bankAccountId: bank.id,
    });
    const txAfterRecon = txnsAfter.find((t) => t.id === tx!.id);
    expect(txAfterRecon, "transação reconciliada não encontrada").toBeDefined();
    expect(txAfterRecon!.reconciled).toBe(true);

    // 5) Após reconcile, invoice precisa estar paga (efeito do bank.reconcile).
    const invoiceList = await trpcQuery<Invoice[]>(request, "financial.listInvoices");
    const refreshed = invoiceList.find((i) => i.id === created.id);
    expect(refreshed, `invoice ${created.id} ainda deve existir após reconcile`).toBeDefined();
    expect(refreshed!.status).toBe("paga");

    // 6) DSO conta esta fatura na janela atual.
    const dso = await trpcQuery<DsoSummary>(request, "financial.dso");
    expect(dso.currentSampleSize).toBeGreaterThanOrEqual(1);

    // 7) Tax payables continuam vinculadas (status "pendente" ou "pago" — o
    //    pagamento da AP de imposto é processo separado; o que importa é que
    //    a reconciliação não as deletou e a contagem é estável).
    const payablesAfterRecon = await trpcQuery<Payable[]>(
      request,
      "financial.listAccountsPayable",
    );
    const taxAfter = payablesAfterRecon.filter(
      (p) => p.sourceType === "tax" && p.invoiceId === created.id,
    );
    expect(taxAfter.length).toBeGreaterThanOrEqual(taxBefore.length);
  });
});
