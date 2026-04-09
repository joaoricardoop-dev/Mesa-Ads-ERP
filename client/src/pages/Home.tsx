import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useSimulator, type BudgetOption, loadSavedBudgetId, saveBudgetId } from "@/hooks/useSimulator";
import { TELAS_INSERCOES } from "@/hooks/useBudgetCalculator";
import { useRestaurantAllocation } from "@/hooks/useRestaurantAllocation";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import KPICards from "@/components/KPICards";
import SimulatorDRE from "@/components/SimulatorDRE";
import MarkupTable from "@/components/CPMTable";
import DiscountTable from "@/components/DiscountTable";
import ScenarioComparison from "@/components/ScenarioComparison";
import DashboardCharts from "@/components/DashboardCharts";
import UnitEconomicsPanel from "@/components/UnitEconomicsPanel";
import RestaurantAllocationPanel from "@/components/RestaurantAllocationPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Rocket,
  RotateCcw,
  Package,
  Store,
  Factory,
  DollarSign,
  Percent,
  Crosshair,
  Target,
  Shield,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Table2,
  LineChart,
  TrendingUp,
  Megaphone,
  Clock,
  Tag,
  Eye,
  Calendar,
} from "lucide-react";
import type { SimulatorInputs, PricingType, CommissionType } from "@/hooks/useSimulator";

function solveMarkupForMargin(
  targetMargin: number,
  inputs: SimulatorInputs,
  restCommOverride?: number,
): number | null {
  const sellerRate = inputs.sellerCommission / 100;
  const taxRateDecimal = inputs.taxRate / 100;
  const agencyVarRate = inputs.commissionType === "variable" ? inputs.restaurantCommission / 100 : 0;
  const restDbRate = (restCommOverride ?? 10) / 100;
  const totalVarRate = sellerRate + taxRateDecimal + agencyVarRate + restDbRate;
  const tm = targetMargin / 100;
  const denom = (1 - totalVarRate) - tm;
  if (denom <= 0) return null;
  const markup = 100 * ((1 - totalVarRate) / denom - 1);
  if (markup < 0) return null;
  return Math.round(markup * 10) / 10;
}

