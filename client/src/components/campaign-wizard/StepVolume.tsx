import { trpc } from "@/lib/trpc";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

const VOLUME_STEPS = [1000, 2500, 5000, 10000, 20000, 50000, 100000];

export function StepVolume({ clientLabel, hasPartner }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const venueIds = useWizardStore((s) => s.venueIds);
  const volume = useWizardStore((s) => s.volume);
  const setVolume = useWizardStore((s) => s.setVolume);
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
      title="Qual o volume da campanha?"
      subtitle="Quantas unidades você quer veicular ao todo (somando todos os locais)."
      onNext={next}
      nextDisabled={volume < 100}
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
      <div className="rounded-xl border border-border/40 bg-card/40 p-6 sm:p-8 space-y-6">
        <div className="flex items-baseline gap-3">
          <Input
            type="number"
            value={volume}
            min={100}
            step={100}
            onChange={(e) => setVolume(parseInt(e.target.value || "0", 10))}
            className="text-3xl font-bold h-14 max-w-xs"
          />
          <span className="text-sm text-muted-foreground">unidades no total</span>
        </div>

        <Slider
          value={[volume]}
          min={1000}
          max={100000}
          step={500}
          onValueChange={(v) => setVolume(v[0])}
        />

        <div className="flex flex-wrap gap-2">
          {VOLUME_STEPS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVolume(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                volume === v
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground hover:bg-muted/70 border border-transparent"
              }`}
            >
              {v.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>
      </div>
    </WizardShell>
  );
}
