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
  AlertTriangle,
  Eye,
  Banknote,
  ShieldCheck,
  CircleDollarSign,
  TrendingUp,
  Upload,
  Truck,
  CheckSquare,
  Camera,
  Image,
  ArrowRight,
  Gift,
  Receipt,
  HandCoins,
  ExternalLink,
  Plus,
  ChevronRight,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  quotation: "Cotação",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
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
  quotation: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
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

const WORKFLOW_STEPS = [
  { key: "briefing", label: "Briefing", step: 1 },
  { key: "design", label: "Design", step: 2 },
  { key: "aprovacao", label: "Aprovação", step: 3 },
  { key: "producao", label: "Produção", step: 4 },
  { key: "distribuicao", label: "Distribuição", step: 5 },
  { key: "veiculacao", label: "Veiculação", step: 6 },
  { key: "inativa", label: "Arquivado", step: 7 },
];

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
  art_uploaded: "Arte enviada",
  production_complete: "Produção concluída",
  material_received: "Material recebido",
  veiculacao_started: "Veiculação iniciada",
  finalized: "Campanha finalizada",
  proof_added: "Comprovante adicionado",
  created_from_quotation: "Campanha criada a partir da cotação",
  briefing_complete: "Briefing concluído",
  design_submitted: "Design enviado para aprovação",
  design_approved: "Design aprovado",
  distribution_complete: "Distribuição concluída",
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
  const [restaurantSelections, setRestaurantSelections] = useState<RestaurantSelection[]>([]);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [artPdfUrl, setArtPdfUrl] = useState("");
  const [artImageUrls, setArtImageUrls] = useState("");
  const [veiculacaoStart, setVeiculacaoStart] = useState("");
  const [veiculacaoEnd, setVeiculacaoEnd] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofWeek, setProofWeek] = useState(1);
  const [proofRestaurantId, setProofRestaurantId] = useState<number | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [freightCode, setFreightCode] = useState("");
  const [freightProv, setFreightProv] = useState("");
  const [freightDate, setFreightDate] = useState("");
  const [freightEditing, setFreightEditing] = useState(false);
  const [addTrackingForSoId, setAddTrackingForSoId] = useState<number | null>(null);
  const [newTrackCode, setNewTrackCode] = useState("");
  const [newTrackProv, setNewTrackProv] = useState("");
  const [newTrackDate, setNewTrackDate] = useState("");
  const [newTrackLabel, setNewTrackLabel] = useState("");
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [editTrackCode, setEditTrackCode] = useState("");
  const [editTrackProv, setEditTrackProv] = useState("");
  const [editTrackDate, setEditTrackDate] = useState("");
  const [editTrackLabel, setEditTrackLabel] = useState("");

  const utils = trpc.useUtils();
  const { data: campaign, isLoading } = trpc.campaign.get.useQuery({ id: campaignId }, { enabled: campaignId > 0 });
  const { data: campaignRestaurants = [] } = trpc.campaign.getRestaurants.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: historyList = [] } = trpc.campaign.getHistory.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: restaurantsList = [] } = trpc.restaurant.list.useQuery();
  const { data: proofsList = [] } = trpc.campaign.getProofs.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignBatchList = [] } = trpc.batch.getCampaignBatches.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignInvoices = [] } = trpc.financial.listInvoices.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignPayments = [] } = trpc.financial.listPayments.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignSoList = [] } = trpc.serviceOrder.list.useQuery({ campaignId }, { enabled: campaignId > 0 });

  const distSo = campaignSoList.find((s: any) => s.type === "distribuicao");
  const prodSo = campaignSoList.find((s: any) => s.type === "producao");

  const updateSoFreightMutation = trpc.serviceOrder.update.useMutation({
    onSuccess: () => {
      utils.serviceOrder.list.invalidate();
      setFreightEditing(false);
      toast.success("Rastreamento de frete atualizado.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: prodTrackings = [], refetch: refetchProdTrackings } = trpc.serviceOrder.listTrackings.useQuery(
    { serviceOrderId: prodSo?.id ?? 0 },
    { enabled: !!prodSo?.id }
  );
  const { data: distTrackings = [], refetch: refetchDistTrackings } = trpc.serviceOrder.listTrackings.useQuery(
    { serviceOrderId: distSo?.id ?? 0 },
    { enabled: !!distSo?.id }
  );

  const invalidateTrackings = () => {
    refetchProdTrackings();
    refetchDistTrackings();
  };

  const addTrackingMutation = trpc.serviceOrder.addTracking.useMutation({
    onSuccess: () => {
      invalidateTrackings();
      setAddTrackingForSoId(null);
      setNewTrackCode(""); setNewTrackProv(""); setNewTrackDate(""); setNewTrackLabel("");
      toast.success("Rastreamento adicionado.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTrackingMutation = trpc.serviceOrder.updateTracking.useMutation({
    onSuccess: () => {
      invalidateTrackings();
      setEditingTrackId(null);
      toast.success("Rastreamento atualizado.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTrackingMutation = trpc.serviceOrder.deleteTracking.useMutation({
    onSuccess: () => {
      invalidateTrackings();
      toast.success("Rastreamento removido.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const uploadArtMutation = trpc.campaign.uploadArt.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setArtPdfUrl("");
      setArtImageUrls("");
      toast.success("Arte enviada! Campanha em produção.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeProductionMutation = trpc.campaign.completeProduction.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Produção concluída! Material em trânsito.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmMaterialMutation = trpc.campaign.confirmMaterial.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Material recebido! Pronto para execução.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const startVeiculacaoMutation = trpc.campaign.startVeiculacao.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setVeiculacaoStart("");
      setVeiculacaoEnd("");
      toast.success("Veiculação iniciada!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const finalizeCampaignMutation = trpc.campaign.finalizeCampaign.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Campanha finalizada e arquivada na biblioteca.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addProofMutation = trpc.campaign.addProof.useMutation({
    onSuccess: () => {
      utils.campaign.getProofs.invalidate();
      utils.campaign.getHistory.invalidate();
      setProofUrl("");
      setProofWeek(1);
      setProofRestaurantId(null);
      toast.success("Comprovante adicionado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

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

  const completeBriefingMutation = trpc.campaign.completeBriefing.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Briefing concluído! Campanha em produção de design.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const submitDesignMutation = trpc.campaign.submitDesign.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Design enviado para aprovação!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const approveDesignMutation = trpc.campaign.approveDesign.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Design aprovado! OS de produção gerada — campanha em produção gráfica.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const receiveMaterialMutation = trpc.campaign.receiveMaterial.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Material recebido! OS de distribuição gerada — campanha em distribuição.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeDistributionMutation = trpc.campaign.completeDistribution.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setVeiculacaoStart("");
      setVeiculacaoEnd("");
      toast.success("Distribuição concluída! Veiculação iniciada.");
    },
    onError: (err: any) => toast.error(err.message),
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

  const createInvoiceMutation = trpc.financial.createInvoice.useMutation({
    onSuccess: () => {
      utils.financial.listInvoices.invalidate();
      utils.financial.dashboard.invalidate();
      setIsInvoiceDialogOpen(false);
      setInvoiceAmount("");
      setInvoiceDueDate("");
      setInvoiceNotes("");
      toast.success("Fatura emitida com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  function handleCreateInvoice() {
    if (!invoiceAmount || !invoiceDueDate) { toast.error("Preencha valor e data de vencimento"); return; }
    createInvoiceMutation.mutate({ campaignId, amount: invoiceAmount, dueDate: invoiceDueDate, notes: invoiceNotes || undefined });
  }

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
    } else if (action === "completeBriefing") {
      completeBriefingMutation.mutate({ id: campaignId });
    } else if (action === "submitDesign") {
      submitDesignMutation.mutate({ id: campaignId });
    } else if (action === "approveDesign") {
      approveDesignMutation.mutate({ id: campaignId });
    } else if (action === "receiveMaterial") {
      receiveMaterialMutation.mutate({ id: campaignId });
    } else if (action === "completeProduction") {
      completeProductionMutation.mutate({ id: campaignId });
    } else if (action === "confirmMaterial") {
      confirmMaterialMutation.mutate({ id: campaignId });
    } else if (action === "finalize") {
      finalizeCampaignMutation.mutate({ id: campaignId });
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

  const totalCoastersDistributed = campaignRestaurants.reduce((sum, r) => sum + r.coastersCount, 0);
  const restaurantsConfigured = campaignRestaurants.length;
  const expectedTotalCoasters = campaign.batchSize > 0 ? campaign.batchSize : campaign.coastersPerRestaurant * campaign.activeRestaurants;
  const allocationPct = expectedTotalCoasters > 0 ? (totalCoastersDistributed / expectedTotalCoasters) * 100 : 0;
  const restaurantsMissing = campaign.activeRestaurants - restaurantsConfigured;

  // When a linked quotation has a totalValue, use it as the revenue source of truth
  const quotationTotalValue = (campaign as any).quotationTotalValue ? parseFloat((campaign as any).quotationTotalValue) : null;
  const hasQuotationRevenue = !campaign.isBonificada && quotationTotalValue && quotationTotalValue > 0;

  // Effective coasters per restaurant: prefer quotation volume over stored campaign value
  // (campaign.coastersPerRestaurant may be the default 500 even when quotation specifies different volume)
  const quotationCoasterVolume = (campaign as any).quotationCoasterVolume ? parseInt((campaign as any).quotationCoasterVolume) : null;
  const effectiveCoastersPerRest: number = (() => {
    if (quotationCoasterVolume && quotationCoasterVolume > 0 && campaign.activeRestaurants > 0) {
      return Math.round(quotationCoasterVolume / campaign.activeRestaurants);
    }
    if (totalCoastersDistributed > 0 && restaurantsConfigured > 0) {
      return Math.round(totalCoastersDistributed / restaurantsConfigured);
    }
    return campaign.coastersPerRestaurant;
  })();

  // pBase uses the effective per-restaurant coaster count for accurate production cost
  const pBase = calcCampaignPricing({ ...campaign, coastersPerRestaurant: effectiveCoastersPerRest });

  let p: typeof pBase;
  if (hasQuotationRevenue) {
    // Revenue source of truth = quotation's agreed total value
    const contractRevenue = quotationTotalValue!;
    const n = campaign.activeRestaurants || 1;
    const monthlyRevenue = contractRevenue / (campaign.contractDuration || 1);
    const sellingPricePerRest = monthlyRevenue / n;
    // Commissions applied to actual agreed revenue
    const restCommPerRest = sellingPricePerRest * (Number(campaign.restaurantCommission) / 100);
    const sellerCommPerRest = sellingPricePerRest * (Number(campaign.sellerCommission) / 100);
    const taxPerRest = sellingPricePerRest * (Number(campaign.taxRate) / 100);
    // Production cost: use campaign's coastersPerRestaurant as originally modeled
    const productionCostPerRest = pBase.productionCostPerRest;
    const totalCostsPerRest = productionCostPerRest + restCommPerRest + sellerCommPerRest + taxPerRest;
    const profitPerRest = sellingPricePerRest - totalCostsPerRest;
    const totalRestComm = restCommPerRest * n;
    const totalSellerComm = sellerCommPerRest * n;
    const totalTax = taxPerRest * n;
    const totalProductionCost = productionCostPerRest * n;
    const totalCosts = totalCostsPerRest * n;
    const monthlyProfit = profitPerRest * n;
    const grossMargin = sellingPricePerRest > 0 ? (profitPerRest / sellingPricePerRest) * 100 : 0;
    p = {
      ...pBase,
      sellingPricePerRest,
      restCommPerRest,
      sellerCommPerRest,
      taxPerRest,
      productionCostPerRest,
      profitPerRest,
      totalCostsPerRest,
      totalRestComm,
      totalSellerComm,
      totalTax,
      totalProductionCost,
      totalCosts,
      monthlyRevenue,
      monthlyProfit,
      contractRevenue,
      contractProfit: monthlyProfit * campaign.contractDuration,
      contractCosts: totalCosts * campaign.contractDuration,
      grossMargin,
      roi: totalCosts > 0 ? (monthlyProfit / totalCosts) * 100 : 0,
      cpi: pBase.totalImpressions > 0 ? monthlyRevenue / pBase.totalImpressions : 0,
    };
  } else {
    p = pBase;
  }

  const client = clientsList.find((cl) => cl.id === campaign.clientId);

  const costBreakdownData = [
    { name: "Produção", value: p.totalProductionCost, color: "#22c55e" },
    { name: "Com. Restaurante", value: p.totalRestComm, color: "#3b82f6" },
    { name: "Com. Vendedor", value: p.totalSellerComm, color: "#f59e0b" },
    { name: "Impostos", value: p.totalTax, color: "#ef4444" },
    { name: "Lucro", value: Math.max(0, p.monthlyProfit), color: "#8b5cf6" },
  ];

  const perRestBarData = [
    { name: "Produção", custo: p.productionCostPerRest },
    { name: "Com. Rest.", custo: p.restCommPerRest },
    { name: "Com. Vend.", custo: p.sellerCommPerRest },
    { name: "Impostos", custo: p.taxPerRest },
    { name: "Lucro", custo: p.profitPerRest },
  ];

  const batchStartDate = campaignBatchList.length > 0 ? campaignBatchList[0].startDate : campaign.startDate;
  const batchEndDate = campaignBatchList.length > 0 ? campaignBatchList[campaignBatchList.length - 1].endDate : campaign.endDate;
  const batchCount = campaignBatchList.length;
  const batchWeeks = batchCount * 4;
  const batchLabel = batchCount > 0
    ? batchCount === 1
      ? `Batch ${campaignBatchList[0].batchNumber}`
      : `Batches ${campaignBatchList[0].batchNumber}–${campaignBatchList[campaignBatchList.length - 1].batchNumber}`
    : null;

  const proposalSignedAt = (campaign as any).proposalSignedAt ? new Date((campaign as any).proposalSignedAt) : null;
  const briefingEnteredAt = (campaign as any).briefingEnteredAt ? new Date((campaign as any).briefingEnteredAt) : proposalSignedAt;
  const designEnteredAt = (campaign as any).designEnteredAt ? new Date((campaign as any).designEnteredAt) : null;
  const aprovacaoEnteredAt = (campaign as any).aprovacaoEnteredAt ? new Date((campaign as any).aprovacaoEnteredAt) : null;
  const producaoEnteredAt = (campaign as any).producaoEnteredAt ? new Date((campaign as any).producaoEnteredAt) : null;
  const distribuicaoEnteredAt = (campaign as any).distribuicaoEnteredAt ? new Date((campaign as any).distribuicaoEnteredAt) : null;
  const slaActive = proposalSignedAt !== null && ["briefing", "design", "aprovacao"].includes(campaign.status);
  const slaResolved = proposalSignedAt !== null && producaoEnteredAt !== null && !["briefing", "design", "aprovacao"].includes(campaign.status);
  const slaDays = slaActive
    ? Math.floor((Date.now() - proposalSignedAt.getTime()) / (1000 * 60 * 60 * 24))
    : slaResolved
      ? Math.floor((producaoEnteredAt!.getTime() - proposalSignedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  const MS_DAY = 1000 * 60 * 60 * 24;
  const now = Date.now();
  const PIPELINE_STAGES_ORDERED = ["briefing", "design", "aprovacao", "producao", "distribuicao", "veiculacao", "inativa"] as const;
  const stageOrderIndex = (s: string) => PIPELINE_STAGES_ORDERED.indexOf(s as typeof PIPELINE_STAGES_ORDERED[number]);
  const currentStageIndex = stageOrderIndex(campaign.status);

  function stageDays(entryAt: Date | null, exitAt: Date | null, stageKey: string): number | null {
    if (!entryAt) return null;
    const end = exitAt ?? (currentStageIndex === stageOrderIndex(stageKey) ? new Date(now) : null);
    if (!end) return null;
    return Math.max(0, Math.floor((end.getTime() - entryAt.getTime()) / MS_DAY));
  }

  const slaStages = [
    { key: "briefing", label: "Briefing", enteredAt: briefingEnteredAt, exitAt: designEnteredAt, threshold: 5 },
    { key: "design", label: "Design", enteredAt: designEnteredAt, exitAt: aprovacaoEnteredAt, threshold: 5 },
    { key: "aprovacao", label: "Aprovação", enteredAt: aprovacaoEnteredAt, exitAt: producaoEnteredAt, threshold: 5 },
    { key: "producao", label: "Produção", enteredAt: producaoEnteredAt, exitAt: distribuicaoEnteredAt, threshold: 14 },
    { key: "distribuicao", label: "Distribuição", enteredAt: distribuicaoEnteredAt, exitAt: null, threshold: 7 },
  ].map(s => ({
    ...s,
    days: stageDays(s.enteredAt, s.exitAt, s.key),
    isCurrent: campaign.status === s.key,
    isPast: currentStageIndex > stageOrderIndex(s.key),
  })).filter(s => s.days !== null || s.isCurrent);
  const slaColor = slaDays === null ? "" : slaDays <= 3 ? "text-emerald-400" : slaDays <= 5 ? "text-yellow-400" : "text-red-400";
  const slaLabel = slaDays === null ? "" : slaDays === 0 ? "Hoje" : `${slaDays} dia${slaDays !== 1 ? "s" : ""}`;
  const showSlaBadge = slaDays !== null && (slaActive || slaResolved);

  const daysElapsed = campaign.status === "active" || campaign.status === "paused"
    ? Math.max(0, Math.floor((Date.now() - new Date(batchStartDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const totalDays = Math.max(1, Math.floor((new Date(batchEndDate).getTime() - new Date(batchStartDate).getTime()) / (1000 * 60 * 60 * 24)));
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
                  {(campaign as any).campaignNumber && (
                    <Badge variant="outline" className="font-mono text-[10px]">{(campaign as any).campaignNumber}</Badge>
                  )}
                  {(campaign as any).isBonificada && (
                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
                      <Gift className="w-3 h-3" /> Bonificada
                    </Badge>
                  )}
                  <Badge variant="outline" className={STATUS_COLORS[campaign.status] || ""}>
                    {STATUS_LABELS[campaign.status] || campaign.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {client?.name || "—"} {client?.company ? `· ${client.company}` : ""} · ID #{campaign.id}
                </p>
                {campaign.productName && (
                  <Badge variant="outline" className="mt-1 text-xs font-normal bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {campaign.productName}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {showSlaBadge && (
                <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${slaDays! > 5 ? "bg-red-500/10 border-red-500/30" : slaDays! > 3 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className={`font-semibold ${slaColor}`}>
                    SLA: {slaResolved ? `${slaLabel} (concluído)` : slaLabel}
                  </span>
                  {slaDays! > 5 && <AlertTriangle className="w-3 h-3 text-red-400" />}
                </div>
              )}
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
              {campaign.status === "briefing" && (
                <Button size="sm" className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-xs h-8" onClick={() => setConfirmAction("completeBriefing")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Briefing Concluído
                </Button>
              )}
              {campaign.status === "design" && (
                <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-xs h-8" onClick={() => setConfirmAction("submitDesign")}>
                  <ArrowRight className="w-3.5 h-3.5" /> Enviar para Aprovação
                </Button>
              )}
              {campaign.status === "aprovacao" && (
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs h-8" onClick={() => setConfirmAction("approveDesign")}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar Design
                </Button>
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
              {campaign.status === "producao" && (
                <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-xs h-8" onClick={() => setConfirmAction("receiveMaterial")}>
                  <Package className="w-3.5 h-3.5" /> Material Recebido
                </Button>
              )}
              {campaign.status === "transito" && (
                <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-xs h-8" onClick={() => setConfirmAction("confirmMaterial")}>
                  <CheckSquare className="w-3.5 h-3.5" /> Confirmar Recebimento
                </Button>
              )}
              {campaign.status === "distribuicao" && (
                <span className="text-xs text-muted-foreground italic">Configure o período abaixo para iniciar veiculação</span>
              )}
              {campaign.status === "veiculacao" && (
                <Button size="sm" className="gap-1.5 text-xs h-8" variant="outline" onClick={() => setConfirmAction("finalize")}>
                  <Archive className="w-3.5 h-3.5" /> Finalizar Campanha
                </Button>
              )}
              {(campaign.status === "archived" || campaign.status === "completed" || campaign.status === "inativa") && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setConfirmAction("reactivate")}>
                  <Play className="w-3.5 h-3.5" /> Reativar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-5">
          {WORKFLOW_STEPS.some(s => s.key === campaign.status) && (
            <div className="bg-card border border-border/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fluxo da Campanha</h3>
                <span className="text-[10px] text-muted-foreground">
                  Etapa {WORKFLOW_STEPS.find(s => s.key === campaign.status)?.step || 0} de {WORKFLOW_STEPS.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {WORKFLOW_STEPS.map((step, i) => {
                  const currentStep = WORKFLOW_STEPS.find(s => s.key === campaign.status)?.step || 0;
                  const isCompleted = step.step < currentStep;
                  const isCurrent = step.key === campaign.status;
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center flex-1 last:flex-none">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                          isCompleted ? "bg-emerald-500 border-emerald-500 text-white" :
                          isCurrent ? "bg-primary border-primary text-primary-foreground" :
                          "bg-muted border-border/30 text-muted-foreground"
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.step}
                        </div>
                        <span className={`text-[9px] mt-1 text-center ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-1 mb-4 ${step.step < currentStep ? "bg-emerald-500" : "bg-border/30"}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {slaStages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Duração por Etapa</p>
                  <div className="flex flex-wrap gap-2">
                    {slaStages.map(s => {
                      const overdue = s.days !== null && s.days > s.threshold;
                      const color = s.days === null ? "bg-muted/40 text-muted-foreground border-border/20" :
                        overdue ? "bg-red-500/10 text-red-400 border-red-500/30" :
                        s.days > s.threshold * 0.7 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                        "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                      return (
                        <div key={s.key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${color}`}>
                          {overdue && <AlertTriangle className="w-3 h-3 shrink-0" />}
                          <span>{s.label}</span>
                          <span className="font-mono font-bold">
                            {s.days !== null ? `${s.days}d` : s.isCurrent ? "…" : "—"}
                          </span>
                          {s.isCurrent && <span className="text-[9px] opacity-70">em curso</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {campaign.status === "briefing" && (
            <div className="bg-card border border-sky-500/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm font-semibold text-sky-400">Briefing</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Proposta assinada em {(campaign as any).proposalSignedAt ? new Date((campaign as any).proposalSignedAt).toLocaleDateString("pt-BR") : "—"}.
                Colete todas as informações necessárias para iniciar a produção do design.
                O SLA máximo do briefing à produção é de <strong className="text-foreground">5 dias</strong>.
              </p>
              {slaDays !== null && slaDays > 5 && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>SLA em atraso! {slaDays} dias desde a assinatura da proposta.</span>
                </div>
              )}
            </div>
          )}

          {campaign.status === "design" && (
            <div className="bg-card border border-purple-500/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Image className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-400">Produção de Design</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                O design do material publicitário está sendo produzido. Ao finalizar a arte, envie para aprovação do cliente.
              </p>
              {slaDays !== null && slaDays > 5 && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>SLA em atraso! {slaDays} dias desde a assinatura da proposta.</span>
                </div>
              )}
            </div>
          )}

          {campaign.status === "aprovacao" && (
            <div className="bg-card border border-orange-500/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-semibold text-orange-400">Aprovação do Design</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                O design foi enviado para aprovação do cliente. Ao receber a aprovação, clique em "Aprovar Design" para gerar a OS de produção.
              </p>
              {slaDays !== null && slaDays > 5 && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>SLA em atraso! {slaDays} dias desde a assinatura da proposta.</span>
                </div>
              )}
            </div>
          )}

          {campaign.status === "active" && (
            <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold">Enviar Arte para Produção</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Envie o PDF e/ou imagens da arte aprovada para iniciar a produção dos porta-copos.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">URL do PDF da Arte</Label>
                  <Input
                    value={artPdfUrl}
                    onChange={(e) => setArtPdfUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-background border-border/30 h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URLs das Imagens (separadas por vírgula)</Label>
                  <Input
                    value={artImageUrls}
                    onChange={(e) => setArtImageUrls(e.target.value)}
                    placeholder="https://img1.jpg, https://img2.jpg"
                    className="bg-background border-border/30 h-9 text-sm"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                disabled={(!artPdfUrl && !artImageUrls) || uploadArtMutation.isPending}
                onClick={() => uploadArtMutation.mutate({ id: campaignId, artPdfUrl: artPdfUrl || undefined, artImageUrls: artImageUrls || undefined })}
              >
                <Upload className="w-3.5 h-3.5" /> Enviar Arte e Iniciar Produção
              </Button>
            </div>
          )}

          {campaign.status === "producao" && (
            <div className="bg-card border border-amber-500/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400">Produção Gráfica em Andamento</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Os porta-copos estão sendo produzidos. Assim que o material chegar, clique em "Material Recebido" para gerar automaticamente a OS de distribuição.
              </p>
              {(campaign as any).artPdfUrl && (
                <div className="flex items-center gap-2 text-xs">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <a href={(campaign as any).artPdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ver PDF da Arte</a>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Volume: <strong className="text-foreground">{expectedTotalCoasters.toLocaleString("pt-BR")}</strong> coasters
              </div>

              {prodSo && (
                <div className="border border-amber-500/20 rounded-md p-3 space-y-3 bg-amber-500/5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rastreamentos de Frete · {prodSo.orderNumber}</p>
                    <button
                      onClick={() => { setAddTrackingForSoId(prodSo.id); setNewTrackCode(""); setNewTrackProv(""); setNewTrackDate(""); setNewTrackLabel(""); }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                    >
                      + Adicionar
                    </button>
                  </div>

                  {prodTrackings.length === 0 && addTrackingForSoId !== prodSo.id && (
                    <p className="text-xs text-muted-foreground italic">Nenhum rastreamento cadastrado.</p>
                  )}

                  {(prodTrackings as any[]).map((t: any) => (
                    <div key={t.id} className="rounded border border-border/20 bg-background/50 p-2 space-y-2">
                      {editingTrackId === t.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Rótulo</Label>
                              <Input value={editTrackLabel} onChange={e => setEditTrackLabel(e.target.value)} placeholder="ex: Lote 1" className="h-7 text-xs bg-background border-border/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Código</Label>
                              <Input value={editTrackCode} onChange={e => setEditTrackCode(e.target.value)} placeholder="ex: BR123456789BR" className="h-7 text-xs bg-background border-border/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Transportadora</Label>
                              <Input value={editTrackProv} onChange={e => setEditTrackProv(e.target.value)} placeholder="ex: Correios" className="h-7 text-xs bg-background border-border/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Previsão</Label>
                              <Input type="date" value={editTrackDate} onChange={e => setEditTrackDate(e.target.value)} className="h-7 text-xs bg-background border-border/30" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-6 text-xs bg-amber-600 hover:bg-amber-700" disabled={updateTrackingMutation.isPending}
                              onClick={() => updateTrackingMutation.mutate({ id: t.id, trackingCode: editTrackCode, freightProvider: editTrackProv || undefined, expectedDate: editTrackDate || undefined, label: editTrackLabel || undefined })}>
                              Salvar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingTrackId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 flex-1">
                            {t.label && <div><p className="text-[10px] text-muted-foreground">Rótulo</p><p className="text-xs font-medium">{t.label}</p></div>}
                            <div><p className="text-[10px] text-muted-foreground">Código</p><p className="text-xs font-mono">{t.trackingCode}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Transportadora</p><p className="text-xs">{t.freightProvider || "—"}</p></div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Previsão</p>
                              {t.expectedDate ? (
                                <div className="flex items-center gap-1">
                                  <p className="text-xs">{new Date(t.expectedDate).toLocaleDateString("pt-BR")}</p>
                                  {t.expectedDate < new Date().toISOString().split("T")[0] && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                </div>
                              ) : <p className="text-xs">—</p>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <a href={`https://rastreio.melhorenvio.com.br/${t.trackingCode}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Rastrear</a>
                            <button onClick={() => { setEditingTrackId(t.id); setEditTrackCode(t.trackingCode); setEditTrackProv(t.freightProvider || ""); setEditTrackDate(t.expectedDate || ""); setEditTrackLabel(t.label || ""); }} className="text-[10px] text-muted-foreground hover:text-foreground underline ml-2">Editar</button>
                            <button onClick={() => deleteTrackingMutation.mutate({ id: t.id })} className="text-[10px] text-red-400 hover:text-red-300 underline ml-2">Remover</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addTrackingForSoId === prodSo.id && (
                    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Novo Rastreamento</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Rótulo</Label>
                          <Input value={newTrackLabel} onChange={e => setNewTrackLabel(e.target.value)} placeholder="ex: Lote 1" className="h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Código *</Label>
                          <Input value={newTrackCode} onChange={e => setNewTrackCode(e.target.value)} placeholder="ex: BR123456789BR" className="h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Transportadora</Label>
                          <Input value={newTrackProv} onChange={e => setNewTrackProv(e.target.value)} placeholder="ex: Correios" className="h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Previsão</Label>
                          <Input type="date" value={newTrackDate} onChange={e => setNewTrackDate(e.target.value)} className="h-7 text-xs bg-background border-border/30" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-6 text-xs bg-amber-600 hover:bg-amber-700" disabled={!newTrackCode || addTrackingMutation.isPending}
                          onClick={() => addTrackingMutation.mutate({ serviceOrderId: prodSo.id, trackingCode: newTrackCode, freightProvider: newTrackProv || undefined, expectedDate: newTrackDate || undefined, label: newTrackLabel || undefined })}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddTrackingForSoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {campaign.status === "transito" && (
            <div className="bg-card border border-cyan-500/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-semibold text-cyan-400">Material em Trânsito</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                O material produzido está sendo transportado. Ao receber o material, confirme o recebimento para avançar.
              </p>
            </div>
          )}

          {campaign.status === "executar" && (
            <div className="bg-card border border-violet-500/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm font-semibold text-violet-400">Pronto para Execução</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Material recebido em {(campaign as any).materialReceivedDate ? new Date((campaign as any).materialReceivedDate).toLocaleDateString("pt-BR") : "—"}.
                Configure os restaurantes na aba Distribuição e defina o período de veiculação para iniciar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Início da Veiculação</Label>
                  <Input type="date" value={veiculacaoStart} onChange={(e) => setVeiculacaoStart(e.target.value)} className="bg-background border-border/30 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fim da Veiculação</Label>
                  <Input type="date" value={veiculacaoEnd} onChange={(e) => setVeiculacaoEnd(e.target.value)} className="bg-background border-border/30 h-9 text-sm" />
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-violet-600 hover:bg-violet-700"
                disabled={!veiculacaoStart || !veiculacaoEnd || startVeiculacaoMutation.isPending}
                onClick={() => startVeiculacaoMutation.mutate({ id: campaignId, veiculacaoStartDate: veiculacaoStart, veiculacaoEndDate: veiculacaoEnd })}
              >
                <Play className="w-3.5 h-3.5" /> Iniciar Veiculação
              </Button>
            </div>
          )}

          {campaign.status === "distribuicao" && (
            <div className="bg-card border border-teal-500/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold text-teal-400">Distribuição em Andamento</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Material recebido em {(campaign as any).materialReceivedDate ? new Date((campaign as any).materialReceivedDate).toLocaleDateString("pt-BR") : "—"}.
                Configure os restaurantes na aba Distribuição e defina o período de veiculação para concluir.
              </p>

              {distSo && (
                <div className="border border-orange-500/20 rounded-md p-3 space-y-3 bg-orange-500/5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rastreamentos de Frete · {distSo.orderNumber}</p>
                    <button
                      onClick={() => { setAddTrackingForSoId(distSo.id); setNewTrackCode(""); setNewTrackProv(""); setNewTrackDate(""); setNewTrackLabel(""); }}
                      className="text-[10px] text-orange-400 hover:text-orange-300 underline"
                    >
                      + Adicionar
                    </button>
                  </div>

                  {distTrackings.length === 0 && addTrackingForSoId !== distSo.id && (
                    <p className="text-xs text-muted-foreground italic">Nenhum rastreamento cadastrado.</p>
                  )}

                  {(distTrackings as any[]).map((t: any) => (
                    <div key={t.id} className="rounded border border-border/20 bg-background/50 p-2 space-y-2">
                      {editingTrackId === t.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Rótulo</Label>
                              <Input value={editTrackLabel} onChange={e => setEditTrackLabel(e.target.value)} placeholder="ex: Lote 1" className="h-7 text-xs bg-background border-border/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Código</Label>
                              <Input value={editTrackCode} onChange={e => setEditTrackCode(e.target.value)} placeholder="ex: BR123456789BR" className="h-7 text-xs bg-background border-border/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Transportadora</Label>
                              <Input value={editTrackProv} onChange={e => setEditTrackProv(e.target.value)} placeholder="ex: Correios" className="h-7 text-xs bg-background border-border/30" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Previsão</Label>
                              <Input type="date" value={editTrackDate} onChange={e => setEditTrackDate(e.target.value)} className="h-7 text-xs bg-background border-border/30" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-6 text-xs bg-orange-600 hover:bg-orange-700" disabled={updateTrackingMutation.isPending}
                              onClick={() => updateTrackingMutation.mutate({ id: t.id, trackingCode: editTrackCode, freightProvider: editTrackProv || undefined, expectedDate: editTrackDate || undefined, label: editTrackLabel || undefined })}>
                              Salvar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingTrackId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 flex-1">
                            {t.label && <div><p className="text-[10px] text-muted-foreground">Rótulo</p><p className="text-xs font-medium">{t.label}</p></div>}
                            <div><p className="text-[10px] text-muted-foreground">Código</p><p className="text-xs font-mono">{t.trackingCode}</p></div>
                            <div><p className="text-[10px] text-muted-foreground">Transportadora</p><p className="text-xs">{t.freightProvider || "—"}</p></div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Previsão</p>
                              {t.expectedDate ? (
                                <div className="flex items-center gap-1">
                                  <p className="text-xs">{new Date(t.expectedDate).toLocaleDateString("pt-BR")}</p>
                                  {t.expectedDate < new Date().toISOString().split("T")[0] && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                </div>
                              ) : <p className="text-xs">—</p>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <a href={`https://rastreio.melhorenvio.com.br/${t.trackingCode}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Rastrear</a>
                            <button onClick={() => { setEditingTrackId(t.id); setEditTrackCode(t.trackingCode); setEditTrackProv(t.freightProvider || ""); setEditTrackDate(t.expectedDate || ""); setEditTrackLabel(t.label || ""); }} className="text-[10px] text-muted-foreground hover:text-foreground underline ml-2">Editar</button>
                            <button onClick={() => deleteTrackingMutation.mutate({ id: t.id })} className="text-[10px] text-red-400 hover:text-red-300 underline ml-2">Remover</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {addTrackingForSoId === distSo.id && (
                    <div className="rounded border border-orange-500/30 bg-orange-500/5 p-2 space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">Novo Rastreamento</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Rótulo</Label>
                          <Input value={newTrackLabel} onChange={e => setNewTrackLabel(e.target.value)} placeholder="ex: Lote 1" className="h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Código *</Label>
                          <Input value={newTrackCode} onChange={e => setNewTrackCode(e.target.value)} placeholder="ex: BR123456789BR" className="h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Transportadora</Label>
                          <Input value={newTrackProv} onChange={e => setNewTrackProv(e.target.value)} placeholder="ex: Correios" className="h-7 text-xs bg-background border-border/30" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Previsão</Label>
                          <Input type="date" value={newTrackDate} onChange={e => setNewTrackDate(e.target.value)} className="h-7 text-xs bg-background border-border/30" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-6 text-xs bg-orange-600 hover:bg-orange-700" disabled={!newTrackCode || addTrackingMutation.isPending}
                          onClick={() => addTrackingMutation.mutate({ serviceOrderId: distSo.id, trackingCode: newTrackCode, freightProvider: newTrackProv || undefined, expectedDate: newTrackDate || undefined, label: newTrackLabel || undefined })}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddTrackingForSoId(null)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Início da Veiculação</Label>
                  <Input type="date" value={veiculacaoStart} onChange={(e) => setVeiculacaoStart(e.target.value)} className="bg-background border-border/30 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fim da Veiculação</Label>
                  <Input type="date" value={veiculacaoEnd} onChange={(e) => setVeiculacaoEnd(e.target.value)} className="bg-background border-border/30 h-9 text-sm" />
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={!veiculacaoStart || !veiculacaoEnd || completeDistributionMutation.isPending}
                onClick={() => completeDistributionMutation.mutate({ id: campaignId, veiculacaoStartDate: veiculacaoStart, veiculacaoEndDate: veiculacaoEnd })}
              >
                <Play className="w-3.5 h-3.5" /> Concluir Distribuição e Iniciar Veiculação
              </Button>
            </div>
          )}

          {campaign.status === "veiculacao" && (
            <div className="bg-card border border-emerald-500/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-400">Veiculação em Andamento</h3>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                <Camera className="w-4 h-4 shrink-0" />
                <span><strong>Lembrete:</strong> Registre fotos semanais de cada restaurante — são obrigatórias para comprovação da veiculação. Uma foto por semana por restaurante.</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Início" value={(campaign as any).veiculacaoStartDate ? new Date((campaign as any).veiculacaoStartDate).toLocaleDateString("pt-BR") : "—"} />
                <MiniStat label="Fim" value={(campaign as any).veiculacaoEndDate ? new Date((campaign as any).veiculacaoEndDate).toLocaleDateString("pt-BR") : "—"} />
                <MiniStat label="Restaurantes" value={`${restaurantsConfigured}`} />
                <MiniStat label="Comprovantes" value={`${proofsList.length}`} />
              </div>

              <div className="border-t border-border/20 pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adicionar Comprovante Fotográfico</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Semana</Label>
                    <select
                      value={proofWeek}
                      onChange={(e) => setProofWeek(Number(e.target.value))}
                      className="w-full h-9 rounded-md border border-border/30 bg-background px-3 text-sm"
                    >
                      {[1, 2, 3, 4].map(w => <option key={w} value={w}>Semana {w}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Restaurante</Label>
                    <select
                      value={proofRestaurantId || ""}
                      onChange={(e) => setProofRestaurantId(Number(e.target.value) || null)}
                      className="w-full h-9 rounded-md border border-border/30 bg-background px-3 text-sm"
                    >
                      <option value="">Selecione...</option>
                      {campaignRestaurants.map(r => (
                        <option key={r.restaurantId} value={r.restaurantId}>{r.restaurantName || `Rest. #${r.restaurantId}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">URL da Foto</Label>
                    <Input
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      placeholder="https://..."
                      className="bg-background border-border/30 h-9 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs w-full"
                      disabled={!proofUrl || !proofRestaurantId || addProofMutation.isPending}
                      onClick={() => addProofMutation.mutate({ campaignId, restaurantId: proofRestaurantId!, week: proofWeek, photoUrl: proofUrl })}
                    >
                      <Camera className="w-3.5 h-3.5" /> Adicionar
                    </Button>
                  </div>
                </div>

                {proofsList.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    {proofsList.map((proof: any) => (
                      <div key={proof.id} className="bg-muted/20 border border-border/20 rounded-lg p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[9px]">Sem. {proof.week}</Badge>
                          <span className="text-muted-foreground text-[9px]">{new Date(proof.createdAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <a href={proof.photoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <Image className="w-3 h-3" /> Ver foto
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {campaign.status === "inativa" && (
            <div className="bg-card border border-gray-500/30 rounded-lg p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-400">Campanha Finalizada</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta campanha foi finalizada e arquivada na Biblioteca. Os dados abaixo são somente leitura.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MiniStat label="Comprovantes" value={`${proofsList.length}`} />
                <MiniStat label="Restaurantes" value={`${restaurantsConfigured}`} />
                <MiniStat label="Receita Total" value={formatCurrency(p.contractRevenue)} />
                <MiniStat label="Lucro Total" value={formatCurrency(p.contractProfit)} />
              </div>
            </div>
          )}

          <Tabs defaultValue="resumo" className="space-y-4">
            <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
              <TabsList className="bg-card border border-border/30 inline-flex w-auto min-w-full sm:w-auto">
                <TabsTrigger value="resumo" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Painel</TabsTrigger>
                <TabsTrigger value="financeiro" className="gap-1.5 text-xs"><CircleDollarSign className="w-3.5 h-3.5" /> Financeiro</TabsTrigger>
                <TabsTrigger value="restaurantes" className="gap-1.5 text-xs"><Store className="w-3.5 h-3.5" /> Distribuição</TabsTrigger>
                <TabsTrigger value="cliente" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Cliente</TabsTrigger>
                <TabsTrigger value="historico" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Histórico</TabsTrigger>
              </TabsList>
            </div>

            {/* ─── PAINEL (Dashboard) ─── */}
            <TabsContent value="resumo" className="space-y-4">
              {(campaign as any).isBonificada && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span className="font-medium">Campanha Bonificada — sem geração de receita</span>
                </div>
              )}
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Período & Progresso</h3>
                  {batchCount > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span>{new Date(batchStartDate).toLocaleDateString("pt-BR")}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{new Date(batchEndDate).toLocaleDateString("pt-BR")}</span>
                      </div>
                      {batchLabel && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{batchLabel}</Badge>
                        </div>
                      )}
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
                        <MiniStat label="Duração" value={`${batchCount} batch${batchCount > 1 ? "es" : ""} (${batchWeeks} semanas)`} />
                        <MiniStat label="Dias restantes" value={`${Math.max(0, totalDays - daysElapsed)}`} />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-3 text-center">
                      <p className="text-xs text-muted-foreground">Sem batches atribuídos</p>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/batches")}>
                        <Calendar className="w-3.5 h-3.5" /> Gerenciar Batches
                      </Button>
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Restaurantes" value={`${restaurantsConfigured}/${campaign.activeRestaurants}`}
                      warn={restaurantsMissing > 0}
                    />
                    <MiniStat label="Coasters/Rest." value={(restaurantsConfigured > 0 ? Math.round(totalCoastersDistributed / restaurantsConfigured) : campaign.coastersPerRestaurant).toLocaleString("pt-BR")} />
                    <MiniStat label="Total Coasters" value={expectedTotalCoasters.toLocaleString("pt-BR")} />
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
                <ContractCard label="Contrato Total" value={formatCurrency(p.contractRevenue)} sub={batchCount > 0 ? `${batchCount} batch${batchCount > 1 ? "es" : ""} (${batchWeeks} semanas)` : `${campaign.contractDuration} meses`} />
                <ContractCard label="Custos do Contrato" value={formatCurrency(p.contractCosts)} />
                <ContractCard label="Lucro do Contrato" value={formatCurrency(p.contractProfit)} accent />
                <ContractCard label="Coasters Total Contrato" value={(expectedTotalCoasters * campaign.contractDuration).toLocaleString("pt-BR")} sub="unidades" />
              </div>
            </TabsContent>

            {/* ─── FINANCEIRO ─── */}
            <TabsContent value="financeiro" className="space-y-4">
              {(campaign as any).isBonificada && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
                  <Gift className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Campanha Bonificada</p>
                    <p className="text-xs text-amber-400/70">Esta campanha é oferecida como bonificação. Valores financeiros não geram receita.</p>
                  </div>
                </div>
              )}
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

              {/* ── FATURAS REAIS ── */}
              {!campaign.isBonificada && (() => {
                const totalFaturado = campaignInvoices.filter(i => i.status !== "cancelada").reduce((s, i) => s + parseFloat(i.amount), 0);
                const totalRecebido = campaignInvoices.filter(i => i.status === "paga").reduce((s, i) => s + parseFloat(i.amount), 0);
                const totalPendente = campaignInvoices.filter(i => i.status === "emitida").reduce((s, i) => s + parseFloat(i.amount), 0);
                const invoiceStatusColor: Record<string, string> = {
                  emitida: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                  paga: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                  vencida: "bg-red-500/20 text-red-400 border-red-500/30",
                  cancelada: "bg-muted/20 text-muted-foreground border-border/30",
                };
                const invoiceStatusLabel: Record<string, string> = { emitida: "Emitida", paga: "Paga", vencida: "Vencida", cancelada: "Cancelada" };
                return (
                  <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Faturas desta Campanha</h3>
                        {campaignInvoices.length > 0 && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{campaignInvoices.length}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/financeiro/faturamento")}>
                          Ver todas <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button size="sm" className="text-xs h-7 gap-1" onClick={() => {
                          setInvoiceAmount(String(p.contractRevenue.toFixed(2)));
                          const due = new Date(); due.setDate(due.getDate() + 30);
                          setInvoiceDueDate(due.toISOString().split("T")[0]);
                          setIsInvoiceDialogOpen(true);
                        }}>
                          <Plus className="w-3.5 h-3.5" /> Emitir Fatura
                        </Button>
                      </div>
                    </div>

                    {campaignInvoices.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 pb-2">
                        <div className="text-center p-3 rounded-lg bg-muted/5 border border-border/20">
                          <p className="text-xs text-muted-foreground">Faturado</p>
                          <p className="font-mono font-semibold text-sm">{formatCurrency(totalFaturado)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                          <p className="text-xs text-muted-foreground">Recebido</p>
                          <p className="font-mono font-semibold text-sm text-emerald-400">{formatCurrency(totalRecebido)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                          <p className="text-xs text-muted-foreground">A Receber</p>
                          <p className="font-mono font-semibold text-sm text-amber-400">{formatCurrency(totalPendente)}</p>
                        </div>
                      </div>
                    )}

                    {campaignInvoices.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                        <Receipt className="w-8 h-8 opacity-20" />
                        <p>Nenhuma fatura emitida para esta campanha</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {campaignInvoices.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border/20 bg-muted/5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div>
                                <p className="text-sm font-medium font-mono">{inv.invoiceNumber}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Emitida {inv.issueDate ? inv.issueDate.split("-").reverse().join("/") : "—"}
                                  {inv.dueDate ? ` · Vence ${inv.dueDate.split("-").reverse().join("/")}` : ""}
                                  {inv.paymentDate ? ` · Pago ${inv.paymentDate.split("-").reverse().join("/")}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <p className="font-mono font-semibold text-sm">{formatCurrency(parseFloat(inv.amount))}</p>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${invoiceStatusColor[inv.status] || invoiceStatusColor.cancelada}`}>
                                {invoiceStatusLabel[inv.status] || inv.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── PAGAMENTOS RESTAURANTES ── */}
              {!campaign.isBonificada && campaignPayments.length > 0 && (() => {
                const totalPago = campaignPayments.filter(p => p.status === "paid").reduce((s, p) => s + parseFloat(p.amount), 0);
                const totalPendente = campaignPayments.filter(p => p.status === "pending").reduce((s, p) => s + parseFloat(p.amount), 0);
                return (
                  <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HandCoins className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Pagamentos a Restaurantes</h3>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{campaignPayments.length}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/financeiro/pagamentos")}>
                        Ver todos <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-xs text-muted-foreground">Pago</p>
                        <p className="font-mono font-semibold text-sm text-emerald-400">{formatCurrency(totalPago)}</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                        <p className="text-xs text-muted-foreground">Pendente</p>
                        <p className="font-mono font-semibold text-sm text-orange-400">{formatCurrency(totalPendente)}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {campaignPayments.slice(0, 5).map((pay) => (
                        <div key={pay.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/10 bg-muted/3">
                          <div>
                            <p className="text-sm font-medium">{pay.restaurantName}</p>
                            <p className="text-[11px] text-muted-foreground">{pay.dueDate ? pay.dueDate.split("-").reverse().join("/") : "—"}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="font-mono text-sm">{formatCurrency(parseFloat(pay.amount))}</p>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${pay.status === "paid" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-orange-500/20 text-orange-400 border-orange-500/30"}`}>
                              {pay.status === "paid" ? "Pago" : "Pendente"}
                            </span>
                          </div>
                        </div>
                      ))}
                      {campaignPayments.length > 5 && (
                        <button className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-1" onClick={() => navigate("/financeiro/pagamentos")}>
                          +{campaignPayments.length - 5} pagamentos <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div className="bg-card border border-border/30 rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border/20 bg-muted/10">
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Restaurante</th>
                        <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3 hidden md:table-cell">Rating</th>
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
                            <td className="p-3 text-center hidden md:table-cell">
                              {(r as any).ratingScore != null ? (
                                <span className="inline-flex items-center text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                                  {parseFloat((r as any).ratingScore).toFixed(2)}
                                </span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
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
                {confirmAction === "completeBriefing" && "Concluir Briefing?"}
                {confirmAction === "submitDesign" && "Enviar Design para Aprovação?"}
                {confirmAction === "approveDesign" && "Aprovar Design?"}
                {confirmAction === "receiveMaterial" && "Confirmar Recebimento do Material?"}
                {confirmAction === "completeProduction" && "Concluir Produção?"}
                {confirmAction === "confirmMaterial" && "Confirmar Recebimento?"}
                {confirmAction === "finalize" && "Finalizar Campanha?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction === "approve" && "A cotação será aprovada e a campanha será ativada."}
                {confirmAction === "archive" && "A cotação será arquivada e não será mais visível na lista principal."}
                {confirmAction === "pause" && "A campanha será pausada temporariamente."}
                {confirmAction === "resume" && "A campanha será retomada."}
                {confirmAction === "complete" && "A campanha será marcada como concluída."}
                {confirmAction === "reactivate" && "A campanha será reativada."}
                {confirmAction === "completeBriefing" && "O briefing será marcado como concluído e a campanha avançará para produção de design."}
                {confirmAction === "submitDesign" && "O design será enviado para aprovação do cliente. A campanha avançará para etapa de aprovação."}
                {confirmAction === "approveDesign" && "O design será aprovado. Uma OS de produção gráfica será gerada automaticamente."}
                {confirmAction === "receiveMaterial" && "O recebimento do material será confirmado. Uma OS de distribuição será gerada automaticamente para os restaurantes configurados."}
                {confirmAction === "completeProduction" && "A produção será concluída, uma OS de Produção será gerada automaticamente e o material passará para trânsito."}
                {confirmAction === "confirmMaterial" && "O recebimento será confirmado e a campanha ficará pronta para execução."}
                {confirmAction === "finalize" && "A campanha será finalizada e arquivada na Biblioteca."}
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

        <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Emitir Fatura
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="bg-background border-border/30 h-9 text-sm font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Data de Vencimento</Label>
                <Input
                  type="date"
                  value={invoiceDueDate}
                  onChange={(e) => setInvoiceDueDate(e.target.value)}
                  className="bg-background border-border/30 h-9 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Observações (opcional)</Label>
                <Textarea
                  placeholder="Referência, condições de pagamento..."
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="bg-background border-border/30 text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsInvoiceDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleCreateInvoice} disabled={createInvoiceMutation.isPending}>
                {createInvoiceMutation.isPending ? "Emitindo..." : "Emitir Fatura"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
