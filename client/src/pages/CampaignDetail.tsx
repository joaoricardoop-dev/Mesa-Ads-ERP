import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import AppNav from "@/components/AppNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft,
  CheckCircle2,
  Archive,
  Pause,
  Play,
  BarChart3,
  Building2,
  Store,
  Clock,
  Calendar,
  Package,
  Target,
  DollarSign,
  TrendingUp,
  FileText,
  Percent,
  Users,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Hash,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  quotation: "Cotação",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  archived: "Arquivada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  quotation: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  active: "bg-primary/20 text-primary border-primary/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const HISTORY_LABELS: Record<string, string> = {
  created: "Cotação criada",
  approved: "Cotação aprovada",
  archived: "Cotação arquivada",
  paused: "Campanha pausada",
  resumed: "Campanha retomada",
  completed: "Campanha concluída",
  reactivated: "Campanha reativada",
  updated: "Campanha atualizada",
  restaurants_updated: "Restaurantes atualizados",
};

function calcCampaignPricing(c: {
  coastersPerRestaurant: number;
  usagePerDay: number;
  daysPerMonth: number;
  activeRestaurants: number;
  pricingType: string;
  markupPercent: string | number;
  fixedPrice: string | number;
  commissionType: string;
  restaurantCommission: string | number;
  fixedCommission: string | number;
  sellerCommission: string | number;
  taxRate: string | number;
  contractDuration: number;
  batchSize: number;
  batchCost: string | number;
}) {
  const coasters = c.coastersPerRestaurant;
  const unitCost = Number(c.batchCost) / c.batchSize;
  const productionCost = coasters * unitCost;
  const impressions = coasters * c.usagePerDay * c.daysPerMonth;
  const markupPct = Number(c.markupPercent);
  const sellerRate = Number(c.sellerCommission) / 100;
  const taxRateDecimal = Number(c.taxRate) / 100;

  const restCommFixed = c.commissionType === "fixed" ? Number(c.fixedCommission) * coasters : 0;
  const custoPD = productionCost + restCommFixed;
  const restVarRate = c.commissionType === "variable" ? Number(c.restaurantCommission) / 100 : 0;
  const totalVarRate = sellerRate + taxRateDecimal + restVarRate;
  const denominator = 1 - totalVarRate;
  const custoBruto = denominator > 0 ? custoPD / denominator : custoPD;

  let sellingPrice: number;
  if (c.pricingType === "fixed") {
    sellingPrice = custoBruto + Number(c.fixedPrice);
  } else {
    sellingPrice = custoBruto * (1 + markupPct / 100);
  }

  const actualRestCommission = c.commissionType === "fixed"
    ? Number(c.fixedCommission) * coasters
    : sellingPrice * (Number(c.restaurantCommission) / 100);
  const actualSellerComm = sellingPrice * sellerRate;
  const actualTax = sellingPrice * taxRateDecimal;
  const totalCosts = productionCost + actualRestCommission + actualSellerComm + actualTax;
  const markupValue = sellingPrice - totalCosts;
  const grossMargin = sellingPrice > 0 ? (markupValue / sellingPrice) * 100 : 0;

  const contractTotal = sellingPrice * c.activeRestaurants * c.contractDuration;
  const contractProfit = markupValue * c.activeRestaurants * c.contractDuration;
  const monthlyRevenue = sellingPrice * c.activeRestaurants;
  const monthlyProfit = markupValue * c.activeRestaurants;

  return {
    impressions, productionCost, unitCost, custoPD, custoBruto, sellingPrice,
    totalCosts, markupValue, grossMargin, actualRestCommission, actualSellerComm,
    actualTax, contractTotal, contractProfit, monthlyRevenue, monthlyProfit,
  };
}

interface RestaurantSelection {
  restaurantId: number;
  coastersCount: number;
  usagePerDay: number;
  selected: boolean;
  name: string;
}

