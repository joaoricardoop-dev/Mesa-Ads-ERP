import { useState, useMemo, useRef } from "react";
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
  Pencil,
  FileBarChart2,
  Send,
  Trash2,
  Download,
  X,
  Users,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ObjectUploader } from "@/components/ObjectUploader";
import { calcTelaImpressions, TELAS_INSERCOES } from "@/hooks/useBudgetCalculator";
import { calcImpressionesParaLocal } from "@/lib/campaign-builder-utils";
import { generateReportPdf } from "@/lib/generate-report-pdf";

const CARRIER_SLUGS: Record<string, string> = {
  latam: "latam", "latam cargo": "latam", ltm: "latam",
  jadlog: "jadlog", "jad log": "jadlog",
  correios: "correios", ect: "correios",
  loggi: "loggi",
  azul: "azul-cargo", "azul cargo": "azul-cargo", "azul cargo express": "azul-cargo",
  tnt: "tnt",
  buslog: "buslog",
  braspress: "braspress",
  sequoia: "sequoia",
  "total express": "total-express", totalexpress: "total-express",
  "melhor envio": "melhor-envio", melhorenvio: "melhor-envio",
};

function buildTrackingUrl(code: string, provider?: string | null): string {
  const slug = provider ? CARRIER_SLUGS[provider.toLowerCase().trim()] : undefined;
  if (slug) return `https://www.melhorrastreio.com.br/app/${slug}/${code}`;
  return `https://www.melhorrastreio.com.br/rastreio/${code}`;
}

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

const WORKFLOW_STEPS_FISICO = [
  { key: "briefing", label: "Briefing", step: 1 },
  { key: "design", label: "Design", step: 2 },
  { key: "aprovacao", label: "Aprovação", step: 3 },
  { key: "producao", label: "Produção", step: 4 },
  { key: "distribuicao", label: "Distribuição", step: 5 },
  { key: "veiculacao", label: "Veiculação", step: 6 },
  { key: "inativa", label: "Concluída", step: 7 },
];

const WORKFLOW_STEPS_ELETRONICO = [
  { key: "briefing", label: "Briefing", step: 1 },
  { key: "aprovacao", label: "Aprovação de Material", step: 2 },
  { key: "producao", label: "Material Recebido", step: 3 },
  { key: "veiculacao", label: "Veiculação", step: 4 },
  { key: "inativa", label: "Concluída", step: 5 },
];

const WORKFLOW_STEPS_ATIVACAO = [
  { key: "briefing", label: "Briefing", step: 1 },
  { key: "producao", label: "Planejamento", step: 2 },
  { key: "veiculacao", label: "Execução", step: 3 },
  { key: "inativa", label: "Concluída", step: 4 },
];

const WORKFLOW_STEPS_DEFAULT = WORKFLOW_STEPS_FISICO;

function getWorkflowSteps(workflowTemplate?: string | null) {
  if (workflowTemplate === "eletronico_cliente_envia") return WORKFLOW_STEPS_ELETRONICO;
  if (workflowTemplate === "ativacao_evento") return WORKFLOW_STEPS_ATIVACAO;
  return WORKFLOW_STEPS_DEFAULT;
}

const WORKFLOW_STEPS = WORKFLOW_STEPS_DEFAULT;

