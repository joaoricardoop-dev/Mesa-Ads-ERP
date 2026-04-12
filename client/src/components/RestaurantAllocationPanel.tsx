import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  HelpCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  RestaurantForAllocation,
  AllocationEntry,
} from "@/hooks/useRestaurantAllocation";
import RestaurantAvatar from "@/components/RestaurantAvatar";
import { COASTER_CAPACITY_FACTOR } from "@/hooks/useRestaurantAllocation";
import { calcPricing, type SimulatorInputs } from "@/hooks/useSimulator";

interface RestaurantAllocationPanelProps {
  restaurants: RestaurantForAllocation[];
  allocations: AllocationEntry[];
  selectedIds: number[];
  totalCoasters: number;
  allocatedTotal: number;
  remaining: number;
  isValid: boolean;
  hasAllocations: boolean;
  weightedScore: number;
  weightedCommission: number;
  onAddRestaurant: (id: number) => void;
  onRemoveRestaurant: (id: number) => void;
  onUpdateCoasters: (id: number, coasters: number) => void;
  onUpdateCommission: (id: number, commission: number) => void;
  onDistributeEvenly: () => void;
  simulatorInputs: SimulatorInputs;
  effectiveUnitCost: number;
}

function RatingBadgeInline({ score }: { score: string | null }) {
  if (!score) {
    return (
      <Badge variant="outline" className="border-border/30 text-muted-foreground text-[10px] px-1.5 py-0">
        Sem rating
      </Badge>
    );
  }
  const s = parseFloat(score);
  return (
    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary gap-1 text-[11px] px-1.5 py-0 font-mono">
      <Star className="w-2.5 h-2.5 fill-primary" />
      {s.toFixed(2)}
    </Badge>
  );
}

