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
    let campaign = await pickAnyCampaign(request);
    if (!campaign) {
      // Determinístico: garante que existe campanha (cria genérica se preciso).
      // Acceptance criterion finrefac #9: CI sem skip.
      const ensured = await devEnsureCampaign(request);
      const campaignsAfter = await trpcQuery<Campaign[]>(request, "campaigns.list");
      campaign = campaignsAfter.find((c) => c.id === ensured.id) ?? campaignsAfter[0];
    }
    expect(campaign, "devEnsureCampaign deve garantir ao menos uma campanha").toBeDefined();
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

    // Payables derivadas: na emissão, materializePayablesForInvoice cria
    // sempre payables de tipo "tax" (IRPJ/CSLL/PIS/COFINS/ISS conforme
    // calc.computeInvoiceTaxes), com sourceRef.invoiceId apontando para a
    // fatura. Verificamos esse vínculo causal — array vazio ou sem tax
    // significa que o materializer não rodou.
    const payables = await trpcQuery<Payable[]>(request, "financial.listAccountsPayable");
    expect(Array.isArray(payables)).toBe(true);
    const taxForInvoice = payables.filter(
      (p) => p.sourceType === "tax" && p.invoiceId === created.id,
    );
    expect(
      taxForInvoice.length,
      `esperado ≥1 AP de tax vinculada à invoice ${created.id}`,
    ).toBeGreaterThanOrEqual(1);
    for (const p of taxForInvoice) {
      expect(["pendente", "pago", "cancelada"]).toContain(p.status);
      expect(parseFloat(p.amount)).toBeGreaterThan(0);
    }
  });
});
