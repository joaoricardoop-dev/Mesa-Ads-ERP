import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Store,
  Star,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Divide,
  AlertTriangle,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import type {
  RestaurantForAllocation,
  AllocationEntry,
} from "@/hooks/useRestaurantAllocation";

interface RestaurantAllocationPanelProps {
  restaurants: RestaurantForAllocation[];
  allocations: AllocationEntry[];
  selectedIds: number[];
  totalCoasters: number;
  allocatedTotal: number;
  remaining: number;
  isValid: boolean;
  hasAllocations: boolean;
  weightedMultiplier: number;
  weightedScore: number;
  onAddRestaurant: (id: number) => void;
  onRemoveRestaurant: (id: number) => void;
  onUpdateCoasters: (id: number, coasters: number) => void;
  onDistributeEvenly: () => void;
}

function RatingBadgeInline({ score, multiplier }: { score: string | null; multiplier: string | null }) {
  if (!score) {
    return (
      <Badge variant="outline" className="border-border/30 text-muted-foreground text-[10px] px-1.5 py-0">
        Sem rating
      </Badge>
    );
  }
  const s = parseFloat(score);
  const m = multiplier ? parseFloat(multiplier) : 1.0;
  return (
    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary gap-1 text-[11px] px-1.5 py-0 font-mono">
      <Star className="w-2.5 h-2.5 fill-primary" />
      {s.toFixed(2)}
      <span className="text-primary/60">({m.toFixed(2)}x)</span>
    </Badge>
  );
}

