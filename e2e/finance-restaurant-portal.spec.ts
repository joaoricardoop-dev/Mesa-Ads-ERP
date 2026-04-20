import { test, expect } from "@playwright/test";
import {
  devLoginAdmin,
  devLoginAs,
  devEnsureRestaurante,
  devDeleteUser,
  trpcQuery,
  trpcMutation,
  FixtureMissingError,
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

    let ensured: { user: { id: string }; restaurantId: number };
    try {
      ensured = await devEnsureRestaurante(request);
    } catch (e) {
      if (e instanceof FixtureMissingError) {
        test.skip(true, e.message);
        return;
      }
      throw e;
    }
    const e2eUserId = ensured.user.id;

    try {
      const payments = await trpcQuery<RestaurantPayment[]>(
        request,
        "financial.listPayments",
        { restaurantId: ensured.restaurantId, status: "pending" },
      );
      if (!payments || payments.length === 0) {
        test.skip(true, `Restaurante ${ensured.restaurantId} sem pagamentos pendentes`);
        return;
      }

      const target = payments[0];
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
