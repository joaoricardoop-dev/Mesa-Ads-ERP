import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { AnimatedNumber } from "./mesa/AnimatedNumber";
import { cn } from "@/lib/utils";
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
      eyebrow="03 · volume"
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
      <div className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-6 sm:p-8 space-y-7">
        <div className="flex items-baseline gap-3">
          <AnimatedNumber
            value={volume}
            className="font-display font-semibold tracking-[-0.04em] text-[56px] leading-none text-chalk tabular-nums"
          />
          <span className="text-[12px] uppercase tracking-[0.18em] text-chalk-dim">
            unidades / total
          </span>
        </div>

        <div className="space-y-2">
          <input
            type="range"
            min={1000}
            max={100000}
            step={500}
            value={Math.min(Math.max(volume, 1000), 100000)}
            onChange={(e) => setVolume(parseInt(e.target.value, 10))}
            className="w-full appearance-none h-1.5 rounded-full bg-chalk/10 accent-mesa-neon cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mesa-neon
              [&::-webkit-slider-thumb]:shadow-neon-sm [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-chalk-dim tabular-nums">
            <span>1.000</span>
            <span>100.000</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {VOLUME_STEPS.map((v, i) => {
            const active = volume === v;
            return (
              <motion.button
                key={v}
                type="button"
                onClick={() => setVolume(v)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "px-4 py-2 rounded-full text-[12px] font-medium tabular-nums transition-all",
                  active
                    ? "bg-mesa-neon text-ink-950 shadow-neon-sm"
                    : "bg-white/5 text-chalk-muted border border-hairline hover:border-mesa-neon/40 hover:text-chalk",
                )}
              >
                {v.toLocaleString("pt-BR")}
              </motion.button>
            );
          })}
        </div>

        <div className="pt-5 border-t border-hairline">
          <label className="block text-[10px] uppercase tracking-[0.22em] text-chalk-dim mb-2">
            ou digite o valor exato
          </label>
          <input
            type="number"
            value={volume}
            min={100}
            step={100}
            onChange={(e) => setVolume(parseInt(e.target.value || "0", 10))}
            className="w-full max-w-xs h-12 rounded-xl bg-ink-950/60 border border-hairline px-4 text-[18px] font-mono tabular-nums text-chalk outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition"
          />
        </div>
      </div>
    </WizardShell>
  );
}
