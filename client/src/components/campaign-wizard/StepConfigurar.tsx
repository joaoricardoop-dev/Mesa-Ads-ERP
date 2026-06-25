import { useEffect, useMemo } from "react";
import { Calendar, Sparkles, Tv, Layers } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSystemPremissas } from "@/hooks/useSystemPremissas";
import { useWizardStore, type CartItem } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { CartSummary } from "./CartSummary";
import { quotePrice, type ProductLite, type PricingTier, type DiscountTier } from "./pricing";
import {
  daysInRangeInclusive,
  cyclesForDays,
  weeksForCycles,
  CYCLE_WEEKS,
  SCREEN_MIN_DAYS,
} from "@shared/period";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDateBR(iso: string): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function StepConfigurar({ clientLabel, hasPartner }: Props) {
  const cart = useWizardStore((s) => s.cart);
  const updateCartItem = useWizardStore((s) => s.updateCartItem);
  const startDate = useWizardStore((s) => s.startDate);
  const endDate = useWizardStore((s) => s.endDate);
  const setDates = useWizardStore((s) => s.setDates);
  const next = useWizardStore((s) => s.next);

  const days = daysInRangeInclusive(startDate, endDate);
  const cycles = cyclesForDays(days);
  const validRange = days > 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <WizardShell
      eyebrow="03 · configurar"
      title="Período × shares × preço"
      subtitle="Escolha as datas livremente. Telas são cobradas por diária (mín. 1 semana); produtos físicos arredondam para ciclos cheios de 4 semanas."
      onNext={next}
      nextDisabled={cart.length === 0 || !validRange}
      summary={<CartSummary clientLabel={clientLabel} />}
    >
      {/* ── Seletor de período por calendário (datas livres) ── */}
      <div className="mb-5 rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-mesa-neon mb-3">
          <Calendar className="w-3.5 h-3.5" /> Período da campanha
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="início">
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => {
                const start = e.target.value;
                const end = endDate && end_gte(start, endDate) ? endDate : start;
                setDates(start, end);
              }}
              className="w-full h-10 rounded-lg bg-ink-950/60 border border-hairline px-3 text-chalk text-[14px] outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 [color-scheme:dark]"
              data-testid="config-start-date"
            />
          </Field>
          <Field label="fim">
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setDates(startDate, e.target.value)}
              className="w-full h-10 rounded-lg bg-ink-950/60 border border-hairline px-3 text-chalk text-[14px] outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 [color-scheme:dark]"
              data-testid="config-end-date"
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-chalk-muted">
          {validRange ? (
            <>
              <span className="text-chalk">
                {fmtDateBR(startDate)} – {fmtDateBR(endDate)}
              </span>
              <span>· {days} dia{days === 1 ? "" : "s"}</span>
              <span>
                · estoque: {cycles} ciclo{cycles === 1 ? "" : "s"} de {CYCLE_WEEKS} sem
              </span>
            </>
          ) : (
            <span className="text-mesa-amber">Selecione um período válido (fim ≥ início).</span>
          )}
        </div>
      </div>

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
              endDate={endDate}
              days={days}
              cycles={cycles}
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

function end_gte(start: string, end: string): boolean {
  return daysInRangeInclusive(start, end) > 0;
}