export default function RestaurantAllocationPanel({
  restaurants,
  allocations,
  selectedIds,
  totalCoasters,
  allocatedTotal,
  remaining,
  isValid,
  hasAllocations,
  weightedMultiplier,
  weightedScore,
  onAddRestaurant,
  onRemoveRestaurant,
  onUpdateCoasters,
  onDistributeEvenly,
}: RestaurantAllocationPanelProps) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const activeRestaurants = useMemo(
    () => restaurants.filter(r => r.status === "active"),
    [restaurants]
  );

  const filteredRestaurants = useMemo(() => {
    const q = search.toLowerCase().trim();
    return activeRestaurants
      .filter(r => !selectedIds.includes(r.id))
      .filter(r =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.neighborhood && r.neighborhood.toLowerCase().includes(q))
      );
  }, [activeRestaurants, selectedIds, search]);

  const selectedRestaurants = useMemo(() => {
    return allocations.map(a => {
      const r = restaurants.find(res => res.id === a.restaurantId);
      return r ? { ...r, coasters: a.coasters } : null;
    }).filter(Boolean) as (RestaurantForAllocation & { coasters: number })[];
  }, [allocations, restaurants]);

  const percentAllocated = totalCoasters > 0 ? (allocatedTotal / totalCoasters) * 100 : 0;

  return (
    <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold">Distribuição por Restaurante</h3>
            <p className="text-xs text-muted-foreground">
              {hasAllocations
                ? `${selectedIds.length} restaurante${selectedIds.length !== 1 ? "s" : ""} · ${allocatedTotal.toLocaleString("pt-BR")} / ${totalCoasters.toLocaleString("pt-BR")} coasters`
                : "Selecione restaurantes e aloque coasters para a campanha"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAllocations && (
            <div className="hidden sm:flex items-center gap-2">
              {isValid ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                  <CheckCircle2 className="w-3 h-3" />
                  Distribuído
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                  <AlertTriangle className="w-3 h-3" />
                  Pendente
                </Badge>
              )}
              <Badge className="bg-primary/10 text-primary border-primary/30 gap-1 text-[11px] font-mono">
                <Star className="w-3 h-3 fill-primary" />
                {weightedMultiplier.toFixed(2)}x
              </Badge>
            </div>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/20">
          <div className="px-5 py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar restaurante por nome ou bairro..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDropdownOpen(false);
                }}
                className="pl-9 bg-background/50 border-border/50 h-10 text-sm"
              />

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {filteredRestaurants.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                        {activeRestaurants.length === selectedIds.length
                          ? "Todos os restaurantes já foram selecionados"
                          : "Nenhum restaurante encontrado"}
                      </div>
                    ) : (
                      filteredRestaurants.slice(0, 20).map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            onAddRestaurant(r.id);
                            setSearch("");
                            setDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/10 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            {r.neighborhood && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {r.neighborhood}
                              </p>
                            )}
                          </div>
                          <RatingBadgeInline score={r.ratingScore} multiplier={r.ratingMultiplier} />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {hasAllocations && (
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDistributeEvenly}
                  className="gap-1.5 text-xs h-8 border-border/40"
                >
                  <Divide className="w-3.5 h-3.5" />
                  Distribuir igualmente
                </Button>
                <span className="text-xs text-muted-foreground">
                  Total: <span className="font-mono font-semibold text-foreground">{totalCoasters.toLocaleString("pt-BR")}</span> coasters
                </span>
              </div>
            )}
          </div>

          {selectedRestaurants.length > 0 && (
            <div className="border-t border-border/20">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                    <th className="text-left py-2 px-5 font-medium">Restaurante</th>
                    <th className="text-center py-2 px-2 font-medium w-16">Rating</th>
                    <th className="text-right py-2 px-2 font-medium w-24">Coasters</th>
                    <th className="text-right py-2 px-2 font-medium w-14">%</th>
                    <th className="py-2 px-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRestaurants.map((r, idx) => {
                    const alloc = allocations.find(a => a.restaurantId === r.id);
                    const coasters = alloc?.coasters || 0;
                    const pct = totalCoasters > 0 ? (coasters / totalCoasters) * 100 : 0;
                    const score = r.ratingScore ? parseFloat(r.ratingScore) : null;
                    const mult = r.ratingMultiplier ? parseFloat(r.ratingMultiplier) : null;

                    return (
                      <tr
                        key={r.id}
                        className={`text-sm border-t border-border/10 hover:bg-muted/10 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}
                      >
                        <td className="py-2.5 px-5">
                          <p className="font-medium text-sm truncate max-w-[200px]">{r.name}</p>
                          {r.neighborhood && (
                            <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{r.neighborhood}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {score !== null ? (
                            <div className="flex items-center justify-center gap-1">
                              <Star className="w-3 h-3 text-primary fill-primary" />
                              <span className="font-mono text-xs font-semibold">{score.toFixed(1)}</span>
                              {mult !== null && (
                                <span className="font-mono text-[10px] text-muted-foreground">{mult.toFixed(2)}x</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <Input
                            type="number"
                            value={coasters}
                            onChange={(e) => onUpdateCoasters(r.id, Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full font-mono text-xs bg-background/50 border-border/40 h-8 tabular-nums text-right"
                            min={0}
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveRestaurant(r.id)}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                            title="Remover restaurante"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {hasAllocations && (
            <div className="border-t border-border/20 px-5 py-4 space-y-4 bg-card/50">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Coasters alocados</span>
                  <span className={`font-mono font-bold ${isValid ? "text-emerald-400" : remaining < 0 ? "text-destructive" : "text-amber-400"}`}>
                    {allocatedTotal.toLocaleString("pt-BR")} / {totalCoasters.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isValid ? "bg-emerald-500" : remaining < 0 ? "bg-destructive" : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, percentAllocated)}%` }}
                  />
                </div>
                {!isValid && (
                  <p className="text-xs text-amber-400 flex items-center gap-1.5 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {remaining > 0
                      ? `Distribua mais ${remaining.toLocaleString("pt-BR")} coasters para validar a simulação`
                      : `Reduza ${Math.abs(remaining).toLocaleString("pt-BR")} coasters — total excedido`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 rounded-lg p-4 text-center border border-border/10">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Rating Ponderado</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <span className="font-mono text-xl font-bold">{weightedScore > 0 ? weightedScore.toFixed(2) : "—"}</span>
                    <span className="text-xs text-muted-foreground">/ 5.00</span>
                  </div>
                </div>
                <div className="bg-primary/10 rounded-lg p-4 text-center border border-primary/20">
                  <p className="text-xs text-primary/70 uppercase tracking-wider mb-2 font-medium">Multiplicador Final</p>
                  <span className="font-mono text-xl font-bold text-primary">{weightedMultiplier.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
