import { useState, useMemo } from "react";
import AppNav from "@/components/AppNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Search,
  Store,
  Calendar,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Package,
  Users,
  Percent,
  FileText,
  BarChart3,
  Target,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";

interface CampaignForm {
  clientId: number | null;
  name: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "paused" | "completed";
  notes: string;
  coastersPerRestaurant: number;
  usagePerDay: number;
  daysPerMonth: number;
  activeRestaurants: number;
  pricingType: "variable" | "fixed";
  markupPercent: number;
  fixedPrice: number;
  commissionType: "variable" | "fixed";
  restaurantCommission: number;
  fixedCommission: number;
  sellerCommission: number;
  taxRate: number;
  contractDuration: number;
  batchSize: number;
  batchCost: number;
}

const emptyForm: CampaignForm = {
  clientId: null,
  name: "",
  startDate: "",
  endDate: "",
  status: "draft",
  notes: "",
  coastersPerRestaurant: 500,
  usagePerDay: 3,
  daysPerMonth: 26,
  activeRestaurants: 10,
  pricingType: "variable",
  markupPercent: 30,
  fixedPrice: 0,
  commissionType: "variable",
  restaurantCommission: 20,
  fixedCommission: 0.05,
  sellerCommission: 10,
  taxRate: 15,
  contractDuration: 6,
  batchSize: 10000,
  batchCost: 1200,
};

interface RestaurantSelection {
  restaurantId: number;
  coastersCount: number;
  usagePerDay: number;
  selected: boolean;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary border-primary/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
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
    impressions,
    productionCost,
    unitCost,
    custoPD,
    custoBruto,
    sellingPrice,
    totalCosts,
    markupValue,
    grossMargin,
    actualRestCommission,
    actualSellerComm,
    actualTax,
    contractTotal,
    contractProfit,
    monthlyRevenue,
    monthlyProfit,
  };
}

