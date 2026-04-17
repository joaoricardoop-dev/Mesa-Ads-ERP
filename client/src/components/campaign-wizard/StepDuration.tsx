import { trpc } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { SEMANAS_OPTIONS, DESCONTOS_PRAZO } from "@/lib/campaign-builder-utils";
import { cn } from "@/lib/utils";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepDuration({ clientLabel, hasPartner }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const venueIds = useWizardStore((s) => s.venueIds);
  const weeks = useWizardStore((s) => s.weeks);
  const setWeeks = useWizardStore((s) => s.setWeeks);
  const next = useWizardStore((s) => s.next);

  const { data: product } = trpc.product.get.useQuery(
    { id: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: tiers = [] } = trpc.product.getTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: discountTiers = [] } = trpc.product.listDiscountTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );

  return (
    <WizardShell
      title="Por quanto tempo?"
      subtitle="Campanhas mais longas têm desconto maior por prazo."
      onNext={next}
      summary={
        <OrderSummary
          product={product as ProductLite | null}
          tiers={tiers as PricingTier[]}
          discountTiers={discountTiers as DiscountTier[]}
          hasPartner={hasPartner}
          venueCount={venueIds.length}
          clientLabel={clientLabel}
        />
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SEMANAS_OPTIONS.map((w) => {
          const desc = DESCONTOS_PRAZO[w] ?? 0;
          const active = weeks === w;
          return (
            <button
              key={w}
              type="button"
              onClick={() => setWeeks(w)}
              className={cn(
                "rounded-xl border p-5 text-left transition-all",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-border bg-card/40",
              )}
            >
              <div className="text-3xl font-bold">{w}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">semanas</div>
              {desc > 0 && (
                <div
                  className={cn(
                    "mt-3 inline-block text-[11px] font-semibold px-2 py-0.5 rounded",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  -{desc}% prazo
                </div>
              )}
            </button>
          );
        })}
      </div>
    </WizardShell>
  );
}
