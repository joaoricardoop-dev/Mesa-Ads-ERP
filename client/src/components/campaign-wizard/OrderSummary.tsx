import { useWizardStore } from "./wizardStore";
import { fmtBRL } from "@/lib/campaign-builder-utils";
import { quotePrice, ProductLite, PricingTier, DiscountTier } from "./pricing";

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
      <div className="text-sm text-muted-foreground">
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

  return (
    <div className="space-y-3 text-sm">
      {clientLabel && (
        <Row label="Cliente" value={clientLabel} />
      )}
      <Row label="Produto" value={product.name} />
      <Row label="Locais" value={venueCount > 0 ? `${venueCount}` : "—"} />
      <Row label="Volume" value={`${volume.toLocaleString("pt-BR")} un.`} />
      <Row label="Duração" value={`${weeks} semanas`} />

      <div className="my-3 border-t border-border/40" />

      <Row label="Subtotal" value={fmtBRL(quote.baseTotal)} muted />
      {quote.volumeDiscountPct > 0 && (
        <Row
          label={`Desconto volume (${quote.volumeDiscountPct.toFixed(0)}%)`}
          value={`- ${fmtBRL(quote.baseTotal * (quote.volumeDiscountPct / 100))}`}
          muted
        />
      )}
      {quote.prazoDiscountPct > 0 && (
        <Row
          label={`Desconto prazo (${quote.prazoDiscountPct.toFixed(0)}%)`}
          value={`- ${fmtBRL((quote.baseTotal - quote.baseTotal * (quote.volumeDiscountPct / 100)) * (quote.prazoDiscountPct / 100))}`}
          muted
        />
      )}

      <div className="my-3 border-t border-border/40" />

      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Total</span>
        <span className="text-2xl font-bold text-primary">{fmtBRL(quote.totalPrice)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground text-right">
        Equivalente a {fmtBRL(quote.unitPrice)} / unidade
      </div>
      <div className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
        Esta é uma estimativa. O time comercial revisa e envia a cotação final.
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? "text-xs text-muted-foreground" : "text-xs uppercase tracking-wide text-muted-foreground"}>{label}</span>
      <span className={muted ? "text-sm text-muted-foreground tabular-nums" : "text-sm font-medium tabular-nums"}>{value}</span>
    </div>
  );
}
