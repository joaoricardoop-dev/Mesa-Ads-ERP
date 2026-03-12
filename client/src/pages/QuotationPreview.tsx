import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useSimulator, type BudgetOption, loadSavedBudgetId } from "@/hooks/useSimulator";
import { useRestaurantAllocation, type AllocationEntry } from "@/hooks/useRestaurantAllocation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Rocket,
  Building2,
  Package,
  Store,
  Banknote,
  TrendingUp,
  Target,
  FileText,
  BarChart3,
  MapPin,
  Download,
} from "lucide-react";
import { generateProposalPdf } from "@/lib/generate-proposal-pdf";

function SummaryCard({ label, value, sub, icon, accent, warn }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`bg-card border rounded-xl p-4 transition-colors ${
      warn ? "border-red-500/30" : accent ? "border-primary/30" : "border-border/30"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
        <div className={`p-1.5 rounded-md ${
          warn ? "bg-red-500/10 text-red-400" : accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}>{icon}</div>
      </div>
      <div className={`font-mono text-xl font-bold tabular-nums tracking-tight ${
        warn ? "text-red-400" : accent ? "text-primary" : ""
      }`}>{value}</div>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function CostRow({ label, perRest, total, contract, pct, sub, bold, accent, warn, separator }: {
  label: string;
  perRest: string;
  total: string;
  contract: string;
  pct: string;
  sub?: boolean;
  bold?: boolean;
  accent?: boolean;
  warn?: boolean;
  separator?: boolean;
}) {
  const textClass = warn ? "text-red-400" : accent ? "text-emerald-400" : bold ? "text-foreground" : "text-muted-foreground";
  const fontClass = bold ? "font-semibold" : "font-normal";
  return (
    <>
      {separator && <tr><td colSpan={5} className="py-1"><div className="border-t border-border/20" /></td></tr>}
      <tr className={`text-xs ${textClass}`}>
        <td className={`py-1.5 ${sub ? "pl-4" : "pl-0"} ${fontClass}`}>{label}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{perRest}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{total}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{contract}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums text-[10px] ${textClass}`}>{pct}</td>
      </tr>
    </>
  );
}

function getTierLabel(score: number): string {
  if (score >= 4.0) return "Diamante";
  if (score >= 3.0) return "Ouro";
  if (score >= 2.0) return "Prata";
  return "Bronze";
}

function getTierColor(score: number): string {
  if (score >= 4.0) return "text-cyan-400";
  if (score >= 3.0) return "text-amber-400";
  if (score >= 2.0) return "text-gray-300";
  return "text-orange-600";
}

export default function QuotationPreview() {
  const [, navigate] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const urlClientId = urlParams.get("clientId");
  const urlLeadId = urlParams.get("leadId");
  const [selectedClientId, setSelectedClientId] = useState<string>(urlClientId || "none");
  const [selectedLeadId, setSelectedLeadId] = useState<string>(urlLeadId || "none");

  const { data: budgetsList = [] } = trpc.budget.listActiveWithItems.useQuery();
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: restaurantsList = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: leadsList = [] } = trpc.lead.list.useQuery({ type: "anunciante" });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (selectedLeadId !== "none" && leadsList.length > 0 && selectedClientId === "none") {
      const lead = leadsList.find((l: any) => l.id === parseInt(selectedLeadId));
      if (lead?.convertedToId && lead.convertedToType === "anunciante") {
        setSelectedClientId(String(lead.convertedToId));
      }
    }
  }, [selectedLeadId, leadsList]);

  const savedBudgetId = loadSavedBudgetId();
  const selectedBudget = useMemo<BudgetOption | null>(() => {
    if (savedBudgetId === null) return null;
    const found = budgetsList.find((b) => b.id === savedBudgetId);
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
        numModels: i.numModels ?? 1,
        qtyPerModel: i.qtyPerModel ?? i.quantity,
      })),
    };
  }, [savedBudgetId, budgetsList]);

  const restaurantsForAllocation = useMemo(
    () => restaurantsList.map(r => ({
      id: r.id,
      name: r.name,
      neighborhood: r.neighborhood,
      ratingScore: r.ratingScore,
      ratingMultiplier: r.ratingMultiplier,
      commissionPercent: r.commissionPercent,
      monthlyDrinksSold: r.monthlyDrinksSold,
      status: r.status,
    })),
    [restaurantsList]
  );

  const simulatorBase = useSimulator(selectedBudget);
  const totalCoasters = simulatorBase.inputs.coastersPerRestaurant * simulatorBase.inputs.activeRestaurants;

  const allocation = useRestaurantAllocation(restaurantsForAllocation, totalCoasters);

  const allocCommission = allocation.isValid ? allocation.weightedCommission : undefined;

  const simulator = useSimulator(selectedBudget, allocCommission);
  const pr = simulator.perRestaurant;
  const ue = simulator.unitEconomics;
  const inputs = simulator.inputs;
  const n = inputs.activeRestaurants;
  const d = inputs.contractDuration;

  const veiculacaoPerRest = pr.grossProfit;
  const veiculacaoTotal = pr.grossProfit * n;

  const totalProduction = pr.productionCost * n;
  const totalRestComm = pr.restaurantCommission * n;
  const totalAgencyComm = pr.agencyCommission * n;
  const totalSellerComm = pr.sellerCommissionValue * n;
  const totalTax = pr.taxValue * n;
  const totalCosts = pr.totalCosts * n;
  const revenue = pr.sellingPrice * n;
  const grossProfit = pr.grossProfit * n;
  const pctOf = (val: number) => revenue > 0 ? `${((val / revenue) * 100).toFixed(1)}%` : "—";

  const allocatedRestaurants = useMemo(() => {
    if (!allocation.hasAllocations) return [];
    return allocation.allocations
      .filter(a => a.coasters > 0)
      .map(a => {
        const rest = restaurantsForAllocation.find(r => r.id === a.restaurantId);
        const score = rest?.ratingScore ? parseFloat(rest.ratingScore) : 0;
        return {
          id: a.restaurantId,
          name: rest?.name || `#${a.restaurantId}`,
          neighborhood: rest?.neighborhood || "",
          coasters: a.coasters,
          commissionPercent: a.commissionPercent,
          ratingScore: score,
        };
      })
      .sort((a, b) => b.coasters - a.coasters);
  }, [allocation.allocations, allocation.hasAllocations, restaurantsForAllocation]);

  const createQuotationMutation = trpc.quotation.create.useMutation({
    onSuccess: () => {
      utils.quotation.list.invalidate();
      toast.success("Cotação criada com sucesso!");
      setTimeout(() => navigate("/comercial/cotacoes"), 800);
    },
    onError: (err) => toast.error(`Erro ao criar cotação: ${err.message}`),
  });

  const handleExportPdf = () => {
    if (selectedClientId === "none") { toast.error("Selecione um cliente antes de exportar"); return; }
    try {
    generateProposalPdf({
      clientName: selectedClient?.name || "Cliente",
      clientCompany: selectedClient?.company || undefined,
      clientCnpj: selectedClient?.cnpj || undefined,
      clientEmail: selectedClient?.contactEmail || undefined,
      clientPhone: selectedClient?.contactPhone || undefined,
      coasterVolume: totalCoasters,
      numRestaurants: allocatedRestaurants.length > 0 ? allocatedRestaurants.length : n,
      coastersPerRestaurant: allocatedRestaurants.length > 0 ? Math.round(totalCoasters / allocatedRestaurants.length) : inputs.coastersPerRestaurant,
      contractDuration: d,
      pricePerRestaurant: pr.sellingPrice,
      monthlyTotal: revenue,
      contractTotal: ue.contractValue,
      includesProduction: true,
      restaurants: allocatedRestaurants.map(r => ({
        name: r.name,
        neighborhood: r.neighborhood,
        coasters: r.coasters,
      })),
    });
    toast.success("PDF da proposta gerado!");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  };

  const handleCreate = () => {
    if (selectedClientId === "none" && selectedLeadId === "none") {
      toast.error("Selecione um cliente ou lead");
      return;
    }

    const totalValueCalc = pr.sellingPrice * n * d;

    createQuotationMutation.mutate({
      ...(selectedClientId !== "none" ? { clientId: parseInt(selectedClientId) } : {}),
      ...(selectedLeadId !== "none" ? { leadId: parseInt(selectedLeadId) } : {}),
      campaignType: "bolachas",
      coasterVolume: totalCoasters,
      unitPrice: String(pr.sellingPrice),
      totalValue: String(totalValueCalc),
      includesProduction: true,
      notes: selectedBudget
        ? `Orçamento: ${selectedBudget.code || selectedBudget.description} | ${n} restaurantes, ${inputs.coastersPerRestaurant} coasters/rest, markup ${inputs.pricingType === "variable" ? inputs.markupPercent + "%" : "fixo R$" + inputs.fixedPrice}, duração ${d} meses`
        : `${n} restaurantes, ${inputs.coastersPerRestaurant} coasters/rest, markup ${inputs.pricingType === "variable" ? inputs.markupPercent + "%" : "fixo R$" + inputs.fixedPrice}, duração ${d} meses`,
    });
  };

  const selectedClient = clientsList.find(c => c.id === parseInt(selectedClientId));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/comercial/simulador")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Preview da Cotação
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Revise os valores do simulador antes de criar a cotação
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/comercial/simulador")}>Voltar ao Simulador</Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExportPdf}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Proposta
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/90"
                onClick={handleCreate}
                disabled={createQuotationMutation.isPending}
              >
                <Rocket className="w-3.5 h-3.5" />
                {createQuotationMutation.isPending ? "Criando..." : "Confirmar Cotação"}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-card border border-border/30 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Dados da Cotação
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cliente (Anunciante) *</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="bg-background border-border/30 h-9 text-sm">
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione um cliente</SelectItem>
                        {clientsList.filter(c => c.status === "active").map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}{c.company ? ` (${c.company})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {clientsList.filter(c => c.status === "active").length === 0 && (
                      <p className="text-xs text-yellow-400">
                        Nenhum cliente cadastrado.{" "}
                        <button className="underline hover:text-primary" onClick={() => navigate("/clientes")}>
                          Cadastre primeiro
                        </button>
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lead (Oportunidade)</Label>
                    <Select
                      value={selectedLeadId}
                      onValueChange={(v) => {
                        setSelectedLeadId(v);
                        if (v !== "none") {
                          const lead = leadsList.find((l: any) => l.id === parseInt(v));
                          if (lead?.convertedToId && lead.convertedToType === "anunciante") {
                            setSelectedClientId(String(lead.convertedToId));
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="bg-background border-border/30 h-9 text-sm">
                        <SelectValue placeholder="Selecione um lead" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum lead</SelectItem>
                        {leadsList.map((l: any) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.name}{l.company ? ` (${l.company})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-muted-foreground">O nome da cotação será gerado automaticamente como: <span className="font-mono text-foreground/70">{`{Mês Ano} | {Anunciante} | {Volume}`}</span></p>
                </div>
              </div>

              {selectedClient && (
                <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente Selecionado</h3>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{selectedClient.name}</p>
                    {selectedClient.company && <p className="text-xs text-muted-foreground">{selectedClient.company}</p>}
                    {selectedClient.cnpj && <p className="text-xs text-muted-foreground font-mono">{selectedClient.cnpj}</p>}
                    {selectedClient.contactEmail && <p className="text-xs text-muted-foreground">{selectedClient.contactEmail}</p>}
                    {selectedClient.contactPhone && <p className="text-xs text-muted-foreground">{selectedClient.contactPhone}</p>}
                  </div>
                </div>
              )}

              {selectedBudget && (
                <div className="bg-card border border-amber-500/30 rounded-xl p-5 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> Orçamento Vinculado
                  </h3>
                  <p className="text-sm font-medium">{selectedBudget.supplierName}</p>
                  <p className="text-xs text-muted-foreground">{selectedBudget.code || selectedBudget.description}</p>
                  <p className="text-xs font-mono text-amber-400">
                    Custo unitário: R$ {simulator.effectiveUnitCost.toFixed(4)}
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="Receita Mensal" value={formatCurrency(ue.monthlyRevenue)} sub={`${formatCurrency(pr.sellingPrice)} × ${n} rest.`} icon={<Banknote className="w-3.5 h-3.5" />} accent />
                <SummaryCard label="Lucro Mensal" value={formatCurrency(ue.monthlyProfit)} sub={`${formatCurrency(pr.grossProfit)} / rest.`} icon={<TrendingUp className="w-3.5 h-3.5" />} accent={ue.monthlyProfit > 0} warn={ue.monthlyProfit <= 0} />
                <SummaryCard label="Margem" value={formatPercent(pr.grossMargin)} sub={pr.grossMargin >= inputs.minMargin ? "Saudável" : "Abaixo do mínimo"} icon={<Target className="w-3.5 h-3.5" />} accent={pr.grossMargin >= inputs.minMargin} warn={pr.grossMargin < inputs.minMargin} />
                <SummaryCard label="Valor do Contrato" value={formatCurrency(ue.contractValue)} sub={`${d} meses · Lucro: ${formatCurrency(ue.contractProfit)}`} icon={<BarChart3 className="w-3.5 h-3.5" />} accent />
              </div>

              <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border/20">
                  <h3 className="text-sm font-semibold">Orçamento da Cotação</h3>
                  <p className="text-[10px] text-muted-foreground">Composição do preço — {n} restaurantes, {d} meses</p>
                </div>
                <div className="px-5 py-3 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                        <th className="text-left pb-2 font-medium">Componente</th>
                        <th className="text-right pb-2 font-medium">/ Rest.</th>
                        <th className="text-right pb-2 font-medium">Total / Mês</th>
                        <th className="text-right pb-2 font-medium">Contrato ({d}m)</th>
                        <th className="text-right pb-2 font-medium">% Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CostRow
                        label="Receita de Veiculação"
                        perRest={formatCurrency(veiculacaoPerRest)}
                        total={formatCurrency(veiculacaoTotal)}
                        contract={formatCurrency(veiculacaoTotal * d)}
                        pct={pctOf(veiculacaoTotal)}
                        bold
                        accent={veiculacaoPerRest > 0}
                        warn={veiculacaoPerRest <= 0}
                      />

                      <CostRow label="" perRest="" total="" contract="" pct="" separator />

                      <CostRow label="Receita de Produção" perRest={formatCurrency(pr.productionCost)} total={formatCurrency(totalProduction)} contract={formatCurrency(totalProduction * d)} pct={pctOf(totalProduction)} sub />
                      <CostRow label="Receita de Comissão Restaurante" perRest={formatCurrency(pr.restaurantCommission)} total={formatCurrency(totalRestComm)} contract={formatCurrency(totalRestComm * d)} pct={pctOf(totalRestComm)} sub />
                      <CostRow label="Receita de Comissão Agência" perRest={formatCurrency(pr.agencyCommission)} total={formatCurrency(totalAgencyComm)} contract={formatCurrency(totalAgencyComm * d)} pct={pctOf(totalAgencyComm)} sub />
                      <CostRow label="Receita de Comissão Vendedor" perRest={formatCurrency(pr.sellerCommissionValue)} total={formatCurrency(totalSellerComm)} contract={formatCurrency(totalSellerComm * d)} pct={pctOf(totalSellerComm)} sub />
                      <CostRow label="Impostos" perRest={formatCurrency(pr.taxValue)} total={formatCurrency(totalTax)} contract={formatCurrency(totalTax * d)} pct={pctOf(totalTax)} sub />

                      <CostRow label="Preço Total (cobrado do cliente)" perRest={formatCurrency(pr.sellingPrice)} total={formatCurrency(revenue)} contract={formatCurrency(revenue * d)} pct="100,0%" bold separator />

                      <CostRow label="Margem Mesa Ads" perRest={formatCurrency(pr.grossProfit)} total={formatCurrency(grossProfit)} contract={formatCurrency(grossProfit * d)} pct={formatPercent(pr.grossMargin)} bold accent={pr.grossProfit > 0} warn={pr.grossProfit <= 0} separator />
                    </tbody>
                  </table>
                </div>

                <div className="px-5 py-3 border-t border-border/20 bg-card/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Veiculação (contrato)</p>
                      <p className={`font-mono font-bold text-sm ${veiculacaoTotal > 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(veiculacaoTotal * d)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Repasses (contrato)</p>
                      <p className="font-mono font-bold text-sm">{formatCurrency(totalCosts * d)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita Total</p>
                      <p className="font-mono font-bold text-sm text-primary">{formatCurrency(revenue * d)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Margem Contrato</p>
                      <p className={`font-mono font-bold text-sm ${ue.contractProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatCurrency(ue.contractProfit)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {allocatedRestaurants.length > 0 && (
                <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-border/20 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary" />
                        Restaurantes Alocados
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        {allocatedRestaurants.length} restaurantes · {formatNumber(allocation.allocatedTotal)} coasters alocados
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score Ponderado</p>
                        <p className="font-mono text-sm font-bold">{allocation.weightedScore.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                          <th className="text-left px-5 py-2 font-medium">Restaurante</th>
                          <th className="text-left px-3 py-2 font-medium">Bairro</th>
                          <th className="text-right px-3 py-2 font-medium">Coasters</th>
                          <th className="text-right px-3 py-2 font-medium">Rating</th>
                          <th className="text-right px-3 py-2 font-medium">Com. %</th>
                          <th className="text-right px-5 py-2 font-medium">% Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocatedRestaurants.map((r) => (
                          <tr key={r.id} className="text-xs border-b border-border/10 hover:bg-muted/30">
                            <td className="px-5 py-2 font-medium">{r.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {r.neighborhood || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">{r.coasters.toLocaleString("pt-BR")}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`font-mono font-semibold ${getTierColor(r.ratingScore)}`}>
                                {r.ratingScore > 0 ? r.ratingScore.toFixed(2) : "—"}
                              </span>
                              {r.ratingScore > 0 && (
                                <span className={`text-[9px] ml-1 ${getTierColor(r.ratingScore)}`}>
                                  {getTierLabel(r.ratingScore)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums">{r.commissionPercent}%</td>
                            <td className="px-5 py-2 text-right font-mono tabular-nums text-muted-foreground">
                              {allocation.allocatedTotal > 0 ? ((r.coasters / allocation.allocatedTotal) * 100).toFixed(1) : "0"}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="text-xs font-semibold border-t border-border/30 bg-muted/20">
                          <td className="px-5 py-2">Total</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{allocation.allocatedTotal.toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{allocation.weightedScore.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{allocation.weightedCommission.toFixed(1)}%</td>
                          <td className="px-5 py-2 text-right font-mono tabular-nums">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-card border border-border/30 rounded-xl p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-primary" /> Parâmetros Operacionais
                </h3>
                <div className="grid grid-cols-2 gap-x-8">
                  <ParamRow label="Coasters/Restaurante" value={formatNumber(inputs.coastersPerRestaurant)} />
                  <ParamRow label="Restaurantes" value={String(n)} />
                  <ParamRow label="Uso Médio/Dia" value={`${inputs.usagePerDay}x`} />
                  <ParamRow label="Dias/Mês" value={String(inputs.daysPerMonth)} />
                  <ParamRow label="Impressões/Rest./Mês" value={formatNumber(pr.impressions)} />
                  <ParamRow label="Total Coasters" value={formatNumber(totalCoasters)} />
                  <ParamRow label={inputs.pricingType === "variable" ? "Markup" : "Preço Fixo"} value={inputs.pricingType === "variable" ? `${inputs.markupPercent}%` : formatCurrency(inputs.fixedPrice)} />
                  <ParamRow label="Duração" value={`${d} meses`} />
                  <ParamRow label={inputs.commissionType === "variable" ? "Com. Agência (%)" : "Com. Agência (R$/un)"} value={inputs.commissionType === "variable" ? `${inputs.restaurantCommission}%` : `R$ ${inputs.fixedCommission.toFixed(4)}`} />
                  <ParamRow label="Com. Vendedor" value={`${inputs.sellerCommission}%`} />
                  <ParamRow label="Impostos" value={`${inputs.taxRate}%`} />
                  <ParamRow label="Custo Unitário" value={`R$ ${simulator.effectiveUnitCost.toFixed(4)}`} />
                  {allocation.hasAllocations && (
                    <ParamRow label="Com. Rest. Ponderada" value={`${allocation.weightedCommission.toFixed(1)}%`} />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pb-6">
            <Button variant="outline" onClick={() => navigate("/comercial/simulador")}>Voltar ao Simulador</Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 px-6"
              onClick={handleCreate}
              disabled={createQuotationMutation.isPending}
            >
              <Rocket className="w-4 h-4" />
              {createQuotationMutation.isPending ? "Criando..." : "Confirmar e Criar Cotação"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
