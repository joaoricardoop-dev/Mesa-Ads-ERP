import { useMemo, useState } from "react";
import { Loader2, MapPin, Search, Check } from "lucide-react";
import { motion } from "framer-motion";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { cn } from "@/lib/utils";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

type Restaurant = RouterOutputs["activeRestaurant"]["list"][number];

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepVenues({ clientLabel, hasPartner }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const venueIds = useWizardStore((s) => s.venueIds);
  const toggleVenue = useWizardStore((s) => s.toggleVenue);
  const setVenues = useWizardStore((s) => s.setVenues);
  const next = useWizardStore((s) => s.next);
  const [query, setQuery] = useState("");

  const { data: restaurants = [], isLoading } = trpc.activeRestaurant.list.useQuery();

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

  const filtered = useMemo<Restaurant[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.neighborhood ?? "").toLowerCase().includes(q),
    );
  }, [restaurants, query]);

  const allSelected = venueIds.length === filtered.length && filtered.length > 0;

  return (
    <WizardShell
      eyebrow="02 · locais"
      title="Onde a campanha vai rodar?"
      subtitle="Escolha um ou mais locais parceiros. Você pode rever depois com o time comercial."
      onNext={next}
      nextDisabled={venueIds.length === 0}
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
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chalk-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar por nome ou bairro…"
            className="w-full h-11 rounded-full bg-ink-900/70 border border-hairline pl-9 pr-4 text-[13px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition"
          />
        </div>
        <button
          type="button"
          onClick={() => (allSelected ? setVenues([]) : setVenues(filtered.map((r) => r.id)))}
          className="text-[11px] uppercase tracking-[0.18em] font-semibold text-mesa-neon hover:brightness-110 transition"
        >
          {allSelected ? "limpar" : "selecionar todos"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-chalk-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando locais…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline p-10 text-center text-sm text-chalk-muted">
          Nenhum local encontrado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r, i) => {
            const active = venueIds.includes(r.id);
            return (
              <motion.button
                key={r.id}
                type="button"
                onClick={() => toggleVenue(r.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 12) * 0.025 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                className={cn(
                  "text-left rounded-2xl border p-4 transition-all relative backdrop-blur-md",
                  active
                    ? "border-mesa-neon bg-mesa-neon/10 shadow-neon-sm"
                    : "border-hairline bg-ink-900/50 hover:border-mesa-neon/40",
                )}
              >
                <span
                  className={cn(
                    "absolute top-3 right-3 size-5 rounded-full border flex items-center justify-center transition-all",
                    active
                      ? "bg-mesa-neon border-mesa-neon text-ink-950"
                      : "border-hairline-bold bg-ink-800",
                  )}
                  aria-hidden
                >
                  {active && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-mesa-neon shrink-0" />
                  <div className="font-display font-semibold text-[15px] text-chalk truncate">
                    {r.name}
                  </div>
                </div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim truncate">
                  {r.neighborhood || r.address}
                </div>
                <div className="mt-3 text-[11px] text-chalk-muted tabular-nums">
                  {r.tableCount ? `${r.tableCount} mesas` : null}
                  {r.monthlyCustomers
                    ? ` · ${Number(r.monthlyCustomers).toLocaleString("pt-BR")} clientes/mês`
                    : null}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </WizardShell>
  );
}