const HISTORY_LABELS: Record<string, string> = {
  created: "Cotação criada",
  approved: "Cotação aprovada",
  archived: "Cotação arquivada",
  paused: "Campanha pausada",
  resumed: "Campanha retomada",
  completed: "Campanha concluída",
  reactivated: "Campanha reativada",
  updated: "Campanha atualizada",
  restaurants_updated: "Locais atualizados",
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
  freightCost?: string | number | null;
  productTipo?: string | null;
  avgMonthlyCustomers?: number | null;
  productImpressionParams?: {
    impressionFormulaType?: string | null;
    attentionFactor?: string | number | null;
    defaultPessoasPorMesa?: string | number | null;
    loopDurationSeconds?: string | number | null;
    frequenciaAparicoes?: string | number | null;
  } | null;
  locationData?: {
    seatCount?: number | null;
    tableCount?: number | null;
    monthlyCustomers?: number | null;
    avgStayMinutes?: number | null;
  } | null;
}) {
  const n = c.activeRestaurants;
  const coasters = c.coastersPerRestaurant;
  const unitCost = Number(c.batchCost) / c.batchSize;
  const productionCostPerRest = coasters * unitCost;

  const productParams = c.productImpressionParams ?? null;
  const formula = productParams?.impressionFormulaType ?? (c.productTipo === "telas" ? "por_tela" : "por_coaster");
  const impressionsPerRest = calcImpressionesParaLocal({
    product: productParams ?? { impressionFormulaType: formula },
    location: c.locationData ?? (c.avgMonthlyCustomers != null ? { monthlyCustomers: c.avgMonthlyCustomers } : null),
    qtdCoasters: coasters,
    usosporCoaster: c.usagePerDay,
    daysPerMonth: c.daysPerMonth,
  });
  const sellerRate = Number(c.sellerCommission) / 100;
  const taxRateDecimal = Number(c.taxRate) / 100;
  const freightPerRest = n > 0 ? Number(c.freightCost || 0) / n : 0;

  const restCommFixed = c.commissionType === "fixed" ? Number(c.fixedCommission) * coasters : 0;
  const custoPD = productionCostPerRest + restCommFixed + freightPerRest;
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
  const totalCostsPerRest = productionCostPerRest + freightPerRest + restCommPerRest + sellerCommPerRest + taxPerRest;
  const profitPerRest = sellingPricePerRest - totalCostsPerRest;
  const grossMargin = sellingPricePerRest > 0 ? (profitPerRest / sellingPricePerRest) * 100 : 0;

  const totalCoasters = coasters * n;
  const totalImpressions = impressionsPerRest * n;
  const totalProductionCost = productionCostPerRest * n;
  const totalFreight = freightPerRest * n;
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
    totalFreight,
    freightPerRest,
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
  const [editingParams, setEditingParams] = useState(false);
  const [paramsForm, setParamsForm] = useState<{
    coastersPerRestaurant: string;
    usagePerDay: string;
    daysPerMonth: string;
    activeRestaurants: string;
    pricingType: string;
    markupPercent: string;
    fixedPrice: string;
    commissionType: string;
    restaurantCommission: string;
    fixedCommission: string;
    sellerCommission: string;
    taxRate: string;
    contractDuration: string;
    batchSize: string;
    batchCost: string;
    freightCost: string;
  } | null>(null);

  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [reportForm, setReportForm] = useState({
    title: "",
    periodStart: "",
    periodEnd: "",
    reportType: "coaster" as "coaster" | "telas" | "ativacao",
    numRestaurants: 0,
    coastersDistributed: 0,
    usagePerDay: 3,
    daysInPeriod: 30,
    numScreens: 0,
    spotsPerDay: 0,
    spotDurationSeconds: 30,
    activationEvents: 0,
    peoplePerEvent: 0,
    notes: "",
  });
  const [reportPdfLoading, setReportPdfLoading] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: campaign, isLoading } = trpc.campaign.get.useQuery({ id: campaignId }, { enabled: campaignId > 0 });
  const { data: campaignRestaurants = [] } = trpc.campaign.getRestaurants.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: historyList = [] } = trpc.campaign.getHistory.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: clientsData } = trpc.advertiser.list.useQuery();
  const clientsList = clientsData?.items ?? [];
  const { data: restaurantsList = [] } = trpc.restaurant.list.useQuery();
  const { data: proofsList = [] } = trpc.campaign.getProofs.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignBatchList = [] } = trpc.batch.getCampaignBatches.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignInvoices = [] } = trpc.financial.listInvoices.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignPayments = [] } = trpc.financial.listPayments.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignSoList = [] } = trpc.serviceOrder.list.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignReportsList = [], refetch: refetchReports } = trpc.campaignReport.list.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const { data: campaignPayables = [], refetch: refetchPayables } = trpc.financial.listAccountsPayable.useQuery({ campaignId }, { enabled: campaignId > 0 });
  const generatePayablesMutation = trpc.financial.generateCampaignPayables.useMutation({
    onSuccess: (data) => { refetchPayables(); toast.success(`${data.generated} lançamentos gerados`); },
  });
  const markPayablePaidMutation = trpc.financial.markAccountPayablePaid.useMutation({
    onSuccess: () => { refetchPayables(); toast.success("Pagamento registrado"); },
  });

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

  const ensureProductionOSMutation = trpc.campaign.ensureProductionOS.useMutation({
    onSuccess: () => {
      utils.serviceOrder.list.invalidate();
      toast.success("OS de produção criada com sucesso.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const uploadArtMutation = trpc.campaign.uploadArt.useMutation({
    onSuccess: (data) => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      utils.serviceOrder.list.invalidate();
      setArtPdfUrl("");
      setArtImageUrls("");
      toast.success("Arte enviada! Campanha em produção.");
      if (data?.productionCostRegistered) {
        toast.info("Custo de produção registrado automaticamente no financeiro.");
      }
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

  const { data: allPartners } = trpc.partner.list.useQuery({ status: "active" });

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
    onSuccess: (data) => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Design aprovado! OS de produção gerada — campanha em produção gráfica.");
      if (data?.productionCostRegistered) {
        toast.info("Custo de produção registrado automaticamente no financeiro.");
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  const receiveMaterialMutation = trpc.campaign.receiveMaterial.useMutation({
    onSuccess: (data) => {
      utils.campaign.get.invalidate();
      utils.campaign.getHistory.invalidate();
      utils.campaign.list.invalidate();
      setConfirmAction(null);
      toast.success("Material recebido! OS de distribuição gerada — campanha em distribuição.");
      if (data?.freightCostRegistered) {
        toast.info("Custo de frete registrado automaticamente no financeiro.");
      }
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
      toast.success("Locais atualizados!");
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

  const createReportMutation = trpc.campaignReport.create.useMutation({
    onSuccess: () => { refetchReports(); setReportSheetOpen(false); toast.success("Relatório criado com sucesso!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateReportMutation = trpc.campaignReport.update.useMutation({
    onSuccess: () => { refetchReports(); setReportSheetOpen(false); setEditingReportId(null); toast.success("Relatório atualizado!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const publishReportMutation = trpc.campaignReport.publish.useMutation({
    onSuccess: () => { refetchReports(); toast.success("Relatório publicado para o anunciante!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteReportMutation = trpc.campaignReport.delete.useMutation({
    onSuccess: () => { refetchReports(); toast.success("Relatório excluído."); },
    onError: (err: any) => toast.error(err.message),
  });

  const addReportPhotoMutation = trpc.campaignReport.addPhoto.useMutation({
    onSuccess: () => { refetchReports(); toast.success("Foto adicionada!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteReportPhotoMutation = trpc.campaignReport.deletePhoto.useMutation({
    onSuccess: () => { refetchReports(); toast.success("Foto removida."); },
    onError: (err: any) => toast.error(err.message),
  });

  function openNewReportSheet() {
    setEditingReportId(null);
    setReportForm({
      title: "", periodStart: "", periodEnd: "",
      reportType: "coaster", numRestaurants: 0, coastersDistributed: 0,
      usagePerDay: 3, daysInPeriod: 30, numScreens: 0,
      spotsPerDay: 0, spotDurationSeconds: 30,
      activationEvents: 0, peoplePerEvent: 0, notes: "",
    });
    setReportSheetOpen(true);
  }

  function openEditReportSheet(report: any) {
    setEditingReportId(report.id);
    setReportForm({
      title: report.title ?? "",
      periodStart: report.periodStart ?? "",
      periodEnd: report.periodEnd ?? "",
      reportType: (report.reportType ?? "coaster") as "coaster" | "telas" | "ativacao",
      numRestaurants: report.numRestaurants ?? 0,
      coastersDistributed: report.coastersDistributed ?? 0,
      usagePerDay: report.usagePerDay ?? 3,
      daysInPeriod: report.daysInPeriod ?? 30,
      numScreens: report.numScreens ?? 0,
      spotsPerDay: report.spotsPerDay ?? 0,
      spotDurationSeconds: report.spotDurationSeconds ?? 30,
      activationEvents: report.activationEvents ?? 0,
      peoplePerEvent: report.peoplePerEvent ?? 0,
      notes: report.notes ?? "",
    });
    setReportSheetOpen(true);
  }

  function handleSaveReport() {
    if (!reportForm.title || !reportForm.periodStart || !reportForm.periodEnd) {
      toast.error("Preencha título e período do relatório.");
      return;
    }
    if (editingReportId) {
      updateReportMutation.mutate({ id: editingReportId, campaignId, ...reportForm });
    } else {
      createReportMutation.mutate({ campaignId, ...reportForm });
    }
  }

  function calcPreviewImpressions() {
    const f = reportForm;
    if (f.reportType === "coaster") return f.coastersDistributed * f.usagePerDay * f.daysInPeriod;
    if (f.reportType === "telas") return f.numScreens * f.spotsPerDay * f.daysInPeriod;
    if (f.reportType === "ativacao") return f.activationEvents * f.peoplePerEvent;
    return 0;
  }

  async function handleDownloadReportPdf(report: any, client: any) {
    setReportPdfLoading(report.id);
    try {
      await generateReportPdf({
        campaignName: campaign?.name ?? "",
        clientName: client?.name ?? undefined,
        reportTitle: report.title,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        reportType: report.reportType ?? "coaster",
        numRestaurants: report.numRestaurants ?? 0,
        coastersDistributed: report.coastersDistributed ?? 0,
        usagePerDay: report.usagePerDay ?? 3,
        daysInPeriod: report.daysInPeriod ?? 30,
        numScreens: report.numScreens ?? 0,
        spotsPerDay: report.spotsPerDay ?? 0,
        spotDurationSeconds: report.spotDurationSeconds ?? 30,
        activationEvents: report.activationEvents ?? 0,
        peoplePerEvent: report.peoplePerEvent ?? 0,
        totalImpressions: report.totalImpressions ?? 0,
        notes: report.notes,
        photos: report.photos ?? [],
        publishedAt: report.publishedAt,
      });
    } catch (err: any) {
      toast.error("Erro ao gerar PDF do relatório.");
    } finally {
      setReportPdfLoading(null);
    }
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

  // Revenue source of truth: prefer signed OS de anunciante, fallback to quotation
  const osAnuncianteTotalValue = (campaign as any).osAnuncianteTotalValue ? parseFloat((campaign as any).osAnuncianteTotalValue) : null;
  const quotationTotalValue = (campaign as any).quotationTotalValue ? parseFloat((campaign as any).quotationTotalValue) : null;
  const contractRevenueTruth = osAnuncianteTotalValue && osAnuncianteTotalValue > 0
    ? osAnuncianteTotalValue
    : quotationTotalValue;
  const hasQuotationRevenue = !campaign.isBonificada && contractRevenueTruth && contractRevenueTruth > 0;

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

  // Average monthly customers across configured restaurants with valid data (for telas impression formula)
  const avgMonthlyCustomers = (() => {
    const withData = campaignRestaurants.filter(r => (r.restaurantMonthlyCustomers ?? 0) > 0);
    if (withData.length === 0) return 0;
    return Math.round(withData.reduce((sum, r) => sum + (r.restaurantMonthlyCustomers ?? 0), 0) / withData.length);
  })();

  // pBase uses the effective per-restaurant coaster count for accurate production cost
  const productImpressionParams = {
    impressionFormulaType: (campaign as any).productImpressionFormulaType ?? null,
    attentionFactor: (campaign as any).productAttentionFactor ?? null,
    defaultPessoasPorMesa: (campaign as any).productDefaultPessoasPorMesa ?? null,
    loopDurationSeconds: (campaign as any).productLoopDurationSeconds ?? null,
    frequenciaAparicoes: (campaign as any).productFrequenciaAparicoes ?? null,
  };
  const pBase = calcCampaignPricing({ ...campaign, coastersPerRestaurant: effectiveCoastersPerRest, productTipo: campaign.productTipo, avgMonthlyCustomers, productImpressionParams });

  let p: typeof pBase;
  if (hasQuotationRevenue) {
    // Revenue source of truth: OS de anunciante assinada, ou cotação vinculada
    const contractRevenue = contractRevenueTruth!;
    const n = campaign.activeRestaurants || 1;
    const monthlyRevenue = contractRevenue / (campaign.contractDuration || 1);
    const sellingPricePerRest = monthlyRevenue / n;
    // Freight: fixed campaign cost distributed per restaurant
    const freightPerRest = n > 0 ? Number((campaign as any).freightCost || 0) / n : 0;
    // Commissions applied to actual agreed revenue
    const restCommPerRest = sellingPricePerRest * (Number(campaign.restaurantCommission) / 100);
    const sellerCommPerRest = sellingPricePerRest * (Number(campaign.sellerCommission) / 100);
    const taxPerRest = sellingPricePerRest * (Number(campaign.taxRate) / 100);
    // Production cost: use campaign's coastersPerRestaurant as originally modeled
    const productionCostPerRest = pBase.productionCostPerRest;
    const totalCostsPerRest = productionCostPerRest + freightPerRest + restCommPerRest + sellerCommPerRest + taxPerRest;
    const profitPerRest = sellingPricePerRest - totalCostsPerRest;
    const totalRestComm = restCommPerRest * n;
    const totalSellerComm = sellerCommPerRest * n;
    const totalTax = taxPerRest * n;
    const totalProductionCost = productionCostPerRest * n;
    const totalFreight = freightPerRest * n;
    const totalCosts = totalCostsPerRest * n;
    const monthlyProfit = profitPerRest * n;
    const grossMargin = sellingPricePerRest > 0 ? (profitPerRest / sellingPricePerRest) * 100 : 0;
    p = {
      ...pBase,
      sellingPricePerRest,
      restCommPerRest,
      sellerCommPerRest,
      taxPerRest,
      freightPerRest,
      productionCostPerRest,
      profitPerRest,
      totalCostsPerRest,
      totalRestComm,
      totalSellerComm,
      totalTax,
      totalFreight,
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

  if ((campaign as any).isBonificada) {
    const prodTotal = p.totalProductionCost;
    const freightTotal = p.totalFreight;
    const costOnly = prodTotal + freightTotal;
    p = {
      ...p,
      sellingPricePerRest: 0,
      restCommPerRest: 0,
      sellerCommPerRest: 0,
      taxPerRest: 0,
      profitPerRest: 0,
      totalCostsPerRest: p.productionCostPerRest + p.freightPerRest,
      totalRestComm: 0,
      totalSellerComm: 0,
      totalTax: 0,
      totalCosts: costOnly,
      monthlyRevenue: 0,
      monthlyProfit: -(costOnly),
      contractRevenue: 0,
      contractProfit: -(costOnly * campaign.contractDuration),
      contractCosts: costOnly * campaign.contractDuration,
      grossMargin: 0,
      roi: 0,
      cpi: 0,
    };
  }

  const client = clientsList.find((cl) => cl.id === campaign.clientId);

  const isBonif = !!(campaign as any).isBonificada;

  const costBreakdownData = isBonif ? [
    { name: "Produção", value: p.totalProductionCost, color: "#22c55e" },
    { name: "Frete", value: p.totalFreight, color: "#f59e0b" },
  ].filter(d => d.value > 0) : [
    { name: "Produção", value: p.totalProductionCost, color: "#22c55e" },
    { name: "Com. Local", value: p.totalRestComm, color: "#3b82f6" },
    { name: "Com. Vendedor", value: p.totalSellerComm, color: "#f59e0b" },
    { name: "Impostos", value: p.totalTax, color: "#ef4444" },
    { name: "Lucro", value: Math.max(0, p.monthlyProfit), color: "#8b5cf6" },
  ];

  const perRestBarData = isBonif ? [
    { name: "Produção", custo: p.productionCostPerRest },
    { name: "Frete", custo: p.freightPerRest },
  ].filter(d => d.custo > 0) : [
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

        {/* ── Stepper sticky (dynamic template-aware) ───────────────────── */}
        {(() => {
          const workflowSteps = getWorkflowSteps((campaign as any).productWorkflowTemplate);
          return workflowSteps.some(s => s.key === campaign.status) && (
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/20 px-4 lg:px-6 py-3">
              <div className="flex items-center gap-1 mb-1.5">
                {workflowSteps.map((step, i) => {
                  const currentStep = workflowSteps.find(s => s.key === campaign.status)?.step || 0;
                  const isCompleted = step.step < currentStep;
                  const isCurrent = step.key === campaign.status;
                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center flex-1 last:flex-none">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all ${
                          isCompleted ? "bg-emerald-500 border-emerald-500 text-white" :
                          isCurrent ? "bg-primary border-primary text-primary-foreground ring-2 ring-primary/30" :
                          "bg-muted border-border/30 text-muted-foreground"
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : step.step}
                        </div>
                        <span className={`text-[8px] mt-0.5 text-center leading-tight ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                      {i < workflowSteps.length - 1 && (
                        <div className={`h-0.5 flex-1 mx-0.5 mb-3.5 ${step.step < currentStep ? "bg-emerald-500" : "bg-border/30"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span>Etapa {workflowSteps.find(s => s.key === campaign.status)?.step || 0} de {workflowSteps.length}</span>
                {slaStages.filter(s => s.isCurrent).map(s => (
                  <span key={s.key} className={`ml-2 px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${
                    s.days !== null && s.days > s.threshold ? "bg-red-500/10 text-red-400 border-red-500/30" :
                    s.days !== null && s.days > s.threshold * 0.7 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                    "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  }`}>
                    {s.days !== null ? `${s.days}d nesta etapa` : "em curso"}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="p-4 lg:p-6 space-y-5">
          {/* SLA detail card (shown in the main content area) */}
          {slaStages.length > 0 && (
            <div className="bg-card border border-border/30 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Duração por Etapa</p>
              <div className="flex flex-wrap gap-1.5">
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

              {!prodSo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                  disabled={ensureProductionOSMutation.isPending}
                  onClick={() => ensureProductionOSMutation.mutate({ id: campaignId })}
                >
                  <Package className="w-3.5 h-3.5" />
                  {ensureProductionOSMutation.isPending ? "Criando OS..." : "Criar OS de Produção"}
                </Button>
              )}

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
                            <a href={buildTrackingUrl(t.trackingCode, t.freightProvider)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Rastrear</a>
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
                            <a href={buildTrackingUrl(t.trackingCode, t.freightProvider)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Rastrear</a>
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
                <MiniStat label="Locais" value={`${restaurantsConfigured}`} />
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
                    <Label className="text-xs">Local</Label>
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
                <MiniStat label="Locais" value={`${restaurantsConfigured}`} />
                <MiniStat label="Receita Total" value={formatCurrency(p.contractRevenue)} />
                <MiniStat label="Lucro Total" value={formatCurrency(p.contractProfit)} />
              </div>
            </div>
          )}

          {/* ── Rastreamentos de Frete (always visible when OS exists) ── */}
          {(prodSo || distSo) && !["producao", "distribuicao"].includes(campaign.status) && (
            <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold">Rastreamentos de Frete</h3>
              </div>

              <div className="space-y-4">
                {/* Produção OS trackings */}
                {prodSo && (
                  <div className="border border-border/20 rounded-md p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">OS Produção · {prodSo.orderNumber}</p>
                      <button
                        onClick={() => { setAddTrackingForSoId(prodSo.id); setNewTrackCode(""); setNewTrackProv(""); setNewTrackDate(""); setNewTrackLabel(""); }}
                        className="text-[10px] text-primary hover:text-primary/80 underline"
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
                              <Button size="sm" className="h-6 text-xs" disabled={updateTrackingMutation.isPending}
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
                              <a href={buildTrackingUrl(t.trackingCode, t.freightProvider)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Rastrear</a>
                              <button onClick={() => { setEditingTrackId(t.id); setEditTrackCode(t.trackingCode); setEditTrackProv(t.freightProvider || ""); setEditTrackDate(t.expectedDate || ""); setEditTrackLabel(t.label || ""); }} className="text-[10px] text-muted-foreground hover:text-foreground underline ml-2">Editar</button>
                              <button onClick={() => deleteTrackingMutation.mutate({ id: t.id })} className="text-[10px] text-red-400 hover:text-red-300 underline ml-2">Remover</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {addTrackingForSoId === prodSo.id && (
                      <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Novo Rastreamento</p>
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
                          <Button size="sm" className="h-6 text-xs" disabled={!newTrackCode || addTrackingMutation.isPending}
                            onClick={() => addTrackingMutation.mutate({ serviceOrderId: prodSo.id, trackingCode: newTrackCode, freightProvider: newTrackProv || undefined, expectedDate: newTrackDate || undefined, label: newTrackLabel || undefined })}>
                            Adicionar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddTrackingForSoId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Distribuição OS trackings */}
                {distSo && (
                  <div className="border border-border/20 rounded-md p-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">OS Distribuição · {distSo.orderNumber}</p>
                      <button
                        onClick={() => { setAddTrackingForSoId(distSo.id); setNewTrackCode(""); setNewTrackProv(""); setNewTrackDate(""); setNewTrackLabel(""); }}
                        className="text-[10px] text-primary hover:text-primary/80 underline"
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
                              <Button size="sm" className="h-6 text-xs" disabled={updateTrackingMutation.isPending}
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
                              <a href={buildTrackingUrl(t.trackingCode, t.freightProvider)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Rastrear</a>
                              <button onClick={() => { setEditingTrackId(t.id); setEditTrackCode(t.trackingCode); setEditTrackProv(t.freightProvider || ""); setEditTrackDate(t.expectedDate || ""); setEditTrackLabel(t.label || ""); }} className="text-[10px] text-muted-foreground hover:text-foreground underline ml-2">Editar</button>
                              <button onClick={() => deleteTrackingMutation.mutate({ id: t.id })} className="text-[10px] text-red-400 hover:text-red-300 underline ml-2">Remover</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {addTrackingForSoId === distSo.id && (
                      <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Novo Rastreamento</p>
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
                          <Button size="sm" className="h-6 text-xs" disabled={!newTrackCode || addTrackingMutation.isPending}
                            onClick={() => addTrackingMutation.mutate({ serviceOrderId: distSo.id, trackingCode: newTrackCode, freightProvider: newTrackProv || undefined, expectedDate: newTrackDate || undefined, label: newTrackLabel || undefined })}>
                            Adicionar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddTrackingForSoId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                <TabsTrigger value="relatorios" className="gap-1.5 text-xs"><FileBarChart2 className="w-3.5 h-3.5" /> Relatórios</TabsTrigger>
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

              {/* ── Ficha Operacional ── */}
              {/* Row 1: Identificação, Contato, Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Dados da Campanha */}
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Identificação
                  </h3>
                  <div className="space-y-2.5">
                    {(campaign as any).campaignNumber && (
                      <DetailRow label="Número da Campanha" value={(campaign as any).campaignNumber} icon={<Hash className="w-3 h-3" />} />
                    )}
                    <DetailRow label="Nome" value={campaign.name} />
                    {campaign.productName && (
                      <DetailRow label="Produto / Marca" value={campaign.productName} icon={<Package className="w-3 h-3" />} />
                    )}
                    {client?.segment && (
                      <DetailRow label="Segmento de Mercado" value={client.segment} />
                    )}
                    <DetailRow label="Status Atual" value={STATUS_LABELS[campaign.status] || campaign.status} />
                    {(campaign as any).isBonificada && (
                      <DetailRow label="Tipo" value="Bonificada (sem receita)" />
                    )}
                    {(campaign as any).proposalSignedAt && (
                      <DetailRow label="Proposta Assinada em"
                        value={new Date((campaign as any).proposalSignedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        icon={<CheckCircle2 className="w-3 h-3" />}
                      />
                    )}
                    <DetailRow label="Criada em"
                      value={new Date(campaign.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      icon={<Clock className="w-3 h-3" />}
                    />
                    {campaign.materialReceivedDate && (
                      <DetailRow label="Material Recebido"
                        value={new Date(campaign.materialReceivedDate + "T12:00:00").toLocaleDateString("pt-BR")}
                        icon={<Package className="w-3 h-3" />}
                      />
                    )}
                    {/* Parceiro vinculado */}
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> Parceiro
                      </p>
                      {(() => {
                        const currentPartnerName = (campaign as any).partnerName;
                        const quotPartner = (campaign as any).quotationPartnerId;
                        if (quotPartner && currentPartnerName) {
                          return (
                            <p className="text-xs font-medium flex items-center gap-1.5">
                              {currentPartnerName}
                              <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">via cotação</span>
                            </p>
                          );
                        }
                        return (
                          <select
                            className="w-full text-xs bg-background border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                            value={campaign.partnerId ?? ""}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              updateMutation.mutate({ id: campaign.id, partnerId: val });
                              toast.success(val ? "Parceiro vinculado à campanha" : "Parceiro removido da campanha");
                            }}
                          >
                            <option value="">Nenhum parceiro</option>
                            {allPartners?.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Contato do Anunciante */}
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Contato do Anunciante
                  </h3>
                  {client ? (
                    <div className="space-y-2.5">
                      <DetailRow label="Nome / Fantasia" value={client.name} />
                      {client.company && <DetailRow label="Empresa" value={client.company} />}
                      {(client as any).razaoSocial && <DetailRow label="Razão Social" value={(client as any).razaoSocial} />}
                      {client.cnpj && (
                        <DetailRow label="CNPJ" value={client.cnpj} icon={<Hash className="w-3 h-3" />} />
                      )}
                      {client.contactName && <DetailRow label="Responsável / Contato" value={client.contactName} />}
                      {(client as any).phone && (
                        <DetailRow label="Telefone" value={(client as any).phone} icon={<Phone className="w-3 h-3" />} />
                      )}
                      {client.email && (
                        <DetailRow label="E-mail" value={client.email} icon={<Mail className="w-3 h-3" />} />
                      )}
                      {(client as any).instagram && (
                        <DetailRow label="Instagram" value={(client as any).instagram} icon={<Instagram className="w-3 h-3" />} />
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Cliente não encontrado</p>
                  )}
                </div>

                {/* Linha do Tempo do Processo */}
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> Linha do Tempo
                  </h3>
                  <div className="space-y-1.5">
                    {[
                      { label: "Proposta Assinada", at: (campaign as any).proposalSignedAt, color: "bg-orange-400" },
                      { label: "Briefing", at: (campaign as any).briefingEnteredAt, color: "bg-sky-400" },
                      { label: "Design", at: (campaign as any).designEnteredAt, color: "bg-purple-400" },
                      { label: "Aprovação", at: (campaign as any).aprovacaoEnteredAt, color: "bg-pink-400" },
                      { label: "Produção", at: (campaign as any).producaoEnteredAt, color: "bg-amber-400" },
                      { label: "Distribuição", at: (campaign as any).distribuicaoEnteredAt, color: "bg-teal-400" },
                      { label: "Veiculação", at: campaign.veiculacaoStartDate ? campaign.veiculacaoStartDate + "T12:00:00" : null, color: "bg-emerald-400" },
                    ].filter(s => s.at).map((s, i, arr) => {
                      const entryDate = new Date(s.at);
                      const nextAt = arr[i + 1]?.at ? new Date(arr[i + 1].at) : null;
                      const exitDate = nextAt || null;
                      const days = exitDate
                        ? Math.max(0, Math.floor((exitDate.getTime() - entryDate.getTime()) / 86400000))
                        : Math.max(0, Math.floor((Date.now() - entryDate.getTime()) / 86400000));
                      const isCurrent = !exitDate;
                      return (
                        <div key={s.label} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${s.color} ${isCurrent ? "ring-2 ring-offset-1 ring-offset-card ring-current" : ""}`} />
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <span className={`font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                            <span className="font-mono text-[10px] text-muted-foreground shrink-0 ml-2">
                              {entryDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              {isCurrent ? <span className="text-primary ml-1">({days}d)</span> : days > 0 ? <span className="ml-1">{days}d</span> : null}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {![(campaign as any).proposalSignedAt, (campaign as any).briefingEnteredAt].some(Boolean) && (
                      <p className="text-xs text-muted-foreground">Nenhuma etapa registrada ainda</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Escopo Contratado + Distribuição Geográfica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Escopo do Contrato */}
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Target className="w-3 h-3" /> Escopo do Contrato
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {/* Produto */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Produto Veiculado</p>
                      <p className="text-sm mt-0.5 font-medium">{campaign.productName || "Coaster (Porta-Copo)"}</p>
                    </div>
                    {/* Locais */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Locais</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {campaign.activeRestaurants}
                        <span className="text-muted-foreground text-xs font-sans ml-1">estabelecimentos</span>
                      </p>
                    </div>
                    {/* Volume de coasters */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Coasters / Mês</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {(quotationCoasterVolume || expectedTotalCoasters).toLocaleString("pt-BR")}
                        <span className="text-muted-foreground text-xs font-sans ml-1">un</span>
                      </p>
                    </div>
                    {/* Coasters por restaurante */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Coasters / Local</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {effectiveCoastersPerRest.toLocaleString("pt-BR")}
                        <span className="text-muted-foreground text-xs font-sans ml-1">un</span>
                      </p>
                    </div>
                    {/* Duração */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Duração do Contrato</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {campaign.contractDuration}
                        <span className="text-muted-foreground text-xs font-sans ml-1">{campaign.contractDuration === 1 ? "mês" : "meses"}</span>
                      </p>
                    </div>
                    {/* Total de coasters no contrato */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Coasters Contrato</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {((quotationCoasterVolume || expectedTotalCoasters) * campaign.contractDuration).toLocaleString("pt-BR")}
                        <span className="text-muted-foreground text-xs font-sans ml-1">un</span>
                      </p>
                    </div>
                    {/* Período de veiculação */}
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Período de Veiculação</p>
                      {campaign.veiculacaoStartDate ? (
                        <p className="text-sm mt-0.5 font-medium">
                          {new Date(campaign.veiculacaoStartDate + "T12:00:00").toLocaleDateString("pt-BR")}
                          {" → "}
                          {campaign.veiculacaoEndDate ? new Date(campaign.veiculacaoEndDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                        </p>
                      ) : campaign.startDate && campaign.endDate ? (
                        <p className="text-sm mt-0.5">
                          {new Date(campaign.startDate).toLocaleDateString("pt-BR")}
                          {" → "}
                          {new Date(campaign.endDate).toLocaleDateString("pt-BR")}
                          <span className="text-[10px] text-muted-foreground ml-1">(previsto)</span>
                        </p>
                      ) : (
                        <p className="text-sm mt-0.5 text-muted-foreground">—</p>
                      )}
                    </div>
                    {/* Frequência de uso */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Uso / Dia</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {campaign.usagePerDay}×
                        <span className="text-muted-foreground text-xs font-sans ml-1">por coaster</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dias / Mês</p>
                      <p className="text-sm mt-0.5 font-medium font-mono">
                        {campaign.daysPerMonth}
                        <span className="text-muted-foreground text-xs font-sans ml-1">dias úteis</span>
                      </p>
                    </div>
                    {/* Impressões mensais */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Impressões / Mês</p>
                      <p className="text-sm mt-0.5 font-medium font-mono text-primary">
                        {p.totalImpressions.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {/* Impressões totais contrato */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Impressões Totais</p>
                      <p className="text-sm mt-0.5 font-medium font-mono text-primary">
                        {(p.totalImpressions * campaign.contractDuration).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {/* Notas */}
                    {(campaign as any).notes && (
                      <div className="col-span-2 pt-1 border-t border-border/20">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Observações</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{(campaign as any).notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Distribuição Geográfica */}
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Distribuição Geográfica
                  </h3>
                  {campaignRestaurants.length > 0 ? (
                    <div className="space-y-2">
                      {/* Bairros únicos */}
                      {(() => {
                        const neighborhoods = [...new Set(
                          campaignRestaurants.map((r: any) => r.restaurantNeighborhood).filter(Boolean)
                        )];
                        return neighborhoods.length > 0 ? (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                              Bairros Cobertos ({neighborhoods.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {neighborhoods.map((n: any) => (
                                <span key={n} className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}
                      {/* Lista de restaurantes */}
                      <div className="pt-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                          Estabelecimentos ({restaurantsConfigured}/{campaign.activeRestaurants})
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {campaignRestaurants.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-border/10 last:border-0">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{r.restaurantName || `Restaurante #${r.restaurantId}`}</p>
                                {r.restaurantNeighborhood && (
                                  <p className="text-muted-foreground text-[10px]">{r.restaurantNeighborhood}</p>
                                )}
                              </div>
                              <span className="font-mono text-muted-foreground text-[10px] shrink-0 ml-2">
                                {r.coastersCount.toLocaleString("pt-BR")} un
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {restaurantsMissing > 0 && (
                        <p className="text-[10px] text-yellow-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Faltam {restaurantsMissing} restaurante(s) para atingir a meta
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-4 text-center">
                      <Store className="w-6 h-6 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">Nenhum restaurante configurado</p>
                      <p className="text-[10px] text-muted-foreground">Previsto: {campaign.activeRestaurants} restaurantes</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Ordens de Serviço ── */}
              {campaignSoList.length > 0 && (
                <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Ordens de Serviço
                  </h3>
                  <div className="divide-y divide-border/10">
                    {(campaignSoList as any[]).map((so: any) => {
                      const typeLabel: Record<string, string> = { anunciante: "Anunciante", producao: "Produção", distribuicao: "Distribuição" };
                      const statusLabel: Record<string, string> = { rascunho: "Rascunho", enviada: "Enviada", assinada: "Assinada", cancelada: "Cancelada" };
                      const statusColor: Record<string, string> = {
                        rascunho: "bg-muted text-muted-foreground",
                        enviada: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        assinada: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        cancelada: "bg-red-500/20 text-red-400 border-red-500/30",
                      };
                      return (
                        <div key={so.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-primary">{so.orderNumber}</span>
                            <span className="text-[10px] text-muted-foreground border border-border/30 rounded px-1.5 py-0.5">
                              {typeLabel[so.type] ?? so.type}
                            </span>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ${statusColor[so.status] ?? "bg-muted text-muted-foreground"}`}>
                            {statusLabel[so.status] ?? so.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Produção & Rastreamento ── */}
              {(prodSo || distSo || prodTrackings.length > 0 || distTrackings.length > 0 || (campaign as any).artPdfUrl || (campaign as any).artImageUrls) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OS de Produção */}
                  {(prodSo || (campaign as any).artPdfUrl) && (
                    <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-3 h-3" /> Produção Gráfica
                      </h3>
                      <div className="space-y-2.5">
                        {prodSo && (
                          <>
                            <DetailRow label="OS de Produção" value={prodSo.orderNumber} />
                            <DetailRow label="Status OS" value={(prodSo as any).status} />
                          </>
                        )}
                        {(campaign as any).artPdfUrl && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Arte (PDF)</p>
                            <a href={(campaign as any).artPdfUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                              <ExternalLink className="w-3 h-3" /> Abrir arquivo
                            </a>
                          </div>
                        )}
                        {prodTrackings.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Rastreamento Produção</p>
                            {prodTrackings.map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/10 last:border-0">
                                <div>
                                  <span className="font-mono">{t.trackingCode}</span>
                                  {t.freightProvider && <span className="text-muted-foreground ml-1.5">· {t.freightProvider}</span>}
                                </div>
                                {t.expectedDate && (
                                  <span className="text-muted-foreground text-[10px]">Prev. {new Date(t.expectedDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* OS de Distribuição */}
                  {(distSo || distTrackings.length > 0) && (
                    <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Truck className="w-3 h-3" /> Distribuição & Frete
                      </h3>
                      <div className="space-y-2.5">
                        {distSo && (
                          <>
                            <DetailRow label="OS de Distribuição" value={distSo.orderNumber} />
                            <DetailRow label="Status OS" value={(distSo as any).status} />
                          </>
                        )}
                        {distTrackings.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Rastreamento Frete</p>
                            {distTrackings.map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border/10 last:border-0">
                                <div>
                                  <a href={buildTrackingUrl(t.trackingCode, t.freightProvider)} target="_blank" rel="noopener noreferrer"
                                    className="font-mono text-primary hover:underline flex items-center gap-1">
                                    {t.trackingCode} <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                  {t.freightProvider && <span className="text-muted-foreground text-[10px]">{t.freightProvider}</span>}
                                </div>
                                {t.expectedDate && (
                                  <span className="text-muted-foreground text-[10px]">Prev. {new Date(t.expectedDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Faturas & Pagamentos ── */}
              {(campaignInvoices.length > 0 || campaignPayments.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaignInvoices.length > 0 && (
                    <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Receipt className="w-3 h-3" /> Faturas do Anunciante
                      </h3>
                      <div className="space-y-1">
                        {campaignInvoices.map((inv: any) => {
                          const statusColor = inv.status === "paga" ? "text-emerald-400" : inv.status === "vencida" ? "text-red-400" : "text-amber-400";
                          const statusLabel: Record<string, string> = { emitida: "Emitida", paga: "Paga", vencida: "Vencida", cancelada: "Cancelada" };
                          return (
                            <div key={inv.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/10 last:border-0">
                              <div>
                                <span className="font-mono font-medium">{formatCurrency(Number(inv.amount))}</span>
                                {inv.dueDate && (
                                  <span className="text-muted-foreground ml-1.5">vence {new Date(inv.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                )}
                              </div>
                              <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel[inv.status] || inv.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {campaignPayments.length > 0 && (
                    <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <HandCoins className="w-3 h-3" /> Pagamentos aos Locais
                      </h3>
                      <div className="space-y-1">
                        {campaignPayments.slice(0, 6).map((pay: any) => {
                          const statusColor = pay.status === "paid" ? "text-emerald-400" : pay.status === "overdue" ? "text-red-400" : "text-amber-400";
                          const statusLabel: Record<string, string> = { pending: "Pendente", paid: "Pago", overdue: "Vencido" };
                          return (
                            <div key={pay.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/10 last:border-0">
                              <div>
                                <span className="font-medium truncate max-w-[140px] block">{pay.restaurantName || `Rest. #${pay.restaurantId}`}</span>
                                {pay.paymentDate && (
                                  <span className="text-muted-foreground text-[10px]">{new Date(pay.paymentDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="font-mono">{formatCurrency(Number(pay.amount))}</span>
                                <span className={`block text-[10px] font-semibold ${statusColor}`}>{statusLabel[pay.status] || pay.status}</span>
                              </div>
                            </div>
                          );
                        })}
                        {campaignPayments.length > 6 && (
                          <p className="text-[10px] text-muted-foreground text-center pt-1">+ {campaignPayments.length - 6} outros pagamentos</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Separador visual ─── */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/20" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Indicadores Financeiros</span>
                <div className="flex-1 h-px bg-border/20" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {isBonif ? (
                  <>
                    <KPIBig label="Custo Mensal" value={formatCurrency(p.totalCosts)} icon={<Banknote className="w-5 h-5" />} warn />
                    <KPIBig label="Custo Total" value={formatCurrency(p.contractCosts)} icon={<TrendingUp className="w-5 h-5" />} warn />
                  </>
                ) : (
                  <>
                    <KPIBig label="Receita Mensal" value={formatCurrency(p.monthlyRevenue)} icon={<Banknote className="w-5 h-5" />} />
                    <KPIBig label="Lucro Mensal" value={formatCurrency(p.monthlyProfit)} icon={<TrendingUp className="w-5 h-5" />} accent />
                    <KPIBig label="Margem Real" value={`${p.grossMargin.toFixed(1)}%`} icon={<ShieldCheck className="w-5 h-5" />}
                      accent={p.grossMargin >= 20} warn={p.grossMargin < 15}
                    />
                    <KPIBig label="ROI Mensal" value={`${p.roi.toFixed(1)}%`} icon={<Target className="w-5 h-5" />} accent={p.roi > 0} />
                  </>
                )}
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{isBonif ? "Custos Bonificação (Mensal)" : "Composição do Preço (Mensal Total)"}</h3>
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Breakdown por Local</h3>
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
                {isBonif ? (
                  <>
                    <ContractCard label="Custo Total Bonificação" value={formatCurrency(p.contractCosts)} sub={batchCount > 0 ? `${batchCount} batch${batchCount > 1 ? "es" : ""} (${batchWeeks} semanas)` : `${campaign.contractDuration} meses`} />
                    <ContractCard label="Coasters Total Contrato" value={(expectedTotalCoasters * campaign.contractDuration).toLocaleString("pt-BR")} sub="unidades" />
                  </>
                ) : (
                  <>
                    <ContractCard label="Contrato Total" value={formatCurrency(p.contractRevenue)} sub={batchCount > 0 ? `${batchCount} batch${batchCount > 1 ? "es" : ""} (${batchWeeks} semanas)` : `${campaign.contractDuration} meses`} />
                    <ContractCard label="Custos do Contrato" value={formatCurrency(p.contractCosts)} />
                    <ContractCard label="Lucro do Contrato" value={formatCurrency(p.contractProfit)} accent />
                    <ContractCard label="Coasters Total Contrato" value={(expectedTotalCoasters * campaign.contractDuration).toLocaleString("pt-BR")} sub="unidades" />
                  </>
                )}
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parâmetros Financeiros da Campanha</h3>
                  {!editingParams ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                      setParamsForm({
                        coastersPerRestaurant: String(campaign.coastersPerRestaurant),
                        usagePerDay: String(campaign.usagePerDay),
                        daysPerMonth: String(campaign.daysPerMonth),
                        activeRestaurants: String(campaign.activeRestaurants),
                        pricingType: campaign.pricingType,
                        markupPercent: String(Number(campaign.markupPercent)),
                        fixedPrice: String(Number(campaign.fixedPrice)),
                        commissionType: campaign.commissionType,
                        restaurantCommission: String(Number(campaign.restaurantCommission)),
                        fixedCommission: String(Number(campaign.fixedCommission)),
                        sellerCommission: String(Number(campaign.sellerCommission)),
                        taxRate: String(Number(campaign.taxRate)),
                        contractDuration: String(campaign.contractDuration),
                        batchSize: String(campaign.batchSize),
                        batchCost: String(Number(campaign.batchCost)),
                        freightCost: String(Number((campaign as any).freightCost || 0)),
                      });
                      setEditingParams(true);
                    }}>
                      <Pencil className="w-3 h-3" /> Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingParams(false); setParamsForm(null); }}>Cancelar</Button>
                      <Button size="sm" className="h-7 text-xs gap-1" disabled={updateMutation.isPending} onClick={() => {
                        if (!paramsForm) return;
                        updateMutation.mutate({
                          id: campaignId,
                          coastersPerRestaurant: parseInt(paramsForm.coastersPerRestaurant),
                          usagePerDay: parseInt(paramsForm.usagePerDay),
                          daysPerMonth: parseInt(paramsForm.daysPerMonth),
                          activeRestaurants: parseInt(paramsForm.activeRestaurants),
                          pricingType: paramsForm.pricingType,
                          markupPercent: paramsForm.markupPercent,
                          fixedPrice: paramsForm.fixedPrice,
                          commissionType: paramsForm.commissionType,
                          restaurantCommission: paramsForm.restaurantCommission,
                          fixedCommission: paramsForm.fixedCommission,
                          sellerCommission: paramsForm.sellerCommission,
                          taxRate: paramsForm.taxRate,
                          contractDuration: parseInt(paramsForm.contractDuration),
                          batchSize: parseInt(paramsForm.batchSize),
                          batchCost: paramsForm.batchCost,
                          freightCost: paramsForm.freightCost,
                        }, { onSuccess: () => { setEditingParams(false); setParamsForm(null); toast.success("Parâmetros salvos"); } });
                      }}>
                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  )}
                </div>
                {!editingParams ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                    <ParamRow label="Coasters/Restaurante" value={campaign.coastersPerRestaurant.toLocaleString("pt-BR")} />
                    <ParamRow label="Uso Médio/Dia" value={`${campaign.usagePerDay}x`} />
                    <ParamRow label="Dias por Mês" value={`${campaign.daysPerMonth}`} />
                    <ParamRow label="Restaurantes Ativos" value={`${campaign.activeRestaurants}`} />
                    <ParamRow label="Tipo de Precificação" value={campaign.pricingType === "variable" ? "Markup (%)" : "Preço Fixo (R$)"} tooltip="Define como o preço de venda é calculado sobre o custo base de produção" />
                    <ParamRow label={campaign.pricingType === "variable" ? "Markup" : "Preço Fixo"}
                      value={campaign.pricingType === "variable" ? `${Number(campaign.markupPercent)}%` : formatCurrency(Number(campaign.fixedPrice))}
                      tooltip={campaign.pricingType === "variable" ? "Percentual aplicado sobre o custo bruto por restaurante para definir o preço de venda" : "Valor fixo adicionado ao custo bruto por restaurante"}
                    />
                    <ParamRow label="Tipo Comissão Rest." value={campaign.commissionType === "variable" ? "Variável (%)" : "Fixo (R$/un)"} tooltip="Forma de cálculo da comissão paga aos restaurantes por coaster" />
                    <ParamRow label={campaign.commissionType === "variable" ? "Comissão Rest." : "Comissão Fixa"}
                      value={campaign.commissionType === "variable" ? `${Number(campaign.restaurantCommission)}%` : `R$ ${Number(campaign.fixedCommission).toFixed(4)}/un`}
                      tooltip={campaign.commissionType === "variable" ? "Percentual do preço de venda pago como comissão ao restaurante" : "Valor fixo em R$ por coaster pago ao restaurante"}
                    />
                    <ParamRow label="Comissão Vendedor" value={`${Number(campaign.sellerCommission)}%`} tooltip="Percentual da receita bruta destinado à comissão do vendedor responsável" />
                    <ParamRow label="Alíquota Impostos" value={`${Number(campaign.taxRate)}%`} tooltip="Carga tributária total (NF) aplicada sobre a receita bruta da campanha" />
                    <ParamRow label="Lote Produção" value={`${campaign.batchSize.toLocaleString("pt-BR")} un`} tooltip="Quantidade de coasters produzidos por lote de impressão" />
                    <ParamRow label="Custo Lote" value={formatCurrency(Number(campaign.batchCost))} tooltip="Custo total de produção do lote (impressão + material). Dividido pelo tamanho do lote = custo unitário." />
                    <ParamRow label="Custo Frete (mensal)" value={formatCurrency(Number((campaign as any).freightCost || 0))} tooltip="Custo mensal de logística e distribuição dos coasters para os restaurantes" />
                  </div>
                ) : paramsForm && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                    {([
                      { label: "Coasters/Rest.", key: "coastersPerRestaurant", type: "int" },
                      { label: "Uso Médio/Dia", key: "usagePerDay", type: "int" },
                      { label: "Dias por Mês", key: "daysPerMonth", type: "int" },
                      { label: "Restaurantes Ativos", key: "activeRestaurants", type: "int" },
                    ] as const).map(({ label, key }) => (
                      <div key={key}>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
                        <Input className="h-8 text-sm mt-1" type="number" value={paramsForm[key]} onChange={e => setParamsForm(f => f ? { ...f, [key]: e.target.value } : f)} />
                      </div>
                    ))}
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo Precificação</Label>
                      <select className="w-full h-8 text-sm mt-1 rounded-md border border-input bg-background px-2" value={paramsForm.pricingType} onChange={e => setParamsForm(f => f ? { ...f, pricingType: e.target.value } : f)}>
                        <option value="variable">Markup (%)</option>
                        <option value="fixed">Preço Fixo (R$)</option>
                      </select>
                    </div>
                    {paramsForm.pricingType === "variable" ? (
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Markup (%)</Label>
                        <Input className="h-8 text-sm mt-1" type="number" step="0.01" value={paramsForm.markupPercent} onChange={e => setParamsForm(f => f ? { ...f, markupPercent: e.target.value } : f)} />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço Fixo (R$)</Label>
                        <Input className="h-8 text-sm mt-1" type="number" step="0.01" value={paramsForm.fixedPrice} onChange={e => setParamsForm(f => f ? { ...f, fixedPrice: e.target.value } : f)} />
                      </div>
                    )}
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo Comissão Rest.</Label>
                      <select className="w-full h-8 text-sm mt-1 rounded-md border border-input bg-background px-2" value={paramsForm.commissionType} onChange={e => setParamsForm(f => f ? { ...f, commissionType: e.target.value } : f)}>
                        <option value="variable">Variável (%)</option>
                        <option value="fixed">Fixo (R$/un)</option>
                      </select>
                    </div>
                    {paramsForm.commissionType === "variable" ? (
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão Rest. (%)</Label>
                        <Input className="h-8 text-sm mt-1" type="number" step="0.01" value={paramsForm.restaurantCommission} onChange={e => setParamsForm(f => f ? { ...f, restaurantCommission: e.target.value } : f)} />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão Fixa (R$/un)</Label>
                        <Input className="h-8 text-sm mt-1" type="number" step="0.0001" value={paramsForm.fixedCommission} onChange={e => setParamsForm(f => f ? { ...f, fixedCommission: e.target.value } : f)} />
                      </div>
                    )}
                    {([
                      { label: "Comissão Vendedor (%)", key: "sellerCommission" },
                      { label: "Alíquota Impostos (%)", key: "taxRate" },
                    ] as const).map(({ label, key }) => (
                      <div key={key}>
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
                        <Input className="h-8 text-sm mt-1" type="number" step="0.01" value={paramsForm[key]} onChange={e => setParamsForm(f => f ? { ...f, [key]: e.target.value } : f)} />
                      </div>
                    ))}
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Duração Contrato (meses)</Label>
                      <Input className="h-8 text-sm mt-1" type="number" value={paramsForm.contractDuration} onChange={e => setParamsForm(f => f ? { ...f, contractDuration: e.target.value } : f)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Lote Produção (un)</Label>
                      <Input className="h-8 text-sm mt-1" type="number" value={paramsForm.batchSize} onChange={e => setParamsForm(f => f ? { ...f, batchSize: e.target.value } : f)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo Lote (R$)</Label>
                      <Input className="h-8 text-sm mt-1" type="number" step="0.01" value={paramsForm.batchCost} onChange={e => setParamsForm(f => f ? { ...f, batchCost: e.target.value } : f)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo Frete Mensal (R$)</Label>
                      <Input className="h-8 text-sm mt-1" type="number" step="0.01" value={paramsForm.freightCost} onChange={e => setParamsForm(f => f ? { ...f, freightCost: e.target.value } : f)} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── CONTAS A PAGAR ── */}
              {(() => {
                const apList = campaignPayables;
                const pendingCount = apList.filter((a: any) => a.status === "pendente").length;
                const totalPending = apList.filter((a: any) => a.status === "pendente").reduce((s: number, a: any) => s + Number(a.amount), 0);

                return (
                  <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contas a Pagar</h3>
                        {pendingCount > 0 && (
                          <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {apList.length === 0 && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={generatePayablesMutation.isPending}
                            onClick={() => generatePayablesMutation.mutate({ campaignId })}>
                            {generatePayablesMutation.isPending ? "Gerando..." : "Gerar Lançamentos"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate("/financeiro/contas-pagar")}>
                          Ver Todos
                        </Button>
                      </div>
                    </div>
                    {apList.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/30">
                              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</th>
                              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Descrição</th>
                              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fornecedor</th>
                              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor</th>
                              <th className="text-center py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Vencimento</th>
                              <th className="text-center py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {apList.map((ap: any) => {
                              const typeLabels: Record<string, string> = { producao: "Produção", frete: "Frete", comissao: "Comissão", outro: "Outro" };
                              const typeColors: Record<string, string> = { producao: "text-emerald-400", frete: "text-blue-400", comissao: "text-purple-400", outro: "text-gray-400" };
                              return (
                                <tr key={ap.id} className="border-b border-border/10">
                                  <td className={`py-2 font-medium ${typeColors[ap.type] || "text-gray-400"}`}>{typeLabels[ap.type] || ap.type}</td>
                                  <td className="py-2 text-muted-foreground">{ap.description}</td>
                                  <td className="py-2 text-muted-foreground">{ap.supplierName || "—"}</td>
                                  <td className="py-2 text-right font-mono">{formatCurrency(Number(ap.amount))}</td>
                                  <td className="py-2 text-center text-muted-foreground">{ap.dueDate ? new Date(ap.dueDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                                  <td className="py-2 text-center">
                                    <Badge variant="outline" className={`text-[9px] ${ap.status === "pago" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border-amber-500/30"}`}>
                                      {ap.status === "pago" ? "Pago" : "Pendente"}
                                    </Badge>
                                  </td>
                                  <td className="py-2 text-right">
                                    {ap.status === "pendente" && (
                                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-emerald-400"
                                        onClick={() => markPayablePaidMutation.mutate({ id: ap.id, paymentDate: new Date().toISOString().split("T")[0] })}>
                                        Pagar
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border/30">
                              <td colSpan={2} className="py-2 font-semibold text-muted-foreground">Total Pendente</td>
                              <td className="py-2 text-right font-mono font-bold text-amber-400">{formatCurrency(totalPending)}</td>
                              <td colSpan={3}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum lançamento. Clique em "Gerar Lançamentos" para criar automaticamente.</p>
                    )}
                  </div>
                );
              })()}

              {/* ── DRE SIMPLIFICADA ── */}
              {(() => {
                const dur = campaign.contractDuration;
                const isBonif = !!(campaign as any).isBonificada;
                const receita = isBonif ? 0 : p.monthlyRevenue;
                const receitaTotal = isBonif ? 0 : p.contractRevenue;
                const taxRate = Number(campaign.taxRate);
                const restCommRate = campaign.commissionType === "variable" ? Number(campaign.restaurantCommission) : 0;
                const partnerPct = Number((campaign as any).partnerCommissionPercent || 0);
                const pName = (campaign as any).partnerName as string | null;

                const impostos = isBonif ? 0 : receita * (taxRate / 100);
                const baseAposImpostos = receita - impostos;

                const commRest = isBonif ? 0 : baseAposImpostos * (restCommRate / 100);
                const baseAposComRest = baseAposImpostos - commRest;

                const prodCost = Number(campaign.batchCost);
                const freteCost = Number((campaign as any).freightCost || 0);
                const baseAposCustos = baseAposComRest - prodCost - freteCost;

                const commParceiro = isBonif ? 0 : (pName && partnerPct > 0 ? baseAposCustos * (partnerPct / 100) : 0);
                const lucro = isBonif ? -(prodCost + freteCost) : baseAposCustos - commParceiro;
                const margem = receita > 0 ? (lucro / receita) * 100 : 0;

                const m = (v: number) => v * dur;

                if (isBonif) {
                  return (
                    <div className="bg-card border border-amber-500/20 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">Campanha Bonificada</span>
                        <span className="text-[11px] text-muted-foreground">Sem receita — apenas custos operacionais</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30">
                              <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"></th>
                              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Mensal</th>
                              <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Total ({dur}m)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border/10">
                              <td className="py-2 text-red-400/80">Custo Produção <span className="text-[10px]">({campaign.batchSize} un × R$ {p.unitCost.toFixed(2)})</span></td>
                              <td className="py-2 text-right px-3 font-mono text-red-400/80">{formatCurrency(prodCost)}</td>
                              <td className="py-2 text-right px-3 font-mono text-red-400/80">{formatCurrency(m(prodCost))}</td>
                            </tr>
                            {freteCost > 0 && (
                              <tr className="border-b border-border/10">
                                <td className="py-2 text-red-400/80">Custo Frete</td>
                                <td className="py-2 text-right px-3 font-mono text-red-400/80">{formatCurrency(freteCost)}</td>
                                <td className="py-2 text-right px-3 font-mono text-red-400/80">{formatCurrency(m(freteCost))}</td>
                              </tr>
                            )}
                            <tr className="border-t-2 border-amber-500/30 bg-amber-500/5">
                              <td className="py-2.5 font-bold text-amber-400">Total Bonificação</td>
                              <td className="py-2.5 text-right px-3 font-mono font-bold text-amber-400">{formatCurrency(prodCost + freteCost)}</td>
                              <td className="py-2.5 text-right px-3 font-mono font-bold text-amber-400">{formatCurrency(m(prodCost + freteCost))}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                return (
              <div className="bg-card border border-border/30 rounded-lg p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"></th>
                        <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Mensal</th>
                        <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Total ({dur}m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2 font-semibold text-emerald-400">Receita Bruta</td>
                        <td className="py-2 text-right px-3 font-semibold text-emerald-400">{formatCurrency(receita)}</td>
                        <td className="py-2 text-right px-3 font-semibold text-emerald-400">{formatCurrency(receitaTotal)}</td>
                      </tr>

                      <tr className="border-t border-border/10">
                        <td className="py-1.5 text-red-400/80 pl-4">(-) Impostos <span className="text-[10px]">({taxRate}%)</span></td>
                        <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(impostos)}</td>
                        <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(m(impostos))}</td>
                      </tr>
                      <tr className="bg-muted/20">
                        <td className="py-1.5 font-medium pl-2 text-xs">= Base após Impostos</td>
                        <td className="py-1.5 text-right px-3 font-medium text-xs">{formatCurrency(baseAposImpostos)}</td>
                        <td className="py-1.5 text-right px-3 font-medium text-xs">{formatCurrency(m(baseAposImpostos))}</td>
                      </tr>

                      <tr className="border-t border-border/10">
                        <td className="py-1.5 text-red-400/80 pl-4">(-) Comissão Restaurante <span className="text-[10px]">({restCommRate}%)</span></td>
                        <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(commRest)}</td>
                        <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(m(commRest))}</td>
                      </tr>
                      <tr className="bg-muted/20">
                        <td className="py-1.5 font-medium pl-2 text-xs">= Base após Comissões</td>
                        <td className="py-1.5 text-right px-3 font-medium text-xs">{formatCurrency(baseAposComRest)}</td>
                        <td className="py-1.5 text-right px-3 font-medium text-xs">{formatCurrency(m(baseAposComRest))}</td>
                      </tr>

                      <tr className="border-t border-border/10">
                        <td className="py-1.5 text-red-400/80 pl-4">(-) Custo Produção <span className="text-[10px]">({campaign.batchSize} un × R$ {p.unitCost.toFixed(2)})</span></td>
                        <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(prodCost)}</td>
                        <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(m(prodCost))}</td>
                      </tr>
                      {freteCost > 0 && (
                        <tr>
                          <td className="py-1.5 text-red-400/80 pl-4">(-) Custo Frete</td>
                          <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(freteCost)}</td>
                          <td className="py-1.5 text-right px-3 text-red-400/80">{formatCurrency(m(freteCost))}</td>
                        </tr>
                      )}
                      <tr className="bg-muted/20">
                        <td className="py-1.5 font-medium pl-2 text-xs">= Base{pName ? " Comissão Parceiro" : ""}</td>
                        <td className="py-1.5 text-right px-3 font-medium text-xs">{formatCurrency(baseAposCustos)}</td>
                        <td className="py-1.5 text-right px-3 font-medium text-xs">{formatCurrency(m(baseAposCustos))}</td>
                      </tr>

                      {pName && partnerPct > 0 && (
                        <>
                          <tr className="border-t border-border/10">
                            <td className="py-1.5 text-purple-400/80 pl-4">(-) Comissão {pName} <span className="text-[10px]">({partnerPct}%)</span></td>
                            <td className="py-1.5 text-right px-3 text-purple-400/80">{formatCurrency(commParceiro)}</td>
                            <td className="py-1.5 text-right px-3 text-purple-400/80">{formatCurrency(m(commParceiro))}</td>
                          </tr>
                        </>
                      )}

                      <tr className="border-t-2 border-emerald-500/30">
                        <td className="py-2.5 font-bold text-emerald-400">Lucro Líquido</td>
                        <td className="py-2.5 text-right px-3 font-bold text-emerald-400">{formatCurrency(lucro)}</td>
                        <td className="py-2.5 text-right px-3 font-bold text-emerald-400">{formatCurrency(m(lucro))}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-muted-foreground">Margem</td>
                        <td className="py-1.5 text-right px-3" colSpan={2}>
                          <span className={margem >= 15 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>{margem.toFixed(1)}%</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
                );
              })()}

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
                        <h3 className="text-sm font-semibold">Pagamentos a Locais</h3>
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

              {/* ── COMISSÃO DO PARCEIRO ── */}
              {!campaign.isBonificada && (() => {
                const pName = (campaign as any).partnerName;
                if (!pName) return null;
                const partnerPct = Number((campaign as any).partnerCommissionPercent || 10);

                const totalFaturado = campaignInvoices
                  .filter(i => i.status !== "cancelada")
                  .reduce((s, i) => s + parseFloat(i.amount), 0);
                const baseGross = totalFaturado > 0 ? totalFaturado : Number(campaign.batchCost) * campaign.contractDuration;
                const taxRate = Number(campaign.taxRate || 0);
                const taxDed = baseGross * (taxRate / 100);
                const afterTax = baseGross - taxDed;
                const restRate = Number(campaign.restaurantCommission || 0);
                const restDed = afterTax * (restRate / 100);
                const prodCost = Number(campaign.productionCost || 0);
                const totalDed = taxDed + restDed + prodCost;
                const commBase = baseGross - totalDed;
                const commValue = commBase * (partnerPct / 100);

                return (
                  <div className="bg-card border border-border/30 rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">Comissão do Parceiro</h3>
                        <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400">{pName}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate("/financeiro/comissao-parceiros")}>
                        Relatório completo <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1.5 px-3 rounded bg-blue-500/5">
                        <span className="font-semibold text-blue-400">Base de Cálculo</span>
                        <span className="font-mono font-semibold">{formatCurrency(commBase)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 px-3 text-muted-foreground">
                        <span>Comissão ({partnerPct}% sobre base)</span>
                        <span className="font-mono font-semibold">{formatCurrency(commValue)}</span>
                      </div>
                      <div className="flex justify-between py-2 px-3 rounded bg-emerald-500/10 border-t border-emerald-500/20">
                        <span className="font-bold text-emerald-400">TOTAL A REPASSAR</span>
                        <span className="font-mono font-bold text-emerald-400">{formatCurrency(commValue)}</span>
                      </div>
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
                  <Store className="w-3.5 h-3.5" /> Configurar Locais
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
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground"> Locais</p>
                  <p className={`text-lg font-bold font-mono mt-1 ${restaurantsMissing > 0 ? "text-yellow-400" : "text-emerald-400"}`}>{restaurantsConfigured}/{campaign.activeRestaurants}</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coasters Alocados</p>
                  <p className={`text-lg font-bold font-mono mt-1 ${allocationPct < 100 ? "text-yellow-400" : "text-emerald-400"}`}>{totalCoastersDistributed.toLocaleString("pt-BR")}</p>
                </div>
                <div className="bg-card border border-border/30 rounded-lg p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impressões/Mês</p>
                  <p className="text-lg font-bold font-mono mt-1">
                    {campaignRestaurants.reduce((sum, r) => sum + calcImpressionesParaLocal({
                          product: productImpressionParams,
                          location: { monthlyCustomers: r.restaurantMonthlyCustomers ?? null, seatCount: (r as any).restaurantSeatCount ?? null, tableCount: (r as any).restaurantTableCount ?? null, avgStayMinutes: (r as any).restaurantAvgStayMinutes ?? null },
                          qtdCoasters: r.coastersCount,
                          usosporCoaster: r.usagePerDay,
                          daysPerMonth: campaign.daysPerMonth,
                        }), 0).toLocaleString("pt-BR")}
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
                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium p-3">Local</th>
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
                        const impressions = calcImpressionesParaLocal({
                          product: productImpressionParams,
                          location: {
                            monthlyCustomers: r.restaurantMonthlyCustomers ?? null,
                            seatCount: (r as any).restaurantSeatCount ?? null,
                            tableCount: (r as any).restaurantTableCount ?? null,
                            avgStayMinutes: (r as any).restaurantAvgStayMinutes ?? null,
                          },
                          qtdCoasters: r.coastersCount,
                          usosporCoaster: r.usagePerDay,
                          daysPerMonth: campaign.daysPerMonth,
                        });
                        const restPricing = calcCampaignPricing({ ...campaign, coastersPerRestaurant: r.coastersCount, usagePerDay: r.usagePerDay, activeRestaurants: 1, productTipo: campaign.productTipo, avgMonthlyCustomers: r.restaurantMonthlyCustomers, productImpressionParams, locationData: { monthlyCustomers: r.restaurantMonthlyCustomers ?? null, seatCount: (r as any).restaurantSeatCount ?? null, tableCount: (r as any).restaurantTableCount ?? null, avgStayMinutes: (r as any).restaurantAvgStayMinutes ?? null } });
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
                          {campaignRestaurants.reduce((sum, r) => sum + calcImpressionesParaLocal({
                            product: productImpressionParams,
                            location: { monthlyCustomers: r.restaurantMonthlyCustomers ?? null, seatCount: (r as any).restaurantSeatCount ?? null, tableCount: (r as any).restaurantTableCount ?? null, avgStayMinutes: (r as any).restaurantAvgStayMinutes ?? null },
                            qtdCoasters: r.coastersCount,
                            usosporCoaster: r.usagePerDay,
                            daysPerMonth: campaign.daysPerMonth,
                          }), 0).toLocaleString("pt-BR")}
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
                  {historyList.map((h) => (
                    <div key={h.id} className="relative flex items-start gap-3 pb-4">
                      <div className={`relative z-10 mt-1.5 w-3 h-3 rounded-full border-2 shrink-0 ${
                        h.action === "approved" || h.action === "design_approved" ? "bg-emerald-400 border-emerald-500" :
                        h.action === "archived" || h.action === "finalized" ? "bg-gray-400 border-gray-500" :
                        h.action === "created" || h.action === "created_from_quotation" ? "bg-orange-400 border-orange-500" :
                        h.action === "paused" ? "bg-yellow-400 border-yellow-500" :
                        h.action === "veiculacao_started" || h.action === "distribution_complete" ? "bg-emerald-400 border-emerald-500" :
                        h.action === "design_submitted" || h.action === "briefing_complete" ? "bg-violet-400 border-violet-500" :
                        "bg-primary border-primary"
                      }`} />
                      <div className="flex-1 bg-card border border-border/30 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{HISTORY_LABELS[h.action] || h.action}</p>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">{new Date(h.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            {(h as any).userName && (
                              <p className="text-[10px] text-foreground/50 font-medium mt-0.5">{(h as any).userName}</p>
                            )}
                          </div>
                        </div>
                        {h.details && <p className="text-xs text-muted-foreground mt-1.5 border-t border-border/20 pt-1.5">{h.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── RELATÓRIOS ─── */}
            <TabsContent value="relatorios" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Relatórios de Campanha</h3>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={openNewReportSheet}>
                  <Plus className="w-3.5 h-3.5" /> Novo Relatório
                </Button>
              </div>

              {campaignReportsList.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
                  <FileBarChart2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum relatório criado ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(campaignReportsList as any[]).map((report) => {
                    const isPublished = !!report.publishedAt;
                    const typeLabel = report.reportType === "telas" ? "Telas" : report.reportType === "ativacao" ? "Ativação" : "Coasters";
                    const clientForReport = clientsList.find((cl) => cl.id === campaign.clientId);
                    return (
                      <div key={report.id} className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold truncate">{report.title}</h4>
                              <Badge variant="outline" className={isPublished ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-yellow-500/30 text-yellow-400 bg-yellow-500/10"}>
                                {isPublished ? "Publicado" : "Rascunho"}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10">{typeLabel}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(report.periodStart).toLocaleDateString("pt-BR")} – {new Date(report.periodEnd).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditReportSheet(report)} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {!isPublished && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-[10px] text-emerald-400 hover:text-emerald-300" onClick={() => publishReportMutation.mutate({ id: report.id })} disabled={publishReportMutation.isPending} title="Publicar">
                                <Send className="w-3 h-3" /> Publicar
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownloadReportPdf(report, clientForReport)} disabled={reportPdfLoading === report.id} title="Download PDF">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => deleteReportMutation.mutate({ id: report.id })} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="bg-background/60 rounded-md p-2 border border-border/20">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impressões</p>
                            <p className="text-sm font-bold font-mono text-emerald-400">{(report.totalImpressions ?? 0).toLocaleString("pt-BR")}</p>
                          </div>
                          {report.reportType === "coaster" && (
                            <>
                              <div className="bg-background/60 rounded-md p-2 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground"> Locais</p>
                                <p className="text-sm font-bold font-mono">{report.numRestaurants}</p>
                              </div>
                              <div className="bg-background/60 rounded-md p-2 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coasters</p>
                                <p className="text-sm font-bold font-mono">{(report.coastersDistributed ?? 0).toLocaleString("pt-BR")}</p>
                              </div>
                            </>
                          )}
                          {report.reportType === "telas" && (
                            <>
                              <div className="bg-background/60 rounded-md p-2 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Telas</p>
                                <p className="text-sm font-bold font-mono">{report.numScreens}</p>
                              </div>
                              <div className="bg-background/60 rounded-md p-2 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Spots/dia</p>
                                <p className="text-sm font-bold font-mono">{report.spotsPerDay}</p>
                              </div>
                            </>
                          )}
                          {report.reportType === "ativacao" && (
                            <>
                              <div className="bg-background/60 rounded-md p-2 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Eventos</p>
                                <p className="text-sm font-bold font-mono">{report.activationEvents}</p>
                              </div>
                              <div className="bg-background/60 rounded-md p-2 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pessoas/evento</p>
                                <p className="text-sm font-bold font-mono">{report.peoplePerEvent}</p>
                              </div>
                            </>
                          )}
                        </div>

                        {report.photos && report.photos.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Fotos</p>
                            <div className="flex flex-wrap gap-2">
                              {(report.photos as any[]).map((photo) => (
                                <div key={photo.id} className="relative group">
                                  <img src={photo.url} alt={photo.caption || ""} className="w-16 h-16 object-cover rounded-md border border-border/30" />
                                  <button
                                    onClick={() => deleteReportPhotoMutation.mutate({ id: photo.id })}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white hidden group-hover:flex items-center justify-center"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <ObjectUploader
                            maxNumberOfFiles={5}
                            maxFileSize={10485760}
                            onGetUploadParameters={async (file) => {
                              const res = await fetch("/api/uploads/request-url", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                              });
                              const data = await res.json();
                              return { method: "PUT" as const, url: data.uploadURL };
                            }}
                            onComplete={(result) => {
                              const successful = result.successful ?? [];
                              for (const f of successful) {
                                const uploadedUrl = (f as any).uploadURL || (f.response as any)?.uploadURL || "";
                                const objectPath = uploadedUrl ? new URL(uploadedUrl).pathname.split("?")[0] : "";
                                const servingUrl = objectPath ? `/objects${objectPath}` : "";
                                if (servingUrl) {
                                  addReportPhotoMutation.mutate({ reportId: report.id, url: servingUrl });
                                }
                              }
                            }}
                            buttonClassName="h-7 text-xs gap-1.5 bg-transparent border border-border/30 text-muted-foreground hover:text-foreground hover:bg-accent/20"
                          >
                            <Camera className="w-3 h-3" /> Adicionar Fotos
                          </ObjectUploader>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Sheet open={reportSheetOpen} onOpenChange={setReportSheetOpen}>
                <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
                  <SheetHeader className="pb-4 border-b">
                    <SheetTitle>{editingReportId ? "Editar Relatório" : "Novo Relatório"}</SheetTitle>
                  </SheetHeader>
                  <div className="py-5 space-y-4">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Título do Relatório</Label>
                      <Input value={reportForm.title} onChange={e => setReportForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: Relatório Mensal - Outubro 2025" className="bg-background border-border/30 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Início do Período</Label>
                        <Input type="date" value={reportForm.periodStart} onChange={e => setReportForm(f => ({ ...f, periodStart: e.target.value }))} className="bg-background border-border/30 text-sm" />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Fim do Período</Label>
                        <Input type="date" value={reportForm.periodEnd} onChange={e => setReportForm(f => ({ ...f, periodEnd: e.target.value }))} className="bg-background border-border/30 text-sm" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Tipo de Mídia</Label>
                      <Select value={reportForm.reportType} onValueChange={(v) => setReportForm(f => ({ ...f, reportType: v as any }))}>
                        <SelectTrigger className="bg-background border-border/30 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="coaster">Coasters / Porta-Copos</SelectItem>
                          <SelectItem value="telas">Telas / Digital</SelectItem>
                          <SelectItem value="ativacao">Ativação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {reportForm.reportType === "coaster" && (
                      <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métricas de Coaster</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Locais ativos</Label>
                            <Input type="number" value={reportForm.numRestaurants} onChange={e => setReportForm(f => ({ ...f, numRestaurants: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Coasters distribuídos</Label>
                            <Input type="number" value={reportForm.coastersDistributed} onChange={e => setReportForm(f => ({ ...f, coastersDistributed: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Usos por dia</Label>
                            <Input type="number" value={reportForm.usagePerDay} onChange={e => setReportForm(f => ({ ...f, usagePerDay: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Dias no período</Label>
                            <Input type="number" value={reportForm.daysInPeriod} onChange={e => setReportForm(f => ({ ...f, daysInPeriod: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    {reportForm.reportType === "telas" && (
                      <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métricas de Telas</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Número de telas</Label>
                            <Input type="number" value={reportForm.numScreens} onChange={e => setReportForm(f => ({ ...f, numScreens: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Spots por dia</Label>
                            <Input type="number" value={reportForm.spotsPerDay} onChange={e => setReportForm(f => ({ ...f, spotsPerDay: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Duração do spot (s)</Label>
                            <Select value={String(reportForm.spotDurationSeconds)} onValueChange={(v) => setReportForm(f => ({ ...f, spotDurationSeconds: parseInt(v) }))}>
                              <SelectTrigger className="bg-background border-border/30 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="15">15 segundos</SelectItem>
                                <SelectItem value="30">30 segundos</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Dias no período</Label>
                            <Input type="number" value={reportForm.daysInPeriod} onChange={e => setReportForm(f => ({ ...f, daysInPeriod: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    {reportForm.reportType === "ativacao" && (
                      <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/20">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Métricas de Ativação</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Eventos de ativação</Label>
                            <Input type="number" value={reportForm.activationEvents} onChange={e => setReportForm(f => ({ ...f, activationEvents: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-xs">Pessoas por evento</Label>
                            <Input type="number" value={reportForm.peoplePerEvent} onChange={e => setReportForm(f => ({ ...f, peoplePerEvent: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30 text-sm" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                      <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">Impressões estimadas</p>
                        <p className="text-sm font-bold text-emerald-400 font-mono">{calcPreviewImpressions().toLocaleString("pt-BR")}</p>
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs">Observações (opcional)</Label>
                      <Textarea value={reportForm.notes} onChange={e => setReportForm(f => ({ ...f, notes: e.target.value }))} placeholder="Destaques, pontos de atenção, contexto do período..." className="bg-background border-border/30 text-sm resize-none" rows={3} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border/20">
                      <Button variant="outline" size="sm" onClick={() => setReportSheetOpen(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleSaveReport} disabled={createReportMutation.isPending || updateReportMutation.isPending}>
                        {(createReportMutation.isPending || updateReportMutation.isPending) ? "Salvando..." : editingReportId ? "Salvar Alterações" : "Criar Relatório"}
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </TabsContent>
          </Tabs>
        </div>

        {/* ─── DIALOGS ─── */}
        <Dialog open={isRestaurantsDialogOpen} onOpenChange={setIsRestaurantsDialogOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" /> Configurar Locais
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

function ParamRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {label}
        {tooltip && (
          <span title={tooltip} className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="inline w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
          </span>
        )}
      </p>
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
