import { test, expect } from "@playwright/test";
import {
  devLoginAdmin,
  devLoginAs,
  devEnsureParceiro,
  devDeleteUser,
  devSeedCampaignForPartner,
  trpcMutation,
  trpcQuery,
  todayIso,
} from "./_finance-helpers";

type Invoice = { id: number; invoiceNumber: string; status: string };
type DashboardCommissionItem = {
  campaignId: number | null;
  amount: number;
  status: "paid" | "pending" | "cancelled";
};
type DashboardMonth = {
  competenceMonth: string;
  paid: number;
  pending: number;
  total: number;
  items: DashboardCommissionItem[];
};
type Dashboard = {
  commissionPaid: number;
  commissionPending: number;
  commissionTotal: number;
  commissionByMonth: DashboardMonth[];
};

// Finrefac #9 — Portal do parceiro reflete comissão por competência.
// Cenário: emite uma fatura em campanha cuja resolução de parceiro
// (campaign.partnerId, quotation.partnerId ou client.partnerId) bate com o
// parceiro vinculado ao usuário e2e → marca paga → o item da campanha
// aparece em commissionByMonth na competência do paymentDate.
test.describe("finance — portal parceiro (comissão por competência)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("comissão de parceiro materializa após pagamento da invoice", async ({ request, context }) => {
    await devLoginAdmin(request);

    // dev-ensure-parceiro auto-cria o partner (com commissionPercent=10) se
    // o BD estiver vazio — acceptance "CI sem skip" finrefac #9.
    const ensured = await devEnsureParceiro(request);
    const e2eUserId = ensured.user.id;
    const partnerId = ensured.partnerId;

    try {
      // Sempre cria um par client+campaign novo amarrado ao partnerId.
      // O seed trava agencyBvPercent=10/hasAgencyBv=true, garantindo que
      // calcPartnerCommission produza AP > 0 (sem depender de configs
      // pré-existentes no BD). Determinístico em CI sem skip.
      const campaign = await devSeedCampaignForPartner(request, partnerId);

      // Snapshot do dashboard antes da ação para isolar o efeito da invoice.
      await context.clearCookies();
      await devLoginAs(request, e2eUserId);
      const before = await trpcQuery<Dashboard>(request, "parceiroPortal.getDashboard");

      // Emite e paga uma invoice nessa campanha.
      await context.clearCookies();
      await devLoginAdmin(request);

      const issueDate = todayIso(-5);
      const dueDate = todayIso(25);
      const paymentDate = todayIso(-1);
      const amount = "5000.00";
      const competenceMonth = paymentDate.slice(0, 7);

      const invoice = await trpcMutation<Invoice>(request, "financial.createInvoice", {
        campaignId: campaign.id,
        amount,
        dueDate,
        issueDate,
      });
      expect(invoice.status).toBe("emitida");

      await trpcMutation<Invoice>(request, "financial.markInvoicePaid", {
        id: invoice.id,
        paymentDate,
      });

      // Reabre dashboard como parceiro e mede.
      await context.clearCookies();
      await devLoginAs(request, e2eUserId);
      const after = await trpcQuery<Dashboard>(request, "parceiroPortal.getDashboard");

      // Causal: o seed trava agencyBvPercent=10 → calcPartnerCommission
      // sempre produz delta > 0. Se chegou aqui zero, é regressão real
      // no materializer — falhamos em vez de pular.
      const totalDelta = after.commissionTotal - before.commissionTotal;
      expect(
        totalDelta,
        `Comissão total deveria crescer >0 após pagar invoice (totalDelta=${totalDelta})`,
      ).toBeGreaterThanOrEqual(0.01);

      const monthEntry = after.commissionByMonth.find(
        (m) => m.competenceMonth === competenceMonth,
      );
      expect(monthEntry, `mês ${competenceMonth} deve aparecer no dashboard`).toBeDefined();
      const item = monthEntry!.items.find((i) => i.campaignId === campaign.id);
      expect(item, `campanha ${campaign.id} deve estar entre os itens do mês`).toBeDefined();
      expect(item!.amount).toBeGreaterThan(0);
      expect(["paid", "pending"]).toContain(item!.status);
    } finally {
      await context.clearCookies();
      await devLoginAdmin(request);
      await devDeleteUser(request, e2eUserId);
    }
  });
});
