import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useSimulator, type BudgetOption, loadSavedBudgetId } from "@/hooks/useSimulator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Calendar,
  FileText,
  ShieldCheck,
  Eye,
  Percent,
  DollarSign,
  BarChart3,
} from "lucide-react";

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

function CostRow({ label, perRest, total, contract, pct, sub, bold, accent, warn }: {
  label: string;
  perRest: string;
  total: string;
  contract: string;
  pct: string;
  sub?: boolean;
  bold?: boolean;
  accent?: boolean;
  warn?: boolean;
}) {
  const textClass = warn ? "text-red-400" : accent ? "text-emerald-400" : bold ? "text-foreground" : "text-muted-foreground";
  const fontClass = bold ? "font-semibold" : "font-normal";
  return (
    <tr className={`text-xs ${textClass}`}>
      <td className={`py-1.5 ${sub ? "pl-4" : "pl-0"} ${fontClass}`}>{label}</td>
      <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{perRest}</td>
      <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{total}</td>
      <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{contract}</td>
      <td className={`py-1.5 text-right font-mono tabular-nums text-[10px] ${textClass}`}>{pct}</td>
    </tr>
  );
}

export default function QuotationPreview() {
  const [, navigate] = useLocation();
  const [selectedClientId, setSelectedClientId] = useState<string>("none");
  const [campaignStartDate, setCampaignStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [campaignEndDate, setCampaignEndDate] = useState("");

  const { data: budgetsList = [] } = trpc.budget.listActiveWithItems.useQuery();
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const utils = trpc.useUtils();

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
      })),
    };
  }, [savedBudgetId, budgetsList]);

  const simulator = useSimulator(selectedBudget);
  const pr = simulator.perRestaurant;
  const ue = simulator.unitEconomics;
  const inputs = simulator.inputs;
  const n = inputs.activeRestaurants;
  const d = inputs.contractDuration;

  const totalProduction = pr.productionCost * n;
  const totalRestComm = pr.restaurantCommission * n;
  const totalSellerComm = pr.sellerCommissionValue * n;
  const totalTax = pr.taxValue * n;
  const totalCosts = pr.totalCosts * n;
  const revenue = pr.sellingPrice * n;
  const grossProfit = pr.grossProfit * n;
  const pctOf = (val: number) => revenue > 0 ? `${((val / revenue) * 100).toFixed(1)}%` : "—";

  const defaultName = `Cotação Markup ${inputs.pricingType === "variable" ? inputs.markupPercent + "%" : "Fixo R$" + inputs.fixedPrice}`;
  const [campaignName, setCampaignName] = useState(defaultName);

  const computedEndDate = useMemo(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + d);
    return end.toISOString().split("T")[0];
  }, [d]);

  const effectiveEndDate = campaignEndDate || computedEndDate;

  const addHistoryMutation = trpc.campaign.addHistory.useMutation();

  const createCampaignMutation = trpc.campaign.create.useMutation({
    onSuccess: (data) => {
      const campaignId = (data as any).id ?? (data as any)[0]?.id;
      if (campaignId) {
        addHistoryMutation.mutate({
          campaignId,
          action: "created",
          details: `Cotação criada a partir do simulador — ${inputs.pricingType === "variable" ? `Markup ${inputs.markupPercent}%` : `Fixo R$${inputs.fixedPrice}`}, ${n} restaurantes`,
        });
      }
      utils.campaign.list.invalidate();
      toast.success("Cotação criada com sucesso!");
      if (campaignId) {
        setTimeout(() => navigate(`/campanhas/${campaignId}`), 800);
      } else {
        setTimeout(() => navigate("/campanhas"), 800);
      }
    },
    onError: (err) => toast.error(`Erro ao criar cotação: ${err.message}`),
  });

  const handleCreate = () => {
    if (!campaignName.trim()) { toast.error("Nome da cotação é obrigatório"); return; }
    if (selectedClientId === "none") { toast.error("Selecione um cliente"); return; }
    if (!campaignStartDate || !effectiveEndDate) { toast.error("Datas são obrigatórias"); return; }

    createCampaignMutation.mutate({
      clientId: parseInt(selectedClientId),
      name: campaignName,
      startDate: campaignStartDate,
      endDate: effectiveEndDate,
      status: "quotation",
      notes: selectedBudget ? `Orçamento: ${selectedBudget.code || selectedBudget.description}` : "",
      coastersPerRestaurant: inputs.coastersPerRestaurant,
      usagePerDay: inputs.usagePerDay,
      daysPerMonth: inputs.daysPerMonth,
      activeRestaurants: n,
      pricingType: inputs.pricingType,
      markupPercent: String(inputs.markupPercent),
      fixedPrice: String(inputs.fixedPrice),
      commissionType: inputs.commissionType,
      restaurantCommission: String(inputs.restaurantCommission),
      fixedCommission: String(inputs.fixedCommission),
      sellerCommission: String(inputs.sellerCommission),
      taxRate: String(inputs.taxRate),
      contractDuration: d,
      batchSize: inputs.batchSize,
      batchCost: String(inputs.batchCost),
      budgetId: selectedBudget?.id ?? null,
    });
  };

  const selectedClient = clientsList.find(c => c.id === parseInt(selectedClientId));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/")}>
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
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>Voltar ao Simulador</Button>
              <Button
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/90"
                onClick={handleCreate}
                disabled={createCampaignMutation.isPending}
              >
                <Rocket className="w-3.5 h-3.5" />
                {createCampaignMutation.isPending ? "Criando..." : "Confirmar Cotação"}
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
                    <Label className="text-xs">Nome da Cotação *</Label>
                    <Input
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Ex: Cotação Verão 2026"
                      className="bg-background border-border/30 h-9 text-sm"
                    />
                  </div>
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data Início *</Label>
                      <Input type="date" value={campaignStartDate} onChange={e => setCampaignStartDate(e.target.value)} className="bg-background border-border/30 h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data Fim *</Label>
                      <Input type="date" value={effectiveEndDate} onChange={e => setCampaignEndDate(e.target.value)} className="bg-background border-border/30 h-9 text-sm" />
                    </div>
                  </div>
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
                    Custo unitário: R$ {simulator.effectiveUnitCost.toFixed(3)}
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
                  <h3 className="text-sm font-semibold">DRE da Cotação</h3>
                  <p className="text-[10px] text-muted-foreground">Demonstrativo de Resultado — {n} restaurantes, {d} meses</p>
                </div>
                <div className="px-5 py-3 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
                        <th className="text-left pb-2 font-medium">Item</th>
                        <th className="text-right pb-2 font-medium">/ Rest.</th>
                        <th className="text-right pb-2 font-medium">Total / Mês</th>
                        <th className="text-right pb-2 font-medium">Contrato ({d}m)</th>
                        <th className="text-right pb-2 font-medium">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CostRow label="Receita Bruta" perRest={formatCurrency(pr.sellingPrice)} total={formatCurrency(revenue)} contract={formatCurrency(revenue * d)} pct="100%" bold />
                      <tr><td colSpan={5} className="py-1"><div className="border-t border-border/20" /></td></tr>
                      <CostRow label="(-) Produção" perRest={formatCurrency(pr.productionCost)} total={formatCurrency(totalProduction)} contract={formatCurrency(totalProduction * d)} pct={pctOf(totalProduction)} sub />
                      <CostRow label="(-) Com. Restaurante" perRest={formatCurrency(pr.restaurantCommission)} total={formatCurrency(totalRestComm)} contract={formatCurrency(totalRestComm * d)} pct={pctOf(totalRestComm)} sub />
                      <CostRow label="(-) Com. Vendedor" perRest={formatCurrency(pr.sellerCommissionValue)} total={formatCurrency(totalSellerComm)} contract={formatCurrency(totalSellerComm * d)} pct={pctOf(totalSellerComm)} sub />
                      <CostRow label="(-) Impostos" perRest={formatCurrency(pr.taxValue)} total={formatCurrency(totalTax)} contract={formatCurrency(totalTax * d)} pct={pctOf(totalTax)} sub />
                      <tr><td colSpan={5} className="py-1"><div className="border-t border-border/20" /></td></tr>
                      <CostRow label="Total Custos" perRest={formatCurrency(pr.totalCosts)} total={formatCurrency(totalCosts)} contract={formatCurrency(totalCosts * d)} pct={pctOf(totalCosts)} bold warn={pr.grossMargin < inputs.minMargin} />
                      <tr><td colSpan={5} className="py-1"><div className="border-t border-border/20" /></td></tr>
                      <CostRow label="Lucro Líquido" perRest={formatCurrency(pr.grossProfit)} total={formatCurrency(grossProfit)} contract={formatCurrency(grossProfit * d)} pct={formatPercent(pr.grossMargin)} bold accent={pr.grossProfit > 0} warn={pr.grossProfit <= 0} />
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo Produção</p>
                  <p className="font-mono font-bold text-sm mt-1">{formatCurrency(totalProduction * d)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(totalProduction)}/mês</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Com. Restaurante</p>
                  <p className="font-mono font-bold text-sm mt-1">{formatCurrency(totalRestComm * d)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(totalRestComm)}/mês</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Com. Vendedor</p>
                  <p className="font-mono font-bold text-sm mt-1">{formatCurrency(totalSellerComm * d)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(totalSellerComm)}/mês</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Impostos</p>
                  <p className="font-mono font-bold text-sm mt-1">{formatCurrency(totalTax * d)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(totalTax)}/mês</p>
                </div>
              </div>

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
                  <ParamRow label="Total Coasters" value={formatNumber(inputs.coastersPerRestaurant * n)} />
                  <ParamRow label={inputs.pricingType === "variable" ? "Markup" : "Preço Fixo"} value={inputs.pricingType === "variable" ? `${inputs.markupPercent}%` : formatCurrency(inputs.fixedPrice)} />
                  <ParamRow label="Duração" value={`${d} meses`} />
                  <ParamRow label={inputs.commissionType === "variable" ? "Com. Rest. (%)" : "Com. Rest. (R$/un)"} value={inputs.commissionType === "variable" ? `${inputs.restaurantCommission}%` : `R$ ${inputs.fixedCommission.toFixed(4)}`} />
                  <ParamRow label="Com. Vendedor" value={`${inputs.sellerCommission}%`} />
                  <ParamRow label="Impostos" value={`${inputs.taxRate}%`} />
                  <ParamRow label="Custo Unitário" value={`R$ ${simulator.effectiveUnitCost.toFixed(3)}`} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pb-6">
            <Button variant="outline" onClick={() => navigate("/")}>Voltar ao Simulador</Button>
            <Button
              className="gap-2 bg-primary hover:bg-primary/90 px-6"
              onClick={handleCreate}
              disabled={createCampaignMutation.isPending}
            >
              <Rocket className="w-4 h-4" />
              {createCampaignMutation.isPending ? "Criando..." : "Confirmar e Criar Cotação"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
