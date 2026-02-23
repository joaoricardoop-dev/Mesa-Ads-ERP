import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";

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
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
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
  FileText,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Hash,
  Pencil,
  AlertTriangle,
  Eye,
  Banknote,
  ShieldCheck,
  CircleDollarSign,
  TrendingUp,
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
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
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

const PIE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

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
  const n = c.activeRestaurants;
  const coasters = c.coastersPerRestaurant;
  const unitCost = Number(c.batchCost) / c.batchSize;
  const productionCostPerRest = coasters * unitCost;
  const impressionsPerRest = coasters * c.usagePerDay * c.daysPerMonth;
  const sellerRate = Number(c.sellerCommission) / 100;
  const taxRateDecimal = Number(c.taxRate) / 100;

  const restCommFixed = c.commissionType === "fixed" ? Number(c.fixedCommission) * coasters : 0;
  const custoPD = productionCostPerRest + restCommFixed;
  const restVarRate = c.commissionType === "variable" ? Number(c.restaurantCommission) / 100 : 0;
  const totalVarRate = sellerRate + taxRateDecimal + restVarRate;
  const denominator = 1 - totalVarRate;
  const custoBruto = denominator > 0 ? custoPD / denominator : custoPD;

  let sellingPricePerRest: number;
  if (c.pricingType === "fixed") {
    sellingPricePerRest = custoBruto + Number(c.fixedPrice);
  } else {
    sellingPricePerRest = custoBruto * (1 + Number(c.markupPercent) / 100);
  }

  const restCommPerRest = c.commissionType === "fixed"
    ? Number(c.fixedCommission) * coasters
    : sellingPricePerRest * (Number(c.restaurantCommission) / 100);
  const sellerCommPerRest = sellingPricePerRest * sellerRate;
  const taxPerRest = sellingPricePerRest * taxRateDecimal;
  const totalCostsPerRest = productionCostPerRest + restCommPerRest + sellerCommPerRest + taxPerRest;
  const profitPerRest = sellingPricePerRest - totalCostsPerRest;
  const grossMargin = sellingPricePerRest > 0 ? (profitPerRest / sellingPricePerRest) * 100 : 0;

  const totalCoasters = coasters * n;
  const totalImpressions = impressionsPerRest * n;
  const totalProductionCost = productionCostPerRest * n;
  const totalRestComm = restCommPerRest * n;
  const totalSellerComm = sellerCommPerRest * n;
  const totalTax = taxPerRest * n;
  const totalCosts = totalCostsPerRest * n;
  const monthlyRevenue = sellingPricePerRest * n;
  const monthlyProfit = profitPerRest * n;
  const contractRevenue = monthlyRevenue * c.contractDuration;
  const contractProfit = monthlyProfit * c.contractDuration;
  const contractCosts = totalCosts * c.contractDuration;
  const cpi = totalImpressions > 0 ? monthlyRevenue / totalImpressions : 0;
  const roi = totalCosts > 0 ? (monthlyProfit / totalCosts) * 100 : 0;

  return {
    unitCost,
    impressionsPerRest,
    sellingPricePerRest,
    totalCostsPerRest,
    profitPerRest,
    grossMargin,
    totalCoasters,
    totalImpressions,
    totalProductionCost,
    totalRestComm,
    totalSellerComm,
    totalTax,
    totalCosts,
    monthlyRevenue,
    monthlyProfit,
    contractRevenue,
    contractProfit,
    contractCosts,
    cpi,
    roi,
    productionCostPerRest,
    restCommPerRest,
    sellerCommPerRest,
    taxPerRest,
  };
}

interface RestaurantSelection {
  restaurantId: number;
  coastersCount: number;
  usagePerDay: number;
  selected: boolean;
  name: string;
  neighborhood: string;
}

