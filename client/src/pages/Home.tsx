/*
 * Design: Bloomberg Terminal Reimaginado
 * Layout: Sidebar fixa à esquerda (inputs) + Área principal com grid de dados
 * Fundo dark slate, acentos emerald, tipografia DM Sans + JetBrains Mono
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useSimulator, type BudgetOption, loadSavedBudgetId, saveBudgetId } from "@/hooks/useSimulator";
import { useRestaurantAllocation } from "@/hooks/useRestaurantAllocation";
import { trpc } from "@/lib/trpc";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import InputPanel from "@/components/InputPanel";
import KPICards from "@/components/KPICards";
import SimulatorDRE from "@/components/SimulatorDRE";
import MarkupTable from "@/components/CPMTable";
import DiscountTable from "@/components/DiscountTable";
import ScenarioComparison from "@/components/ScenarioComparison";
import DashboardCharts from "@/components/DashboardCharts";
import UnitEconomicsPanel from "@/components/UnitEconomicsPanel";
import RestaurantAllocationPanel from "@/components/RestaurantAllocationPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

import {
  BarChart3,
  Table2,
  Layers,
  Zap,
  LineChart,
  SlidersHorizontal,
  Rocket,
  FileText,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";


export default function Home() {
  // ─── Budget selection state ────────────────────────────────────────
  const { theme, toggleTheme } = useTheme();
  const { data: budgetsList = [] } = trpc.budget.listActiveWithItems.useQuery();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(() => {
    const savedId = loadSavedBudgetId();
    return savedId !== null ? String(savedId) : "manual";
  });

  const selectedBudget = useMemo<BudgetOption | null>(() => {
    if (selectedBudgetId === "manual") return null;
    const id = parseInt(selectedBudgetId);
    const found = budgetsList.find((b) => b.id === id);
    if (!found) return null;
    return {
      id: found.id,
      code: found.code,
      description: found.description,
      supplierName: found.supplierName,
      items: found.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: String(i.unitPrice),
        totalPrice: String(i.totalPrice),
      })),
    };
  }, [selectedBudgetId, budgetsList]);

  const simulator = useSimulator(selectedBudget);
  const [activeTab, setActiveTab] = useState("overview");
  const [, navigate] = useLocation();

  const { data: restaurantsList = [] } = trpc.activeRestaurant.list.useQuery();
  const restaurantsForAllocation = useMemo(
    () => restaurantsList.map(r => ({
      id: r.id,
      name: r.name,
      neighborhood: r.neighborhood,
      ratingScore: r.ratingScore,
      ratingMultiplier: r.ratingMultiplier,
      status: r.status,
    })),
    [restaurantsList]
  );

  // Total coasters for budget interpolation info
  const totalCoasters =
    simulator.inputs.coastersPerRestaurant * simulator.inputs.activeRestaurants;

  const allocation = useRestaurantAllocation(restaurantsForAllocation, totalCoasters);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[300px] xl:w-[320px] flex-shrink-0 border-r border-border/30 bg-sidebar flex-col">
        <ScrollArea className="h-full">
          <InputPanel
            inputs={simulator.inputs}
            updateInput={simulator.updateInput}
            grossMargin={simulator.perRestaurant.grossMargin}
          />
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile sidebar trigger */}
        <div className="lg:hidden border-b border-border/30 bg-card/30 px-4 py-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-border/40"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Parâmetros
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0 bg-sidebar">
              <ScrollArea className="h-full">
                <InputPanel
                  inputs={simulator.inputs}
                  updateInput={simulator.updateInput}
                  grossMargin={simulator.perRestaurant.grossMargin}
                />
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {/* Tabs Navigation - Fixed */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="border-b border-border/30 bg-card/30 flex-shrink-0 px-4 lg:px-6">
            <TabsList className="bg-transparent h-10 p-0 gap-0">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="tables"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabelas</span>
              </TabsTrigger>
              <TabsTrigger
                value="scenarios"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cenários</span>
              </TabsTrigger>
              <TabsTrigger
                value="unit-economics"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Unit Economics</span>
              </TabsTrigger>
              <TabsTrigger
                value="charts"
                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-xs gap-1.5"
              >
                <LineChart className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">
              <TabsContent value="overview" className="mt-0 space-y-6">
                {/* Hero Banner */}
                <div className="relative rounded-xl overflow-hidden h-32 md:h-36 border border-border/30">
                  <img src="/images/hero-bar.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
                  <div className="absolute inset-0 flex items-center p-6 md:p-8">
                    <div className="flex-1 relative z-10">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-1 text-white">
                        Simulador Financeiro
                      </h2>
                      <p className="text-sm text-white/60 max-w-md mb-3">
                        Faturamento e lucro da Mesa Ads. Restaurantes parceiros
                        recebem comissão sobre a mídia veiculada nos coasters.
                      </p>
                      <Button
                        onClick={() => navigate("/cotacao/preview")}
                        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                        size="sm"
                      >
                        <Rocket className="w-4 h-4" />
                        Criar Cotação com estes valores
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Budget Selector Card */}
                <div className="bg-card/50 border border-border/30 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">
                        Custo de Produção
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Selecione um orçamento cadastrado ou use valores manuais
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Orçamento de Produção
                      </Label>
                      <Select
                        value={selectedBudgetId}
                        onValueChange={(v) => {
                          setSelectedBudgetId(v);
                          saveBudgetId(v === "manual" ? null : parseInt(v));
                        }}
                      >
                        <SelectTrigger className="bg-background/50 border-border/50 h-9 text-sm">
                          <SelectValue placeholder="Selecione um orçamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">
                            Manual (Batch Size / Custo)
                          </SelectItem>
                          {budgetsList.map((b) => (
                            <SelectItem key={b.id} value={String(b.id)}>
                              {b.supplierName} — {b.code || b.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          Custo Unitário Efetivo
                        </Label>
                        <div className="bg-background/50 border border-border/50 rounded-md h-9 flex items-center px-3">
                          <span className="font-mono text-sm font-semibold text-primary">
                            R$ {simulator.effectiveUnitCost.toFixed(3)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            / coaster
                          </span>
                        </div>
                      </div>
                      {selectedBudget && (
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1.5 block">
                            Qtd. Total Estimada
                          </Label>
                          <div className="bg-background/50 border border-border/50 rounded-md h-9 flex items-center px-3">
                            <span className="font-mono text-sm">
                              {totalCoasters.toLocaleString("pt-BR")} un
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedBudget && selectedBudget.items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/20">
                      <p className="text-xs text-muted-foreground mb-2">
                        Tabela de preços do orçamento{" "}
                        <span className="text-foreground font-medium">
                          {selectedBudget.code}
                        </span>{" "}
                        ({selectedBudget.supplierName}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedBudget.items.map((item, i) => {
                          const isActive =
                            totalCoasters >= item.quantity &&
                            (i === selectedBudget.items.length - 1 ||
                              totalCoasters <
                                selectedBudget.items[i + 1].quantity);
                          return (
                            <div
                              key={i}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                                isActive
                                  ? "bg-primary/20 border-primary/40 text-primary"
                                  : "bg-background/30 border-border/20 text-muted-foreground"
                              }`}
                            >
                              <span className="font-semibold">
                                {item.quantity.toLocaleString("pt-BR")}
                              </span>
                              <span className="mx-1">→</span>
                              <span>R$ {parseFloat(item.unitPrice).toFixed(3)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Restaurant Allocation */}
                <RestaurantAllocationPanel
                  restaurants={restaurantsForAllocation}
                  allocations={allocation.allocations}
                  selectedIds={allocation.selectedIds}
                  totalCoasters={totalCoasters}
                  allocatedTotal={allocation.allocatedTotal}
                  remaining={allocation.remaining}
                  isValid={allocation.isValid}
                  hasAllocations={allocation.hasAllocations}
                  weightedMultiplier={allocation.weightedMultiplier}
                  weightedScore={allocation.weightedScore}
                  onAddRestaurant={allocation.addRestaurant}
                  onRemoveRestaurant={allocation.removeRestaurant}
                  onUpdateCoasters={allocation.updateCoasters}
                  onDistributeEvenly={allocation.distributeEvenly}
                />

                {/* KPI Cards */}
                <KPICards
                  perRestaurant={simulator.perRestaurant}
                  unitEconomics={simulator.unitEconomics}
                  activeRestaurants={simulator.inputs.activeRestaurants}
                  contractDuration={simulator.inputs.contractDuration}
                  coastersPerRestaurant={simulator.inputs.coastersPerRestaurant}
                  minMargin={simulator.inputs.minMargin}
                />

                {/* DRE - Income Statement */}
                <SimulatorDRE
                  perRestaurant={simulator.perRestaurant}
                  unitEconomics={simulator.unitEconomics}
                  activeRestaurants={simulator.inputs.activeRestaurants}
                  contractDuration={simulator.inputs.contractDuration}
                  minMargin={simulator.inputs.minMargin}
                />

                {/* Management Charts */}
                <DashboardCharts
                  perRestaurant={simulator.perRestaurant}
                  unitEconomics={simulator.unitEconomics}
                  activeRestaurants={simulator.inputs.activeRestaurants}
                  cumulativeProfit={simulator.cumulativeProfit}
                  revenueVsRestaurants={simulator.revenueVsRestaurants}
                  minMargin={simulator.inputs.minMargin}
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

              <TabsContent value="scenarios" className="mt-0 space-y-6">
                <ScenarioComparison scenarios={simulator.scenarios} />
              </TabsContent>

              <TabsContent value="unit-economics" className="mt-0 space-y-6">
                <UnitEconomicsPanel
                  data={simulator.unitEconomics}
                  sellerCommission={simulator.inputs.sellerCommission}
                  contractDuration={simulator.inputs.contractDuration}
                />
              </TabsContent>

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
            </div>
          </div>
        </Tabs>
      </div>

    </div>
  );
}
