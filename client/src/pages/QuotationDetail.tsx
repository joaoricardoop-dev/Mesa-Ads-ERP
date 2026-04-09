import { useState } from "react";
import ClientPresentation from "@/components/ClientPresentation";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { generateOSPdf } from "@/lib/generate-os-pdf";
import { generateProposalPdf } from "@/lib/generate-proposal-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft,
  Undo2,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Copy,
  Pencil,
  Trash2,
  Download,
  Upload,
  Store,
  MapPin,
  Send,
  Play,
  Plus,
  Building2,
  Package,
  DollarSign,
  Clock,
  Link2,
  Presentation,
} from "lucide-react";

type QuotationStatus = "rascunho" | "enviada" | "ativa" | "os_gerada" | "win" | "perdida" | "expirada";

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string; description: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground", description: "Cotação em preparação" },
  enviada: { label: "Enviada", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", description: "Aguardando resposta do cliente" },
  ativa: { label: "Ativa", className: "bg-primary/20 text-primary border-primary/30", description: "Cliente aceitou — pronta para gerar OS" },
  os_gerada: { label: "OS Gerada", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", description: "OS criada — alocar restaurantes e assinar" },
  win: { label: "WIN", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", description: "Cotação convertida em campanha" },
  perdida: { label: "Perdida", className: "bg-destructive/20 text-destructive border-destructive/30", description: "Cotação perdida" },
  expirada: { label: "Expirada", className: "bg-orange-500/20 text-orange-400 border-orange-500/30", description: "Cotação expirada" },
};

const WORKFLOW_STEPS: QuotationStatus[] = ["rascunho", "enviada", "ativa", "os_gerada", "win"];

export default function QuotationDetail() {
  const params = useParams<{ id: string }>();
  const quotationId = Number(params.id);
  const [, navigate] = useLocation();

  const [editOpen, setEditOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [osDialogOpen, setOsDialogOpen] = useState(false);
  const [osForm, setOsForm] = useState({ description: "", paymentTerms: "" });
  const [osBatchIds, setOsBatchIds] = useState<number[]>([]);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signForm, setSignForm] = useState({ batchIds: [] as number[], signatureUrl: "" });
  const [signingLinkDialogOpen, setSigningLinkDialogOpen] = useState(false);
  const [signingLinkBatchIds, setSigningLinkBatchIds] = useState<number[]>([]);
  const [generatedSigningUrl, setGeneratedSigningUrl] = useState("");
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [restaurantAllocations, setRestaurantAllocations] = useState<Array<{ restaurantId: number; coasterQuantity: number }>>([]);
  const [addRestaurantId, setAddRestaurantId] = useState<string>("");

  const [editForm, setEditForm] = useState({
    clientId: 0 as number,
    coasterVolume: 10000,
    networkProfile: "",
    regions: "",
    cycles: 1,
    unitPrice: "",
    totalValue: "",
    includesProduction: true,
    notes: "",
    validUntil: "",
    isBonificada: false,
    periodStart: "",
    batchWeeks: 4,
    editBatchIds: [] as number[],
    agencyCommissionPercent: "",
  });

  const utils = trpc.useUtils();
  const { data: quotation, isLoading } = trpc.quotation.get.useQuery({ id: quotationId }, { enabled: !isNaN(quotationId) });
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: activeRestaurantsList = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: batchesList = [] } = trpc.batch.list.useQuery();
  const { data: os } = trpc.quotation.getOS.useQuery({ quotationId }, { enabled: !!quotation && (quotation.status === "os_gerada" || quotation.status === "win") });
  const { data: allocatedRestaurants = [] } = trpc.quotation.getRestaurants.useQuery({ quotationId });
  const { data: quotationItemsList = [] } = trpc.quotation.listItems.useQuery({ quotationId }, { enabled: !isNaN(quotationId) });

  const bvScale = (() => {
    if (!quotation) return 1;
    const bvPct = Number((quotation as any).agencyCommissionPercent ?? 0);
    if (bvPct <= 0) return 1;
    const rawTotal = quotationItemsList.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
    const finalTotal = Number(quotation.totalValue || 0);
    return rawTotal > 0 ? finalTotal / rawTotal : 1;
  })();

  const updateMutation = trpc.quotation.update.useMutation({
    onSuccess: () => { utils.quotation.get.invalidate({ id: quotationId }); utils.quotation.list.invalidate(); setEditOpen(false); toast.success("Cotação atualizada!"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.quotation.delete.useMutation({
    onSuccess: () => { utils.quotation.list.invalidate(); toast.success("Cotação removida!"); navigate("/comercial/cotacoes"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const lossMutation = trpc.quotation.markLost.useMutation({
    onSuccess: () => { utils.quotation.get.invalidate({ id: quotationId }); utils.quotation.list.invalidate(); setLossOpen(false); toast.success("Cotação marcada como perdida."); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const duplicateMutation = trpc.quotation.duplicate.useMutation({
    onSuccess: (data) => { utils.quotation.list.invalidate(); toast.success("Cotação duplicada!"); navigate(`/comercial/cotacoes/${data.id}`); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const generateOSMutation = trpc.quotation.generateOS.useMutation({
    onSuccess: (data) => { utils.quotation.get.invalidate({ id: quotationId }); utils.quotation.list.invalidate(); setOsDialogOpen(false); toast.success(`OS ${data.orderNumber} gerada!`); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const setRestaurantsMutation = trpc.quotation.setRestaurants.useMutation({
    onSuccess: () => { utils.quotation.getRestaurants.invalidate({ quotationId }); toast.success("Restaurantes atualizados!"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const signOSMutation = trpc.quotation.signOS.useMutation({
    onSuccess: (data) => { utils.quotation.get.invalidate({ id: quotationId }); utils.quotation.list.invalidate(); setSignDialogOpen(false); toast.success(`OS assinada! Campanha ${data.campaignNumber} criada.`); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const generateSigningLinkMutation = trpc.quotation.generateSigningLink.useMutation({
    onSuccess: (data) => { utils.quotation.get.invalidate({ id: quotationId }); setGeneratedSigningUrl(data.signingUrl); toast.success("Link de assinatura gerado!"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const statusChangeMutation = trpc.quotation.update.useMutation({
    onSuccess: () => { utils.quotation.get.invalidate({ id: quotationId }); utils.quotation.list.invalidate(); toast.success("Status atualizado!"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const openEdit = () => {
    if (!quotation) return;
    const existingPeriodStart = (quotation as any).periodStart || "";
    const existingCycles = quotation.cycles || 1;
    let preselectedBatchIds: number[] = [];
    if (existingPeriodStart && batchesList.length > 0) {
      const sorted = [...batchesList].sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
      const startIdx = sorted.findIndex((b: any) => b.startDate === existingPeriodStart);
      if (startIdx >= 0) {
        preselectedBatchIds = sorted.slice(startIdx, startIdx + existingCycles).map((b: any) => b.id);
      }
    }
    setEditForm({
      clientId: quotation.clientId,
      coasterVolume: quotation.coasterVolume,
      networkProfile: quotation.networkProfile || "",
      regions: quotation.regions || "",
      cycles: existingCycles,
      unitPrice: quotation.unitPrice || "",
      totalValue: quotation.totalValue || "",
      includesProduction: quotation.includesProduction ?? true,
      notes: quotation.notes || "",
      validUntil: quotation.validUntil || "",
      isBonificada: quotation.isBonificada ?? false,
      periodStart: existingPeriodStart,
      batchWeeks: (quotation as any).batchWeeks ?? 4,
      editBatchIds: preselectedBatchIds,
      agencyCommissionPercent: (quotation as any).agencyCommissionPercent ? String((quotation as any).agencyCommissionPercent) : "",
    });
    setEditOpen(true);
  };

  const handleExportProposal = async () => {
    if (!quotation) return;
    try {
      const [fetchedRestaurants, fetchedItems] = await Promise.all([
        utils.quotation.getRestaurants.fetch({ quotationId }),
        utils.quotation.listItems.fetch({ quotationId }),
      ]);

      const numRest = fetchedRestaurants.length;
      const duration = quotation.cycles || 1;
      const totalContractValue = Number(quotation.totalValue || 0);
      const monthlyTotal = duration > 0 ? totalContractValue / duration : totalContractValue;
      const effectiveNumRest = numRest > 0 ? numRest : 1;
      const pricePerRest = monthlyTotal / effectiveNumRest;

      const restaurants = fetchedRestaurants.map((r: any) => ({
        name: r.restaurantName || "Restaurante",
        neighborhood: r.restaurantAddress || "",
        coasters: r.coasterQuantity || 0,
      }));

      const proposalItems = fetchedItems.length > 0
        ? fetchedItems.map((item) => {
            const semanasMatch = item.notes?.match(/(\d+)sem/);
            const itemSemanas = semanasMatch ? parseInt(semanasMatch[1]) : duration * 4;
            const spotMatch = item.notes?.match(/Spot(30|15)s/);
            const insMatch = item.notes?.match(/(\d+)ins\/dia/);
            const cliMatch = item.notes?.match(/(\d+)cli\/mês/);
            const spotSec = spotMatch ? (parseInt(spotMatch[1]) as 15 | 30) : null;
            const insPerDay = insMatch ? parseInt(insMatch[1]) : null;
            const monthlyClients = cliMatch ? parseInt(cliMatch[1]) : null;
            const impressionsPerRestaurant = (insPerDay !== null && monthlyClients !== null)
              ? insPerDay * monthlyClients
              : undefined;
            return {
              productName: item.productName,
              volume: Number(item.quantity),
              semanas: itemSemanas,
              unitPrice: Number(item.unitPrice || 0),
              totalPrice: Number(item.totalPrice || 0),
              spotSeconds: spotSec,
              impressionsPerRestaurant,
            };
          })
        : undefined;

      generateProposalPdf({
        clientName: quotation.clientName || quotation.leadName || "Cliente",
        clientCompany: quotation.clientCompany || quotation.leadCompany || undefined,
        clientCnpj: (quotation as any).clientCnpj || undefined,
        clientEmail: (quotation as any).clientEmail || undefined,
        clientPhone: (quotation as any).clientPhone || undefined,
        quotationName: quotation.quotationName || quotation.quotationNumber,
        coasterVolume: quotation.coasterVolume,
        numRestaurants: numRest,
        coastersPerRestaurant: numRest > 0 ? Math.round(quotation.coasterVolume / numRest) : quotation.coasterVolume,
        contractDuration: duration,
        semanas: undefined,
        pricePerRestaurant: pricePerRest,
        monthlyTotal,
        contractTotal: totalContractValue,
        includesProduction: quotation.includesProduction ?? true,
        isBonificada: quotation.isBonificada ?? false,
        hasPartnerDiscount: quotation.hasPartnerDiscount ?? false,
        restaurants,
        productName: (quotation as any).productName || undefined,
        productUnitLabelPlural: (quotation as any).productUnitLabelPlural || undefined,
        items: proposalItems,
        periodStart: (quotation as any).periodStart || undefined,
        batchWeeks: (quotation as any).batchWeeks ?? 4,
        isCustomProduct: (quotation as any).isCustomProduct ?? false,
        customProductName: (quotation as any).customProductName || undefined,
        customProjectCost: (quotation as any).customProjectCost ? Number((quotation as any).customProjectCost) : undefined,
        customPricingMode: (quotation as any).customPricingMode || undefined,
        customMarginPercent: (quotation as any).customMarginPercent ? Number((quotation as any).customMarginPercent) : undefined,
        customRestaurantCommission: (quotation as any).customRestaurantCommission ? Number((quotation as any).customRestaurantCommission) : undefined,
        customPartnerCommission: (quotation as any).customPartnerCommission ? Number((quotation as any).customPartnerCommission) : undefined,
        customSellerCommission: (quotation as any).customSellerCommission ? Number((quotation as any).customSellerCommission) : undefined,
        customFinalPrice: (quotation as any).customFinalPrice ? Number((quotation as any).customFinalPrice) : undefined,
        agencyCommissionPercent: (quotation as any).agencyCommissionPercent ? Number((quotation as any).agencyCommissionPercent) : undefined,
      });
      toast.success("PDF da proposta gerado!");
    } catch {
      toast.error("Erro ao gerar PDF da proposta");
    }
  };

  const handleUpdate = () => {
    if (!editForm.clientId) { toast.error("Selecione um cliente"); return; }
    updateMutation.mutate({
      id: quotationId,
      clientId: editForm.clientId,
      coasterVolume: editForm.coasterVolume,
      networkProfile: editForm.networkProfile || undefined,
      regions: editForm.regions || undefined,
      cycles: editForm.cycles || undefined,
      unitPrice: editForm.isBonificada ? "0.0000" : (editForm.unitPrice || undefined),
      totalValue: editForm.isBonificada ? "0.00" : (editForm.totalValue || undefined),
      includesProduction: editForm.includesProduction,
      notes: editForm.notes || undefined,
      validUntil: editForm.validUntil || undefined,
      isBonificada: editForm.isBonificada,
      periodStart: editForm.periodStart || null,
      batchWeeks: editForm.batchWeeks || 4,
      agencyCommissionPercent: editForm.agencyCommissionPercent || null,
    });
  };

  if (isLoading && !isNaN(quotationId)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando cotação...</p>
        </div>
      </div>
    );
  }

  if (!quotation || isNaN(quotationId)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Cotação não encontrada</p>
          <Button variant="outline" onClick={() => navigate("/comercial/cotacoes")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const status = quotation.status as QuotationStatus;
  const isTerminal = status === "win" || status === "perdida" || status === "expirada";
  const currentStepIndex = WORKFLOW_STEPS.indexOf(status);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* ── Top Header ── */}
        <div className="border-b border-border/20 bg-card/50 px-4 lg:px-6 py-3 sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/comercial/cotacoes")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold tracking-tight">{quotation.quotationNumber}</span>
                  <Badge variant="outline" className={`text-[11px] ${STATUS_CONFIG[status]?.className || ""}`}>
                    {STATUS_CONFIG[status]?.label || status}
                  </Badge>
                  {quotation.isBonificada && (
                    <Badge variant="outline" className="text-[11px] bg-amber-500/20 text-amber-500 border-amber-500/30">Bonificada</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                  {quotation.clientName || quotation.leadName || "—"}
                  {(quotation.clientCompany || quotation.leadCompany) && ` · ${quotation.clientCompany || quotation.leadCompany}`}
                  {quotation.totalValue && !quotation.isBonificada && Number(quotation.totalValue) > 0
                    ? ` · ${formatCurrency(Number(quotation.totalValue))}`
                    : quotation.isBonificada ? " · Bonificada" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isTerminal && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={openEdit}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 border-pink-500/40 text-pink-400 hover:bg-pink-500/10 hover:text-pink-300"
                onClick={() => setPresentationOpen(true)}
              >
                <Presentation className="w-3.5 h-3.5" /> Apresentação
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExportProposal}>
                <Download className="w-3.5 h-3.5" /> Proposta
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => duplicateMutation.mutate({ id: quotationId })}>
                <Copy className="w-3.5 h-3.5" /> Duplicar
              </Button>
              {!isTerminal && (
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={() => { setLossReason(""); setLossOpen(true); }}>
                  <XCircle className="w-3.5 h-3.5" /> Perdida
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-4 max-w-5xl mx-auto">

          {/* ── Workflow stepper ── */}
          {!isTerminal && status !== "perdida" && (
            <div className="bg-card border border-border/30 rounded-xl p-3">
              <div className="flex items-center gap-1">
                {WORKFLOW_STEPS.map((step, i) => {
                  const isActive = step === status;
                  const isDone = currentStepIndex > i || status === "win";
                  const isPast = i < currentStepIndex;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg flex-1 text-xs font-medium transition-all ${
                        isActive ? "bg-primary/20 text-primary border border-primary/30" :
                        isDone ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-muted/30 text-muted-foreground"
                      }`}>
                        {isDone && !isActive ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}>{i + 1}</span>
                        )}
                        <span className="hidden sm:inline truncate">{STATUS_CONFIG[step].label}</span>
                      </div>
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={`w-3 h-px mx-0.5 ${isPast ? "bg-emerald-400" : "bg-border/30"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Main content: 3/5 left + 2/5 right ── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* ══ LEFT COLUMN: Context + Products + Notes ══ */}
            <div className="lg:col-span-3 space-y-4">

              {/* Client compact row */}
              <div className="bg-card border border-border/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight truncate">
                    {quotation.clientName || quotation.leadName || "—"}
                  </p>
                  {(quotation.clientCompany || quotation.leadCompany) && (
                    <p className="text-xs text-muted-foreground truncate">{quotation.clientCompany || quotation.leadCompany}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{quotation.clientId ? "Cliente" : "Lead"}</Badge>
                  {(quotation as any).partnerName && (
                    <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500">
                      Parceiro: {(quotation as any).partnerName}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Products table — main content */}
              <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Package className="w-3.5 h-3.5" /> Produtos do Orçamento
                  </h3>
                  {quotationItemsList.length > 0 && (
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {quotationItemsList.length} {quotationItemsList.length === 1 ? "item" : "itens"}
                    </span>
                  )}
                </div>

                {quotationItemsList.length > 0 ? (() => {
                  const bvPercent = Number((quotation as any).agencyCommissionPercent ?? 0);
                  const rawItemsTotal = quotationItemsList.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
                  const totalValue = Number(quotation.totalValue || 0);
                  const bvScale = bvPercent > 0 && rawItemsTotal > 0 ? totalValue / rawItemsTotal : 1;
                  return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2 font-medium">Produto</th>
                        <th className="text-right px-4 py-2 font-medium">Volume</th>
                        <th className="text-right px-4 py-2 font-medium">Preço/un.</th>
                        <th className="text-right px-4 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotationItemsList.map((item) => (
                        <tr key={item.id} className="border-t border-border/20 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.productName}</p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.notes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {Number(item.quantity).toLocaleString("pt-BR")} un.
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                            {item.unitPrice && Number(item.unitPrice) > 0
                              ? `R$ ${(Number(item.unitPrice) * bvScale).toFixed(4)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            {quotation.isBonificada || (Number(item.totalPrice ?? 0) === 0 && Number(item.unitPrice ?? 0) > 0) ? (
                              <span className="text-amber-500 text-xs">Bonif.</span>
                            ) : item.totalPrice && Number(item.totalPrice) > 0 ? (
                              formatCurrency(Number(item.totalPrice) * bvScale)
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border/40 bg-muted/10">
                        <td colSpan={2} className="px-4 py-2.5 text-xs text-muted-foreground">
                          {quotationItemsList.length > 1
                            ? `${quotationItemsList.length} produtos · ${quotationItemsList.reduce((s, i) => s + Number(i.quantity), 0).toLocaleString("pt-BR")} un. total`
                            : `${Number(quotationItemsList[0]?.quantity || 0).toLocaleString("pt-BR")} un.`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">Total</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-primary">
                          {quotation.isBonificada
                            ? <span className="text-amber-500">R$ 0,00</span>
                            : quotation.totalValue ? formatCurrency(Number(quotation.totalValue)) : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  );
                })() : (quotation as any).isCustomProduct ? (
                  <div className="px-4 py-4 space-y-1.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Projeto Sob Medida
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nome do Projeto</span>
                      <span className="font-medium">{(quotation as any).customProductName || quotation.productName || "—"}</span>
                    </div>
                    {(quotation as any).customProjectCost && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Custo do Projeto</span>
                        <span className="font-mono">{formatCurrency(Number((quotation as any).customProjectCost))}</span>
                      </div>
                    )}
                    {(quotation as any).customPricingMode === "margin" && (quotation as any).customMarginPercent && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Margem</span>
                        <span className="font-mono">{Number((quotation as any).customMarginPercent).toFixed(1)}%</span>
                      </div>
                    )}
                    {(quotation as any).customRestaurantCommission && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Comissão Restaurante</span>
                        <span className="font-mono">{Number((quotation as any).customRestaurantCommission).toFixed(1)}%</span>
                      </div>
                    )}
                    {(quotation as any).customPartnerCommission && Number((quotation as any).customPartnerCommission) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Comissão Parceiro/Agência</span>
                        <span className="font-mono">{Number((quotation as any).customPartnerCommission).toFixed(1)}%</span>
                      </div>
                    )}
                    {(quotation as any).customSellerCommission && Number((quotation as any).customSellerCommission) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Comissão Vendedor</span>
                        <span className="font-mono">{Number((quotation as any).customSellerCommission).toFixed(1)}%</span>
                      </div>
                    )}
                    {(quotation as any).agencyCommissionPercent && Number((quotation as any).agencyCommissionPercent) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">BV Agência/Parceiro</span>
                        <span className="font-mono text-amber-500">
                          {Number((quotation as any).agencyCommissionPercent).toFixed(1)}%
                          {(quotation as any).partnerName ? ` · ${(quotation as any).partnerName}` : ""}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-1 border-t border-border/20 mt-2">
                      <span className="text-muted-foreground">Valor Total</span>
                      <span className={`font-mono font-bold ${quotation.isBonificada ? "text-amber-500" : "text-violet-600 dark:text-violet-400"}`}>
                        {quotation.isBonificada ? "R$ 0,00 (Bonificada)" : quotation.totalValue ? formatCurrency(Number(quotation.totalValue)) : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-4 space-y-1">
                    {quotation.productName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Produto</span>
                        <span className="font-medium">{quotation.productName}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Volume</span>
                      <span className="font-mono">{quotation.coasterVolume.toLocaleString("pt-BR")} un.</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1 border-t border-border/20 mt-2">
                      <span className="text-muted-foreground">Total</span>
                      <span className={`font-mono font-bold ${quotation.isBonificada ? "text-amber-500" : "text-primary"}`}>
                        {quotation.isBonificada ? "R$ 0,00 (Bonificada)" : quotation.totalValue ? formatCurrency(Number(quotation.totalValue)) : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Observações */}
              {quotation.notes && (
                <div className="bg-card border border-border/30 rounded-xl px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{quotation.notes}</p>
                </div>
              )}
            </div>

            {/* ══ RIGHT COLUMN: Workflow action + Campaign metadata ══ */}
            <div className="lg:col-span-2 space-y-4">

              {/* Workflow action card — contextual */}
              {status === "rascunho" && (
                <div className="bg-card border border-blue-500/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-400" /> Próximo passo
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Revise os dados e envie a cotação ao cliente.</p>
                  </div>
                  <Button
                    className="w-full gap-1.5"
                    onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "enviada" })}
                    disabled={statusChangeMutation.isPending}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {statusChangeMutation.isPending ? "Enviando..." : "Marcar como Enviada"}
                  </Button>
                </div>
              )}

              {status === "enviada" && (
                <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary" /> Aguardando Resposta
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">O cliente aceitou? Ative para seguir o fluxo.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full gap-1.5 bg-primary hover:bg-primary/90"
                      onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "ativa" })}
                      disabled={statusChangeMutation.isPending}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {statusChangeMutation.isPending ? "Ativando..." : "Ativar Cotação"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-1.5"
                      onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "rascunho" })}
                      disabled={statusChangeMutation.isPending}
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Voltar p/ Rascunho
                    </Button>
                  </div>
                </div>
              )}

              {status === "ativa" && (
                <div className="bg-card border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400" /> Cliente Aceitou
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Formalize o contrato gerando a OS Anunciante.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700"
                      onClick={() => { setOsForm({ description: "", paymentTerms: "" }); setOsBatchIds([]); setOsDialogOpen(true); }}
                    >
                      <FileText className="w-3.5 h-3.5" /> Gerar OS
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-1.5"
                      onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "enviada" })}
                      disabled={statusChangeMutation.isPending}
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Voltar p/ Enviada
                    </Button>
                  </div>
                </div>
              )}

              {status === "os_gerada" && (
                <div className="bg-card border border-amber-500/30 rounded-xl p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Store className="w-4 h-4 text-amber-400" /> OS Gerada
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Aloque restaurantes e assine para converter.</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-muted-foreground h-7"
                      onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "ativa" })}
                      disabled={statusChangeMutation.isPending}
                    >
                      <Undo2 className="w-3 h-3" /> Voltar p/ Ativa
                    </Button>
                  </div>

                  {os && (
                    <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">OS</p>
                        <p className="text-sm font-bold">{os.orderNumber}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-8"
                        onClick={() => {
                          generateOSPdf({
                            orderNumber: os.orderNumber,
                            quotationNumber: quotation.quotationNumber,
                            clientName: quotation.clientName || "Anunciante",
                            clientCompany: quotation.clientCompany || undefined,
                            coasterVolume: quotation.coasterVolume,
                            totalValue: quotation.totalValue || os.totalValue || undefined,
                            paymentTerms: os.paymentTerms || undefined,
                            periodStart: os.periodStart || undefined,
                            periodEnd: os.periodEnd || undefined,
                            description: os.description || undefined,
                            restaurants: allocatedRestaurants.map((r: any) => ({
                              name: r.restaurantName || `Restaurante #${r.restaurantId}`,
                              coasterQuantity: r.coasterQuantity,
                            })),
                          });
                        }}
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Restaurantes ({allocatedRestaurants.length})
                    </p>
                    {allocatedRestaurants.length > 0 && (
                      <div className="space-y-1">
                        {allocatedRestaurants.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between bg-background/50 rounded px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs">{r.restaurantName || `#${r.restaurantId}`}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{r.coasterQuantity} un. · {r.commissionPercent}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Select value={addRestaurantId} onValueChange={setAddRestaurantId}>
                        <SelectTrigger className="flex-1 bg-background border-border/30 h-8 text-xs">
                          <SelectValue placeholder="Adicionar restaurante..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeRestaurantsList
                            .filter((r) => !allocatedRestaurants.find((a: any) => a.restaurantId === r.id))
                            .map((r) => (
                              <SelectItem key={r.id} value={String(r.id)}>
                                {r.name} <span className="text-muted-foreground">({r.commissionPercent}%)</span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={!addRestaurantId}
                        onClick={() => {
                          if (!addRestaurantId) return;
                          const newAllocations = [
                            ...allocatedRestaurants.map((r: any) => ({ restaurantId: r.restaurantId, coasterQuantity: r.coasterQuantity })),
                            { restaurantId: Number(addRestaurantId), coasterQuantity: Math.floor(quotation.coasterVolume / (allocatedRestaurants.length + 1)) || 500 },
                          ];
                          setRestaurantsMutation.mutate({ quotationId, restaurants: newAllocations });
                          setAddRestaurantId("");
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {quotation.publicToken && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                      <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400 flex-1 truncate">Link ativo</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 gap-1 text-[10px] px-2"
                        onClick={() => {
                          const url = `${window.location.origin}/cotacao/assinar/${quotation.publicToken}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Link copiado!");
                        }}
                      >
                        <Copy className="w-2.5 h-2.5" /> Copiar
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1 border-t border-border/20">
                    <Button
                      className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        let ids: number[] = [];
                        try { if (os?.batchSelectionJson) ids = JSON.parse(os.batchSelectionJson); } catch {}
                        if (!Array.isArray(ids)) ids = [];
                        const validBatchIds = new Set(batchesList.map((b: any) => b.id));
                        ids = ids.filter(id => validBatchIds.has(id));
                        setSignForm({ batchIds: ids, signatureUrl: "" });
                        setSignDialogOpen(true);
                      }}
                      disabled={allocatedRestaurants.length === 0}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Assinar OS e Criar Campanha
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full gap-1.5"
                      onClick={() => {
                        let ids: number[] = [];
                        try { if (os?.batchSelectionJson) ids = JSON.parse(os.batchSelectionJson); } catch {}
                        if (!Array.isArray(ids)) ids = [];
                        const validBatchIds = new Set(batchesList.map((b: any) => b.id));
                        ids = ids.filter(id => validBatchIds.has(id));
                        setSigningLinkBatchIds(ids);
                        setGeneratedSigningUrl("");
                        setSigningLinkDialogOpen(true);
                      }}
                      disabled={allocatedRestaurants.length === 0}
                    >
                      <Send className="w-4 h-4" /> Enviar para Assinatura
                    </Button>
                  </div>
                </div>
              )}

              {status === "win" && (
                <div className="bg-card border border-emerald-500/30 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Cotação Convertida
                  </h3>
                  <p className="text-sm text-muted-foreground">Convertida em campanha com sucesso.</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/campanhas")}>
                    Ver Campanhas
                  </Button>
                </div>
              )}

              {status === "perdida" && (
                <div className="bg-card border border-destructive/30 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                    <XCircle className="w-4 h-4" /> Cotação Perdida
                  </h3>
                  {quotation.lossReason && (
                    <p className="text-xs text-muted-foreground">Motivo: {quotation.lossReason}</p>
                  )}
                </div>
              )}

              {/* Campaign metadata */}
              <div className="bg-card border border-border/30 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Configurações
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Ciclos</span>
                    <span className="text-xs font-medium">{quotation.cycles || 1}</span>
                  </div>
                  {quotation.networkProfile && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-xs">Rede</span>
                      <span className="text-xs font-medium">{quotation.networkProfile}</span>
                    </div>
                  )}
                  {quotation.regions && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-xs">Regiões</span>
                      <span className="text-xs font-medium">{quotation.regions}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Produção</span>
                    <span className="text-xs font-medium">{quotation.includesProduction ? "Inclusa" : "Não inclusa"}</span>
                  </div>
                  {quotationItemsList.length <= 1 && quotation.unitPrice && Number(quotation.unitPrice) > 0 && (
                    <div className="flex justify-between items-center pt-1 border-t border-border/20 mt-1">
                      <span className="text-muted-foreground text-xs">Preço/un.</span>
                      <span className="text-xs font-mono">R$ {Number(quotation.unitPrice).toFixed(4)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Validity */}
              {quotation.validUntil && (
                <div className="bg-card border border-border/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Válido até</span>
                  <span className="text-xs font-medium ml-auto">
                    {new Date(quotation.validUntil + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}

              {/* Restaurants (non-os_gerada statuses) */}
              {allocatedRestaurants.length > 0 && status !== "os_gerada" && (
                <div className="bg-card border border-border/30 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" /> Restaurantes ({allocatedRestaurants.length})
                  </h3>
                  <div className="space-y-1">
                    {allocatedRestaurants.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-background/50 rounded px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs">{r.restaurantName || `#${r.restaurantId}`}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{r.coasterQuantity} un.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cotação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select value={editForm.clientId ? String(editForm.clientId) : ""} onValueChange={(v) => setEditForm({ ...editForm, clientId: Number(v) })}>
                <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clientsList.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} {c.company ? `(${c.company})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Volume *</Label>
                <Input type="number" value={editForm.coasterVolume} onChange={(e) => setEditForm({ ...editForm, coasterVolume: Number(e.target.value) })} min={1} className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Ciclos</Label>
                <Input type="number" value={editForm.cycles} onChange={(e) => setEditForm({ ...editForm, cycles: Number(e.target.value) })} min={1} className="bg-background border-border/30" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Regiões</Label>
                <Input value={editForm.regions} onChange={(e) => setEditForm({ ...editForm, regions: e.target.value })} placeholder="Ex: Zona Sul" className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Perfil de Rede</Label>
                <Input value={editForm.networkProfile} onChange={(e) => setEditForm({ ...editForm, networkProfile: e.target.value })} placeholder="Ex: Top 50" className="bg-background border-border/30" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <Switch
                id="detail-bonificada-toggle"
                checked={editForm.isBonificada}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setEditForm({ ...editForm, isBonificada: true, unitPrice: "0.0000", totalValue: "0.00" });
                  } else {
                    setEditForm({ ...editForm, isBonificada: false });
                  }
                }}
              />
              <Label htmlFor="detail-bonificada-toggle" className="cursor-pointer text-sm font-medium text-amber-500">
                Bonificação
              </Label>
              {editForm.isBonificada && (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] ml-auto">
                  Bonificada
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Preço Unitário (R$)</Label>
                <Input value={editForm.isBonificada ? "0.0000" : editForm.unitPrice} onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} placeholder="0.0000" className="bg-background border-border/30" disabled={editForm.isBonificada} />
              </div>
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input value={editForm.isBonificada ? "0.00" : editForm.totalValue} onChange={(e) => setEditForm({ ...editForm, totalValue: e.target.value })} placeholder="0.00" className="bg-background border-border/30" disabled={editForm.isBonificada} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Comissão de Agência (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={editForm.agencyCommissionPercent}
                  onChange={(e) => setEditForm({ ...editForm, agencyCommissionPercent: e.target.value })}
                  placeholder="Ex: 15"
                  className="bg-background border-border/30 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Comissão paga à agência parceira (apenas informativo)</p>
            </div>
            <div className="grid gap-2">
              <Label>Validade</Label>
              <Input type="date" value={editForm.validUntil} onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })} className="bg-background border-border/30" />
            </div>
            <div className="grid gap-2">
              <Label>Período de Veiculação (Batches)</Label>
              <div className="bg-background border border-border/30 rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-1">
                {batchesList.map((batch: any) => (
                  <label key={batch.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/30 cursor-pointer">
                    <Checkbox
                      checked={editForm.editBatchIds.includes(batch.id)}
                      onCheckedChange={(checked) => {
                        const newIds = checked
                          ? [...editForm.editBatchIds, batch.id].sort((a, b) => a - b)
                          : editForm.editBatchIds.filter(id => id !== batch.id);
                        const selectedBatches = batchesList
                          .filter((b: any) => newIds.includes(b.id))
                          .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
                        const newPeriodStart = selectedBatches.length > 0 ? selectedBatches[0].startDate : "";
                        const newCycles = selectedBatches.length;
                        setEditForm({ ...editForm, editBatchIds: newIds, periodStart: newPeriodStart, cycles: newCycles || editForm.cycles, batchWeeks: 4 });
                      }}
                    />
                    <span className="text-sm font-medium">{batch.name}</span>
                    <span className="text-xs text-muted-foreground ml-1">{batch.startDate} — {batch.endDate}</span>
                  </label>
                ))}
              </div>
              {editForm.editBatchIds.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {editForm.editBatchIds.length} batch(es) — Período: {(() => {
                    const sel = batchesList
                      .filter((b: any) => editForm.editBatchIds.includes(b.id))
                      .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
                    return sel.length > 0 ? `${sel[0].startDate} a ${sel[sel.length - 1].endDate}` : "";
                  })()}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="bg-background border-border/30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={osDialogOpen} onOpenChange={setOsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30">
          <DialogHeader>
            <DialogTitle>Gerar Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={osForm.description} onChange={(e) => setOsForm({ ...osForm, description: e.target.value })} placeholder="Descrição da OS" rows={3} className="bg-background border-border/30" />
            </div>
            <div className="grid gap-2">
              <Label>Período (Batches)</Label>
              <div className="bg-background border border-border/30 rounded-lg p-3 max-h-[180px] overflow-y-auto space-y-1">
                {batchesList.map((batch: any) => (
                  <label key={batch.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/30 cursor-pointer">
                    <Checkbox
                      checked={osBatchIds.includes(batch.id)}
                      onCheckedChange={(checked) => {
                        setOsBatchIds(prev =>
                          checked
                            ? [...prev, batch.id].sort((a, b) => a - b)
                            : prev.filter(id => id !== batch.id)
                        );
                      }}
                    />
                    <span className="text-xs flex-1">{batch.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {batch.startDate} — {batch.endDate}
                    </span>
                  </label>
                ))}
              </div>
              {osBatchIds.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {osBatchIds.length} batch(es) — Período: {
                    (() => {
                      const selected = batchesList
                        .filter((b: any) => osBatchIds.includes(b.id))
                        .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
                      return selected.length > 0
                        ? `${selected[0].startDate} a ${selected[selected.length - 1].endDate}`
                        : "";
                    })()
                  }
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Condições de Pagamento</Label>
              <Input value={osForm.paymentTerms} onChange={(e) => setOsForm({ ...osForm, paymentTerms: e.target.value })} placeholder="Ex: 30/60/90 dias" className="bg-background border-border/30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const selectedBatches = batchesList
                .filter((b: any) => osBatchIds.includes(b.id))
                .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
              const periodStart = selectedBatches.length > 0 ? selectedBatches[0].startDate : undefined;
              const periodEnd = selectedBatches.length > 0 ? selectedBatches[selectedBatches.length - 1].endDate : undefined;
              generateOSMutation.mutate({
                id: quotationId,
                description: osForm.description || undefined,
                periodStart,
                periodEnd,
                paymentTerms: osForm.paymentTerms || undefined,
                batchIds: osBatchIds.length > 0 ? osBatchIds : undefined,
              });
            }} disabled={generateOSMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              {generateOSMutation.isPending ? "Gerando..." : "Gerar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assinar OS e Criar Campanha</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Batches (períodos de 4 semanas) *</Label>
              <div className="border border-border/30 rounded-lg max-h-48 overflow-y-auto bg-background">
                {batchesList.map((batch: any) => (
                  <label
                    key={batch.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer border-b border-border/10 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={signForm.batchIds.includes(batch.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSignForm({ ...signForm, batchIds: [...signForm.batchIds, batch.id] });
                        } else {
                          setSignForm({ ...signForm, batchIds: signForm.batchIds.filter((id: number) => id !== batch.id) });
                        }
                      }}
                      className="rounded border-border"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{batch.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(batch.startDate + "T00:00:00").toLocaleDateString("pt-BR")} — {new Date(batch.endDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {signForm.batchIds.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {signForm.batchIds.length} batch(es) selecionado(s)
                  {(() => {
                    const selected = batchesList.filter((b: any) => signForm.batchIds.includes(b.id)).sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
                    if (selected.length === 0) return "";
                    const first = selected[0];
                    const last = selected[selected.length - 1];
                    return ` — ${new Date(first.startDate + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(last.endDate + "T00:00:00").toLocaleDateString("pt-BR")}`;
                  })()}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>URL da Assinatura *</Label>
              <Input value={signForm.signatureUrl} onChange={(e) => setSignForm({ ...signForm, signatureUrl: e.target.value })} placeholder="https://..." className="bg-background border-border/30" />
              <p className="text-[10px] text-muted-foreground">Link para o documento assinado ou imagem da assinatura</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!signForm.signatureUrl.trim()) { toast.error("Informe a URL da assinatura"); return; }
                if (signForm.batchIds.length === 0) { toast.error("Selecione pelo menos um batch"); return; }
                signOSMutation.mutate({ quotationId, signatureUrl: signForm.signatureUrl.trim(), batchIds: signForm.batchIds });
              }}
              disabled={signOSMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {signOSMutation.isPending ? "Assinando..." : "Assinar e Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signingLinkDialogOpen} onOpenChange={setSigningLinkDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Enviar para Assinatura
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Selecione os Batches *</Label>
              <div className="border border-border/30 rounded-lg max-h-48 overflow-y-auto bg-background">
                {batchesList.map((batch: any) => (
                  <label
                    key={batch.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer border-b border-border/10 last:border-b-0"
                  >
                    <Checkbox
                      checked={signingLinkBatchIds.includes(batch.id)}
                      onCheckedChange={(checked) => {
                        setSigningLinkBatchIds(prev =>
                          checked
                            ? [...prev, batch.id].sort((a, b) => a - b)
                            : prev.filter(id => id !== batch.id)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{batch.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(batch.startDate + "T00:00:00").toLocaleDateString("pt-BR")} — {new Date(batch.endDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              {signingLinkBatchIds.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {signingLinkBatchIds.length} batch(es) selecionado(s)
                </p>
              )}
            </div>
            {generatedSigningUrl && (
              <div className="grid gap-2">
                <Label>Link de Assinatura</Label>
                <div className="flex items-center gap-2">
                  <Input value={generatedSigningUrl} readOnly className="bg-background border-border/30 text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedSigningUrl);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar Link
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSigningLinkDialogOpen(false)}>Fechar</Button>
            {!generatedSigningUrl && (
              <Button
                onClick={() => {
                  if (signingLinkBatchIds.length === 0) { toast.error("Selecione pelo menos um batch"); return; }
                  generateSigningLinkMutation.mutate({ quotationId, batchIds: signingLinkBatchIds });
                }}
                disabled={generateSigningLinkMutation.isPending || signingLinkBatchIds.length === 0}
                className="gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                {generateSigningLinkMutation.isPending ? "Gerando..." : "Gerar Link"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={lossOpen} onOpenChange={setLossOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Perdida</AlertDialogTitle>
            <AlertDialogDescription>Deseja marcar esta cotação como perdida?</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="Motivo da perda (opcional)" rows={3} className="bg-background border-border/30" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => lossMutation.mutate({ id: quotationId, lossReason: lossReason || undefined })} className="bg-destructive hover:bg-destructive/90">
              Marcar Perdida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cotação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate({ id: quotationId })} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientPresentation
        isOpen={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        quotation={quotation}
        quotationItems={quotationItemsList}
      />
    </div>
  );
}