export default function CampaignDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/campanhas/:id");
  const campaignId = match ? parseInt(params!.id) : 0;

  const [isRestaurantsDialogOpen, setIsRestaurantsDialogOpen] = useState(false);
  const [isEditPeriodOpen, setIsEditPeriodOpen] = useState(false);
  const [restaurantSelections, setRestaurantSelections] = useState<RestaurantSelection[]>([]);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

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
    if (!campaign) return;
    const existing = campaignRestaurants || [];
    const maxRestaurants = campaign.activeRestaurants;
    const defaultCoasters = campaign.coastersPerRestaurant;
    const selections: RestaurantSelection[] = restaurantsList
      .filter((r) => r.status === "active")
      .map((r) => {
        const linked = existing.find((cr) => cr.restaurantId === r.id);
        return {
          restaurantId: r.id,
          name: r.name,
          neighborhood: r.neighborhood || "",
          coastersCount: linked ? linked.coastersCount : defaultCoasters,
          usagePerDay: linked ? linked.usagePerDay : campaign.usagePerDay,
          selected: !!linked,
        };
      });
    setRestaurantSelections(selections);
    setIsRestaurantsDialogOpen(true);
  };

  const handleToggleRestaurant = (restaurantId: number) => {
    if (!campaign) return;
    const maxRestaurants = campaign.activeRestaurants;
    setRestaurantSelections(prev => {
      const current = prev.find(x => x.restaurantId === restaurantId);
      if (!current) return prev;
      if (!current.selected) {
        const currentSelected = prev.filter(x => x.selected).length;
        if (currentSelected >= maxRestaurants) {
          toast.error(`Máximo de ${maxRestaurants} restaurantes permitidos nesta campanha`);
          return prev;
        }
      }
      return prev.map(x =>
        x.restaurantId === restaurantId ? { ...x, selected: !x.selected } : x
      );
    });
  };

  const handleSaveRestaurants = () => {
    const selected = restaurantSelections
      .filter((r) => r.selected)
      .map((r) => ({ restaurantId: r.restaurantId, coastersCount: r.coastersCount, usagePerDay: r.usagePerDay }));
    setRestaurantsMutation.mutate({ campaignId, restaurants: selected });
  };

  const handleOpenEditPeriod = () => {
    if (!campaign) return;
    setEditStart(campaign.startDate || "");
    setEditEnd(campaign.endDate || "");
    setIsEditPeriodOpen(true);
  };

  const handleSavePeriod = () => {
    if (!editStart || !editEnd) return;
    const start = new Date(editStart);
    const end = new Date(editEnd);
    const diffMonths = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    updateMutation.mutate(
      { id: campaignId, startDate: editStart, endDate: editEnd, contractDuration: diffMonths },
      {
        onSuccess: () => {
          setIsEditPeriodOpen(false);
          addHistoryMutation.mutate({
            campaignId,
            action: "updated",
            details: `Período atualizado: ${new Date(editStart).toLocaleDateString("pt-BR")} → ${new Date(editEnd).toLocaleDateString("pt-BR")} (${diffMonths} meses)`,
          });
          toast.success("Período atualizado!");
        },
      }
    );
  };

  const selectedCount = restaurantSelections.filter(r => r.selected).length;
  const totalCoastersAllocated = restaurantSelections.filter(r => r.selected).reduce((s, r) => s + r.coastersCount, 0);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Campanha não encontrada</p>
          <Button variant="outline" onClick={() => navigate("/campanhas")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const p = calcCampaignPricing(campaign);
  const client = clientsList.find((cl) => cl.id === campaign.clientId);
  const totalCoastersDistributed = campaignRestaurants.reduce((sum, r) => sum + r.coastersCount, 0);
  const expectedTotalCoasters = campaign.coastersPerRestaurant * campaign.activeRestaurants;
  const allocationPct = expectedTotalCoasters > 0 ? (totalCoastersDistributed / expectedTotalCoasters) * 100 : 0;
  const restaurantsConfigured = campaignRestaurants.length;
  const restaurantsMissing = campaign.activeRestaurants - restaurantsConfigured;

  const costBreakdownData = [
    { name: "Produção", value: p.totalProductionCost, color: "#22c55e" },
    { name: "Com. Restaurante", value: p.totalRestComm, color: "#3b82f6" },
    { name: "Com. Vendedor", value: p.totalSellerComm, color: "#f59e0b" },
    { name: "Impostos", value: p.totalTax, color: "#ef4444" },
    { name: "Lucro", value: p.monthlyProfit, color: "#8b5cf6" },
  ];

  const perRestBarData = [
    { name: "Produção", custo: p.productionCostPerRest },
    { name: "Com. Rest.", custo: p.restCommPerRest },
    { name: "Com. Vend.", custo: p.sellerCommPerRest },
    { name: "Impostos", custo: p.taxPerRest },
    { name: "Lucro", custo: p.profitPerRest },
  ];

  const daysElapsed = campaign.status === "active" || campaign.status === "paused"
    ? Math.max(0, Math.floor((Date.now() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const totalDays = Math.max(1, Math.floor((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / (1000 * 60 * 60 * 24)));
  const progressPct = Math.min(100, (daysElapsed / totalDays) * 100);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/campanhas")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight">{campaign.name}</h1>
                  <Badge variant="outline" className={STATUS_COLORS[campaign.status] || ""}>
                    {STATUS_LABELS[campaign.status] || campaign.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {client?.name || "—"} {client?.company ? `· ${client.company}` : ""} · ID #{campaign.id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {campaign.status === "quotation" && (
                <>
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs h-8" onClick={() => setConfirmAction("approve")}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setConfirmAction("archive")}>
                    <Archive className="w-3.5 h-3.5" /> Arquivar
                  </Button>
                </>
              )}
              {campaign.status === "active" && (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setConfirmAction("pause")}>
                    <Pause className="w-3.5 h-3.5" /> Pausar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setConfirmAction("complete")}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                  </Button>
                </>
              )}
              {campaign.status === "paused" && (
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setConfirmAction("resume")}>
                  <Play className="w-3.5 h-3.5" /> Retomar
                </Button>
              )}
              {(campaign.status === "archived" || campaign.status === "completed") && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setConfirmAction("reactivate")}>
                  <Play className="w-3.5 h-3.5" /> Reativar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-5">
          <Tabs defaultValue="resumo" className="space-y-4">
            <TabsList className="bg-card border border-border/30">
              <TabsTrigger value="resumo" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Painel</TabsTrigger>
              <TabsTrigger value="financeiro" className="gap-1.5 text-xs"><CircleDollarSign className="w-3.5 h-3.5" /> Financeiro</TabsTrigger>
              <TabsTrigger value="restaurantes" className="gap-1.5 text-xs"><Store className="w-3.5 h-3.5" /> Distribuição</TabsTrigger>
              <TabsTrigger value="cliente" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Cliente</TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
            </TabsList>

            {/* ─── PAINEL (Dashboard) ─── */}
            <TabsContent value="resumo" className="space-y-4">
              {restaurantsMissing > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restaurantsMissing} restaurante(s) faltando. Configure {campaign.activeRestaurants} restaurantes na aba Distribuição.</span>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPIBig label="Receita Mensal" value={formatCurrency(p.monthlyRevenue)} icon={<Banknote className="w-5 h-5" />} />
                <KPIBig label="Lucro Mensal" value={formatCurrency(p.monthlyProfit)} icon={<TrendingUp className="w-5 h-5" />} accent />
                <KPIBig label="Margem Real" value={`${p.grossMargin.toFixed(1)}%`} icon={<ShieldCheck className="w-5 h-5" />}
                  accent={p.grossMargin >= 20} warn={p.grossMargin < 15}
                />
                <KPIBig label="ROI Mensal" value={`${p.roi.toFixed(1)}%`} icon={<Target className="w-5 h-5" />} accent={p.roi > 0} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período & Progresso</h3>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenEditPeriod}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{campaign.startDate ? new Date(campaign.startDate).toLocaleDateString("pt-BR") : "—"}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{campaign.endDate ? new Date(campaign.endDate).toLocaleDateString("pt-BR") : "—"}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{daysElapsed} dias</span>
                      <span>{totalDays} dias total</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <MiniStat label="Duração" value={`${campaign.contractDuration} meses`} />
                    <MiniStat label="Dias restantes" value={`${Math.max(0, totalDays - daysElapsed)}`} />
                  </div>
                </div>

                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Restaurantes" value={`${restaurantsConfigured}/${campaign.activeRestaurants}`}
                      warn={restaurantsMissing > 0}
                    />
                    <MiniStat label="Coasters/Rest." value={campaign.coastersPerRestaurant.toLocaleString("pt-BR")} />
                    <MiniStat label="Total Coasters" value={p.totalCoasters.toLocaleString("pt-BR")} />
                    <MiniStat label="Alocação" value={`${allocationPct.toFixed(0)}%`} warn={allocationPct < 100} />
                  </div>
                </div>

                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alcance & Impressões</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Impressões/Mês" value={p.totalImpressions.toLocaleString("pt-BR")} />
                    <MiniStat label="Impressões/Rest." value={p.impressionsPerRest.toLocaleString("pt-BR")} />
                    <MiniStat label="Custo por Impressão" value={`R$ ${p.cpi.toFixed(4)}`} />
                    <MiniStat label="Uso/Dia" value={`${campaign.usagePerDay}x`} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/30 rounded-lg p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Composição do Preço (Mensal Total)</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costBreakdownData}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={80}
                          dataKey="value"
                          paddingAngle={2}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {costBreakdownData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card border border-border/30 rounded-lg p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Breakdown por Restaurante</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={perRestBarData} layout="vertical">
                        <XAxis type="number" tickFormatter={(v) => `R$${v.toFixed(0)}`} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
                          {perRestBarData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ContractCard label="Contrato Total" value={formatCurrency(p.contractRevenue)} sub={`${campaign.contractDuration} meses`} />
                <ContractCard label="Custos do Contrato" value={formatCurrency(p.contractCosts)} />
                <ContractCard label="Lucro do Contrato" value={formatCurrency(p.contractProfit)} accent />
                <ContractCard label="Coasters Total Contrato" value={(p.totalCoasters * campaign.contractDuration).toLocaleString("pt-BR")} sub="unidades" />
              </div>
            </TabsContent>

            {/* ─── FINANCEIRO ─── */}
            <TabsContent value="financeiro" className="space-y-4">
              <div className="bg-card border border-border/30 rounded-lg p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Parâmetros Financeiros da Campanha</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                  <ParamRow label="Coasters/Restaurante" value={campaign.coastersPerRestaurant.toLocaleString("pt-BR")} />
                  <ParamRow label="Uso Médio/Dia" value={`${campaign.usagePerDay}x`} />
                  <ParamRow label="Dias por Mês" value={`${campaign.daysPerMonth}`} />
                  <ParamRow label="Restaurantes Ativos" value={`${campaign.activeRestaurants}`} />
                  <ParamRow label="Tipo de Precificação" value={campaign.pricingType === "variable" ? "Markup (%)" : "Preço Fixo (R$)"} />
                  <ParamRow label={campaign.pricingType === "variable" ? "Markup" : "Preço Fixo"}
                    value={campaign.pricingType === "variable" ? `${Number(campaign.markupPercent)}%` : formatCurrency(Number(campaign.fixedPrice))}
                  />
                  <ParamRow label="Tipo Comissão Rest." value={campaign.commissionType === "variable" ? "Variável (%)" : "Fixo (R$/un)"} />
                  <ParamRow label={campaign.commissionType === "variable" ? "Comissão Rest." : "Comissão Fixa"}
                    value={campaign.commissionType === "variable" ? `${Number(campaign.restaurantCommission)}%` : `R$ ${Number(campaign.fixedCommission).toFixed(4)}/un`}
                  />
                  <ParamRow label="Comissão Vendedor" value={`${Number(campaign.sellerCommission)}%`} />
                  <ParamRow label="Alíquota Impostos" value={`${Number(campaign.taxRate)}%`} />
                  <ParamRow label="Lote Produção" value={`${campaign.batchSize.toLocaleString("pt-BR")} un`} />
                  <ParamRow label="Custo Lote" value={formatCurrency(Number(campaign.batchCost))} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border/30 rounded-lg p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Por Restaurante (Mensal)</h3>
                  <div className="space-y-2">
                    <FinRow label="Custo Unitário Coaster" value={`R$ ${p.unitCost.toFixed(4)}`} />
                    <FinRow label="Custo Produção" value={formatCurrency(p.productionCostPerRest)} />
                    <FinRow label="Comissão Restaurante" value={formatCurrency(p.restCommPerRest)} sub={campaign.commissionType === "variable" ? `${Number(campaign.restaurantCommission)}%` : `R$ ${Number(campaign.fixedCommission).toFixed(2)}/un`} />
                    <FinRow label="Comissão Vendedor" value={formatCurrency(p.sellerCommPerRest)} sub={`${Number(campaign.sellerCommission)}%`} />
                    <FinRow label="Impostos" value={formatCurrency(p.taxPerRest)} sub={`${Number(campaign.taxRate)}%`} />
                    <div className="border-t border-border/20 pt-2 mt-2">
                      <FinRow label="Total Custos" value={formatCurrency(p.totalCostsPerRest)} bold />
                    </div>
                    <FinRow label="Preço de Venda" value={formatCurrency(p.sellingPricePerRest)} accent />
                    <FinRow label="Lucro" value={formatCurrency(p.profitPerRest)} accent />
                    <FinRow label="Margem" value={`${p.grossMargin.toFixed(1)}%`} accent={p.grossMargin >= 15} warn={p.grossMargin < 15} />
                  </div>
                </div>

                <div className="bg-card border border-border/30 rounded-lg p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Total Campanha (Mensal × {campaign.activeRestaurants} rest.)</h3>
                  <div className="space-y-2">
                    <FinRow label="Custo Produção" value={formatCurrency(p.totalProductionCost)} />
                    <FinRow label="Comissões Restaurantes" value={formatCurrency(p.totalRestComm)} />
                    <FinRow label="Comissões Vendedores" value={formatCurrency(p.totalSellerComm)} />
                    <FinRow label="Impostos" value={formatCurrency(p.totalTax)} />
                    <div className="border-t border-border/20 pt-2 mt-2">
                      <FinRow label="Total Custos" value={formatCurrency(p.totalCosts)} bold />
                    </div>
                    <FinRow label="Receita Mensal" value={formatCurrency(p.monthlyRevenue)} accent />
                    <FinRow label="Lucro Mensal" value={formatCurrency(p.monthlyProfit)} accent />
                    <div className="border-t border-border/20 pt-2 mt-2">
                      <FinRow label={`Receita Contrato (${campaign.contractDuration}m)`} value={formatCurrency(p.contractRevenue)} bold />
                      <FinRow label={`Lucro Contrato (${campaign.contractDuration}m)`} value={formatCurrency(p.contractProfit)} accent />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ─── DISTRIBUIÇÃO ─── */}
            <TabsContent value="restaurantes" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Distribuição de Coasters</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {restaurantsConfigured}/{campaign.activeRestaurants} restaurantes · {totalCoastersDistributed.toLocaleString("pt-BR")}/{expectedTotalCoasters.toLocaleString("pt-BR")} coasters alocados
                  </p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleManageRestaurants}>
                  <Store className="w-3.5 h-3.5" /> Configurar Restaurantes
                </Button>
              </div>

              {restaurantsMissing > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Faltam {restaurantsMissing} restaurante(s) para atingir os {campaign.activeRestaurants} previstos na campanha. Coasters previstos por restaurante: {campaign.coastersPerRestaurant.toLocaleString("pt-BR")}.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Restaurantes</p>
                  <p className={`text-lg font-bold font-mono mt-1 ${restaurantsMissing > 0 ? "text-yellow-400" : "text-emerald-400"}`}>{restaurantsConfigured}/{campaign.activeRestaurants}</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coasters Alocados</p>
                  <p className={`text-lg font-bold font-mono mt-1 ${allocationPct < 100 ? "text-yellow-400" : "text-emerald-400"}`}>{totalCoastersDistributed.toLocaleString("pt-BR")}</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impressões/Mês</p>
                  <p className="text-lg font-bold font-mono mt-1">
                    {campaignRestaurants.reduce((sum, r) => sum + r.coastersCount * r.usagePerDay * campaign.daysPerMonth, 0).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>

              {campaignRestaurants.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-10 text-center space-y-3">
                  <Store className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm">Nenhum restaurante configurado</p>
                  <Button size="sm" variant="outline" onClick={handleManageRestaurants} className="text-xs">Configurar agora</Button>
                </div>
              ) : (
                <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/10">
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Restaurante</th>
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden md:table-cell">Bairro</th>
                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Coasters</th>
                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Uso/Dia</th>
                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Impressões</th>
                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden lg:table-cell">Receita</th>
                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden lg:table-cell">Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignRestaurants.map((r) => {
                        const impressions = r.coastersCount * r.usagePerDay * campaign.daysPerMonth;
                        const restPricing = calcCampaignPricing({ ...campaign, coastersPerRestaurant: r.coastersCount, usagePerDay: r.usagePerDay, activeRestaurants: 1 });
                        return (
                          <tr key={r.id} className="border-b border-border/10 hover:bg-muted/5">
                            <td className="p-3 text-sm font-medium">{r.restaurantName || `Rest. #${r.restaurantId}`}</td>
                            <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{r.restaurantNeighborhood || "—"}</td>
                            <td className="p-3 text-sm font-mono text-right">{r.coastersCount.toLocaleString("pt-BR")}</td>
                            <td className="p-3 text-sm font-mono text-right">{r.usagePerDay}x</td>
                            <td className="p-3 text-sm font-mono text-right">{impressions.toLocaleString("pt-BR")}</td>
                            <td className="p-3 text-sm font-mono text-right text-primary hidden lg:table-cell">{formatCurrency(restPricing.monthlyRevenue)}</td>
                            <td className="p-3 text-sm font-mono text-right text-emerald-400 hidden lg:table-cell">{formatCurrency(restPricing.monthlyProfit)}</td>
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
                        <td className="p-3 text-sm font-mono font-semibold text-right">
                          {campaignRestaurants.reduce((sum, r) => sum + r.coastersCount * r.usagePerDay * campaign.daysPerMonth, 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3 text-sm font-mono font-semibold text-right text-primary hidden lg:table-cell">{formatCurrency(p.monthlyRevenue)}</td>
                        <td className="p-3 text-sm font-mono font-semibold text-right text-emerald-400 hidden lg:table-cell">{formatCurrency(p.monthlyProfit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ─── CLIENTE ─── */}
            <TabsContent value="cliente" className="space-y-4">
              {client ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-primary" /> Identificação
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
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-primary" /> Contato
                    </h3>
                    <div className="space-y-3">
                      <DetailRow label="Telefone" value={client.contactPhone} icon={<Phone className="w-3 h-3" />} />
                      <DetailRow label="Email" value={client.contactEmail} icon={<Mail className="w-3 h-3" />} />
                      <DetailRow label="Instagram" value={client.instagram} icon={<Instagram className="w-3 h-3" />} />
                    </div>
                  </div>
                  <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4 md:col-span-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-primary" /> Endereço
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

            {/* ─── HISTÓRICO ─── */}
            <TabsContent value="historico" className="space-y-4">
              <h3 className="text-sm font-semibold">Histórico da Campanha</h3>
              {historyList.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
                  Nenhum registro no histórico
                </div>
              ) : (
                <div className="relative pl-4">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/30" />
                  {historyList.map((h, i) => (
                    <div key={h.id} className="relative flex items-start gap-3 pb-4">
                      <div className={`relative z-10 mt-1 w-3 h-3 rounded-full border-2 ${
                        h.action === "approved" ? "bg-emerald-400 border-emerald-500" :
                        h.action === "archived" ? "bg-gray-400 border-gray-500" :
                        h.action === "created" ? "bg-orange-400 border-orange-500" :
                        h.action === "paused" ? "bg-yellow-400 border-yellow-500" :
                        "bg-primary border-primary"
                      }`} />
                      <div className="flex-1 bg-card border border-border/30 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{HISTORY_LABELS[h.action] || h.action}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(h.createdAt).toLocaleString("pt-BR")}</p>
                        </div>
                        {h.details && <p className="text-xs text-muted-foreground mt-1">{h.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ─── DIALOGS ─── */}
        <Dialog open={isRestaurantsDialogOpen} onOpenChange={setIsRestaurantsDialogOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" /> Configurar Restaurantes
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-between px-1 py-2 text-xs">
              <span className="text-muted-foreground">
                Selecione até <strong className="text-foreground">{campaign.activeRestaurants}</strong> restaurantes com <strong className="text-foreground">{campaign.coastersPerRestaurant.toLocaleString("pt-BR")}</strong> coasters cada
              </span>
              <Badge variant="outline" className={selectedCount === campaign.activeRestaurants ? "border-emerald-500/30 text-emerald-400" : selectedCount > campaign.activeRestaurants ? "border-red-500/30 text-red-400" : "border-yellow-500/30 text-yellow-400"}>
                {selectedCount}/{campaign.activeRestaurants} selecionados
              </Badge>
            </div>
            <div className="space-y-2 py-2">
              {restaurantSelections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum restaurante ativo disponível.</p>
              ) : (
                restaurantSelections.map((r) => (
                  <div key={r.restaurantId} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${r.selected ? "border-primary/30 bg-primary/5" : "border-border/20 bg-background/50"}`}>
                    <Checkbox checked={r.selected} onCheckedChange={() => handleToggleRestaurant(r.restaurantId)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      {r.neighborhood && <p className="text-[10px] text-muted-foreground">{r.neighborhood}</p>}
                    </div>
                    {r.selected && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">Coasters:</Label>
                          <Input type="number" value={r.coastersCount} onChange={(e) => setRestaurantSelections(prev => prev.map(x => x.restaurantId === r.restaurantId ? { ...x, coastersCount: parseInt(e.target.value) || 0 } : x))} className="w-20 h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] text-muted-foreground">Uso:</Label>
                          <Input type="number" value={r.usagePerDay} onChange={(e) => setRestaurantSelections(prev => prev.map(x => x.restaurantId === r.restaurantId ? { ...x, usagePerDay: parseInt(e.target.value) || 0 } : x))} className="w-14 h-7 text-xs bg-background border-border/30" />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {selectedCount > 0 && (
              <div className="text-xs text-muted-foreground border-t border-border/20 pt-3 flex justify-between">
                <span>Total coasters alocados: <strong className="text-foreground">{totalCoastersAllocated.toLocaleString("pt-BR")}</strong></span>
                <span>Previsto: <strong className="text-foreground">{expectedTotalCoasters.toLocaleString("pt-BR")}</strong></span>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsRestaurantsDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveRestaurants} disabled={setRestaurantsMutation.isPending}>
                Salvar ({selectedCount} restaurantes)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditPeriodOpen} onOpenChange={setIsEditPeriodOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Editar Período
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="bg-background border-border/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Fim</Label>
                <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="bg-background border-border/30" />
              </div>
              {editStart && editEnd && (
                <p className="text-xs text-muted-foreground">
                  Duração: {Math.max(1, Math.round((new Date(editEnd).getTime() - new Date(editStart).getTime()) / (1000 * 60 * 60 * 24 * 30)))} meses
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsEditPeriodOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSavePeriod} disabled={updateMutation.isPending || !editStart || !editEnd}>Salvar</Button>
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

function KPIBig({ label, value, icon, accent, warn }: {
  label: string; value: string; icon: React.ReactNode; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? "bg-emerald-500/5 border-emerald-500/20" : warn ? "bg-red-500/5 border-red-500/20" : "bg-card border-border/30"}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <span className={accent ? "text-emerald-400" : warn ? "text-red-400" : "text-muted-foreground"}>{icon}</span>
      </div>
      <p className={`text-xl font-bold font-mono ${accent ? "text-emerald-400" : warn ? "text-red-400" : ""}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold font-mono ${warn ? "text-yellow-400" : ""}`}>{value}</p>
    </div>
  );
}

function ContractCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${accent ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border/30"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-base font-bold font-mono mt-1 ${accent ? "text-emerald-400" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function FinRow({ label, value, sub, bold, accent, warn }: {
  label: string; value: string; sub?: string; bold?: boolean; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <span className={`text-sm ${bold ? "font-semibold" : "text-muted-foreground"}`}>{label}</span>
        {sub && <span className="text-[10px] text-muted-foreground ml-1.5">({sub})</span>}
      </div>
      <span className={`text-sm font-mono ${bold ? "font-bold" : ""} ${accent ? "text-emerald-400 font-semibold" : ""} ${warn ? "text-red-400 font-semibold" : ""}`}>{value}</span>
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
