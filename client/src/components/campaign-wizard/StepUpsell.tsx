import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
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
      eyebrow="05 · adicionais"
      title="Quer algum adicional?"
      subtitle="Você pode incluir extras junto com sua campanha — opcional."
      onNext={next}
      nextLabel="pular adicionais"
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
      <div className="rounded-2xl border border-dashed border-hairline-bold bg-ink-900/40 backdrop-blur-md p-10 text-center">
        <div className="mx-auto size-12 rounded-full bg-mesa-neon/10 border border-mesa-neon/30 flex items-center justify-center mb-4">
          <Sparkles className="w-5 h-5 text-mesa-neon" />
        </div>
        <div className="font-display font-semibold text-[18px] tracking-tight text-chalk mb-1.5">
          Sem adicionais por enquanto
        </div>
        <p className="text-[13px] text-chalk-muted max-w-md mx-auto leading-relaxed">
          Se quiser combinar produtos ou contratar serviços extras (vídeo, ativação, etc.), o time
          comercial pode incluir depois na revisão da cotação.
        </p>
      </div>
    </WizardShell>
  );
}