function ConfigRow({
  item,
  startDate,
  endDate,
  days,
  cycles,
  hasPartner,
  onChange,
}: {
  item: CartItem;
  startDate: string;
  endDate: string;
  days: number;
  cycles: number;
  hasPartner: boolean;
  onChange: (patch: Partial<CartItem>) => void;
}) {
  const { data: product } = trpc.product.get.useQuery({ id: item.productId });
  const { data: tiers = [] } = trpc.product.getTiers.useQuery({ productId: item.productId });
  const { data: discountTiers = [] } = trpc.product.listDiscountTiers.useQuery({
    productId: item.productId,
  });
  const { premissas: sysPremissas, bvAgencia } = useSystemPremissas();

  const productLite: ProductLite | null = product
    ? {
        id: product.id,
        name: product.name,
        pricingMode: product.pricingMode ?? null,
        tipo: (product as any).tipo ?? item.productTipo ?? null,
      }
    : null;

  const isScreen = productLite?.tipo === "telas";
  const cpmConfig = item.screenCpm
    ? {
        cpm: item.screenCpm.cpm ?? undefined,
        insertionsPerHour: item.screenCpm.insertionsPerHour ?? undefined,
        impactsPerInsertion: item.screenCpm.impactsPerInsertion ?? undefined,
        weeklyHours: item.screenCpm.weeklyHours ?? undefined,
      }
    : null;

  // Produtos físicos por ciclo: período arredondado para ciclos cheios (4 sem).
  const physicalWeeks = weeksForCycles(cycles);

  const estimated = useMemo(() => {
    if (!productLite) return null;
    // Telas precificam por diária (CPM÷7); demais produtos exigem tiers.
    if (!isScreen && tiers.length === 0) return null;
    return quotePrice({
      product: productLite,
      tiers: tiers as PricingTier[],
      discountTiers: discountTiers as DiscountTier[],
      volume: item.volume,
      weeks: physicalWeeks,
      days,
      hasPartner,
      premissas: { ...sysPremissas, bvAgencia },
      cpmConfig,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productLite, isScreen, tiers, discountTiers, item.volume, physicalWeeks, days, hasPartner, item.screenCpm, sysPremissas, bvAgencia]);

  // Mantém o store coerente: ciclos/dias derivados das datas (fonte única:
  // shared/period.ts) + a estimativa de preço.
  useEffect(() => {
    if (!estimated) return;
    const patch: Partial<CartItem> = {};
    if (item.cycles !== cycles) patch.cycles = cycles;
    if (item.days !== days) patch.days = days;
    if (item.estimatedUnitPrice !== estimated.unitPrice) patch.estimatedUnitPrice = estimated.unitPrice;
    if (item.estimatedTotal !== estimated.totalPrice) patch.estimatedTotal = estimated.totalPrice;
    if (Object.keys(patch).length > 0) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimated?.unitPrice, estimated?.totalPrice, cycles, days]);

  const seasonalAlert = checkSeasonalWindow(startDate, endDate);

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
            {estimated ? BRL(estimated.totalPrice) : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <Field label={isScreen ? "telas (shares)" : `volume por ciclo (${CYCLE_WEEKS}sem)`}>
          <input
            type="number"
            min={isScreen ? 1 : 100}
            step={isScreen ? 1 : 100}
            value={item.volume}
            onChange={(e) =>
              onChange({
                volume: Math.max(isScreen ? 1 : 100, parseInt(e.target.value || "0", 10)),
              })
            }
            className="w-full h-10 rounded-lg bg-ink-950/60 border border-hairline px-3 text-chalk text-[14px] tabular-nums outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20"
            data-testid={`volume-${item.restaurantId}-${item.productId}-${item.shareIndex}`}
          />
        </Field>

        {/* Detalhe da regra de período/preço por tipo de produto */}
        <Field label="como é cobrado">
          {isScreen ? (
            <div className="h-10 rounded-lg border border-hairline bg-ink-950/40 px-3 flex items-center gap-2 text-[12px] text-chalk tabular-nums">
              <Tv className="w-3.5 h-3.5 text-mesa-neon shrink-0" />
              {estimated && estimated.dailyRate != null && estimated.billedDays != null ? (
                <span>
                  {BRL(estimated.dailyRate)}/dia × {estimated.billedDays} dia
                  {estimated.billedDays === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-chalk-dim">CPM não configurado</span>
              )}
            </div>
          ) : (
            <div className="h-10 rounded-lg border border-hairline bg-ink-950/40 px-3 flex items-center gap-2 text-[12px] text-chalk tabular-nums">
              <Layers className="w-3.5 h-3.5 text-mesa-neon shrink-0" />
              <span>
                {cycles} ciclo{cycles === 1 ? "" : "s"} · {physicalWeeks} sem
                {estimated && estimated.prazoDiscountPct > 0 ? ` · −${estimated.prazoDiscountPct}%` : ""}
              </span>
            </div>
          )}
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-chalk-muted">
        <Calendar className="w-3.5 h-3.5" />
        {isScreen ? (
          <span>
            Tela cobrada por diária — mínimo de {SCREEN_MIN_DAYS} dias (1 semana). Estoque reservado
            por ciclo de {CYCLE_WEEKS} semanas.
          </span>
        ) : (
          <span>
            Período arredondado para {cycles} ciclo{cycles === 1 ? "" : "s"} cheio
            {cycles === 1 ? "" : "s"} de {CYCLE_WEEKS} semanas · {(item.volume * cycles).toLocaleString("pt-BR")} unidades
          </span>
        )}
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

// Heurística: detecta se a janela [start, end] inclui datas sazonais conhecidas.
// Avisa o usuário antes do checkout — o preço final é confirmado pelo backend.
function checkSeasonalWindow(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
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
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return null;
}
