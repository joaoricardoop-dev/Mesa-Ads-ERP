import { trpc } from "@/lib/trpc";
import { Sparkles } from "lucide-react";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepUpsell({ clientLabel, hasPartner }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const venueIds = useWizardStore((s) => s.venueIds);
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
      title="Quer algum adicional?"
      subtitle="Você pode incluir extras junto com sua campanha — opcional."
      onNext={next}
      nextLabel="Pular adicionais"
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
      <div className="rounded-xl border border-dashed border-border/40 p-8 text-center">
        <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="font-semibold mb-1">Sem adicionais por enquanto</div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Se quiser combinar produtos ou contratar serviços extras (vídeo, ativação, etc.), o time
          comercial pode incluir depois na revisão da cotação.
        </p>
      </div>
    </WizardShell>
  );
}
