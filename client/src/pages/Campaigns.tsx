import { useState, useMemo, useEffect } from "react";

import { trpc } from "@/lib/trpc";
import PageContainer from "@/components/PageContainer";
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
import { Switch } from "@/components/ui/switch";
import {
  Pencil,
  Trash2,
  Megaphone,
  Search,
  Store,
  DollarSign,
  Package,
  Users,
  Percent,
  Gift,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useLocation } from "wouter";

interface CampaignForm {
  clientId: number | null;
  name: string;
  status: "draft" | "active" | "paused" | "completed" | "quotation" | "archived" | "briefing" | "design" | "aprovacao" | "producao" | "transito" | "executar" | "distribuicao" | "veiculacao" | "inativa";
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
  isBonificada: boolean;
}

const emptyForm: CampaignForm = {
  clientId: null,
  name: "",
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
  isBonificada: false,
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
  quotation: "Cotação",
  archived: "Arquivada",
  briefing: "Briefing",
  design: "Design",
  aprovacao: "Aprovação",
  producao: "Produção",
  transito: "Trânsito",
  executar: "Executar",
  distribuicao: "Distribuição",
  veiculacao: "Veiculação",
  inativa: "Inativa",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary border-primary/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  quotation: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  briefing: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  design: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  aprovacao: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  producao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  transito: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  executar: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  distribuicao: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  veiculacao: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inativa: "bg-gray-500/20 text-gray-400 border-gray-500/30",
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
  const [managingCampaignId, setManagingCampaignId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const [restaurantSelections, setRestaurantSelections] = useState<RestaurantSelection[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [batchYear, setBatchYear] = useState(new Date().getFullYear());

  const utils = trpc.useUtils();
  const { data: campaignsList = [], isLoading } = trpc.campaign.list.useQuery();
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: restaurantsList = [] } = trpc.restaurant.list.useQuery();
  const { data: batchesList = [] } = trpc.batch.list.useQuery({ year: batchYear });
  const { data: campaignBatchesData = [] } = trpc.batch.getCampaignBatches.useQuery(
    { campaignId: editingId! },
    { enabled: editingId !== null }
  );

  const { data: campaignRestaurants = [] } = trpc.campaign.getRestaurants.useQuery(
    { campaignId: managingCampaignId! },
    { enabled: managingCampaignId !== null }
  );

  const updateMutation = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setSelectedBatchIds([]);
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

  const assignBatchesMutation = trpc.batch.assignCampaign.useMutation({
    onSuccess: () => {
      utils.batch.getCampaignBatches.invalidate();
      utils.campaign.list.invalidate();
    },
    onError: (err: any) => toast.error(`Erro ao atribuir batches: ${err.message}`),
  });

  const selectedBatches = useMemo(() => {
    return batchesList
      .filter((b: any) => selectedBatchIds.includes(b.id))
      .sort((a: any, b: any) => a.batchNumber - b.batchNumber);
  }, [batchesList, selectedBatchIds]);

  const derivedStartDate = selectedBatches.length > 0 ? selectedBatches[0].startDate : "";
  const derivedEndDate = selectedBatches.length > 0 ? selectedBatches[selectedBatches.length - 1].endDate : "";

  useEffect(() => {
    if (selectedBatches.length > 0) {
      setForm(prev => ({ ...prev, contractDuration: selectedBatches.length }));
    }
  }, [selectedBatches.length]);

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.clientId) { toast.error("Selecione um cliente"); return; }
    if (selectedBatchIds.length === 0) { toast.error("Selecione pelo menos um batch"); return; }

    const payload = {
      clientId: form.clientId!,
      name: form.name,
      startDate: derivedStartDate,
      endDate: derivedEndDate,
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
      contractDuration: selectedBatchIds.length,
      batchSize: form.batchSize,
      batchCost: String(form.batchCost),
      isBonificada: form.isBonificada,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload }, {
        onSuccess: () => {
          assignBatchesMutation.mutate({ campaignId: editingId, batchIds: selectedBatchIds });
        },
      });
    }
  };

  const handleEdit = (c: (typeof campaignsList)[0]) => {
    setEditingId(c.id);
    setForm({
      clientId: c.clientId,
      name: c.name,
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
      isBonificada: !!(c as any).isBonificada,
    });
    setSelectedBatchIds([]);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (editingId && campaignBatchesData.length > 0) {
      setSelectedBatchIds(campaignBatchesData.map((b: any) => b.batchId));
    }
  }, [editingId, campaignBatchesData]);



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
          coastersCount: linked ? linked.coastersCount : (r.monthlyDrinksSold ? Math.round(r.monthlyDrinksSold * 0.6) : 500),
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

  function effectivePricing(c: typeof campaignsList[0]) {
    const qVolume = (c as any).quotationCoasterVolume ? parseInt((c as any).quotationCoasterVolume) : null;
    const effectiveCoastersPerRest = (qVolume && qVolume > 0 && c.activeRestaurants > 0)
      ? Math.round(qVolume / c.activeRestaurants)
      : c.coastersPerRestaurant;
    const base = calcCampaignPricing({ ...c, coastersPerRestaurant: effectiveCoastersPerRest });
    const qTotal = (c as any).quotationTotalValue ? parseFloat((c as any).quotationTotalValue) : null;
    if (qTotal !== null && qTotal > 0) {
      const totalCostsContract = base.totalCosts * c.activeRestaurants * c.contractDuration;
      const contractProfit = qTotal - totalCostsContract;
      const grossMargin = qTotal > 0 ? (contractProfit / qTotal) * 100 : 0;
      const monthlyRevenue = qTotal / (c.contractDuration || 1);
      const monthlyProfit = contractProfit / (c.contractDuration || 1);
      return { ...base, contractTotal: qTotal, contractProfit, grossMargin, monthlyRevenue, monthlyProfit, fromQuotation: true };
    }
    return { ...base, fromQuotation: false };
  }

  const activeCount = campaignsList.filter((c) => ["active", "briefing", "design", "aprovacao", "producao", "transito", "executar", "distribuicao", "veiculacao"].includes(c.status)).length;
  const totals = useMemo(() => {
    let totalContract = 0;
    let totalProfit = 0;
    let totalMonthly = 0;
    for (const c of campaignsList) {
      if ((c as any).isBonificada) continue;
      const p = effectivePricing(c);
      totalContract += p.contractTotal;
      totalProfit += p.contractProfit;
      totalMonthly += p.monthlyRevenue;
    }
    return { totalContract, totalProfit, totalMonthly };
  }, [campaignsList]);

  return (
    <PageContainer
      title="Campanhas"
      description="Gestão de campanhas de mídia"
      actions={null}
    >

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold font-mono">{campaignsList.length}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">Em Produção</p>
            <p className="text-2xl font-bold font-mono text-orange-400">{campaignsList.filter((c) => c.status === "producao").length}</p>
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
                : 'Nenhuma campanha cadastrada. Campanhas são criadas automaticamente a partir de cotações aprovadas (WIN).'}
            </div>
          ) : (
            filtered.map((c) => {
              const isBonificada = (c as any).isBonificada;
              const pricing = isBonificada ? null : effectivePricing(c);

              return (
                <div key={c.id} className="bg-card border border-border/30 rounded-lg overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-card/80 transition-colors"
                    onClick={() => setLocation(`/campanhas/${c.id}`)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{c.name}</h3>
                            {(c as any).campaignNumber && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{(c as any).campaignNumber}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {c.clientName || "—"}
                            {c.clientCompany ? ` · ${c.clientCompany}` : ""}
                            {c.productName ? ` · ${c.productName}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-6 text-sm">
                        {isBonificada ? (
                          <div className="text-right">
                            <p className="text-xs text-amber-400 font-medium">Bonificada — sem receita</p>
                          </div>
                        ) : pricing && (
                          <>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                Contrato{pricing.fromQuotation && <span className="ml-1 text-violet-400 text-[10px]">cotação</span>}
                              </p>
                              <p className="font-mono font-semibold">{formatCurrency(pricing.contractTotal)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Lucro</p>
                              <p className={`font-mono font-semibold ${pricing.contractProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(pricing.contractProfit)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Margem</p>
                              <p className={`font-mono font-semibold ${pricing.grossMargin >= 15 ? "text-emerald-400" : "text-red-400"}`}>
                                {pricing.grossMargin.toFixed(1)}%
                              </p>
                            </div>
                          </>
                        )}
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Rest.</p>
                          <p className="font-mono">{c.activeRestaurants}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {(c as any).isBonificada && (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                            <Gift className="w-3 h-3" /> Bonificada
                          </Badge>
                        )}
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
                </div>
              );
            })
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Campanha</DialogTitle>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          <SelectItem value="quotation">Cotação</SelectItem>
                          <SelectItem value="active">Ativa</SelectItem>
                          <SelectItem value="producao">Produção</SelectItem>
                          <SelectItem value="transito">Trânsito</SelectItem>
                          <SelectItem value="executar">Executar</SelectItem>
                          <SelectItem value="veiculacao">Veiculação</SelectItem>
                          <SelectItem value="paused">Pausada</SelectItem>
                          <SelectItem value="completed">Concluída</SelectItem>
                          <SelectItem value="archived">Arquivada</SelectItem>
                          <SelectItem value="inativa">Inativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-400" />
                      <div>
                        <Label className="text-xs font-medium">Bonificação</Label>
                        <p className="text-[10px] text-muted-foreground">Campanha sem geração de receita</p>
                      </div>
                    </div>
                    <Switch
                      checked={form.isBonificada}
                      onCheckedChange={(checked) => setForm({ ...form, isBonificada: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Batches (Período) *</Label>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setBatchYear(batchYear - 1)}>&lt;</Button>
                        <span className="text-xs font-mono font-semibold">{batchYear}</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => setBatchYear(batchYear + 1)}>&gt;</Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-border/20 rounded-lg p-2 bg-background/50">
                      {batchesList.map((batch: any) => {
                        const isSelected = selectedBatchIds.includes(batch.id);
                        return (
                          <div
                            key={batch.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
                            onClick={() => {
                              setSelectedBatchIds(prev =>
                                isSelected ? prev.filter(id => id !== batch.id) : [...prev, batch.id]
                              );
                            }}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{batch.label}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(batch.startDate + "T12:00:00").toLocaleDateString("pt-BR")} — {new Date(batch.endDate + "T12:00:00").toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedBatchIds.length > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                        <span className="font-medium text-foreground">{selectedBatchIds.length} batch(es)</span>
                        {" · "}
                        {derivedStartDate && new Date(derivedStartDate + "T12:00:00").toLocaleDateString("pt-BR")}
                        {" → "}
                        {derivedEndDate && new Date(derivedEndDate + "T12:00:00").toLocaleDateString("pt-BR")}
                        {" · "}
                        Duração: {selectedBatchIds.length} ciclo(s) de 4 semanas
                      </div>
                    )}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Tamanho do Lote" value={form.batchSize} onChange={(v) => setForm({ ...form, batchSize: v })} min={100} max={100000} step={500} />
                  <FormField label="Custo do Lote (R$)" value={form.batchCost} onChange={(v) => setForm({ ...form, batchCost: v })} min={0} max={50000} step={50} decimal />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5" /> Precificação
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Comissão Vendedor (%)" value={form.sellerCommission} onChange={(v) => setForm({ ...form, sellerCommission: v })} min={0} max={30} step={1} />
                  <FormField label="Carga Tributária (%)" value={form.taxRate} onChange={(v) => setForm({ ...form, taxRate: v })} min={0} max={40} step={1} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs">Observações</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas sobre a campanha..." className="bg-background border-border/30 h-9 text-sm" />
              </div>

              {form.clientId && selectedBatchIds.length > 0 && (
                <CampaignPreview form={form} />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
                Salvar
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
    </PageContainer>
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
