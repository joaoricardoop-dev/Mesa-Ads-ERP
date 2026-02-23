/*
 * Design: Bloomberg Terminal Reimaginado
 * Layout: Sidebar fixa à esquerda (inputs) + Área principal com grid de dados
 * Fundo dark slate, acentos emerald, tipografia DM Sans + JetBrains Mono
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useSimulator, type BudgetOption } from "@/hooks/useSimulator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import MarkupTable from "@/components/CPMTable";
import DiscountTable from "@/components/DiscountTable";
import ScenarioComparison from "@/components/ScenarioComparison";
import DashboardCharts from "@/components/DashboardCharts";
import UnitEconomicsPanel from "@/components/UnitEconomicsPanel";
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
  Megaphone,
  Store,
  Building2,
  DollarSign,
  Rocket,
  Info,
  Factory,
  FileText,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";


export default function Home() {
  // ─── Budget selection state ────────────────────────────────────────
  const { theme, toggleTheme } = useTheme();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("manual");
  const { data: budgetsList = [] } = trpc.budget.listActiveWithItems.useQuery();

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
  const [isCampaignDialogOpen, setIsCampaignDialogOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [campaignStartDate, setCampaignStartDate] = useState("");
  const [campaignEndDate, setCampaignEndDate] = useState("");

  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const utils = trpc.useUtils();

  const createCampaignMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setIsCampaignDialogOpen(false);
      toast.success("Campanha criada com sucesso! Redirecionando...");
      setTimeout(() => navigate("/campanhas"), 1000);
    },
    onError: (err) => toast.error(`Erro ao criar campanha: ${err.message}`),
  });

  const handleOpenCampaignDialog = () => {
    setCampaignName(`Campanha Markup ${simulator.inputs.pricingType === "variable" ? simulator.inputs.markupPercent + "%" : "Fixo R$" + simulator.inputs.fixedPrice}`);
    setSelectedClientId("none");
    const today = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + simulator.inputs.contractDuration);
    setCampaignStartDate(today.toISOString().split("T")[0]);
    setCampaignEndDate(endDate.toISOString().split("T")[0]);
    setIsCampaignDialogOpen(true);
  };

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) {
      toast.error("Nome da campanha é obrigatório");
      return;
    }
    if (selectedClientId === "none") {
      toast.error("Selecione um cliente");
      return;
    }
    if (!campaignStartDate || !campaignEndDate) {
      toast.error("Datas são obrigatórias");
      return;
    }
    createCampaignMutation.mutate({
      clientId: parseInt(selectedClientId),
      name: campaignName,
      cpm: "0.00",
      startDate: campaignStartDate,
      endDate: campaignEndDate,
      status: "draft",
      notes: `Criada a partir do simulador. Coasters/rest: ${simulator.inputs.coastersPerRestaurant}, Uso/dia: ${simulator.inputs.usagePerDay}, Markup: ${simulator.inputs.pricingType === "variable" ? simulator.inputs.markupPercent + "%" : "Fixo R$" + simulator.inputs.fixedPrice}, Comissão rest: ${simulator.inputs.commissionType === "variable" ? simulator.inputs.restaurantCommission + "%" : "Fixo R$" + simulator.inputs.fixedCommission}, Margem projetada: ${simulator.perRestaurant.grossMargin.toFixed(1)}%, Custo unit. produção: R$ ${simulator.effectiveUnitCost.toFixed(3)}${selectedBudget ? ` (Orçamento: ${selectedBudget.code || selectedBudget.description})` : " (Manual)"}`,
    });
  };

  // Total coasters for budget interpolation info
  const totalCoasters =
    simulator.inputs.coastersPerRestaurant * simulator.inputs.activeRestaurants;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[300px] xl:w-[320px] flex-shrink-0 border-r border-border/30 bg-sidebar flex-col h-screen">
        <ScrollArea className="h-full">
          <InputPanel
            inputs={simulator.inputs}
            updateInput={simulator.updateInput}
          />
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar - Fixed */}
        <header className="border-b border-border/30 bg-card/50 backdrop-blur-sm flex-shrink-0 z-10">
          <div className="flex items-center justify-between px-4 lg:px-6 h-14">
            <div className="flex items-center gap-3">
              {/* Mobile sidebar trigger */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden h-8 w-8 border-border/40"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[320px] p-0 bg-sidebar">
                  <ScrollArea className="h-full">
                    <InputPanel
                      inputs={simulator.inputs}
                      updateInput={simulator.updateInput}
                    />
                  </ScrollArea>
                </SheetContent>
              </Sheet>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Megaphone className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-sm font-bold tracking-tight">
                    Mesa Ads
                  </h1>
                  <p className="text-[10px] text-muted-foreground">
                    Plataforma de Gestão
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation links */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-primary"
                onClick={() => navigate("/")}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Simulador</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate("/restaurantes")}
              >
                <Store className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Restaurantes</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate("/clientes")}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Clientes</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate("/campanhas")}
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Campanhas</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate("/economics")}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Economics</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate("/producao")}
              >
                <Factory className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Produção</span>
              </Button>

              <div className="w-px h-5 bg-border/50 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0"
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </header>

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
                <div className="relative rounded-xl overflow-hidden h-32 md:h-36 bg-gradient-to-r from-primary/20 via-primary/10 to-card border border-border/30">
                  <div className="absolute inset-0 flex items-center p-6 md:p-8">
                    <div className="flex-1">
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-1">
                        Simulador Financeiro
                      </h2>
                      <p className="text-sm text-muted-foreground max-w-md mb-3">
                        Faturamento e lucro da Mesa Ads. Restaurantes parceiros
                        recebem comissão sobre a mídia veiculada nos coasters.
                      </p>
                      <Button
                        onClick={handleOpenCampaignDialog}
                        className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                        size="sm"
                      >
                        <Rocket className="w-4 h-4" />
                        Criar Campanha com estes valores
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
                        onValueChange={setSelectedBudgetId}
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

                {/* KPI Cards */}
                <KPICards
                  perRestaurant={simulator.perRestaurant}
                  unitEconomics={simulator.unitEconomics}
                  activeRestaurants={simulator.inputs.activeRestaurants}
                />

                {/* Quick Charts */}
                <DashboardCharts
                  revenueVsRestaurants={simulator.revenueVsRestaurants}
                  marginVsMarkup={simulator.marginVsMarkup}
                  cumulativeProfit={simulator.cumulativeProfit}
                  discountSensitivity={simulator.discountSensitivity}
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
                  cacPerRestaurant={simulator.inputs.cacPerRestaurant}
                  contractDuration={simulator.inputs.contractDuration}
                />
              </TabsContent>

              <TabsContent value="charts" className="mt-0 space-y-6">
                <DashboardCharts
                  revenueVsRestaurants={simulator.revenueVsRestaurants}
                  marginVsMarkup={simulator.marginVsMarkup}
                  cumulativeProfit={simulator.cumulativeProfit}
                  discountSensitivity={simulator.discountSensitivity}
                  minMargin={simulator.inputs.minMargin}
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Create Campaign from Simulator Dialog */}
      <Dialog open={isCampaignDialogOpen} onOpenChange={setIsCampaignDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Criar Campanha a partir do Simulador
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Os valores do simulador serão usados como base para a nova campanha.
            </DialogDescription>
          </DialogHeader>

          {/* Summary of simulator values */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                Valores do Simulador
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Markup:</span>
                <span className="font-mono font-medium text-primary">
                  {simulator.inputs.pricingType === "variable" ? `${simulator.inputs.markupPercent}%` : `Fixo R$ ${simulator.inputs.fixedPrice.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coasters/rest:</span>
                <span className="font-mono font-medium">
                  {simulator.inputs.coastersPerRestaurant}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receita/rest:</span>
                <span className="font-mono font-medium text-primary">
                  {formatCurrency(simulator.perRestaurant.revenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lucro/rest:</span>
                <span className="font-mono font-medium text-primary">
                  {formatCurrency(simulator.perRestaurant.grossProfit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Margem:</span>
                <span className="font-mono font-medium">
                  {simulator.perRestaurant.grossMargin.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo/coaster:</span>
                <span className="font-mono font-medium text-amber-400">
                  R$ {simulator.effectiveUnitCost.toFixed(3)}
                </span>
              </div>
            </div>
            {selectedBudget && (
              <div className="pt-2 border-t border-primary/10 mt-2">
                <span className="text-xs text-muted-foreground">
                  Orçamento:{" "}
                  <span className="text-foreground font-medium">
                    {selectedBudget.supplierName} — {selectedBudget.code}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome da Campanha *</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Ex: Campanha Verão 2026"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid gap-2">
              <Label>Cliente (Anunciante) *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="bg-background border-border/30">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione um cliente</SelectItem>
                  {clientsList
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                        {c.company ? ` (${c.company})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {clientsList.filter((c) => c.status === "active").length === 0 && (
                <p className="text-xs text-yellow-400">
                  Nenhum cliente cadastrado.{" "}
                  <button
                    className="underline hover:text-primary transition-colors"
                    onClick={() => {
                      setIsCampaignDialogOpen(false);
                      navigate("/clientes");
                    }}
                  >
                    Cadastre um cliente primeiro
                  </button>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={campaignStartDate}
                  onChange={(e) => setCampaignStartDate(e.target.value)}
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Data Fim *</Label>
                <Input
                  type="date"
                  value={campaignEndDate}
                  onChange={(e) => setCampaignEndDate(e.target.value)}
                  className="bg-background border-border/30"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCampaignDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={createCampaignMutation.isPending}
              className="gap-2"
            >
              <Rocket className="w-4 h-4" />
              {createCampaignMutation.isPending
                ? "Criando..."
                : "Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
