import { useMemo, useState } from "react";
import { Loader2, MapPin, Search, Check } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";

type Restaurant = RouterOutputs["activeRestaurant"]["list"][number];
import { Input } from "@/components/ui/input";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { cn } from "@/lib/utils";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

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

  return (
    <WizardShell
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
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou bairro..."
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            venueIds.length === filtered.length
              ? setVenues([])
              : setVenues(filtered.map((r) => r.id))
          }
          className="text-xs font-medium text-primary hover:underline"
        >
          {venueIds.length === filtered.length && filtered.length > 0
            ? "Desmarcar todos"
            : "Selecionar todos"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando locais...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          Nenhum local encontrado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => {
            const active = venueIds.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleVenue(r.id)}
                className={cn(
                  "text-left rounded-xl border p-4 transition-all relative",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-border bg-card/40",
                )}
              >
                {active && (
                  <div className="absolute top-2 right-2 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <div className="font-medium truncate">{r.name}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.neighborhood || r.address}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">
                  {r.tableCount ? `${r.tableCount} mesas` : null}
                  {r.monthlyCustomers
                    ? ` · ${Number(r.monthlyCustomers).toLocaleString("pt-BR")} clientes/mês`
                    : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </WizardShell>
  );
}