function calcPerRestaurantPricing(
  coasters: number,
  commissionPercent: number,
  inputs: SimulatorInputs,
  effectiveUnitCost: number
) {
  const productionCost = coasters * effectiveUnitCost;
  const perRestInputs = { ...inputs, coastersPerRestaurant: coasters };
  const result = calcPricing(productionCost, perRestInputs, {
    restaurantCommissionRate: commissionPercent,
  });
  return {
    productionCost: result.productionCost,
    sellingPrice: result.sellingPrice,
    restaurantCommission: result.restaurantCommission,
    agencyCommission: result.agencyCommission,
    sellerCommission: result.sellerCommissionValue,
    tax: result.taxValue,
    grossProfit: result.grossProfit,
    grossMargin: result.grossMargin,
  };
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  weightedScore,
  weightedCommission,
  onAddRestaurant,
  onRemoveRestaurant,
  onUpdateCoasters,
  onUpdateCommission,
  onDistributeEvenly,
  simulatorInputs,
  effectiveUnitCost,
}: RestaurantAllocationPanelProps) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showPricing, setShowPricing] = useState(false);

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
      return r ? { ...r, coasters: a.coasters, allocCommission: a.commissionPercent ?? 10 } : null;
    }).filter(Boolean) as (RestaurantForAllocation & { coasters: number; allocCommission: number })[];
  }, [allocations, restaurants]);

  const perRestaurantPricing = useMemo(() => {
    if (!showPricing) return new Map<number, ReturnType<typeof calcPerRestaurantPricing>>();
    const map = new Map<number, ReturnType<typeof calcPerRestaurantPricing>>();
    for (const r of selectedRestaurants) {
      const pricing = calcPerRestaurantPricing(
        r.coasters,
        r.allocCommission,
        simulatorInputs,
        effectiveUnitCost
      );
      map.set(r.id, pricing);
    }
    return map;
  }, [selectedRestaurants, showPricing, simulatorInputs, effectiveUnitCost]);

  const percentAllocated = totalCoasters > 0 ? (allocatedTotal / totalCoasters) * 100 : 0;

  return (
    <TooltipProvider>
      <div className="bg-card border border-border/30 rounded-xl">
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
              <h3 className="text-sm font-semibold">Distribuição por Local</h3>
              <p className="text-xs text-muted-foreground">
                {hasAllocations
                  ? `${selectedIds.length} local${selectedIds.length !== 1 ? "is" : ""} · ${allocatedTotal.toLocaleString("pt-BR")} / ${totalCoasters.toLocaleString("pt-BR")} coasters`
                  : "Selecione locais e aloque coasters para a campanha"}
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
                  Score: {weightedScore.toFixed(2)}
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
              </div>

              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="relative z-20 -mt-2 bg-popover border border-border rounded-lg shadow-xl max-h-72 overflow-y-auto">
                      {filteredRestaurants.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                          {activeRestaurants.length === selectedIds.length
                            ? "Todos os restaurantes já foram selecionados"
                            : "Nenhum restaurante encontrado"}
                        </div>
                      ) : (
                        filteredRestaurants.slice(0, 20).map(r => {
                          const capacity = r.monthlyDrinksSold
                            ? Math.round(r.monthlyDrinksSold * COASTER_CAPACITY_FACTOR)
                            : null;
                          return (
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
                              <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} size="xs" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{r.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {r.neighborhood && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {r.neighborhood}
                                    </p>
                                  )}
                                  {capacity !== null && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      Cap: {capacity.toLocaleString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <RatingBadgeInline score={r.ratingScore} />
                            </button>
                          );
                        })
                      )}
                  </div>
                </>
              )}

              {hasAllocations && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDistributeEvenly}
                      className="gap-1.5 text-xs h-8 border-border/40"
                    >
                      <Divide className="w-3.5 h-3.5" />
                      Distribuir igualmente
                    </Button>
                    <Button
                      variant={showPricing ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowPricing(!showPricing)}
                      className="gap-1.5 text-xs h-8 border-border/40"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      {showPricing ? "Ocultar Preços" : "Ver Preços"}
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Total: <span className="font-mono font-semibold text-foreground">{totalCoasters.toLocaleString("pt-BR")}</span> coasters
                  </span>
                </div>
              )}
            </div>

            {selectedRestaurants.length > 0 && (
              <div className="border-t border-border/20 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
                      <th className="text-left py-2 px-5 font-medium">Local</th>
                      <th className="text-center py-2 px-2 font-medium w-16">Rating</th>
                      <th className="text-center py-2 px-2 font-medium w-28">
                        <div className="flex items-center justify-center gap-1">
                          <span>Cap. Mensal</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              <p className="font-semibold mb-1">Capacidade Mensal de Coasters</p>
                              <p>Calculada como: <span className="font-mono">Bebidas Vendidas/Mês × {COASTER_CAPACITY_FACTOR}</span></p>
                              <p className="mt-1 text-muted-foreground">Estima que ~{(COASTER_CAPACITY_FACTOR * 100).toFixed(0)}% das bebidas servidas utilizam coasters para apoio, resultando na capacidade mensal de distribuição.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </th>
                      <th className="text-right py-2 px-2 font-medium w-24">Coasters</th>
                      <th className="text-right py-2 px-2 font-medium w-14">%</th>
                      <th className="text-center py-2 px-2 font-medium w-20">Com. %</th>
                      {showPricing && (
                        <>
                          <th className="text-right py-2 px-2 font-medium w-24">Preço Venda</th>
                          <th className="text-right py-2 px-2 font-medium w-24">Lucro</th>
                          <th className="text-right py-2 px-2 font-medium w-16">Margem</th>
                        </>
                      )}
                      <th className="py-2 px-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRestaurants.map((r, idx) => {
                      const alloc = allocations.find(a => a.restaurantId === r.id);
                      const coasters = alloc?.coasters || 0;
                      const pct = totalCoasters > 0 ? (coasters / totalCoasters) * 100 : 0;
                      const score = r.ratingScore ? parseFloat(r.ratingScore) : null;
                      const capacity = r.monthlyDrinksSold
                        ? Math.round(r.monthlyDrinksSold * COASTER_CAPACITY_FACTOR)
                        : null;
                      const pricing = perRestaurantPricing.get(r.id);
                      const overCapacity = capacity !== null && coasters > capacity;

                      return (
                        <tr
                          key={r.id}
                          className={`text-sm border-t border-border/10 hover:bg-muted/10 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}
                        >
                          <td className="py-2.5 px-5">
                            <div className="flex items-center gap-2">
                              <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} size="xs" />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate max-w-[180px]">{r.name}</p>
                                {r.neighborhood && (
                                  <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{r.neighborhood}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {score !== null ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="w-3 h-3 text-primary fill-primary" />
                                <span className="font-mono text-xs font-semibold">{score.toFixed(1)}</span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {capacity !== null ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`font-mono text-xs cursor-help ${overCapacity ? "text-amber-400" : "text-muted-foreground"}`}>
                                    {capacity.toLocaleString("pt-BR")}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p>{(r.monthlyDrinksSold ?? 0).toLocaleString("pt-BR")} bebidas/mês × {COASTER_CAPACITY_FACTOR} = {capacity.toLocaleString("pt-BR")}</p>
                                  {overCapacity && (
                                    <p className="text-amber-400 mt-1">Alocação excede a capacidade estimada</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
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
                          <td className="py-2.5 px-2 text-center">
                            <Input
                              type="number"
                              value={r.allocCommission}
                              onChange={(e) => onUpdateCommission(r.id, parseFloat(e.target.value) || 8)}
                              className="w-full font-mono text-xs bg-background/50 border-border/40 h-8 tabular-nums text-center"
                              min={8}
                              max={15}
                              step={0.5}
                            />
                          </td>
                          {showPricing && pricing && (
                            <>
                              <td className="py-2.5 px-2 text-right">
                                <span className="font-mono text-xs font-semibold">R$ {fmt(pricing.sellingPrice)}</span>
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <span className={`font-mono text-xs font-semibold ${pricing.grossProfit >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                                  R$ {fmt(pricing.grossProfit)}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <span className={`font-mono text-xs ${pricing.grossMargin >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                                  {pricing.grossMargin.toFixed(1)}%
                                </span>
                              </td>
                            </>
                          )}
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

            {showPricing && selectedRestaurants.length > 0 && (
              <div className="border-t border-border/20 px-5 py-4 bg-muted/10">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">Detalhamento por Local</h4>
                </div>
                <div className="space-y-3">
                  {selectedRestaurants.map(r => {
                    const pricing = perRestaurantPricing.get(r.id);
                    if (!pricing || r.coasters === 0) return null;
                    return (
                      <div key={r.id} className="bg-card border border-border/20 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} size="xs" />
                            <span className="text-sm font-semibold truncate max-w-[200px]">{r.name}</span>
                            {r.ratingScore && (
                              <Badge variant="outline" className="border-primary/30 text-primary text-[10px] px-1.5 py-0 font-mono gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-primary" />
                                {parseFloat(r.ratingScore).toFixed(1)}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{r.coasters.toLocaleString("pt-BR")} coasters</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Receita</span>
                            <p className="font-mono font-semibold">R$ {fmt(pricing.sellingPrice)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Produção</span>
                            <p className="font-mono text-red-400">-R$ {fmt(pricing.productionCost)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Com. Rest. ({r.allocCommission}%)</span>
                            <p className="font-mono text-red-400">-R$ {fmt(pricing.restaurantCommission)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Impostos</span>
                            <p className="font-mono text-red-400">-R$ {fmt(pricing.tax)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Com. Agência</span>
                            <p className="font-mono text-red-400">-R$ {fmt(pricing.agencyCommission)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Com. Vendedor</span>
                            <p className="font-mono text-red-400">-R$ {fmt(pricing.sellerCommission)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lucro Bruto</span>
                            <p className={`font-mono font-bold ${pricing.grossProfit >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                              R$ {fmt(pricing.grossProfit)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Margem</span>
                            <p className={`font-mono font-bold ${pricing.grossMargin >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                              {pricing.grossMargin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4 text-center border border-border/10">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Rating Ponderado</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <Star className="w-4 h-4 text-primary fill-primary" />
                      <span className="font-mono text-xl font-bold">{weightedScore > 0 ? weightedScore.toFixed(2) : "—"}</span>
                      <span className="text-xs text-muted-foreground">/ 5.00</span>
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 text-center border border-border/10">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Com. Ponderada</p>
                    <span className="font-mono text-xl font-bold">{weightedCommission.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
