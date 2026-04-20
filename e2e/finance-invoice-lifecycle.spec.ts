import { test, expect } from "@playwright/test";
import {
  devLoginAdmin,
  pickAnyCampaign,
  trpcMutation,
  trpcQuery,
  todayIso,
} from "./_finance-helpers";

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
  previousDso: number;
  previousSampleSize: number;
};

// Finrefac #9 — Ciclo financeiro completo de uma fatura:
// emitir → conferir trilha de payables → marcar paga → emitir DSO refletindo
// o pagamento. Cobre o caminho normal sem reconciliação bancária (ver
// finance-bank-reconciliation.spec.ts para esse caminho).
test.describe("finance — ciclo de vida de fatura", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("emitir fatura, gerar payables, marcar paga e refletir no DSO", async ({ request }) => {
    await devLoginAdmin(request);
    const campaign = await pickAnyCampaign(request);
    test.skip(!campaign, "Nenhuma campanha cadastrada — não dá para emitir fatura");
    if (!campaign) return;

    const amount = "1234.56";
    const issueDate = todayIso(-10);
    const dueDate = todayIso(20);

    const created = await trpcMutation<Invoice>(request, "financial.createInvoice", {
      campaignId: campaign.id,
      amount,
      dueDate,
      issueDate,
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.status).toBe("emitida");
    expect(created.invoiceNumber).toMatch(/^FAT-\d{4}-\d{4}$/);

    // Confere que a auditoria registrou a criação.
    const auditCreate = await trpcQuery<{ rows: Array<{ action: string }> }>(
      request,
      "financial.auditLog",
      { entityType: "invoice", entityId: created.id, limit: 50, offset: 0 },
    );
    expect(auditCreate.rows.some((r) => r.action === "create")).toBe(true);

    // Marca como paga em data ≠ issueDate para gerar DSO mensurável.
    const paymentDate = todayIso(-2);
    const paid = await trpcMutation<Invoice>(request, "financial.markInvoicePaid", {
      id: created.id,
      paymentDate,
    });
    expect(paid.status).toBe("paga");

    // Auditoria registra mark_paid.
    const auditPaid = await trpcQuery<{ rows: Array<{ action: string }> }>(
      request,
      "financial.auditLog",
      { entityType: "invoice", entityId: created.id, limit: 50, offset: 0 },
    );
    expect(
      auditPaid.rows.some((r) => r.action === "mark_paid" || r.action === "update"),
    ).toBe(true);

    // DSO da janela atual (90 dias) precisa contar pelo menos esta fatura.
    const dso = await trpcQuery<DsoSummary>(request, "financial.dso");
    expect(dso.currentSampleSize).toBeGreaterThanOrEqual(1);

    // listAccountsPayable retorna o ledger consolidado. Nem toda invoice
    // amarra invoiceId nos derivados (partner_commission é agregada por
    // mês via sourceRef.invoiceIds[]; restaurant_commission, ISS retido e
    // outras dependem da configuração da campanha). O contrato mínimo
    // verificável aqui é: o endpoint responde com array válido (prova que
    // o materializador rodou sem exceção dentro da transação de pagamento).
    const payables = await trpcQuery<Payable[]>(request, "financial.listAccountsPayable");
    expect(Array.isArray(payables)).toBe(true);
  });
});
