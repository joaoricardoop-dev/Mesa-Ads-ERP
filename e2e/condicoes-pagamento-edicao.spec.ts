import { test, expect, type APIRequestContext } from "@playwright/test";
import { devLoginAdmin, trpcQuery, trpcMutation } from "./_finance-helpers";

// Condições de pagamento: coerência + edição (fonte única).
// Prova, contra o banco de teste isolado, que:
//   1. O cronograma da cotação é IDÊNTICO entre a tela interna
//      (billingSchedule.getForQuotation) e a tela pública de assinatura
//      (GET /api/public-signing/quotation/:token) — ambos leem o cronograma
//      persistido VERBATIM (fonte única), sem reconciliação/deslocamento.
//   2. A edição das parcelas em os_gerada persiste e reflete imediatamente na
//      tela pública, preservando as datas EXATAS — inclusive vencimentos
//      anteriores ao início do período (pagamento antecipado é válido).
//   3. Edição com soma divergente do total é rejeitada pelo servidor.

const TOLERANCE_CENTS = 1;

type Parcela = { sequence: number; amount: string; dueDate: string; notes: string | null };

function sumCents(items: Array<{ amount: string }>): number {
  return items.reduce((s, it) => s + Math.round(parseFloat(it.amount) * 100), 0);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedSignable(request: APIRequestContext): Promise<{
  token: string;
  quotationId: number;
  periodStart: string;
  totalValue: string;
}> {
  const res = await request.post("/api/dev-seed-signable-quotation");
  expect(res.ok(), `seed falhou (${res.status()}): ${await res.text()}`).toBeTruthy();
  return res.json();
}

async function fetchPublicSchedule(
  request: APIRequestContext,
  token: string,
): Promise<Parcela[]> {
  const res = await request.get(`/api/public-signing/quotation/${token}`);
  expect(res.ok(), `GET público falhou (${res.status()}): ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return (body.billingSchedule ?? []) as Parcela[];
}

test.describe("condições de pagamento — coerência interna×pública + edição em os_gerada", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("schedule idêntico entre interno e público, e edição em os_gerada reflete na pública", async ({ request }) => {
    const { token, quotationId, periodStart, totalValue } = await seedSignable(request);
    const totalCents = Math.round(parseFloat(totalValue) * 100);

    // ── 1. Público (sem auth): cronograma reconciliado ───────────────────────
    const pub = await fetchPublicSchedule(request, token);
    expect(pub.length).toBeGreaterThan(0);

    // ── 2. Interno (admin): cronograma reconciliado, idêntico ao público ────
    await devLoginAdmin(request);
    const internal = await trpcQuery<Parcela[]>(request, "billingSchedule.getForQuotation", { quotationId });

    const norm = (items: Parcela[]) =>
      [...items]
        .sort((a, b) => a.sequence - b.sequence)
        .map((it) => ({ sequence: it.sequence, dueDate: it.dueDate, amount: parseFloat(it.amount).toFixed(2) }));
    expect(norm(internal)).toEqual(norm(pub));

    // Σ parcelas = total (a soma é invariante; as datas são verbatim).
    expect(Math.abs(sumCents(internal) - totalCents)).toBeLessThanOrEqual(TOLERANCE_CENTS);

    // ── 3. Edita as datas/valores em os_gerada ──────────────────────────────
    // A 1ª parcela vence ANTES do início do período (pagamento antecipado) para
    // provar que datas pré-período são persistidas e exibidas verbatim.
    const novasParcelas: Parcela[] = [
      { sequence: 1, amount: "1200.00", dueDate: addDaysIso(periodStart, -10), notes: null },
      { sequence: 2, amount: "1200.00", dueDate: addDaysIso(periodStart, 30), notes: null },
      { sequence: 3, amount: "2400.00", dueDate: addDaysIso(periodStart, 60), notes: null },
    ];
    await trpcMutation(request, "billingSchedule.setForQuotation", { quotationId, items: novasParcelas });

    // ── 4. Tela pública reflete imediatamente as novas datas ────────────────
    const pubAfter = await fetchPublicSchedule(request, token);
    expect(pubAfter.map((p) => p.dueDate).sort()).toEqual(
      novasParcelas.map((p) => p.dueDate).sort(),
    );
    // A data pré-período foi preservada VERBATIM na tela pública.
    expect(pubAfter.find((p) => p.sequence === 1)?.dueDate).toBe(addDaysIso(periodStart, -10));
    expect(Math.abs(sumCents(pubAfter) - totalCents)).toBeLessThanOrEqual(TOLERANCE_CENTS);

    // Interno também reflete (mesma fonte).
    const internalAfter = await trpcQuery<Parcela[]>(request, "billingSchedule.getForQuotation", { quotationId });
    expect(norm(internalAfter)).toEqual(norm(pubAfter));

    // ── 5. Edição com soma divergente do total é rejeitada ──────────────────
    let rejected = false;
    try {
      await trpcMutation(request, "billingSchedule.setForQuotation", {
        quotationId,
        items: [{ sequence: 1, amount: "1000.00", dueDate: periodStart, notes: null }],
      });
    } catch {
      rejected = true;
    }
    expect(rejected, "soma divergente do total deveria ser rejeitada").toBeTruthy();
  });
});
