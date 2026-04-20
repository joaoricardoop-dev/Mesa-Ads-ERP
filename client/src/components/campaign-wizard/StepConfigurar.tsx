import { useEffect, useMemo } from "react";
import { Calendar, AlertTriangle, Sparkles } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore, type CartItem } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { CartSummary } from "./CartSummary";
import { quotePrice, type ProductLite, type PricingTier, type DiscountTier } from "./pricing";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

const CYCLE_DISCOUNTS: Record<number, number> = { 1: 0, 2: 3, 3: 5, 4: 7, 5: 9, 6: 11 };

export function StepConfigurar({ clientLabel, hasPartner }: Props) {
  const cart = useWizardStore((s) => s.cart);
  const updateCartItem = useWizardStore((s) => s.updateCartItem);
  const startDate = useWizardStore((s) => s.startDate);
  const next = useWizardStore((s) => s.next);

  // Pricing data por productId em batch — buscamos todos de uma vez.
  const productIds = useMemo(
    () => Array.from(new Set(cart.map((c) => c.productId))),
    [cart],
  );

  return (
    <WizardShell
      eyebrow="03 · configurar"
      title="Shares × ciclos × preço"
      subtitle="Cada ciclo tem 4 semanas. Quanto mais ciclos, maior o desconto por prazo. Avisamos se houver multiplicador sazonal aplicado no período."
      onNext={next}
      nextDisabled={cart.length === 0}
      summary={<CartSummary clientLabel={clientLabel} />}
    >
      {cart.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline p-10 text-center text-sm text-chalk-muted">
          Carrinho vazio. Volte e adicione produtos.
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((item) => (
            <ConfigRow
              key={`${item.restaurantId}-${item.productId}-${item.shareIndex}`}
              item={item}
              startDate={startDate}
              hasPartner={hasPartner}
              onChange={(patch) =>
                updateCartItem(item.restaurantId, item.productId, item.shareIndex, patch)
              }
            />
          ))}
        </div>
      )}
    </WizardShell>
  );
}