function CompactField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function Home() {
  const { data: budgetsList = [] } = trpc.budget.listActiveWithItems.useQuery();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(() => {
    const savedId = loadSavedBudgetId();
    return savedId !== null ? String(savedId) : "manual";
  });

  const [numArts, setNumArts] = useState<number>(1);
  const [paramsOpen, setParamsOpen] = useState(true);
  const [goalSeekOpen, setGoalSeekOpen] = useState(false);
  const [simulatorProductTipo, setSimulatorProductTipo] = useState<"coasters" | "telas">("coasters");
  const [simulatorSpotSeconds, setSimulatorSpotSeconds] = useState<15 | 30>(30);
  const [simulatorAvgMonthlyCustomers, setSimulatorAvgMonthlyCustomers] = useState<number>(3000);
  const [targetMargin, setTargetMargin] = useState("35");
  const [goalResult, setGoalResult] = useState<{ markup: number } | { error: string } | null>(null);

  const availableNumModels = useMemo<number[]>(() => {
    if (selectedBudgetId === "manual") return [1];
    const id = parseInt(selectedBudgetId);
    const found = budgetsList.find((b) => b.id === id);
    if (!found) return [1];
    const models = new Set(found.items.map((i) => i.numModels ?? 1));
    return Array.from(models).sort((a, b) => a - b);
  }, [selectedBudgetId, budgetsList]);

  useEffect(() => {
    if (!availableNumModels.includes(numArts)) {
      setNumArts(availableNumModels[0] ?? 1);
    }
  }, [availableNumModels, numArts]);

  const selectedBudget = useMemo<BudgetOption | null>(() => {
    if (selectedBudgetId === "manual") return null;
    const id = parseInt(selectedBudgetId);
    const found = budgetsList.find((b) => b.id === id);
    if (!found) return null;
    const filtered = found.items.filter((i) => (i.numModels ?? 1) === numArts);
    return {
      id: found.id,
      code: found.code,
      description: found.description,
      supplierName: found.supplierName,
      items: filtered.map((i) => ({
        quantity: i.quantity,
        unitPrice: String(i.unitPrice),
        totalPrice: String(i.totalPrice),
        numModels: i.numModels ?? 1,
        qtyPerModel: i.qtyPerModel ?? i.quantity,
      })),
    };
  }, [selectedBudgetId, budgetsList, numArts]);

  const [, navigate] = useLocation();

  const { data: restaurantsList = [] } = trpc.activeRestaurant.list.useQuery();
  const restaurantsForAllocation = useMemo(
    () => restaurantsList.map(r => ({
      id: r.id,
      name: r.name,
      neighborhood: r.neighborhood,
      logoUrl: (r as any).logoUrl,
      ratingScore: r.ratingScore,
      ratingMultiplier: r.ratingMultiplier,
      commissionPercent: r.commissionPercent,
      monthlyDrinksSold: r.monthlyDrinksSold,
      status: r.status,
    })),
    [restaurantsList]
  );

  const [allocCommission, setAllocCommission] = useState<number | undefined>();

  const isTelasSimulator = simulatorProductTipo === "telas";
  const simulator = useSimulator(
    selectedBudget,
    allocCommission,
    undefined,
    undefined,
    isTelasSimulator ? "telas" : undefined,
    isTelasSimulator ? simulatorAvgMonthlyCustomers : undefined,
    isTelasSimulator ? simulatorSpotSeconds : undefined,
  );

  const totalCoasters =
    simulator.inputs.coastersPerRestaurant * simulator.inputs.activeRestaurants;

  const allocation = useRestaurantAllocation(restaurantsForAllocation, totalCoasters);

  useEffect(() => {
    setAllocCommission(allocation.hasAllocations ? allocation.weightedCommission : undefined);
  }, [allocation.hasAllocations, allocation.weightedCommission]);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetQuotation = () => {
    simulator.resetInputs();
    allocation.clearAllocations();
    setSelectedBudgetId("manual");
    setNumArts(1);
    saveBudgetId(null);
    setAllocCommission(undefined);
    setShowResetConfirm(false);
  };

  const handleGoalSeek = () => {
    const target = parseFloat(targetMargin);
    if (isNaN(target) || target <= 0 || target >= 100) {
      setGoalResult({ error: "Informe entre 0% e 100%" });
      return;
    }
    const markup = solveMarkupForMargin(target, simulator.inputs, allocCommission);
    if (markup === null) {
      setGoalResult({ error: "Margem impossível com as taxas atuais" });
    } else {
      setGoalResult({ markup });
    }
  };

  const handleApplyGoalSeek = () => {
    if (goalResult && "markup" in goalResult) {
      simulator.updateInput("pricingType", "variable" as PricingType);
      simulator.updateInput("markupPercent", goalResult.markup);
      setGoalSeekOpen(false);
      setGoalResult(null);
      setTargetMargin("");
    }
  };

  const inputs = simulator.inputs;
  const updateInput = simulator.updateInput;
  const grossMargin = simulator.perRestaurant.grossMargin;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6 space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Simulador Financeiro</h1>
            <p className="text-xs text-muted-foreground">Monte cenários de campanha e gere cotações</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                const fwdParams = new URLSearchParams();
                const clientId = params.get("clientId");
                const leadId = params.get("leadId");
                if (clientId) fwdParams.set("clientId", clientId);
                if (leadId) fwdParams.set("leadId", leadId);
                navigate(`/cotacao/preview${fwdParams.toString() ? `?${fwdParams}` : ""}`);
              }}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              size="sm"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Criar Cotação</span>
            </Button>
            {showResetConfirm ? (
              <div className="flex items-center gap-1.5 bg-destructive/10 rounded-lg px-2 py-1 border border-destructive/30">
                <span className="text-xs text-muted-foreground">Resetar?</span>
                <Button onClick={handleResetQuotation} variant="destructive" size="sm" className="h-6 text-xs px-2">Sim</Button>
                <Button onClick={() => setShowResetConfirm(false)} variant="ghost" size="sm" className="h-6 text-xs px-2">Não</Button>
              </div>
            ) : (
              <Button onClick={() => setShowResetConfirm(true)} variant="outline" size="sm" className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Resetar</span>
              </Button>
            )}
          </div>
        </div>

        <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
          <button
            onClick={() => setParamsOpen(!paramsOpen)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Factory className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-semibold">Parâmetros da Simulação</h2>
                <p className="text-[10px] text-muted-foreground">
                  {inputs.coastersPerRestaurant} coasters × {inputs.activeRestaurants} rest. = {totalCoasters.toLocaleString("pt-BR")} un
                  {" · "}Markup {inputs.markupPercent}% · Margem {grossMargin.toFixed(1)}%
                </p>
              </div>
            </div>
            {paramsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {paramsOpen && (
            <div className="border-t border-border/20 px-5 py-4 space-y-4">

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Operacional</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <CompactField label="Tipo de Produto">
                  <Select value={simulatorProductTipo} onValueChange={(v) => setSimulatorProductTipo(v as "coasters" | "telas")}>
                    <SelectTrigger className="bg-background/50 border-border/50 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coasters">Coasters</SelectItem>
                      <SelectItem value="telas">Telas (TV)</SelectItem>
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label="Restaurantes ativos">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" value={inputs.activeRestaurants} onChange={(e) => updateInput("activeRestaurants", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={1} max={100} />
                    </div>
                    <Slider value={[inputs.activeRestaurants]} onValueChange={([v]) => updateInput("activeRestaurants", v)} min={1} max={100} step={1} />
                  </div>
                </CompactField>
                {isTelasSimulator ? (
                  <>
                    <CompactField label="Spot">
                      <Select value={String(simulatorSpotSeconds)} onValueChange={(v) => setSimulatorSpotSeconds(Number(v) as 15 | 30)}>
                        <SelectTrigger className="bg-background/50 border-border/50 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30s ({TELAS_INSERCOES[30]} ins/dia)</SelectItem>
                          <SelectItem value="15">15s ({TELAS_INSERCOES[15]} ins/dia)</SelectItem>
                        </SelectContent>
                      </Select>
                    </CompactField>
                    <CompactField label="Clientes / mês">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={simulatorAvgMonthlyCustomers} onChange={(e) => setSimulatorAvgMonthlyCustomers(Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} step={100} />
                        <span className="text-[10px] text-muted-foreground">cli</span>
                      </div>
                    </CompactField>
                  </>
                ) : (
                  <>
                    <CompactField label="Coasters / restaurante">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={inputs.coastersPerRestaurant} onChange={(e) => updateInput("coastersPerRestaurant", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={50} max={5000} step={50} />
                        <span className="text-[10px] text-muted-foreground">un</span>
                      </div>
                    </CompactField>
                    <CompactField label="Uso médio / dia">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={inputs.usagePerDay} onChange={(e) => updateInput("usagePerDay", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={1} max={20} />
                        <span className="text-[10px] text-muted-foreground">×</span>
                      </div>
                    </CompactField>
                    <CompactField label="Dias / mês">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={inputs.daysPerMonth} onChange={(e) => updateInput("daysPerMonth", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={1} max={31} />
                        <span className="text-[10px] text-muted-foreground">dias</span>
                      </div>
                    </CompactField>
                  </>
                )}
                </div>
              </div>

              <div className="border-t border-border/10 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Custo de Produção</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3">
                  <CompactField label="Orçamento" className="min-w-0">
                    <Select value={selectedBudgetId} onValueChange={(v) => { setSelectedBudgetId(v); saveBudgetId(v === "manual" ? null : parseInt(v)); }}>
                      <SelectTrigger className="bg-background/50 border-border/50 h-8 text-sm [&>span]:truncate [&>span]:block">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        {budgetsList.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.supplierName} — {b.code || b.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CompactField>

                  {selectedBudgetId !== "manual" && availableNumModels.length > 1 && (
                    <CompactField label="Nº de Artes">
                      <Select value={String(numArts)} onValueChange={(v) => setNumArts(parseInt(v))}>
                        <SelectTrigger className="bg-background/50 border-border/50 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableNumModels.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 ? "1 (único)" : `${n} artes`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CompactField>
                  )}

                  {selectedBudgetId === "manual" && (
                    <>
                      <CompactField label="Batch Size">
                        <Input type="number" value={inputs.batchSize} onChange={(e) => updateInput("batchSize", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={100} step={1000} />
                      </CompactField>
                      <CompactField label="Custo do Batch (R$)">
                        <Input type="number" value={inputs.batchCost} onChange={(e) => updateInput("batchCost", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} step={100} />
                      </CompactField>
                    </>
                  )}

                  <CompactField label="Custo Unitário Efetivo">
                    <div className="bg-background/50 border border-border/50 rounded-md h-8 flex items-center px-3">
                      <span className="font-mono text-sm font-semibold text-primary">
                        R$ {simulator.effectiveUnitCost.toFixed(4)}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">/ un</span>
                    </div>
                  </CompactField>
                </div>

                {selectedBudget && selectedBudget.items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedBudget.items.map((item, i) => {
                      const isActive =
                        totalCoasters >= item.quantity &&
                        (i === selectedBudget.items.length - 1 || totalCoasters < selectedBudget.items[i + 1].quantity);
                      return (
                        <div
                          key={i}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                            isActive
                              ? "bg-primary/20 border-primary/40 text-primary"
                              : "bg-background/30 border-border/20 text-muted-foreground"
                          }`}
                        >
                          <span className="font-semibold">{item.quantity.toLocaleString("pt-BR")}</span>
                          {numArts > 1 && item.qtyPerModel && (
                            <span className="text-[9px] opacity-60"> ({item.qtyPerModel.toLocaleString("pt-BR")}/arte)</span>
                          )}
                          <span className="mx-0.5">→</span>
                          <span>R$ {parseFloat(item.unitPrice).toFixed(4)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border/10 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Precificação</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <CompactField label="Tipo de Markup">
                    <div className="flex rounded-md overflow-hidden border border-border/50 h-8">
                      <button
                        type="button"
                        onClick={() => updateInput("pricingType", "fixed" as PricingType)}
                        className={`flex-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
                          inputs.pricingType === "fixed" ? "bg-primary text-primary-foreground" : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        R$ Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => updateInput("pricingType", "variable" as PricingType)}
                        className={`flex-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
                          inputs.pricingType === "variable" ? "bg-primary text-primary-foreground" : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        % Variável
                      </button>
                    </div>
                  </CompactField>

                  <CompactField label={inputs.pricingType === "fixed" ? "Valor Fixo (R$/rest.)" : "Markup (%)"}>
                    {inputs.pricingType === "fixed" ? (
                      <Input type="number" value={inputs.fixedPrice} onChange={(e) => updateInput("fixedPrice", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={50000} step={50} />
                    ) : (
                      <div className="space-y-1">
                        <Input type="number" value={inputs.markupPercent} onChange={(e) => updateInput("markupPercent", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={300} />
                        <Slider value={[inputs.markupPercent]} onValueChange={([v]) => updateInput("markupPercent", v)} min={0} max={300} step={5} />
                      </div>
                    )}
                  </CompactField>

                  <CompactField label="Margem Bruta">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 bg-background/50 border border-border/50 rounded-md h-8 flex items-center px-3">
                        <span className={`font-mono text-sm font-bold tabular-nums ${
                          grossMargin >= 40 ? "text-primary" : grossMargin >= 20 ? "text-amber-400" : "text-destructive"
                        }`}>
                          {grossMargin.toFixed(1)}%
                        </span>
                      </div>
                      <Popover open={goalSeekOpen} onOpenChange={(v) => { setGoalSeekOpen(v); if (!v) { setGoalResult(null); setTargetMargin(""); } }}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 border-primary/30 hover:bg-primary/10" title="Atingir meta">
                            <Crosshair className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" side="bottom" align="end">
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <Target className="w-4 h-4 text-primary" />
                              Atingir Meta
                            </div>
                            <div className="flex items-center gap-2">
                              <Input type="number" value={targetMargin} onChange={(e) => { setTargetMargin(e.target.value); setGoalResult(null); }} onKeyDown={(e) => { if (e.key === "Enter") handleGoalSeek(); }} placeholder="35" className="font-mono text-sm h-8" min={1} max={99} step={0.1} autoFocus />
                              <span className="text-xs text-muted-foreground">%</span>
                              <Button onClick={handleGoalSeek} size="sm" className="h-8 px-3 shrink-0">
                                <Crosshair className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            {goalResult && "error" in goalResult && (
                              <p className="text-xs text-destructive">{goalResult.error}</p>
                            )}
                            {goalResult && "markup" in goalResult && (
                              <Button onClick={handleApplyGoalSeek} size="sm" className="w-full gap-2 h-8">
                                <Target className="w-3.5 h-3.5" />
                                Aplicar {goalResult.markup.toFixed(1)}%
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </CompactField>

                  <CompactField label="Desc. Máximo">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={inputs.maxDiscount} onChange={(e) => updateInput("maxDiscount", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={50} />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                      <Slider value={[inputs.maxDiscount]} onValueChange={([v]) => updateInput("maxDiscount", v)} min={0} max={50} step={1} />
                    </div>
                  </CompactField>

                  <CompactField label="Margem Mínima">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" value={inputs.minMargin} onChange={(e) => updateInput("minMargin", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={50} />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                  </CompactField>
                </div>
              </div>

              <div className="border-t border-border/10 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">Comercial & Tributário</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <CompactField label="Tipo Com. Agência">
                    <div className="flex rounded-md overflow-hidden border border-border/50 h-8">
                      <button
                        type="button"
                        onClick={() => updateInput("commissionType", "fixed" as CommissionType)}
                        className={`flex-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
                          inputs.commissionType === "fixed" ? "bg-primary text-primary-foreground" : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        R$ Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => updateInput("commissionType", "variable" as CommissionType)}
                        className={`flex-1 text-[10px] uppercase tracking-wider font-medium transition-colors ${
                          inputs.commissionType === "variable" ? "bg-primary text-primary-foreground" : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        % Var
                      </button>
                    </div>
                  </CompactField>

                  <CompactField label={inputs.commissionType === "fixed" ? "Com. Agência (R$/un)" : "Com. Agência (%)"}>
                    {inputs.commissionType === "fixed" ? (
                      <Input type="number" value={inputs.fixedCommission} onChange={(e) => updateInput("fixedCommission", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={5} step={0.01} />
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Input type="number" value={inputs.restaurantCommission} onChange={(e) => updateInput("restaurantCommission", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={50} />
                          <span className="text-[10px] text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                  </CompactField>

                  <CompactField label="Com. Vendedor">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Input type="number" value={inputs.sellerCommission} onChange={(e) => updateInput("sellerCommission", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={30} />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                    </div>
                  </CompactField>

                  <CompactField label="Carga Tributária">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" value={inputs.taxRate} onChange={(e) => updateInput("taxRate", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={0} max={40} step={0.5} />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>
                  </CompactField>

                  <CompactField label="Duração Contrato">
                    <div className="flex items-center gap-1.5">
                      <Input type="number" value={inputs.contractDuration} onChange={(e) => updateInput("contractDuration", Number(e.target.value))} className="font-mono text-sm bg-background/50 border-border/50 h-8 tabular-nums" min={1} max={36} />
                      <span className="text-[10px] text-muted-foreground">meses</span>
                    </div>
                  </CompactField>
                </div>
              </div>
            </div>
          )}
        </div>

        <KPICards
          perRestaurant={simulator.perRestaurant}
          unitEconomics={simulator.unitEconomics}
          activeRestaurants={simulator.inputs.activeRestaurants}
          contractDuration={simulator.inputs.contractDuration}
          coastersPerRestaurant={simulator.inputs.coastersPerRestaurant}
          minMargin={simulator.inputs.minMargin}
          isTelas={isTelasSimulator}
        />

        <SimulatorDRE
          perRestaurant={simulator.perRestaurant}
          unitEconomics={simulator.unitEconomics}
          activeRestaurants={simulator.inputs.activeRestaurants}
          contractDuration={simulator.inputs.contractDuration}
          minMargin={simulator.inputs.minMargin}
          weightedScore={allocation.hasAllocations ? allocation.weightedScore : undefined}
          allocationValid={allocation.isValid}
        />

        <RestaurantAllocationPanel
          restaurants={restaurantsForAllocation}
          allocations={allocation.allocations}
          selectedIds={allocation.selectedIds}
          totalCoasters={totalCoasters}
          allocatedTotal={allocation.allocatedTotal}
          remaining={allocation.remaining}
          isValid={allocation.isValid}
          hasAllocations={allocation.hasAllocations}
          weightedScore={allocation.weightedScore}
          weightedCommission={allocation.weightedCommission}
          onAddRestaurant={allocation.addRestaurant}
          onRemoveRestaurant={allocation.removeRestaurant}
          onUpdateCoasters={allocation.updateCoasters}
          onUpdateCommission={allocation.updateCommission}
          onDistributeEvenly={allocation.distributeEvenly}
          simulatorInputs={simulator.inputs}
          effectiveUnitCost={simulator.effectiveUnitCost}
        />

        <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
          <Tabs defaultValue="charts" className="w-full">
            <div className="border-b border-border/20 px-5">
              <TabsList className="bg-transparent h-10 p-0 gap-0">
                <TabsTrigger value="charts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5">
                  <LineChart className="w-3.5 h-3.5" />
                  Gráficos
                </TabsTrigger>
                <TabsTrigger value="scenarios" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Cenários
                </TabsTrigger>
                <TabsTrigger value="tables" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5">
                  <Table2 className="w-3.5 h-3.5" />
                  Tabelas
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-5">
              <TabsContent value="charts" className="mt-0 space-y-6">
                <DashboardCharts
                  perRestaurant={simulator.perRestaurant}
                  unitEconomics={simulator.unitEconomics}
                  activeRestaurants={simulator.inputs.activeRestaurants}
                  cumulativeProfit={simulator.cumulativeProfit}
                  revenueVsRestaurants={simulator.revenueVsRestaurants}
                  minMargin={simulator.inputs.minMargin}
                />
              </TabsContent>

              <TabsContent value="scenarios" className="mt-0 space-y-6">
                <ScenarioComparison scenarios={simulator.scenarios} />
                <UnitEconomicsPanel
                  data={simulator.unitEconomics}
                  sellerCommission={simulator.inputs.sellerCommission}
                  contractDuration={simulator.inputs.contractDuration}
                />
              </TabsContent>

              <TabsContent value="tables" className="mt-0 space-y-6">
                <MarkupTable
                  data={simulator.markupTable}
                  currentMarkup={simulator.inputs.markupPercent}
                  minMargin={simulator.inputs.minMargin}
                />
                <DiscountTable
                  data={simulator.discountTable}
                  minMargin={simulator.inputs.minMargin}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

      </div>
    </div>
  );
}