export default function Campaigns() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRestaurantsDialogOpen, setIsRestaurantsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [managingCampaignId, setManagingCampaignId] = useState<number | null>(null);
  const [restaurantSelections, setRestaurantSelections] = useState<RestaurantSelection[]>([]);

  const utils = trpc.useUtils();
  const { data: campaignsList = [], isLoading } = trpc.campaign.list.useQuery();
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: restaurantsList = [] } = trpc.restaurant.list.useQuery();

  const { data: campaignRestaurants = [] } = trpc.campaign.getRestaurants.useQuery(
    { campaignId: managingCampaignId! },
    { enabled: managingCampaignId !== null }
  );

  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("Campanha criada com sucesso!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Campanha atualizada!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setDeleteId(null);
      toast.success("Campanha removida!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const setRestaurantsMutation = trpc.campaign.setRestaurants.useMutation({
    onSuccess: () => {
      utils.campaign.getRestaurants.invalidate();
      setIsRestaurantsDialogOpen(false);
      setManagingCampaignId(null);
      toast.success("Restaurantes da campanha atualizados!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.clientId) { toast.error("Selecione um cliente"); return; }
    if (!form.startDate || !form.endDate) { toast.error("Datas são obrigatórias"); return; }

    const payload = {
      clientId: form.clientId!,
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      notes: form.notes,
      coastersPerRestaurant: form.coastersPerRestaurant,
      usagePerDay: form.usagePerDay,
      daysPerMonth: form.daysPerMonth,
      activeRestaurants: form.activeRestaurants,
      pricingType: form.pricingType,
      markupPercent: String(form.markupPercent),
      fixedPrice: String(form.fixedPrice),
      commissionType: form.commissionType,
      restaurantCommission: String(form.restaurantCommission),
      fixedCommission: String(form.fixedCommission),
      sellerCommission: String(form.sellerCommission),
      taxRate: String(form.taxRate),
      contractDuration: form.contractDuration,
      batchSize: form.batchSize,
      batchCost: String(form.batchCost),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (c: (typeof campaignsList)[0]) => {
    setEditingId(c.id);
    setForm({
      clientId: c.clientId,
      name: c.name,
      startDate: c.startDate ? new Date(c.startDate).toISOString().split("T")[0] : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().split("T")[0] : "",
      status: c.status,
      notes: c.notes || "",
      coastersPerRestaurant: c.coastersPerRestaurant,
      usagePerDay: c.usagePerDay,
      daysPerMonth: c.daysPerMonth,
      activeRestaurants: c.activeRestaurants,
      pricingType: c.pricingType as "variable" | "fixed",
      markupPercent: Number(c.markupPercent),
      fixedPrice: Number(c.fixedPrice),
      commissionType: c.commissionType as "variable" | "fixed",
      restaurantCommission: Number(c.restaurantCommission),
      fixedCommission: Number(c.fixedCommission),
      sellerCommission: Number(c.sellerCommission),
      taxRate: Number(c.taxRate),
      contractDuration: c.contractDuration,
      batchSize: c.batchSize,
      batchCost: Number(c.batchCost),
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const handleManageRestaurants = (campaignId: number) => {
    setManagingCampaignId(campaignId);
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
    if (!managingCampaignId) return;
    const selected = restaurantSelections
      .filter((r) => r.selected)
      .map((r) => ({
        restaurantId: r.restaurantId,
        coastersCount: r.coastersCount,
        usagePerDay: r.usagePerDay,
      }));
    setRestaurantsMutation.mutate({ campaignId: managingCampaignId, restaurants: selected });
  };

  const toggleRestaurant = (restaurantId: number) => {
    setRestaurantSelections((prev) =>
      prev.map((r) => r.restaurantId === restaurantId ? { ...r, selected: !r.selected } : r)
    );
  };

  const updateRestaurantField = (restaurantId: number, field: "coastersCount" | "usagePerDay", value: number) => {
    setRestaurantSelections((prev) =>
      prev.map((r) => r.restaurantId === restaurantId ? { ...r, [field]: value } : r)
    );
  };

  const filtered = campaignsList.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.clientName || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = campaignsList.filter((c) => c.status === "active").length;

  const totals = useMemo(() => {
    let totalContract = 0;
    let totalProfit = 0;
    let totalMonthly = 0;
    for (const c of campaignsList) {
      const p = calcCampaignPricing(c);
      totalContract += p.contractTotal;
      totalProfit += p.contractProfit;
      totalMonthly += p.monthlyRevenue;
    }
    return { totalContract, totalProfit, totalMonthly };
  }, [campaignsList]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Campanhas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie campanhas com todos os parâmetros financeiros do simulador
            </p>
          </div>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold font-mono">{campaignsList.length}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold font-mono text-primary">{activeCount}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Faturamento Mensal</p>
            <p className="text-lg font-bold font-mono text-primary">{formatCurrency(totals.totalMonthly)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Valor Total Contratos</p>
            <p className="text-lg font-bold font-mono">{formatCurrency(totals.totalContract)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Lucro Total Contratos</p>
            <p className="text-lg font-bold font-mono text-emerald-400">{formatCurrency(totals.totalProfit)}</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/30"
          />
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
              {search
                ? "Nenhuma campanha encontrada"
                : 'Nenhuma campanha cadastrada. Clique em "Nova Campanha" ou crie pelo Simulador.'}
            </div>
          ) : (
            filtered.map((c) => {
              const pricing = calcCampaignPricing(c);
              const isExpanded = expandedId === c.id;

              return (
                <div key={c.id} className="bg-card border border-border/30 rounded-lg overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-card/80 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.clientName || "—"}
                            {c.clientCompany ? ` · ${c.clientCompany}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Contrato</p>
                          <p className="font-mono font-semibold">{formatCurrency(pricing.contractTotal)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Lucro</p>
                          <p className="font-mono font-semibold text-emerald-400">{formatCurrency(pricing.contractProfit)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Margem</p>
                          <p className={`font-mono font-semibold ${pricing.grossMargin >= 15 ? "text-emerald-400" : "text-red-400"}`}>
                            {pricing.grossMargin.toFixed(1)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Rest.</p>
                          <p className="font-mono">{c.activeRestaurants}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>
                          {STATUS_LABELS[c.status] || c.status}
                        </Badge>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/20 p-4 space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <InfoCard icon={<Calendar className="w-4 h-4" />} label="Período"
                              value={`${c.startDate ? new Date(c.startDate).toLocaleDateString("pt-BR") : "—"} → ${c.endDate ? new Date(c.endDate).toLocaleDateString("pt-BR") : "—"}`}
                              sub={`${c.contractDuration} meses`}
                            />
                            <InfoCard icon={<Store className="w-4 h-4" />} label="Restaurantes"
                              value={`${c.activeRestaurants} ativos`}
                              sub={`${c.coastersPerRestaurant} coasters/rest.`}
                            />
                            <InfoCard icon={<Package className="w-4 h-4" />} label="Impressões/Rest."
                              value={pricing.impressions.toLocaleString("pt-BR")}
                              sub={`${c.usagePerDay}x/dia × ${c.daysPerMonth} dias`}
                            />
                            <InfoCard icon={<Target className="w-4 h-4" />} label="Markup"
                              value={c.pricingType === "variable" ? `${Number(c.markupPercent)}%` : `R$ ${Number(c.fixedPrice).toFixed(2)}`}
                              sub={c.pricingType === "variable" ? "Variável (%)" : "Fixo (R$)"}
                            />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            <MetricCard label="Custo Produção" value={formatCurrency(pricing.productionCost)} sub={`Unit: R$ ${pricing.unitCost.toFixed(3)}`} />
                            <MetricCard label="Comissão Rest." value={formatCurrency(pricing.actualRestCommission)}
                              sub={c.commissionType === "variable" ? `${Number(c.restaurantCommission)}%` : `R$ ${Number(c.fixedCommission).toFixed(2)}/un`}
                            />
                            <MetricCard label="Comissão Vendedor" value={formatCurrency(pricing.actualSellerComm)} sub={`${Number(c.sellerCommission)}%`} />
                            <MetricCard label="Impostos" value={formatCurrency(pricing.actualTax)} sub={`${Number(c.taxRate)}%`} />
                            <MetricCard label="Custo Bruto" value={formatCurrency(pricing.totalCosts)} highlight />
                            <MetricCard label="Preço de Venda" value={formatCurrency(pricing.sellingPrice)} accent />
                            <MetricCard label="Lucro/Rest." value={formatCurrency(pricing.markupValue)}
                              sub={`Margem: ${pricing.grossMargin.toFixed(1)}%`}
                              accent={pricing.grossMargin >= 15}
                              warn={pricing.grossMargin < 15}
                            />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Receita Mensal" value={formatCurrency(pricing.monthlyRevenue)} />
                            <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="Lucro Mensal" value={formatCurrency(pricing.monthlyProfit)} accent />
                            <SummaryCard icon={<FileText className="w-4 h-4" />} label="Contrato Total" value={formatCurrency(pricing.contractTotal)} />
                            <SummaryCard icon={<BarChart3 className="w-4 h-4" />} label="Lucro do Contrato" value={formatCurrency(pricing.contractProfit)} accent />
                          </div>

                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); handleManageRestaurants(c.id); }}>
                              <Store className="w-3 h-3" /> Gerenciar Restaurantes
                            </Button>
                          </div>

                          {c.notes && (
                            <p className="text-xs text-muted-foreground italic border-t border-border/20 pt-3">
                              {c.notes}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="w-3.5 h-3.5" /> Informações Gerais
                </h4>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Nome da Campanha *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Campanha Verão 2026" className="bg-background border-border/30 h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Cliente *</Label>
                      <Select value={form.clientId ? String(form.clientId) : "none"} onValueChange={(v) => setForm({ ...form, clientId: v === "none" ? null : parseInt(v) })}>
                        <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione um cliente</SelectItem>
                          {clientsList.filter((cl) => cl.status === "active").map((cl) => (
                            <SelectItem key={cl.id} value={String(cl.id)}>{cl.name}{cl.company ? ` (${cl.company})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CampaignForm["status"] })}>
                        <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativa</SelectItem>
                          <SelectItem value="paused">Pausada</SelectItem>
                          <SelectItem value="completed">Concluída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Data Início *</Label>
                      <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="bg-background border-border/30 h-9 text-sm" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Data Fim *</Label>
                      <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="bg-background border-border/30 h-9 text-sm" />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Duração (meses)</Label>
                      <Input type="number" value={form.contractDuration} onChange={(e) => setForm({ ...form, contractDuration: Number(e.target.value) })} className="bg-background border-border/30 h-9 text-sm font-mono" min={1} max={36} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Operacional
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FormField label="Coasters/Rest." value={form.coastersPerRestaurant} onChange={(v) => setForm({ ...form, coastersPerRestaurant: v })} min={100} max={5000} step={50} />
                  <FormField label="Uso/Dia" value={form.usagePerDay} onChange={(v) => setForm({ ...form, usagePerDay: v })} min={1} max={20} />
                  <FormField label="Dias/Mês" value={form.daysPerMonth} onChange={(v) => setForm({ ...form, daysPerMonth: v })} min={1} max={31} />
                  <FormField label="Restaurantes" value={form.activeRestaurants} onChange={(v) => setForm({ ...form, activeRestaurants: v })} min={1} max={100} />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Produção
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Tamanho do Lote" value={form.batchSize} onChange={(v) => setForm({ ...form, batchSize: v })} min={100} max={100000} step={500} />
                  <FormField label="Custo do Lote (R$)" value={form.batchCost} onChange={(v) => setForm({ ...form, batchCost: v })} min={0} max={50000} step={50} decimal />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5" /> Precificação
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Tipo Markup</Label>
                    <Select value={form.pricingType} onValueChange={(v) => setForm({ ...form, pricingType: v as "variable" | "fixed" })}>
                      <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variable">Variável (%)</SelectItem>
                        <SelectItem value="fixed">Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.pricingType === "variable" ? (
                    <FormField label="Markup (%)" value={form.markupPercent} onChange={(v) => setForm({ ...form, markupPercent: v })} min={0} max={500} step={5} />
                  ) : (
                    <FormField label="Markup Fixo (R$)" value={form.fixedPrice} onChange={(v) => setForm({ ...form, fixedPrice: v })} min={0} max={50000} step={50} decimal />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Comissões & Impostos
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Tipo Comissão Rest.</Label>
                    <Select value={form.commissionType} onValueChange={(v) => setForm({ ...form, commissionType: v as "variable" | "fixed" })}>
                      <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variable">Variável (%)</SelectItem>
                        <SelectItem value="fixed">Fixo (R$/un)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.commissionType === "variable" ? (
                    <FormField label="Comissão Rest. (%)" value={form.restaurantCommission} onChange={(v) => setForm({ ...form, restaurantCommission: v })} min={0} max={50} step={1} />
                  ) : (
                    <FormField label="Comissão Fixa (R$/un)" value={form.fixedCommission} onChange={(v) => setForm({ ...form, fixedCommission: v })} min={0} max={1} step={0.01} decimal />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Comissão Vendedor (%)" value={form.sellerCommission} onChange={(v) => setForm({ ...form, sellerCommission: v })} min={0} max={30} step={1} />
                  <FormField label="Carga Tributária (%)" value={form.taxRate} onChange={(v) => setForm({ ...form, taxRate: v })} min={0} max={40} step={1} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Observações</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas sobre a campanha..." className="bg-background border-border/30 h-9 text-sm" />
              </div>

              {form.clientId && form.startDate && (
                <CampaignPreview form={form} />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    <Checkbox checked={r.selected} onCheckedChange={() => toggleRestaurant(r.restaurantId)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                    </div>
                    {r.selected && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Coasters:</Label>
                          <Input type="number" value={r.coastersCount} onChange={(e) => updateRestaurantField(r.restaurantId, "coastersCount", parseInt(e.target.value) || 0)} className="w-20 h-8 text-xs bg-background border-border/30" />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Uso/dia:</Label>
                          <Input type="number" value={r.usagePerDay} onChange={(e) => updateRestaurantField(r.restaurantId, "usagePerDay", parseInt(e.target.value) || 0)} className="w-16 h-8 text-xs bg-background border-border/30" />
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

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
                Excluir
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
    <div className="bg-background/50 border border-border/20 rounded-lg p-3">
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
    <div className={`rounded-lg p-3 border ${highlight ? "bg-muted/50 border-border/40" : accent ? "bg-primary/5 border-primary/20" : warn ? "bg-red-500/5 border-red-500/20" : "bg-background/30 border-border/20"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-mono font-bold mt-1 ${accent ? "text-primary" : warn ? "text-red-400" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${accent ? "bg-emerald-500/5 border-emerald-500/20" : "bg-background/40 border-border/30"}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={`text-base font-mono font-bold ${accent ? "text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function FormField({ label, value, onChange, min, max, step, decimal }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; decimal?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(decimal ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
        className="bg-background border-border/30 h-9 text-sm font-mono"
        min={min} max={max} step={step}
      />
    </div>
  );
}

function CampaignPreview({ form }: { form: CampaignForm }) {
  const pricing = calcCampaignPricing({
    ...form,
    markupPercent: form.markupPercent,
    fixedPrice: form.fixedPrice,
    restaurantCommission: form.restaurantCommission,
    fixedCommission: form.fixedCommission,
    sellerCommission: form.sellerCommission,
    taxRate: form.taxRate,
    batchCost: form.batchCost,
  });

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
      <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Preview Financeiro</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[10px] text-muted-foreground">Custo Bruto/Rest.</p>
          <p className="font-mono font-bold">{formatCurrency(pricing.totalCosts)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Preço Venda/Rest.</p>
          <p className="font-mono font-bold text-primary">{formatCurrency(pricing.sellingPrice)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Margem Real</p>
          <p className={`font-mono font-bold ${pricing.grossMargin >= 15 ? "text-emerald-400" : "text-red-400"}`}>{pricing.grossMargin.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Contrato Total</p>
          <p className="font-mono font-bold">{formatCurrency(pricing.contractTotal)}</p>
        </div>
      </div>
    </div>
  );
}
