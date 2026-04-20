import { useMemo, useState } from "react";
import { Loader2, MapPin, Search, Check, List, Map as MapIcon, Star } from "lucide-react";
import { motion } from "framer-motion";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { CartSummary } from "./CartSummary";
import { ShareAvailabilityBadge } from "./ShareAvailabilityBadge";
import { cn } from "@/lib/utils";

type Local = RouterOutputs["anunciantePortal"]["listAvailableLocations"][number];

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepLocais({ clientLabel }: Props) {
  const locaisIds = useWizardStore((s) => s.locaisIds);
  const toggleLocal = useWizardStore((s) => s.toggleLocal);
  const setLocais = useWizardStore((s) => s.setLocais);
  const startDate = useWizardStore((s) => s.startDate);
  const endDate = useWizardStore((s) => s.endDate);
  const setDates = useWizardStore((s) => s.setDates);
  const next = useWizardStore((s) => s.next);

  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [neighborhood, setNeighborhood] = useState<string>("");

  const { data: locais = [], isLoading } = trpc.anunciantePortal.listAvailableLocations.useQuery({
    startDate,
    endDate,
    neighborhood: neighborhood || undefined,
  });

  const neighborhoods = useMemo(() => {
    const set = new Set<string>();
    for (const l of locais) if (l.neighborhood) set.add(l.neighborhood);
    return Array.from(set).sort();
  }, [locais]);

  const filtered = useMemo<Local[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locais;
    return locais.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(q) ||
        (r.neighborhood ?? "").toLowerCase().includes(q),
    );
  }, [locais, query]);

  const allSelected = filtered.length > 0 && filtered.every((r) => locaisIds.includes(r.restaurantId));

  return (
    <WizardShell
      eyebrow="01 · locais"
      title="Onde sua marca vai aparecer?"
      subtitle="Escolha um ou mais locais. Você pode filtrar por bairro, ver no mapa e conferir quantos shares estão disponíveis no período."
      onNext={next}
      nextDisabled={locaisIds.length === 0}
      summary={<CartSummary clientLabel={clientLabel} />}
    >
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chalk-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar por nome ou bairro…"
            className="w-full h-11 rounded-full bg-ink-900/70 border border-hairline pl-9 pr-4 text-[13px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition"
          />
        </div>
        <select
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          className="h-11 rounded-full bg-ink-900/70 border border-hairline px-4 text-[13px] text-chalk outline-none focus:border-mesa-neon/60 transition"
          data-testid="filter-neighborhood"
        >
          <option value="">todos os bairros</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-chalk-dim">
          <span>período</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setDates(e.target.value, endDate)}
            className="h-11 rounded-full bg-ink-900/70 border border-hairline px-3 text-[12px] text-chalk [color-scheme:dark]"
            data-testid="filter-start"
          />
          <span>→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setDates(startDate, e.target.value)}
            className="h-11 rounded-full bg-ink-900/70 border border-hairline px-3 text-[12px] text-chalk [color-scheme:dark]"
            data-testid="filter-end"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "h-9 px-3 rounded-full text-[11px] uppercase tracking-[0.14em] flex items-center gap-1 transition",
              view === "list"
                ? "bg-mesa-neon text-ink-950 border border-mesa-neon"
                : "border border-hairline text-chalk-muted hover:border-mesa-neon/40",
            )}
            data-testid="toggle-list"
          >
            <List className="w-3.5 h-3.5" /> lista
          </button>
          <button
            type="button"
            onClick={() => setView("map")}
            className={cn(
              "h-9 px-3 rounded-full text-[11px] uppercase tracking-[0.14em] flex items-center gap-1 transition",
              view === "map"
                ? "bg-mesa-neon text-ink-950 border border-mesa-neon"
                : "border border-hairline text-chalk-muted hover:border-mesa-neon/40",
            )}
            data-testid="toggle-map"
          >
            <MapIcon className="w-3.5 h-3.5" /> mapa
          </button>
          <button
            type="button"
            onClick={() =>
              allSelected ? setLocais([]) : setLocais(filtered.map((r) => r.restaurantId))
            }
            className="text-[11px] uppercase tracking-[0.18em] font-semibold text-mesa-neon hover:brightness-110 transition"
          >
            {allSelected ? "limpar" : "selecionar todos"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-chalk-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando locais…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline p-10 text-center text-sm text-chalk-muted">
          Nenhum local encontrado neste período/bairro.
        </div>
      ) : view === "map" ? (
        <SimpleMapPlaceholder count={filtered.length} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r, i) => {
            const active = locaisIds.includes(r.restaurantId);
            const totalShares = r.productSlots.reduce((s, p) => s + p.maxShares, 0);
            const availableShares = r.totalAvailableShares;
            const products = r.productSlots.length;
            return (
              <motion.button
                key={r.restaurantId}
                type="button"
                onClick={() => toggleLocal(r.restaurantId)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 12) * 0.025 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                data-testid={`local-card-${r.restaurantId}`}
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
                  {r.neighborhood || r.city}
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-chalk-muted tabular-nums flex-wrap">
                  {r.monthlyCustomers && (
                    <span>{Number(r.monthlyCustomers).toLocaleString("pt-BR")} clientes/mês</span>
                  )}
                  {r.rating?.score != null && (
                    <span className="inline-flex items-center gap-1">
                      <Star className="w-3 h-3 text-mesa-amber" /> {r.rating.score.toFixed(1)}
                    </span>
                  )}
                  <span>{products} produto{products === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3">
                  <ShareAvailabilityBadge available={availableShares} total={totalShares} />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </WizardShell>
  );
}

function SimpleMapPlaceholder({ count }: { count: number }) {
  // Mapa simples (sem leaflet/google) — placeholder funcional. O componente
  // RestaurantsMap.tsx existente pode ser plugado aqui em iteração posterior.
  return (
    <div className="rounded-2xl border border-hairline bg-ink-900/40 h-[420px] grid place-items-center text-chalk-muted text-sm">
      <div className="text-center">
        <MapIcon className="w-8 h-8 mx-auto mb-3 text-mesa-neon" />
        <div className="text-chalk font-medium mb-1">{count} locais no período</div>
        <div className="text-xs">Visualização de mapa em desenvolvimento — use a lista para selecionar.</div>
      </div>
    </div>
  );
}
