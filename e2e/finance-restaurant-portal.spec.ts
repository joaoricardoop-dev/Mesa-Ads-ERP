import { test, expect } from "@playwright/test";
import {
  devLoginAdmin,
  devLoginAs,
  devEnsureRestaurante,
  devSeedRestaurantPayment,
  devDeleteUser,
  trpcQuery,
  trpcMutation,
} from "./_finance-helpers";

type RestaurantPayment = {
  id: number;
  restaurantId: number;
  status: string;
  amount: string;
  paymentDate: string | null;
};
type MyCommissionsResp = {
  totalPaid: number;
  totalPending: number;
  payments: Array<{
    id: number;
    status: string;
    amountNumber: number;
    paymentDate?: string | null;
  }>;
};

// Finrefac #9 — Portal do restaurante reflete pagamento de comissão.
// Cenário: admin marca um restaurant_payment como pago → no portal do
// restaurante, a comissão aparece como paga (status=paid + paymentDate).
test.describe("finance — portal restaurante", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("admin marca pagamento → restaurante vê como paga via myCommissions", async ({ request, context }) => {
    await devLoginAdmin(request);

    // dev-ensure-restaurante agora cria restaurante se não existir
    // (acceptance "CI sem skip" — finrefac #9). Qualquer falha é erro real.
    const ensured = await devEnsureRestaurante(request);
    const e2eUserId = ensured.user.id;

    try {
      // Cria deterministicamente um pagamento pendente — não depende do
      // estado pré-existente do banco de dev. Valor não-redondo p/ reduzir
      // colisão com históricos (ainda comparamos por delta, não por valor).
      const seedAmount = (Math.floor(Math.random() * 90000) / 100 + 100).toFixed(2);
      const seeded = await devSeedRestaurantPayment(
        request,
        ensured.restaurantId,
        seedAmount,
      );
      const target = seeded as RestaurantPayment;
      const targetAmount = parseFloat(target.amount);
      const today = new Date().toISOString().split("T")[0];

      // Snapshot do portal antes da ação.
      await context.clearCookies();
      await devLoginAs(request, e2eUserId);
      const before = await trpcQuery<MyCommissionsResp>(
        request,
        "restaurantePortal.myCommissions",
      );

      // Volta para admin e executa a ação.
      await context.clearCookies();
      await devLoginAdmin(request);
      const updated = await trpcMutation<RestaurantPayment>(
        request,
        "financial.markPaymentPaid",
        { id: target.id, paymentDate: today },
      );
      expect(updated.status).toBe("paid");
      expect(updated.paymentDate).toBe(today);

      // Loga novamente como restaurante e2e e mede o delta.
      await context.clearCookies();
      await devLoginAs(request, e2eUserId);
      const after = await trpcQuery<MyCommissionsResp>(
        request,
        "restaurantePortal.myCommissions",
      );

      // Causal: totalPaid aumentou em pelo menos targetAmount, totalPending
      // diminuiu em pelo menos targetAmount. Tolerância 0,01 p/ ponto flutuante.
      expect(after.totalPaid - before.totalPaid).toBeGreaterThanOrEqual(targetAmount - 0.01);
      expect(before.totalPending - after.totalPending).toBeGreaterThanOrEqual(targetAmount - 0.01);

      // Existe pagamento "paid" com a data exata da ação.
      const paidWithDate = after.payments.find(
        (p) => p.status === "paid" && p.paymentDate === today,
      );
      expect(paidWithDate, "pagamento com paymentDate de hoje deve estar visível").toBeDefined();
    } finally {
      await context.clearCookies();
      await devLoginAdmin(request);
      await devDeleteUser(request, e2eUserId);
    }
  });
});