export default function CampaignDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/campanhas/:id");
  const campaignId = match ? parseInt(params!.id) : 0;

  const [isRestaurantsDialogOpen, setIsRestaurantsDialogOpen] = useState(false);
  const [restaurantSelections, setRestaurantSelections] = useState<RestaurantSelection[]>([]);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: campaign, isLoading } = trpc.campaign.get.useQuery({ id: campaignId }, { enabled: campaignId > 0 });
  const { data: campaignRestaurants = [] } = trpc.campaign.getRestaurants.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: historyList = [] } = trpc.campaign.getHistory.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: restaurantsList = [] } = trpc.restaurant.list.useQuery();

  const approveMutation = trpc.campaign.approve.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Cotação aprovada! Campanha ativada.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const archiveMutation = trpc.campaign.archive.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Cotação arquivada.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addHistoryMutation = trpc.campaign.addHistory.useMutation({
    onSuccess: () => utils.campaign.getHistory.invalidate(),
  });

  const setRestaurantsMutation = trpc.campaign.setRestaurants.useMutation({
    onSuccess: () => {
      utils.campaign.getRestaurants.invalidate();
      setIsRestaurantsDialogOpen(false);
      addHistoryMutation.mutate({ campaignId, action: "restaurants_updated", details: `${restaurantSelections.filter(r => r.selected).length} restaurantes configurados` });
      toast.success("Restaurantes atualizados!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleStatusAction = (action: string) => {
    if (action === "approve") {
      approveMutation.mutate({ id: campaignId });
    } else if (action === "archive") {
      archiveMutation.mutate({ id: campaignId });
    } else if (action === "pause") {
      updateMutation.mutate({ id: campaignId, status: "paused" });
      addHistoryMutation.mutate({ campaignId, action: "paused", details: "Campanha pausada" });
      toast.success("Campanha pausada.");
    } else if (action === "resume") {
      updateMutation.mutate({ id: campaignId, status: "active" });
      addHistoryMutation.mutate({ campaignId, action: "resumed", details: "Campanha retomada" });
      toast.success("Campanha retomada.");
    } else if (action === "complete") {
      updateMutation.mutate({ id: campaignId, status: "completed" });
      addHistoryMutation.mutate({ campaignId, action: "completed", details: "Campanha concluída" });
      toast.success("Campanha concluída.");
    } else if (action === "reactivate") {
      updateMutation.mutate({ id: campaignId, status: "active" });
      addHistoryMutation.mutate({ campaignId, action: "reactivated", details: "Campanha reativada" });
      toast.success("Campanha reativada.");
    }
    setConfirmAction(null);
  };

  const handleManageRestaurants = () => {
    const existing = campaignRestaurants || [];
    const selections: RestaurantSelection[] = restaurantsList
      .filter((r) => r.status === "active")
      .map((r) => {
        const linked = existing.find((cr) => cr.restaurantId === r.id);
        return {
          restaurantId: r.id,
          name: r.name,
          coastersCount: linked ? linked.coastersCount : r.coastersAllocated,
          usagePerDay: linked ? linked.usagePerDay : 5,
          selected: !!linked,
        };
      });
    setRestaurantSelections(selections);
    setIsRestaurantsDialogOpen(true);
  };

  const handleSaveRestaurants = () => {
    const selected = restaurantSelections
      .filter((r) => r.selected)
      .map((r) => ({ restaurantId: r.restaurantId, coastersCount: r.coastersCount, usagePerDay: r.usagePerDay }));
    setRestaurantsMutation.mutate({ campaignId, restaurants: selected });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppNav />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <AppNav />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Campanha não encontrada</p>
          <Button variant="outline" onClick={() => navigate("/campanhas")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const pricing = calcCampaignPricing(campaign);
  const client = clientsList.find((cl) => cl.id === campaign.clientId);
  const totalCoastersDistributed = campaignRestaurants.reduce((sum, r) => sum + r.coastersCount, 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/campanhas")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">{campaign.name}</h1>
                <Badge variant="outline" className={STATUS_COLORS[campaign.status] || ""}>
                  {STATUS_LABELS[campaign.status] || campaign.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {client?.name || "—"} {client?.company ? `· ${client.company}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {campaign.status === "quotation" && (
              <>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmAction("approve")}>
                  <CheckCircle2 className="w-4 h-4" /> Aprovar Cotação
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setConfirmAction("archive")}>
                  <Archive className="w-4 h-4" /> Arquivar
                </Button>
              </>
            )}
            {campaign.status === "active" && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setConfirmAction("pause")}>
                  <Pause className="w-4 h-4" /> Pausar
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setConfirmAction("complete")}>
                  <CheckCircle2 className="w-4 h-4" /> Concluir
                </Button>
              </>
            )}
            {campaign.status === "paused" && (
              <Button className="gap-2" onClick={() => setConfirmAction("resume")}>
                <Play className="w-4 h-4" /> Retomar
              </Button>
            )}
            {(campaign.status === "archived" || campaign.status === "completed") && (
              <Button variant="outline" className="gap-2" onClick={() => setConfirmAction("reactivate")}>
                <Play className="w-4 h-4" /> Reativar
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="bg-card border border-border/30">
            <TabsTrigger value="resumo" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Resumo</TabsTrigger>
            <TabsTrigger value="cliente" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Cliente</TabsTrigger>
            <TabsTrigger value="restaurantes" className="gap-1.5 text-xs"><Store className="w-3.5 h-3.5" /> Restaurantes</TabsTrigger>
            <TabsTrigger value="historico" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoCard icon={<Calendar className="w-4 h-4" />} label="Período"
                value={`${campaign.startDate ? new Date(campaign.startDate).toLocaleDateString("pt-BR") : "—"} → ${campaign.endDate ? new Date(campaign.endDate).toLocaleDateString("pt-BR") : "—"}`}
                sub={`${campaign.contractDuration} meses`}
              />
              <InfoCard icon={<Store className="w-4 h-4" />} label="Restaurantes"
                value={`${campaign.activeRestaurants} configurados`}
                sub={`${campaign.coastersPerRestaurant} coasters/rest.`}
              />
              <InfoCard icon={<Package className="w-4 h-4" />} label="Impressões/Rest."
                value={pricing.impressions.toLocaleString("pt-BR")}
                sub={`${campaign.usagePerDay}x/dia × ${campaign.daysPerMonth} dias`}
              />
              <InfoCard icon={<Target className="w-4 h-4" />} label="Markup"
                value={campaign.pricingType === "variable" ? `${Number(campaign.markupPercent)}%` : `R$ ${Number(campaign.fixedPrice).toFixed(2)}`}
                sub={campaign.pricingType === "variable" ? "Variável (%)" : "Fixo (R$)"}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <MetricCard label="Custo Produção" value={formatCurrency(pricing.productionCost)} sub={`Unit: R$ ${pricing.unitCost.toFixed(3)}`} />
              <MetricCard label="Comissão Rest." value={formatCurrency(pricing.actualRestCommission)}
                sub={campaign.commissionType === "variable" ? `${Number(campaign.restaurantCommission)}%` : `R$ ${Number(campaign.fixedCommission).toFixed(2)}/un`}
              />
              <MetricCard label="Comissão Vendedor" value={formatCurrency(pricing.actualSellerComm)} sub={`${Number(campaign.sellerCommission)}%`} />
              <MetricCard label="Impostos" value={formatCurrency(pricing.actualTax)} sub={`${Number(campaign.taxRate)}%`} />
              <MetricCard label="Custo Bruto" value={formatCurrency(pricing.totalCosts)} highlight />
              <MetricCard label="Preço de Venda" value={formatCurrency(pricing.sellingPrice)} accent />
              <MetricCard label="Lucro/Rest." value={formatCurrency(pricing.markupValue)}
                sub={`Margem: ${pricing.grossMargin.toFixed(1)}%`}
                accent={pricing.grossMargin >= 15} warn={pricing.grossMargin < 15}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Receita Mensal" value={formatCurrency(pricing.monthlyRevenue)} />
              <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="Lucro Mensal" value={formatCurrency(pricing.monthlyProfit)} accent />
              <SummaryCard icon={<FileText className="w-4 h-4" />} label="Contrato Total" value={formatCurrency(pricing.contractTotal)} />
              <SummaryCard icon={<BarChart3 className="w-4 h-4" />} label="Lucro do Contrato" value={formatCurrency(pricing.contractProfit)} accent />
            </div>
          </TabsContent>

          <TabsContent value="cliente" className="space-y-4">
            {client ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" /> Identificação
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="Nome Fantasia" value={client.name} />
                    <DetailRow label="Empresa" value={client.company} />
                    <DetailRow label="Razão Social" value={client.razaoSocial} />
                    <DetailRow label="CNPJ" value={client.cnpj} icon={<Hash className="w-3 h-3" />} />
                    <DetailRow label="Segmento" value={client.segment} />
                  </div>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" /> Contato
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="Telefone" value={client.contactPhone} icon={<Phone className="w-3 h-3" />} />
                    <DetailRow label="Email" value={client.contactEmail} icon={<Mail className="w-3 h-3" />} />
                    <DetailRow label="Instagram" value={client.instagram} icon={<Instagram className="w-3 h-3" />} />
                  </div>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4 md:col-span-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" /> Endereço
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <DetailRow label="Logradouro" value={client.address} />
                    <DetailRow label="Número" value={client.addressNumber} />
                    <DetailRow label="Bairro" value={client.neighborhood} />
                    <DetailRow label="Cidade" value={client.city} />
                    <DetailRow label="Estado" value={client.state} />
                    <DetailRow label="CEP" value={client.cep} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
                Dados do cliente não encontrados
              </div>
            )}
          </TabsContent>

          <TabsContent value="restaurantes" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Restaurantes da Campanha</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {campaignRestaurants.length} restaurante(s) · {totalCoastersDistributed.toLocaleString("pt-BR")} coasters distribuídos
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleManageRestaurants}>
                <Store className="w-3.5 h-3.5" /> Gerenciar Restaurantes
              </Button>
            </div>

            {campaignRestaurants.length === 0 ? (
              <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
                Nenhum restaurante vinculado. Clique em "Gerenciar Restaurantes" para adicionar.
              </div>
            ) : (
              <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Restaurante</th>
                      <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden md:table-cell">Bairro</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Coasters</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Uso/Dia</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden md:table-cell">Impressões/Mês</th>
                      <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden lg:table-cell">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignRestaurants.map((r) => {
                      const impressions = r.coastersCount * r.usagePerDay * campaign.daysPerMonth;
                      return (
                        <tr key={r.id} className="border-b border-border/10 hover:bg-card/80">
                          <td className="p-3 text-sm font-medium">{r.restaurantName || `Rest. #${r.restaurantId}`}</td>
                          <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{r.restaurantNeighborhood || "—"}</td>
                          <td className="p-3 text-sm font-mono text-right">{r.coastersCount.toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-sm font-mono text-right">{r.usagePerDay}x</td>
                          <td className="p-3 text-sm font-mono text-right hidden md:table-cell">{impressions.toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-sm font-mono text-right text-muted-foreground hidden lg:table-cell">{r.restaurantCommission || "—"}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border/30 bg-muted/20">
                      <td className="p-3 text-sm font-semibold">Total</td>
                      <td className="p-3 hidden md:table-cell"></td>
                      <td className="p-3 text-sm font-mono font-semibold text-right">{totalCoastersDistributed.toLocaleString("pt-BR")}</td>
                      <td className="p-3"></td>
                      <td className="p-3 text-sm font-mono font-semibold text-right hidden md:table-cell">
                        {campaignRestaurants.reduce((sum, r) => sum + r.coastersCount * r.usagePerDay * campaign.daysPerMonth, 0).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 hidden lg:table-cell"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="historico" className="space-y-4">
            <h3 className="text-sm font-semibold">Histórico da Campanha</h3>
            {historyList.length === 0 ? (
              <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
                Nenhum registro no histórico
              </div>
            ) : (
              <div className="space-y-2">
                {historyList.map((h) => (
                  <div key={h.id} className="bg-card border border-border/30 rounded-lg p-4 flex items-start gap-3">
                    <div className="mt-0.5">
                      <div className={`w-2 h-2 rounded-full ${
                        h.action === "approved" ? "bg-emerald-400" :
                        h.action === "archived" ? "bg-gray-400" :
                        h.action === "created" ? "bg-orange-400" :
                        "bg-primary"
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{HISTORY_LABELS[h.action] || h.action}</p>
                      {h.details && <p className="text-xs text-muted-foreground mt-0.5">{h.details}</p>}
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(h.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isRestaurantsDialogOpen} onOpenChange={setIsRestaurantsDialogOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" /> Restaurantes da Campanha
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              {restaurantSelections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum restaurante ativo disponível.</p>
              ) : (
                restaurantSelections.map((r) => (
                  <div key={r.restaurantId} className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${r.selected ? "border-primary/30 bg-primary/5" : "border-border/20 bg-background/50"}`}>
                    <Checkbox checked={r.selected} onCheckedChange={() => setRestaurantSelections(prev => prev.map(x => x.restaurantId === r.restaurantId ? { ...x, selected: !x.selected } : x))} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                    </div>
                    {r.selected && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Coasters:</Label>
                          <Input type="number" value={r.coastersCount} onChange={(e) => setRestaurantSelections(prev => prev.map(x => x.restaurantId === r.restaurantId ? { ...x, coastersCount: parseInt(e.target.value) || 0 } : x))} className="w-20 h-8 text-xs bg-background border-border/30" />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Uso/dia:</Label>
                          <Input type="number" value={r.usagePerDay} onChange={(e) => setRestaurantSelections(prev => prev.map(x => x.restaurantId === r.restaurantId ? { ...x, usagePerDay: parseInt(e.target.value) || 0 } : x))} className="w-16 h-8 text-xs bg-background border-border/30" />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRestaurantsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveRestaurants} disabled={setRestaurantsMutation.isPending}>
                Salvar ({restaurantSelections.filter((r) => r.selected).length} selecionados)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction === "approve" && "Aprovar Cotação?"}
                {confirmAction === "archive" && "Arquivar Cotação?"}
                {confirmAction === "pause" && "Pausar Campanha?"}
                {confirmAction === "resume" && "Retomar Campanha?"}
                {confirmAction === "complete" && "Concluir Campanha?"}
                {confirmAction === "reactivate" && "Reativar Campanha?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === "approve" && "A cotação será aprovada e a campanha será ativada."}
                {confirmAction === "archive" && "A cotação será arquivada e não será mais visível na lista principal."}
                {confirmAction === "pause" && "A campanha será pausada temporariamente."}
                {confirmAction === "resume" && "A campanha será retomada."}
                {confirmAction === "complete" && "A campanha será marcada como concluída."}
                {confirmAction === "reactivate" && "A campanha será reativada."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className={confirmAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                onClick={() => confirmAction && handleStatusAction(confirmAction)}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function MetricCard({ label, value, sub, highlight, accent, warn }: {
  label: string; value: string; sub?: string; highlight?: boolean; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? "bg-muted/50 border-border/40" : accent ? "bg-primary/5 border-primary/20" : warn ? "bg-red-500/5 border-red-500/20" : "bg-card border-border/30"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-mono font-bold mt-1 ${accent ? "text-primary" : warn ? "text-red-400" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${accent ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border/30"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-base font-mono font-bold ${accent ? "text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm mt-0.5 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value || "—"}
      </p>
    </div>
  );
}
