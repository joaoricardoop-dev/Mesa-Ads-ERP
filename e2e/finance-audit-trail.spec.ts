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
type AuditRow = {
  id: number;
  entityType: string;
  entityId: number | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
type AuditPage = { rows: AuditRow[]; total: number };

// Finrefac #9 — Trilha de auditoria registra create/update/mark_paid em
// invoices com diff calculado entre before/after.
test.describe("finance — auditoria de fatura", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("create + update gera entradas de audit com diff", async ({ request }) => {
    await devLoginAdmin(request);

    let campaign = await pickAnyCampaign(request);
    if (!campaign) {
      const ensured = await devEnsureCampaign(request);
      const list = await trpcQuery<Campaign[]>(request, "campaign.list");
      campaign = list.find((c) => c.id === ensured.id) ?? list[0];
    }
    expect(campaign, "devEnsureCampaign deve garantir ao menos uma campanha").toBeDefined();
    if (!campaign) return;

    const initialAmount = "999.00";
    const updatedAmount = "1234.50";
    const issueDate = todayIso(-3);
    const dueDate = todayIso(15);

    const created = await trpcMutation<Invoice>(request, "financial.createInvoice", {
      campaignId: campaign.id,
      amount: initialAmount,
      dueDate,
      issueDate,
    });
    expect(created.id).toBeGreaterThan(0);

    // Atualiza o valor — deve gerar audit "update" com diff de amount.
    await trpcMutation<Invoice>(request, "financial.updateInvoice", {
      id: created.id,
      amount: updatedAmount,
    });

    const log = await trpcQuery<AuditPage>(request, "financial.auditLog", {
      entityType: "invoice",
      entityId: created.id,
      limit: 50,
      offset: 0,
    });
    expect(log.rows.length).toBeGreaterThanOrEqual(2);

    const createRow = log.rows.find((r) => r.action === "create");
    const updateRow = log.rows.find((r) => r.action === "update");
    expect(createRow, "deve registrar create").toBeDefined();
    expect(updateRow, "deve registrar update").toBeDefined();

    // diff (se serializado) ou after deve refletir o novo amount.
    const newAmount = String(updateRow?.after?.amount ?? "");
    expect(newAmount).toBe(updatedAmount);

    // Confere que o before reflete o valor original.
    const beforeAmount = String(updateRow?.before?.amount ?? "");
    expect(beforeAmount).toBe(initialAmount);
  });
});
