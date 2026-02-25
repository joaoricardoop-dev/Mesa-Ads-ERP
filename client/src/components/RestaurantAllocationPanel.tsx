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

function RatingBadge({ score, multiplier }: { score: string | null; multiplier: string | null }) {
  if (!score) {
    return (
      <span className="text-[10px] text-muted-foreground italic">Sem rating</span>
    );
  }
  const s = parseFloat(score);
  const m = multiplier ? parseFloat(multiplier) : 1.0;
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3 h-3 text-primary fill-primary" />
      <span className="font-mono text-xs font-semibold">{s.toFixed(2)}</span>
      <span className="font-mono text-[10px] text-muted-foreground">({m.toFixed(2)}x)</span>
    </div>
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
    <div className="bg-card/50 border border-border/30 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold">Distribuição por Restaurante</h3>
            <p className="text-xs text-muted-foreground">
              {hasAllocations
                ? `${selectedIds.length} selecionado${selectedIds.length !== 1 ? "s" : ""} · ${allocatedTotal.toLocaleString("pt-BR")} / ${totalCoasters.toLocaleString("pt-BR")} coasters`
                : "Selecione restaurantes e aloque coasters"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasAllocations && (
            <div className="hidden sm:flex items-center gap-2">
              {isValid ? (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 gap-1 text-[10px]">
                  <CheckCircle2 className="w-3 h-3" />
                  Válido
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 gap-1 text-[10px]">
                  <AlertTriangle className="w-3 h-3" />
                  {remaining > 0 ? `Faltam ${remaining.toLocaleString("pt-BR")}` : `Excesso ${Math.abs(remaining).toLocaleString("pt-BR")}`}
                </Badge>
              )}
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                <Star className="w-3 h-3 text-primary" />
                <span className="font-mono text-xs font-bold text-primary">{weightedMultiplier.toFixed(2)}x</span>
              </div>
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/20 p-4 space-y-4">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar restaurante para adicionar..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setDropdownOpen(false);
                }}
                className="pl-9 bg-background/50 border-border/50 h-9 text-sm"
              />
            </div>

            {dropdownOpen && (search.trim() || dropdownOpen) && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                  {filteredRestaurants.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">
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
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          {r.neighborhood && (
                            <p className="text-[10px] text-muted-foreground truncate">{r.neighborhood}</p>
                          )}
                        </div>
                        <RatingBadge score={r.ratingScore} multiplier={r.ratingMultiplier} />
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {hasAllocations && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={onDistributeEvenly}
                className="gap-1.5 text-xs h-7 border-border/40"
              >
                <Divide className="w-3 h-3" />
                Distribuir igualmente
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {totalCoasters.toLocaleString("pt-BR")} coasters no total da campanha
              </span>
            </div>
          )}

          {selectedRestaurants.length > 0 && (
            <div className="space-y-2">
              {selectedRestaurants.map(r => {
                const alloc = allocations.find(a => a.restaurantId === r.id);
                const coasters = alloc?.coasters || 0;
                const pct = totalCoasters > 0 ? (coasters / totalCoasters) * 100 : 0;

                return (
                  <div
                    key={r.id}
                    className="bg-background/40 border border-border/20 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{r.name}</p>
                          <RatingBadge score={r.ratingScore} multiplier={r.ratingMultiplier} />
                        </div>
                        {r.neighborhood && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{r.neighborhood}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveRestaurant(r.id)}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Slider
                          value={[coasters]}
                          onValueChange={([v]) => onUpdateCoasters(r.id, v)}
                          min={0}
                          max={totalCoasters}
                          step={10}
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Input
                          type="number"
                          value={coasters}
                          onChange={(e) => onUpdateCoasters(r.id, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-20 font-mono text-xs bg-background/50 border-border/50 h-7 tabular-nums text-right"
                          min={0}
                        />
                        <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasAllocations && (
            <div className="space-y-3 pt-2 border-t border-border/20">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Alocados</span>
                  <span className={`font-mono font-semibold ${isValid ? "text-emerald-400" : remaining < 0 ? "text-destructive" : "text-amber-400"}`}>
                    {allocatedTotal.toLocaleString("pt-BR")} / {totalCoasters.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isValid ? "bg-emerald-500" : remaining < 0 ? "bg-destructive" : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, percentAllocated)}%` }}
                  />
                </div>
                {!isValid && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {remaining > 0
                      ? `Distribua mais ${remaining.toLocaleString("pt-BR")} coasters para concluir`
                      : `Excesso de ${Math.abs(remaining).toLocaleString("pt-BR")} coasters — reduza a alocação`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Rating Ponderado</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                    <span className="font-mono text-lg font-bold">{weightedScore > 0 ? weightedScore.toFixed(2) : "—"}</span>
                  </div>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-primary/70 uppercase tracking-wider mb-1">Multiplicador Final</p>
                  <span className="font-mono text-lg font-bold text-primary">{weightedMultiplier.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
