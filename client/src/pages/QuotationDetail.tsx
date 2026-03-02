import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { generateOSPdf } from "@/lib/generate-os-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Link,
  CheckCircle,
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
  const [osForm, setOsForm] = useState({ description: "", periodStart: "", periodEnd: "", paymentTerms: "" });
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signForm, setSignForm] = useState({ startDate: "", endDate: "", signatureUrl: "" });
  const [restaurantAllocations, setRestaurantAllocations] = useState<Array<{ restaurantId: number; coasterQuantity: number }>>([]);
  const [addRestaurantId, setAddRestaurantId] = useState<string>("");

  const [editForm, setEditForm] = useState({
    clientId: 0 as number,
    campaignType: "padrao",
    coasterVolume: 10000,
    networkProfile: "",
    regions: "",
    cycles: 1,
    unitPrice: "",
    totalValue: "",
    includesProduction: true,
    notes: "",
    validUntil: "",
  });

  const utils = trpc.useUtils();
  const { data: quotation, isLoading } = trpc.quotation.get.useQuery({ id: quotationId }, { enabled: !isNaN(quotationId) });
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: activeRestaurantsList = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: os } = trpc.quotation.getOS.useQuery({ quotationId }, { enabled: !!quotation && (quotation.status === "os_gerada" || quotation.status === "win") });
  const { data: allocatedRestaurants = [] } = trpc.quotation.getRestaurants.useQuery({ quotationId });

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

  const statusChangeMutation = trpc.quotation.update.useMutation({
    onSuccess: () => { utils.quotation.get.invalidate({ id: quotationId }); utils.quotation.list.invalidate(); toast.success("Status atualizado!"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const generateProposalLinkMutation = trpc.quotation.generateProposalLink.useMutation({
    onSuccess: (data) => {
      utils.quotation.get.invalidate({ id: quotationId });
      const fullUrl = `${window.location.origin}${data.url}`;
      navigator.clipboard.writeText(fullUrl).then(() => {
        toast.success("Link da proposta copiado!");
      }).catch(() => {
        toast.success("Link gerado: " + fullUrl);
      });
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const openEdit = () => {
    if (!quotation) return;
    setEditForm({
      clientId: quotation.clientId,
      campaignType: quotation.campaignType || "padrao",
      coasterVolume: quotation.coasterVolume,
      networkProfile: quotation.networkProfile || "",
      regions: quotation.regions || "",
      cycles: quotation.cycles || 1,
      unitPrice: quotation.unitPrice || "",
      totalValue: quotation.totalValue || "",
      includesProduction: quotation.includesProduction ?? true,
      notes: quotation.notes || "",
      validUntil: quotation.validUntil || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm.clientId) { toast.error("Selecione um cliente"); return; }
    updateMutation.mutate({
      id: quotationId,
      clientId: editForm.clientId,
      campaignType: editForm.campaignType || undefined,
      coasterVolume: editForm.coasterVolume,
      networkProfile: editForm.networkProfile || undefined,
      regions: editForm.regions || undefined,
      cycles: editForm.cycles || undefined,
      unitPrice: editForm.unitPrice || undefined,
      totalValue: editForm.totalValue || undefined,
      includesProduction: editForm.includesProduction,
      notes: editForm.notes || undefined,
      validUntil: editForm.validUntil || undefined,
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
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/comercial/cotacoes")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight">{quotation.quotationNumber}</h1>
                  <Badge variant="outline" className={STATUS_CONFIG[status]?.className || ""}>
                    {STATUS_CONFIG[status]?.label || status}
                  </Badge>
                  {quotation.signedAt && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Assinada em {new Date(quotation.signedAt).toLocaleDateString("pt-BR")} por {quotation.signedBy}
                    </Badge>
                  )}
                </div>
                {quotation.quotationName && (
                  <p className="text-xs text-muted-foreground mt-0.5">{quotation.quotationName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isTerminal && status !== "rascunho" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (quotation.publicToken) {
                      const fullUrl = `${window.location.origin}/proposta/${quotation.publicToken}`;
                      navigator.clipboard.writeText(fullUrl).then(() => {
                        toast.success("Link copiado!");
                      }).catch(() => {
                        toast.info("Link: " + fullUrl);
                      });
                    } else {
                      generateProposalLinkMutation.mutate({ quotationId });
                    }
                  }}
                  disabled={generateProposalLinkMutation.isPending}
                >
                  <Link className="w-3.5 h-3.5" />
                  {quotation.publicToken ? "Copiar Link" : "Gerar Link da Proposta"}
                </Button>
              )}
              {!isTerminal && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => duplicateMutation.mutate({ id: quotationId })}>
                <Copy className="w-3.5 h-3.5" /> Duplicar
              </Button>
              {!isTerminal && (
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => { setLossReason(""); setLossOpen(true); }}>
                  <XCircle className="w-3.5 h-3.5" /> Perdida
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
          {!isTerminal && status !== "perdida" && (
            <div className="bg-card border border-border/30 rounded-xl p-4">
              <div className="flex items-center gap-1">
                {WORKFLOW_STEPS.map((step, i) => {
                  const isActive = step === status;
                  const isDone = currentStepIndex > i || status === "win";
                  const isPast = i < currentStepIndex;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg flex-1 text-xs font-medium transition-all ${
                        isActive ? "bg-primary/20 text-primary border border-primary/30" :
                        isDone ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-muted/30 text-muted-foreground"
                      }`}>
                        {isDone && !isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}>{i + 1}</span>
                        )}
                        <span className="hidden sm:inline">{STATUS_CONFIG[step].label}</span>
                      </div>
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={`w-4 h-px mx-1 ${isPast ? "bg-emerald-400" : "bg-border/30"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-card border border-border/30 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Cliente
                </h3>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{quotation.clientName || "—"}</p>
                  {quotation.clientCompany && <p className="text-xs text-muted-foreground">{quotation.clientCompany}</p>}
                </div>
              </div>

              <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Detalhes
                </h3>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <span className="text-muted-foreground">Volume</span>
                  <span className="font-mono font-medium">{quotation.coasterVolume.toLocaleString("pt-BR")} un.</span>
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="capitalize">{quotation.campaignType || "padrão"}</span>
                  <span className="text-muted-foreground">Ciclos</span>
                  <span>{quotation.cycles || 1}</span>
                  {quotation.networkProfile && (<><span className="text-muted-foreground">Rede</span><span>{quotation.networkProfile}</span></>)}
                  {quotation.regions && (<><span className="text-muted-foreground">Regiões</span><span>{quotation.regions}</span></>)}
                  <span className="text-muted-foreground">Produção</span>
                  <span>{quotation.includesProduction ? "Inclusa" : "Não inclusa"}</span>
                </div>
              </div>

              <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Valores
                </h3>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <span className="text-muted-foreground">Unitário</span>
                  <span className="font-mono">{quotation.unitPrice ? `R$ ${quotation.unitPrice}` : "—"}</span>
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono font-bold text-primary">{quotation.totalValue ? formatCurrency(Number(quotation.totalValue)) : "—"}</span>
                </div>
              </div>

              {quotation.validUntil && (
                <div className="bg-card border border-border/30 rounded-xl p-5 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Validade
                  </h3>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {new Date(quotation.validUntil + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}

              {quotation.notes && (
                <div className="bg-card border border-border/30 rounded-xl p-5 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {status === "rascunho" && (
                <div className="bg-card border border-blue-500/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Send className="w-4 h-4 text-blue-400" /> Enviar Cotação
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Revise os dados e envie a cotação ao cliente.</p>
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "enviada" })}
                      disabled={statusChangeMutation.isPending}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {statusChangeMutation.isPending ? "Enviando..." : "Marcar como Enviada"}
                    </Button>
                  </div>
                </div>
              )}

              {status === "enviada" && (
                <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary" /> Ativar Cotação
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">O cliente aceitou? Ative para seguir o fluxo operacional.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "rascunho" })}
                        disabled={statusChangeMutation.isPending}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Voltar p/ Rascunho
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-primary hover:bg-primary/90"
                        onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "ativa" })}
                        disabled={statusChangeMutation.isPending}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {statusChangeMutation.isPending ? "Ativando..." : "Ativar Cotação"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {status === "ativa" && (
                <div className="bg-card border border-amber-500/30 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400" /> Gerar Ordem de Serviço
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Gere a OS Anunciante para formalizar o contrato.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "enviada" })}
                        disabled={statusChangeMutation.isPending}
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Voltar p/ Enviada
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                        onClick={() => { setOsForm({ description: "", periodStart: "", periodEnd: "", paymentTerms: "" }); setOsDialogOpen(true); }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Gerar OS
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {status === "os_gerada" && (
                <div className="bg-card border border-amber-500/30 rounded-xl p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Store className="w-4 h-4 text-amber-400" /> Alocação de Restaurantes e Assinatura
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Aloque os restaurantes, baixe o PDF da OS e assine para converter em campanha.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => statusChangeMutation.mutate({ id: quotationId, status: "ativa" })}
                      disabled={statusChangeMutation.isPending}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Voltar p/ Ativa
                    </Button>
                  </div>

                  {os && (
                    <div className="bg-background/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">OS Anunciante</p>
                          <p className="text-sm font-bold">{os.orderNumber}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
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
                          <Download className="w-3.5 h-3.5" /> Baixar PDF
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Restaurantes Alocados ({allocatedRestaurants.length})</p>
                    </div>
                    {allocatedRestaurants.length > 0 && (
                      <div className="space-y-1">
                        {allocatedRestaurants.map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm">{r.restaurantName || `#${r.restaurantId}`}</span>
                            </div>
                            <span className="text-xs font-mono text-muted-foreground">{r.coasterQuantity} un. • {r.commissionPercent}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Select value={addRestaurantId} onValueChange={setAddRestaurantId}>
                        <SelectTrigger className="flex-1 bg-background border-border/30 h-9 text-sm">
                          <SelectValue placeholder="Selecione restaurante" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeRestaurantsList
                            .filter((r) => !allocatedRestaurants.find((a: any) => a.restaurantId === r.id))
                            .map((r) => (
                              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
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

                  <div className="flex justify-end gap-2 pt-2 border-t border-border/20">
                    <Button
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { setSignForm({ startDate: "", endDate: "", signatureUrl: "" }); setSignDialogOpen(true); }}
                      disabled={allocatedRestaurants.length === 0}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Assinar OS e Criar Campanha
                    </Button>
                  </div>
                </div>
              )}

              {status === "win" && (
                <div className="bg-card border border-emerald-500/30 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Cotação Convertida
                  </h3>
                  <p className="text-sm text-muted-foreground">Esta cotação foi convertida em campanha com sucesso.</p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/campanhas")}>
                    Ver Campanhas
                  </Button>
                </div>
              )}

              {status === "perdida" && (
                <div className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive">
                    <XCircle className="w-4 h-4" /> Cotação Perdida
                  </h3>
                  {quotation.lossReason && <p className="text-sm text-muted-foreground">Motivo: {quotation.lossReason}</p>}
                </div>
              )}

              {allocatedRestaurants.length > 0 && status !== "os_gerada" && (
                <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Store className="w-3.5 h-3.5" /> Restaurantes ({allocatedRestaurants.length})
                  </h3>
                  <div className="space-y-1">
                    {allocatedRestaurants.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{r.restaurantName || `#${r.restaurantId}`}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{r.coasterQuantity} un.</span>
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
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Volume *</Label>
                <Input type="number" value={editForm.coasterVolume} onChange={(e) => setEditForm({ ...editForm, coasterVolume: Number(e.target.value) })} min={1} className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Ciclos</Label>
                <Input type="number" value={editForm.cycles} onChange={(e) => setEditForm({ ...editForm, cycles: Number(e.target.value) })} min={1} className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={editForm.campaignType} onValueChange={(v) => setEditForm({ ...editForm, campaignType: v })}>
                  <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="exclusivo">Exclusivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Regiões</Label>
                <Input value={editForm.regions} onChange={(e) => setEditForm({ ...editForm, regions: e.target.value })} placeholder="Ex: Zona Sul" className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Perfil de Rede</Label>
                <Input value={editForm.networkProfile} onChange={(e) => setEditForm({ ...editForm, networkProfile: e.target.value })} placeholder="Ex: Top 50" className="bg-background border-border/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Preço Unitário (R$)</Label>
                <Input value={editForm.unitPrice} onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} placeholder="0.0000" className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input value={editForm.totalValue} onChange={(e) => setEditForm({ ...editForm, totalValue: e.target.value })} placeholder="0.00" className="bg-background border-border/30" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Validade</Label>
              <Input type="date" value={editForm.validUntil} onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })} className="bg-background border-border/30" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Início do Período</Label>
                <Input type="date" value={osForm.periodStart} onChange={(e) => setOsForm({ ...osForm, periodStart: e.target.value })} className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Fim do Período</Label>
                <Input type="date" value={osForm.periodEnd} onChange={(e) => setOsForm({ ...osForm, periodEnd: e.target.value })} className="bg-background border-border/30" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Condições de Pagamento</Label>
              <Input value={osForm.paymentTerms} onChange={(e) => setOsForm({ ...osForm, paymentTerms: e.target.value })} placeholder="Ex: 30/60/90 dias" className="bg-background border-border/30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => generateOSMutation.mutate({ id: quotationId, ...osForm })} disabled={generateOSMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
              {generateOSMutation.isPending ? "Gerando..." : "Gerar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30">
          <DialogHeader>
            <DialogTitle>Assinar OS e Criar Campanha</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data Início Veiculação</Label>
                <Input type="date" value={signForm.startDate} onChange={(e) => setSignForm({ ...signForm, startDate: e.target.value })} className="bg-background border-border/30" />
              </div>
              <div className="grid gap-2">
                <Label>Data Fim Veiculação</Label>
                <Input type="date" value={signForm.endDate} onChange={(e) => setSignForm({ ...signForm, endDate: e.target.value })} className="bg-background border-border/30" />
              </div>
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
                if (!signForm.startDate || !signForm.endDate) { toast.error("Informe as datas"); return; }
                signOSMutation.mutate({ quotationId, signatureUrl: signForm.signatureUrl.trim(), startDate: signForm.startDate, endDate: signForm.endDate });
              }}
              disabled={signOSMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {signOSMutation.isPending ? "Assinando..." : "Assinar e Criar Campanha"}
            </Button>
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
    </div>
  );
}
