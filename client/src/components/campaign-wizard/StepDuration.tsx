import { motion } from "framer-motion";
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
      eyebrow="04 · duração"
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
        {SEMANAS_OPTIONS.map((w, i) => {
          const desc = DESCONTOS_PRAZO[w] ?? 0;
          const active = weeks === w;
          const cycles = Math.max(1, Math.round(w / 4));
          return (
            <motion.button
              key={w}
              type="button"
              onClick={() => setWeeks(w)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "rounded-2xl border p-5 text-left transition-all backdrop-blur-md",
                active
                  ? "border-mesa-neon bg-mesa-neon/10 shadow-neon-sm"
                  : "border-hairline bg-ink-900/50 hover:border-mesa-neon/40",
              )}
            >
              <div className="font-display font-semibold text-[40px] leading-none tabular-nums text-chalk">
                {w}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-chalk-dim">
                semanas · {cycles} ciclo(s)
              </div>
              {desc > 0 && (
                <div
                  className={cn(
                    "mt-4 inline-flex items-center text-[10px] tracking-[0.18em] uppercase font-semibold px-2 py-0.5 rounded-full border",
                    active
                      ? "bg-mesa-neon text-ink-950 border-mesa-neon"
                      : "bg-mesa-neon/10 text-mesa-neon border-mesa-neon/30",
                  )}
                >
                  -{desc}% prazo
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </WizardShell>
  );
}
