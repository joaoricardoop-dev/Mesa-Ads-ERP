import { useWizardStore } from "./wizardStore";
import { fmtBRL } from "@/lib/campaign-builder-utils";
import { quotePrice, ProductLite, PricingTier, DiscountTier } from "./pricing";
import { AnimatedNumber } from "./mesa/AnimatedNumber";
import { MesaChip } from "./mesa/MesaUI";
import { cn } from "@/lib/utils";

interface Props {
  product: ProductLite | null;
  tiers: PricingTier[];
  discountTiers: DiscountTier[];
  hasPartner: boolean;
  venueCount: number;
  clientLabel?: string | null;
}

export function OrderSummary({
  product,
  tiers,
  discountTiers,
  hasPartner,
  venueCount,
  clientLabel,
}: Props) {
  const volume = useWizardStore((s) => s.volume);
  const weeks = useWizardStore((s) => s.weeks);

  if (!product) {
    return (
      <div className="text-[12px] text-chalk-muted leading-relaxed">
        Selecione um produto para ver o resumo de preço.
      </div>
    );
  }

  const productTiers = tiers.filter((t) => t.productId === product.id);
  const quote = quotePrice({
    product,
    tiers: productTiers,
    discountTiers,
    volume,
    weeks,
    hasPartner,
  });

  const cycles = Math.max(1, Math.round(weeks / 4));
  const volumeDiscountAmt = quote.baseTotal * (quote.volumeDiscountPct / 100);
  const prazoDiscountAmt =
    (quote.baseTotal - volumeDiscountAmt) * (quote.prazoDiscountPct / 100);

  return (
    <div className="space-y-6 text-[13px]">
      <Block label="Produto">
        <div className="font-display text-[18px] tracking-tight text-chalk leading-tight">
          {product.name}
        </div>
        {clientLabel && (
          <div className="mt-0.5 text-[11px] text-chalk-dim truncate">{clientLabel}</div>
        )}
      </Block>

      <Block label="Locais" count={venueCount}>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] tabular-nums text-chalk">
            {venueCount > 0 ? venueCount : "—"}
          </span>
          <span className="text-[11px] text-chalk-dim">selecionados</span>
        </div>
      </Block>

      <Block label="Volume / ciclo">
        <div className="flex items-baseline gap-2">
          <AnimatedNumber
            value={volume}
            className="font-mono text-[22px] tabular-nums text-chalk"
          />
          <span className="text-[11px] text-chalk-dim">unidades</span>
        </div>
      </Block>

      <Block label="Duração">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] tabular-nums text-chalk">{weeks}</span>
          <span className="text-[11px] text-chalk-dim">
            semanas · {cycles} ciclo(s)
          </span>
        </div>
      </Block>

      <div className="pt-4 border-t border-hairline space-y-3">
        <Row label="Subtotal" value={fmtBRL(quote.baseTotal)} muted />
        {quote.volumeDiscountPct > 0 && (
          <Row
            label={`desconto volume (${quote.volumeDiscountPct.toFixed(0)}%)`}
            value={`- ${fmtBRL(volumeDiscountAmt)}`}
            accent
          />
        )}
        {quote.prazoDiscountPct > 0 && (
          <Row
            label={`desconto prazo (${quote.prazoDiscountPct.toFixed(0)}%)`}
            value={`- ${fmtBRL(prazoDiscountAmt)}`}
            accent
          />
        )}
      </div>

      <div className="pt-4 border-t border-hairline">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-chalk-dim">
              total
            </div>
            <AnimatedNumber
              value={quote.totalPrice}
              format={(v) => fmtBRL(v)}
              className="block font-mono text-[28px] tabular-nums text-chalk mt-1"
            />
          </div>
          <MesaChip tone="ice" size="xs">
            estimativa
          </MesaChip>
        </div>
        <div className="mt-2 text-[11px] text-chalk-dim">
          equivalente a {fmtBRL(quote.unitPrice)} / unidade
        </div>
        <p className="mt-3 text-[11px] text-chalk-dim leading-relaxed">
          O time comercial revisa e envia a cotação final.
        </p>
      </div>
    </div>
  );
}

function Block({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-[0.22em] uppercase text-chalk-dim">
          {label}
        </div>
        {count !== undefined && (
          <span className="text-[11px] font-mono tabular-nums text-chalk-muted">
            {count}
          </span>
        )}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] tracking-wide text-chalk-dim">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums text-[13px]",
          muted && "text-chalk-muted",
          accent && "text-mesa-neon",
          !muted && !accent && "text-chalk",
        )}
      >
        {value}
      </span>
    </div>
  );
}