function ConfigRow({
  item,
  startDate,
  hasPartner,
  onChange,
}: {
  item: CartItem;
  startDate: string;
  hasPartner: boolean;
  onChange: (patch: Partial<CartItem>) => void;
}) {
  const { data: product } = trpc.product.get.useQuery({ id: item.productId });
  const { data: tiers = [] } = trpc.product.getTiers.useQuery({ productId: item.productId });
  const { data: discountTiers = [] } = trpc.product.listDiscountTiers.useQuery({
    productId: item.productId,
  });

  const productLite: ProductLite | null = product
    ? {
        id: product.id,
        name: product.name,
        irpj: product.irpj ?? null,
        comRestaurante: product.comRestaurante ?? null,
        comComercial: product.comComercial ?? null,
        pricingMode: product.pricingMode ?? null,
      }
    : null;

  // Total weeks = cycles × cycleWeeks. Usamos o desconto por prazo já existente
  // mapeado pelo número de semanas aproximadas (4w → ciclo).
  const totalWeeks = item.cycles * item.cycleWeeks;

  const estimated = useMemo(() => {
    if (!productLite || tiers.length === 0) return null;
    return quotePrice({
      product: productLite,
      tiers: tiers as PricingTier[],
      discountTiers: discountTiers as DiscountTier[],
      volume: item.volume,
      weeks: totalWeeks,
      hasPartner,
    });
  }, [productLite, tiers, discountTiers, item.volume, totalWeeks, hasPartner]);

  // Atualiza estimativa no store sempre que muda.
  useEffect(() => {
    if (!estimated) return;
    if (
      item.estimatedUnitPrice === estimated.unitPrice &&
      item.estimatedTotal === estimated.totalPrice
    ) {
      return;
    }
    onChange({
      estimatedUnitPrice: estimated.unitPrice,
      estimatedTotal: estimated.totalPrice,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimated?.unitPrice, estimated?.totalPrice]);

  const discount = CYCLE_DISCOUNTS[Math.min(item.cycles, 6)] ?? 0;
  const seasonalAlert = checkSeasonalWindow(startDate, item.cycles, item.cycleWeeks);

  return (
    <div
      className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-5"
      data-testid={`configure-row-${item.restaurantId}-${item.productId}-${item.shareIndex}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-mesa-neon mb-0.5">
            {item.restaurantName}
          </div>
          <div className="font-display font-semibold text-chalk text-[16px]">
            {item.productName} <span className="text-chalk-dim">· share {item.shareIndex}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-chalk-dim">estimativa</div>
          <div className="font-display font-semibold text-mesa-neon tabular-nums">
            {estimated
              ? estimated.totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        <Field label={`volume por ciclo (${item.cycleWeeks}sem)`}>
          <input
            type="number"
            min={100}
            step={100}
            value={item.volume}
            onChange={(e) => onChange({ volume: Math.max(100, parseInt(e.target.value || "0", 10)) })}
            className="w-full h-10 rounded-lg bg-ink-950/60 border border-hairline px-3 text-chalk text-[14px] tabular-nums outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20"
            data-testid={`volume-${item.restaurantId}-${item.productId}-${item.shareIndex}`}
          />
        </Field>
        <Field label="ciclos (4sem cada)">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ cycles: Math.max(1, item.cycles - 1) })}
              className="size-10 rounded-lg border border-hairline-bold text-chalk hover:border-mesa-neon/40"
            >
              −
            </button>
            <div className="flex-1 text-center font-display font-semibold text-chalk tabular-nums text-lg">
              {item.cycles}
            </div>
            <button
              type="button"
              onClick={() => onChange({ cycles: Math.min(12, item.cycles + 1) })}
              className="size-10 rounded-lg border border-hairline-bold text-chalk hover:border-mesa-neon/40"
              data-testid={`cycles-inc-${item.restaurantId}-${item.productId}-${item.shareIndex}`}
            >
              +
            </button>
          </div>
        </Field>
        <Field label="desconto por prazo">
          <div className="h-10 rounded-lg border border-hairline bg-ink-950/40 px-3 flex items-center text-mesa-neon font-display font-semibold tabular-nums">
            {discount > 0 ? `−${discount}%` : "—"}
          </div>
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-chalk-muted">
        <Calendar className="w-3.5 h-3.5" />
        <span>
          Total: {totalWeeks} semanas · {(item.volume * item.cycles).toLocaleString("pt-BR")} unidades
        </span>
      </div>

      {seasonalAlert && (
        <div className="mt-3 rounded-xl border border-mesa-amber/40 bg-mesa-amber/10 p-3 flex items-start gap-2 text-[12px] text-mesa-amber">
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Atenção: o período inclui {seasonalAlert} — pode haver multiplicador sazonal. O preço
            final será confirmado pelo time comercial.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.18em] text-chalk-dim mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// Heurística: detecta se a janela inclui datas sazonais conhecidas. Avisa o
// usuário antes do checkout — o preço final é confirmado pelo backend.
function checkSeasonalWindow(startDate: string, cycles: number, cycleWeeks: number): string | null {
  if (!startDate) return null;
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + cycles * cycleWeeks * 7);
  const seasons: Array<{ label: string; from: { m: number; d: number }; to: { m: number; d: number } }> = [
    { label: "Carnaval", from: { m: 2, d: 1 }, to: { m: 2, d: 28 } },
    { label: "Festas Juninas", from: { m: 6, d: 1 }, to: { m: 6, d: 30 } },
    { label: "Black Friday", from: { m: 11, d: 20 }, to: { m: 11, d: 30 } },
    { label: "Festas de fim de ano", from: { m: 12, d: 15 }, to: { m: 12, d: 31 } },
  ];
  for (const s of seasons) {
    const cur = new Date(start);
    while (cur <= end) {
      const m = cur.getUTCMonth() + 1;
      const d = cur.getUTCDate();
      const after = m > s.from.m || (m === s.from.m && d >= s.from.d);
      const before = m < s.to.m || (m === s.to.m && d <= s.to.d);
      if (after && before) return s.label;
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  }
  return null;
}
