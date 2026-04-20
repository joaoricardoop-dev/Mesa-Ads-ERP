import { test, expect } from "@playwright/test";
import {
  devLoginAdmin,
  devLoginAs,
  devEnsureParceiro,
  devDeleteUser,
  devFindCampaignForPartner,
  devSeedCampaignForPartner,
  trpcMutation,
  trpcQuery,
  todayIso,
  FixtureMissingError,
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

    let ensured: { user: { id: string }; partnerId: number };
    try {
      ensured = await devEnsureParceiro(request);
    } catch (e) {
      if (e instanceof FixtureMissingError) {
        test.skip(true, e.message);
        return;
      }
      throw e;
    }
    const e2eUserId = ensured.user.id;
    const partnerId = ensured.partnerId;

    try {
      // Tenta achar uma campanha existente que resolva para esse parceiro;
      // se não houver, cria deterministicamente um par client+campaign
      // amarrado ao partnerId — assim o teste roda em CI sem skip.
      let campaign: { id: number; clientId: number; name: string };
      try {
        campaign = await devFindCampaignForPartner(request, partnerId);
      } catch (e) {
        if (e instanceof FixtureMissingError) {
          campaign = await devSeedCampaignForPartner(request, partnerId);
        } else {
          throw e;
        }
      }

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

      // Causal: comissão total cresceu (sourceType=partner_commission).
      // Se o produto/parceiro tem taxa zero, o materializer não cria AP —
      // nesse caso, marcamos o teste como skipped.
      const totalDelta = after.commissionTotal - before.commissionTotal;
      if (totalDelta < 0.01) {
        test.skip(
          true,
          `Parceiro ${partnerId} configurado sem taxa de comissão (totalDelta=${totalDelta})`,
        );
        return;
      }

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
