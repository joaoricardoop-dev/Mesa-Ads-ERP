import { useState, Fragment, useCallback } from "react";
import { useLocation } from "wouter";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import PageContainer from "@/components/PageContainer";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  XCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  FileText,
  Calendar,
  CheckCircle2,
  MapPin,
  Upload,
  Download,
  Store,
  ExternalLink,
} from "lucide-react";

function OSActionButton({ quotationId, quotationNumber, clientName, clientCompany, coasterVolume, totalValue, onSign }: {
  quotationId: number;
  quotationNumber: string;
  clientName: string;
  clientCompany?: string;
  coasterVolume: number;
  totalValue?: string;
  onSign: (savedBatchIds: number[]) => void;
}) {
  const { data: os } = trpc.quotation.getOS.useQuery({ quotationId });
  const { data: restaurants = [] } = trpc.quotation.getRestaurants.useQuery({ quotationId });
  if (!os) return <span className="text-xs text-muted-foreground px-2">Carregando OS...</span>;

  const osStatusLabels: Record<string, string> = {
    rascunho: "OS Rascunho",
    enviada: "OS Enviada",
    assinada: "OS Assinada",
    execucao: "OS Execução",
    concluida: "OS Concluída",
  };

  if (os.status === "assinada" || os.status === "execucao" || os.status === "concluida") {
    return (
      <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {osStatusLabels[os.status] || os.status}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-amber-400 hover:text-amber-300 gap-1"
        onClick={() => {
          if (os) {
            generateOSPdf({
              orderNumber: os.orderNumber,
              quotationNumber,
              clientName,
              clientCompany,
              coasterVolume,
              totalValue: totalValue || os.totalValue || undefined,
              paymentTerms: os.paymentTerms || undefined,
              periodStart: os.periodStart || undefined,
              periodEnd: os.periodEnd || undefined,
              description: os.description || undefined,
              restaurants: restaurants.map((r: any) => ({
                name: r.restaurantName || `Restaurante #${r.restaurantId}`,
                coasterQuantity: r.coasterQuantity,
              })),
            });
          }
        }}
        title="Baixar OS em PDF"
      >
        <Download className="w-3.5 h-3.5" />
        PDF
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-emerald-400 hover:text-emerald-300 gap-1"
        onClick={() => { let ids: number[] = []; try { if (os.batchSelectionJson) ids = JSON.parse(os.batchSelectionJson); } catch {} if (!Array.isArray(ids)) ids = []; onSign(ids); }}
        title="Assinar OS e criar campanha"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Assinar OS
      </Button>
    </div>
  );
}

type QuotationStatus = "rascunho" | "enviada" | "ativa" | "os_gerada" | "win" | "perdida" | "expirada";

interface QuotationForm {
  clientId: number | "";
  campaignType: string;
  coasterVolume: number;
  networkProfile: string;
  regions: string;
  cycles: number;
  unitPrice: string;
  totalValue: string;
  includesProduction: boolean;
  notes: string;
  validUntil: string;
  isBonificada: boolean;
  hasPartnerDiscount: boolean;
  productId: number | "";
  partnerId: number | "" | null;
}

const emptyForm: QuotationForm = {
  clientId: "",
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
  isBonificada: false,
  hasPartnerDiscount: false,
  productId: "",
  partnerId: "",
};

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  enviada: { label: "Enviada", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ativa: { label: "Ativa", className: "bg-primary/20 text-primary border-primary/30" },
  os_gerada: { label: "OS Gerada", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  win: { label: "WIN", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  perdida: { label: "Perdida", className: "bg-destructive/20 text-destructive border-destructive/30" },
  expirada: { label: "Expirada", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
};

type SortKey = "quotationNumber" | "clientName" | "totalValue" | "status" | "createdAt";
type SortDir = "asc" | "desc";

export default function Quotations() {
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<QuotationForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");


  const [lossDialogId, setLossDialogId] = useState<number | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [osDialogId, setOsDialogId] = useState<number | null>(null);
  const [osForm, setOsForm] = useState({ description: "", paymentTerms: "" });
  const [osBatchIds, setOsBatchIds] = useState<number[]>([]);
  const [signOsDialogId, setSignOsDialogId] = useState<number | null>(null);
  const [signForm, setSignForm] = useState({ batchIds: [] as number[], signatureUrl: "" });
  const [restaurantAllocations, setRestaurantAllocations] = useState<Array<{ restaurantId: number; coasterQuantity: number }>>([]);
  const [addRestaurantId, setAddRestaurantId] = useState<string>("");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ productId: "", quantity: 1000, quantityPerLocation: 500, unitPrice: "", notes: "" });

  const utils = trpc.useUtils();
  const { data: quotationsList = [], isLoading } = trpc.quotation.list.useQuery();
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: productsList = [] } = trpc.product.list.useQuery();
  const { data: partnersList = [] } = trpc.partner.list.useQuery();
  const { data: activeRestaurantsList = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: batchesList = [] } = trpc.batch.list.useQuery();
  const { data: allocatedRestaurants = [] } = trpc.quotation.getRestaurants.useQuery(
    { quotationId: signOsDialogId! },
    { enabled: !!signOsDialogId }
  );

  const updateMutation = trpc.quotation.update.useMutation({
    onSuccess: () => {
      utils.quotation.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Cotação atualizada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.quotation.delete.useMutation({
    onSuccess: () => {
      utils.quotation.list.invalidate();
      setDeleteId(null);
      toast.success("Cotação removida!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const lossMutation = trpc.quotation.markLost.useMutation({
    onSuccess: () => {
      utils.quotation.list.invalidate();
      setLossDialogId(null);
      setLossReason("");
      toast.success("Cotação marcada como perdida.");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const duplicateMutation = trpc.quotation.duplicate.useMutation({
    onSuccess: () => {
      utils.quotation.list.invalidate();
      toast.success("Cotação duplicada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const generateOSMutation = trpc.quotation.generateOS.useMutation({
    onSuccess: (data) => {
      utils.quotation.list.invalidate();
      setOsDialogId(null);
      toast.success(`OS ${data.orderNumber} gerada com sucesso!`);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const setRestaurantsMutation = trpc.quotation.setRestaurants.useMutation({
    onSuccess: () => {
      utils.quotation.getRestaurants.invalidate({ quotationId: signOsDialogId! });
      toast.success("Restaurantes atualizados!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const { data: quotationItemsList = [] } = trpc.quotation.listItems.useQuery(
    { quotationId: editingId! },
    { enabled: !!editingId }
  );

  const addItemMutation = trpc.quotation.addItem.useMutation({
    onSuccess: () => {
      utils.quotation.listItems.invalidate({ quotationId: editingId! });
      setAddItemOpen(false);
      setAddItemForm({ productId: "", quantity: 1000, quantityPerLocation: 500, unitPrice: "", notes: "" });
      toast.success("Produto adicionado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const removeItemMutation = trpc.quotation.removeItem.useMutation({
    onSuccess: () => {
      utils.quotation.listItems.invalidate({ quotationId: editingId! });
      toast.success("Item removido.");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const signOSMutation = trpc.quotation.signOS.useMutation({
    onSuccess: (data) => {
      utils.quotation.list.invalidate();
      setSignOsDialogId(null);
      toast.success(`OS assinada! Campanha ${data.campaignNumber} criada.`);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (form.coasterVolume < 0) {
      toast.error("Volume inválido");
      return;
    }
    if (!form.productId) {
      toast.error("Selecione um produto");
      return;
    }

    const payload = {
      clientId: form.clientId as number,
      campaignType: form.campaignType || undefined,
      coasterVolume: form.coasterVolume,
      networkProfile: form.networkProfile || undefined,
      regions: form.regions || undefined,
      cycles: form.cycles || undefined,
      unitPrice: form.isBonificada ? "0.0000" : (form.unitPrice || undefined),
      totalValue: form.isBonificada ? "0.00" : (form.totalValue || undefined),
      includesProduction: form.includesProduction,
      notes: form.notes || undefined,
      validUntil: form.validUntil || undefined,
      isBonificada: form.isBonificada,
      hasPartnerDiscount: form.hasPartnerDiscount,
      productId: Number(form.productId),
      partnerId: form.partnerId ? Number(form.partnerId) : null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    }
  };

  const handleEdit = (q: (typeof quotationsList)[0]) => {
    setEditingId(q.id);
    setForm({
      clientId: q.clientId,
      campaignType: q.campaignType || "padrao",
      coasterVolume: q.coasterVolume,
      networkProfile: q.networkProfile || "",
      regions: q.regions || "",
      cycles: q.cycles || 1,
      unitPrice: q.unitPrice || "",
      totalValue: q.totalValue || "",
      includesProduction: q.includesProduction ?? true,
      notes: q.notes || "",
      validUntil: q.validUntil || "",
      isBonificada: q.isBonificada ?? false,
      hasPartnerDiscount: q.hasPartnerDiscount ?? false,
      productId: q.productId || "",
      partnerId: (q as any).partnerId || "",
    });
    setIsDialogOpen(true);
  };


  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = quotationsList.filter((q) => {
    const matchesSearch =
      (q.quotationNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.quotationName || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.clientName || q.leadName || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.clientCompany || q.leadCompany || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.notes || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "quotationNumber":
        return (a.quotationNumber || "").localeCompare(b.quotationNumber || "") * dir;
      case "clientName":
        return (a.clientName || a.leadName || "").localeCompare(b.clientName || b.leadName || "") * dir;
      case "totalValue":
        return (Number(a.totalValue || 0) - Number(b.totalValue || 0)) * dir;
      case "status":
        return (a.status || "").localeCompare(b.status || "") * dir;
      case "createdAt":
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      default:
        return 0;
    }
  });

  const statusCounts = quotationsList.reduce(
    (acc, q) => {
      acc[q.status] = (acc[q.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const SortHeader = ({ label, col, className = "" }: { label: string; col: SortKey; className?: string }) => (
    <TableHead
      className={`text-xs text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === col ? (
          sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );

  return (
    <PageContainer
      title="Cotações"
      description="Gestão de cotações comerciais"
      actions={
        <Button onClick={() => navigate("/comercial/simulador")} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Cotação
        </Button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(["rascunho", "enviada", "ativa", "win", "perdida", "expirada"] as QuotationStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`bg-card border rounded-lg p-3 text-left transition-all ${
              statusFilter === s ? "border-primary ring-1 ring-primary" : "border-border/30 hover:border-border/60"
            }`}
          >
            <p className="text-xs text-muted-foreground">{STATUS_CONFIG[s].label}</p>
            <p className="text-xl font-bold font-mono">{statusCounts[s] || 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cotação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/30"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-card border-border/30">
            <SelectValue placeholder="Todos Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="ativa">Ativa</SelectItem>
            <SelectItem value="os_gerada">OS Gerada</SelectItem>
            <SelectItem value="win">WIN</SelectItem>
            <SelectItem value="perdida">Perdida</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <SortHeader label="COTAÇÃO" col="quotationNumber" />
              <SortHeader label="CLIENTE" col="clientName" />
              <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">VOLUME</TableHead>
              <SortHeader label="VALOR" col="totalValue" className="hidden lg:table-cell" />
              <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">VALIDADE</TableHead>
              <SortHeader label="STATUS" col="status" className="text-center" />
              <TableHead className="text-xs text-muted-foreground font-medium text-right">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {search || statusFilter !== "all"
                    ? "Nenhuma cotação encontrada"
                    : 'Nenhuma cotação cadastrada. Use o Simulador para criar uma nova cotação.'}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((q) => (
                <TableRow key={q.id} className="border-border/20 hover:bg-card/80">
                  <TableCell className="font-medium">
                    <button
                      className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                      onClick={() => navigate(`/comercial/cotacoes/${q.id}`)}
                    >
                      <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      <div>
                        <p className="group-hover:underline">{q.quotationNumber}</p>
                        {q.quotationName && (
                          <p className="text-[11px] text-muted-foreground font-normal">{q.quotationName}</p>
                        )}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{q.clientName || q.leadName || "—"}</p>
                      {(q.clientCompany || q.leadCompany) && (
                        <p className="text-xs text-muted-foreground">{q.clientCompany || q.leadCompany}</p>
                      )}
                      {(q as any).partnerName && (
                        <p className="text-[11px] text-green-500">via {(q as any).partnerName}</p>
                      )}
                      {!q.clientId && q.leadId && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 mt-0.5 text-amber-500 border-amber-500/30">Lead</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {q.coasterVolume ? (
                      <span>{q.coasterVolume.toLocaleString("pt-BR")} un.</span>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs italic">—</span>
                    )}
                    {q.productName && (
                      <p className="text-[10px] text-muted-foreground/70">{q.productName}</p>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {q.totalValue ? formatCurrency(Number(q.totalValue)) : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {q.validUntil ? (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(q.validUntil + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Badge variant="outline" className={STATUS_CONFIG[q.status as QuotationStatus]?.className || ""}>
                        {STATUS_CONFIG[q.status as QuotationStatus]?.label || q.status}
                      </Badge>
                      {q.isBonificada && (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[9px]">
                          Bonificada
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:text-primary"
                        onClick={() => navigate(`/comercial/cotacoes/${q.id}`)}
                        title="Abrir"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
                        onClick={async () => {
                          try {
                            const [fetchedRestaurants, fetchedItems] = await Promise.all([
                              utils.quotation.getRestaurants.fetch({ quotationId: q.id }),
                              utils.quotation.listItems.fetch({ quotationId: q.id }),
                            ]);
                            const numRest = fetchedRestaurants.length;
                            const duration = q.cycles || 1;
                            const totalContractValue = Number(q.totalValue || 0);
                            const monthlyTotal = duration > 0 ? totalContractValue / duration : totalContractValue;
                            const effectiveNumRest = numRest > 0 ? numRest : 1;
                            const pricePerRest = monthlyTotal / effectiveNumRest;
                            const restaurants = fetchedRestaurants.map((r) => ({
                              name: r.restaurantName || "Restaurante",
                              neighborhood: r.restaurantAddress || "",
                              coasters: r.coasterQuantity || 0,
                            }));

                            // Build multi-product items if the quotation has budget items
                            const proposalItems = fetchedItems.length > 0
                              ? fetchedItems.map(item => {
                                  const semanasMatch = item.notes?.match(/(\d+)sem/);
                                  const itemSemanas = semanasMatch ? parseInt(semanasMatch[1]) : duration * 4;
                                  return {
                                    productName: item.productName,
                                    volume: Number(item.quantity),
                                    semanas: itemSemanas,
                                    unitPrice: Number(item.unitPrice || 0),
                                    totalPrice: Number(item.totalPrice || 0),
                                  };
                                })
                              : undefined;

                            generateProposalPdf({
                              clientName: q.clientName || q.leadName || "Cliente",
                              clientCompany: q.clientCompany || q.leadCompany || undefined,
                              clientCnpj: q.clientCnpj || q.leadCnpj || undefined,
                              clientEmail: q.clientEmail || q.leadEmail || undefined,
                              clientPhone: q.clientPhone || q.leadPhone || undefined,
                              quotationName: q.quotationName || q.quotationNumber,
                              coasterVolume: q.coasterVolume,
                              numRestaurants: numRest,
                              coastersPerRestaurant: numRest > 0 ? Math.round(q.coasterVolume / numRest) : q.coasterVolume,
                              contractDuration: duration,
                              semanas: proposalItems ? undefined : (q.cycles || 1) * 4,
                              pricePerRestaurant: pricePerRest,
                              monthlyTotal,
                              contractTotal: totalContractValue,
                              includesProduction: q.includesProduction ?? true,
                              isBonificada: q.isBonificada ?? false,
                              restaurants,
                              productName: q.productName || undefined,
                              productUnitLabelPlural: q.productUnitLabelPlural || undefined,
                              items: proposalItems,
                            });
                            toast.success("PDF da proposta gerado!");
                          } catch (err) {
                            toast.error("Erro ao gerar PDF da proposta");
                          }
                        }}
                        title="Exportar Proposta PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {q.status === "ativa" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-400 hover:text-amber-300"
                          onClick={() => {
                            setOsDialogId(q.id);
                            setOsForm({ description: "", paymentTerms: "" });
                            setOsBatchIds([]);
                          }}
                          title="Gerar OS"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {q.status === "os_gerada" && (
                        <OSActionButton
                          quotationId={q.id}
                          quotationNumber={q.quotationNumber}
                          clientName={q.clientName || "Anunciante"}
                          clientCompany={q.clientCompany || undefined}
                          coasterVolume={q.coasterVolume}
                          totalValue={q.totalValue || undefined}
                          onSign={(savedBatchIds) => {
                          const validBatchIds = new Set(batchesList.map((b: any) => b.id));
                          setSignOsDialogId(q.id);
                          setSignForm({
                            batchIds: savedBatchIds.filter(id => validBatchIds.has(id)),
                            signatureUrl: "",
                          });
                          setRestaurantAllocations([]);
                        }} />
                      )}
                      {q.status !== "win" && q.status !== "perdida" && q.status !== "os_gerada" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setLossDialogId(q.id);
                            setLossReason("");
                          }}
                          title="Marcar Perdida"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(q)}
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => duplicateMutation.mutate({ id: q.id })}
                        title="Duplicar"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(q.id)}
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cotação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Cliente</p>
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select
                value={form.clientId ? String(form.clientId) : ""}
                onValueChange={(v) => setForm({ ...form, clientId: Number(v) })}
              >
                <SelectTrigger className="bg-background border-border/30">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.company ? `(${c.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Produto *</Label>
              <Select
                value={form.productId ? String(form.productId) : ""}
                onValueChange={(v) => setForm({ ...form, productId: Number(v) })}
              >
                <SelectTrigger className="bg-background border-border/30">
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {productsList.filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Detalhes</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de Campanha</Label>
                <Select
                  value={form.campaignType}
                  onValueChange={(v) => setForm({ ...form, campaignType: v })}
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="padrao">Padrão</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="exclusivo">Exclusivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Perfil de Rede</Label>
                <Input
                  value={form.networkProfile}
                  onChange={(e) => setForm({ ...form, networkProfile: e.target.value })}
                  placeholder="Ex: Top 50"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Volume de Bolachas *</Label>
                <Input
                  type="number"
                  value={form.coasterVolume}
                  onChange={(e) => setForm({ ...form, coasterVolume: Number(e.target.value) })}
                  min={1}
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ciclos</Label>
                <Input
                  type="number"
                  value={form.cycles}
                  onChange={(e) => setForm({ ...form, cycles: Number(e.target.value) })}
                  min={1}
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Regiões</Label>
                <Input
                  value={form.regions}
                  onChange={(e) => setForm({ ...form, regions: e.target.value })}
                  placeholder="Ex: Zona Sul, Centro"
                  className="bg-background border-border/30"
                />
              </div>
            </div>

            {editingId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Itens do Orçamento</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddItemOpen(true)}>
                    <Plus className="w-3 h-3" /> Adicionar Produto
                  </Button>
                </div>
                {quotationItemsList.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground border rounded-lg border-dashed">
                    Nenhum produto adicionado. Clique em "Adicionar Produto" para começar.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">Qtd/Local</TableHead>
                          <TableHead className="text-right">Preço Un.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotationItemsList.map((item) => (
                          <TableRow key={item.id} className="text-xs">
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-right">{item.quantity.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              {item.quantityPerLocation ? item.quantityPerLocation.toLocaleString("pt-BR") : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.unitPrice ? formatCurrency(Number(item.unitPrice)) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.totalPrice ? formatCurrency(Number(item.totalPrice)) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeItemMutation.mutate({ id: item.id })}
                                disabled={removeItemMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {quotationItemsList.length > 0 && (
                      <div className="px-4 py-2 border-t bg-muted/30 text-xs flex justify-between items-center">
                        <span className="text-muted-foreground">{quotationItemsList.length} produto(s)</span>
                        <span className="font-semibold">
                          Total: {formatCurrency(quotationItemsList.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Valores</p>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
              <Switch
                id="bonificada-toggle"
                checked={form.isBonificada}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setForm({ ...form, isBonificada: true, unitPrice: "0.0000", totalValue: "0.00" });
                  } else {
                    setForm({ ...form, isBonificada: false });
                  }
                }}
              />
              <Label htmlFor="bonificada-toggle" className="cursor-pointer text-sm font-medium text-amber-500">
                Bonificação
              </Label>
              {form.isBonificada && (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-[10px] ml-auto">
                  Bonificada
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
              <Switch
                id="partner-discount-toggle"
                checked={form.hasPartnerDiscount}
                onCheckedChange={(checked) => setForm({ ...form, hasPartnerDiscount: checked })}
              />
              <Label htmlFor="partner-discount-toggle" className="cursor-pointer text-sm font-medium text-green-500">
                Desconto de parceiro (−10%)
              </Label>
              {form.hasPartnerDiscount && (
                <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px] ml-auto">
                  Parceiro
                </Badge>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Parceiro</Label>
              <Select
                value={form.partnerId ? String(form.partnerId) : "none"}
                onValueChange={(v) => setForm({ ...form, partnerId: v === "none" ? null : Number(v) })}
              >
                <SelectTrigger className="bg-background border-border/30">
                  <SelectValue placeholder="Selecione um parceiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(partnersList as any[]).filter((p: any) => p.status === "active").map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.company ? ` (${p.company})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Preço Unitário (R$)</Label>
                <Input
                  value={form.isBonificada ? "0.0000" : form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  placeholder="0.0000"
                  className="bg-background border-border/30"
                  disabled={form.isBonificada}
                />
              </div>
              <div className="grid gap-2">
                <Label>Valor Total (R$)</Label>
                <Input
                  value={form.isBonificada ? "0.00" : form.totalValue}
                  onChange={(e) => setForm({ ...form, totalValue: e.target.value })}
                  placeholder="0.00"
                  className="bg-background border-border/30"
                  disabled={form.isBonificada}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Validade</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className="bg-background border-border/30"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <input
                  type="checkbox"
                  id="includesProduction"
                  checked={form.includesProduction}
                  onChange={(e) => setForm({ ...form, includesProduction: e.target.checked })}
                  className="rounded border-border"
                />
                <Label htmlFor="includesProduction" className="cursor-pointer">
                  Inclui Produção
                </Label>
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Observações</p>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas e observações..."
              className="bg-background border-border/30"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={osDialogId !== null} onOpenChange={() => setOsDialogId(null)}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Gerar OS para Anunciante
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Uma Ordem de Serviço será criada com os dados da cotação. Quando assinada, a campanha será automaticamente criada.
            </p>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                value={osForm.description}
                onChange={(e) => setOsForm({ ...osForm, description: e.target.value })}
                placeholder="Descrição da OS (opcional)"
                className="bg-background border-border/30"
                rows={2}
              />
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
              <Input
                value={osForm.paymentTerms}
                onChange={(e) => setOsForm({ ...osForm, paymentTerms: e.target.value })}
                placeholder="Ex: 30/60/90 dias"
                className="bg-background border-border/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOsDialogId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!osDialogId) return;
                const selectedBatches = batchesList
                  .filter((b: any) => osBatchIds.includes(b.id))
                  .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
                const periodStart = selectedBatches.length > 0 ? selectedBatches[0].startDate : undefined;
                const periodEnd = selectedBatches.length > 0 ? selectedBatches[selectedBatches.length - 1].endDate : undefined;
                generateOSMutation.mutate({
                  id: osDialogId,
                  description: osForm.description || undefined,
                  periodStart,
                  periodEnd,
                  paymentTerms: osForm.paymentTerms || undefined,
                  batchIds: osBatchIds.length > 0 ? osBatchIds : undefined,
                });
              }}
              disabled={generateOSMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {generateOSMutation.isPending ? "Gerando..." : "Gerar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signOsDialogId !== null} onOpenChange={() => setSignOsDialogId(null)}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              Assinar OS e Criar Campanha
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ao assinar a OS, a cotação será automaticamente convertida em WIN e uma nova campanha (CMP-YYYY-NNNN) será criada no status de Produção.
          </p>

          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Alocação de Restaurantes</p>
            {allocatedRestaurants.length > 0 && (
              <div className="border border-border/30 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-xs">Restaurante</TableHead>
                      <TableHead className="text-xs text-center">Comissão</TableHead>
                      <TableHead className="text-xs text-right">Bolachas</TableHead>
                      <TableHead className="text-xs w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocatedRestaurants.map((r) => (
                      <TableRow key={r.id} className="border-border/20">
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-muted-foreground" />
                            {r.restaurantName || `Restaurante #${r.restaurantId}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {r.commissionPercent ? `${r.commissionPercent}%` : "20%"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            className="w-24 h-7 text-xs text-right font-mono bg-background border-border/30 ml-auto"
                            defaultValue={r.coasterQuantity}
                            min={1}
                            onBlur={(e) => {
                              const newQty = Number(e.target.value);
                              if (newQty < 1 || newQty === r.coasterQuantity) return;
                              const updated = allocatedRestaurants.map((ar) =>
                                ar.restaurantId === r.restaurantId
                                  ? { restaurantId: ar.restaurantId, coasterQuantity: newQty }
                                  : { restaurantId: ar.restaurantId, coasterQuantity: ar.coasterQuantity }
                              );
                              setRestaurantsMutation.mutate({ quotationId: signOsDialogId!, restaurants: updated });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              const updated = allocatedRestaurants
                                .filter((ar) => ar.restaurantId !== r.restaurantId)
                                .map((ar) => ({ restaurantId: ar.restaurantId, coasterQuantity: ar.coasterQuantity }));
                              setRestaurantsMutation.mutate({ quotationId: signOsDialogId!, restaurants: updated });
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="px-3 py-2 bg-muted/30 border-t border-border/30 flex justify-between text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono font-medium">
                    {allocatedRestaurants.reduce((sum, r) => sum + r.coasterQuantity, 0).toLocaleString("pt-BR")} bolachas
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Select value={addRestaurantId} onValueChange={setAddRestaurantId}>
                <SelectTrigger className="flex-1 bg-background border-border/30">
                  <SelectValue placeholder="Selecione um restaurante" />
                </SelectTrigger>
                <SelectContent>
                  {activeRestaurantsList
                    .filter((r: any) => !allocatedRestaurants.some((ar) => ar.restaurantId === r.id))
                    .map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name} {r.address ? `— ${r.address}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  if (!addRestaurantId) return;
                  const existing = allocatedRestaurants.map((ar) => ({
                    restaurantId: ar.restaurantId,
                    coasterQuantity: ar.coasterQuantity,
                  }));
                  existing.push({ restaurantId: Number(addRestaurantId), coasterQuantity: 500 });
                  setRestaurantsMutation.mutate({ quotationId: signOsDialogId!, restaurants: existing });
                  setAddRestaurantId("");
                }}
                disabled={!addRestaurantId}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-4">Assinatura da OS</p>
            <div className="grid gap-2">
              <Label>URL da Assinatura *</Label>
              <Input
                value={signForm.signatureUrl}
                onChange={(e) => setSignForm({ ...signForm, signatureUrl: e.target.value })}
                placeholder="https://... (link do documento assinado)"
                className="bg-background border-border/30"
              />
              <p className="text-[11px] text-muted-foreground">Cole a URL do documento ou comprovante de assinatura.</p>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-4">Dados da Campanha</p>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Nome da Campanha</Label>
                <div className="h-10 px-3 flex items-center rounded-lg bg-muted/50 border border-border/20 text-sm text-muted-foreground">
                  {(() => {
                    const q = quotationsList.find((x) => x.id === signOsDialogId);
                    return q?.quotationName || q?.quotationNumber || "—";
                  })()}
                </div>
                <p className="text-[11px] text-muted-foreground">Gerado automaticamente a partir da cotação.</p>
              </div>
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
            </div>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              className="mr-auto"
              onClick={() => {
                if (!signOsDialogId) return;
                const q = quotationsList.find((x) => x.id === signOsDialogId);
                generateOSPdf({
                  orderNumber: `OS-${signOsDialogId}`,
                  quotationNumber: q?.quotationNumber || "",
                  clientName: q?.clientName || "Anunciante",
                  clientCompany: q?.clientCompany || undefined,
                  coasterVolume: q?.coasterVolume || 0,
                  totalValue: q?.totalValue || undefined,
                  description: "",
                  restaurants: allocatedRestaurants.map((r) => ({
                    name: r.restaurantName || `Restaurante #${r.restaurantId}`,
                    coasterQuantity: r.coasterQuantity,
                  })),
                });
              }}
              disabled={allocatedRestaurants.length === 0}
            >
              <Download className="w-4 h-4 mr-1" /> Baixar PDF
            </Button>
            <Button variant="outline" onClick={() => setSignOsDialogId(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!signOsDialogId) return;
                if (!signForm.signatureUrl.trim()) {
                  toast.error("Informe a URL da assinatura");
                  return;
                }
                if (signForm.batchIds.length === 0) {
                  toast.error("Selecione pelo menos um batch");
                  return;
                }
                signOSMutation.mutate({
                  quotationId: signOsDialogId,
                  signatureUrl: signForm.signatureUrl.trim(),
                  batchIds: signForm.batchIds,
                });
              }}
              disabled={signOSMutation.isPending || allocatedRestaurants.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {signOSMutation.isPending ? "Assinando..." : "Assinar OS e Criar Campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={lossDialogId !== null} onOpenChange={() => setLossDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Perdida</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar esta cotação como perdida? Opcionalmente, informe o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={lossReason}
            onChange={(e) => setLossReason(e.target.value)}
            placeholder="Motivo da perda (opcional)"
            className="bg-background border-border/30"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (lossDialogId) {
                  lossMutation.mutate({ id: lossDialogId, lossReason: lossReason || undefined });
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Marcar Perdida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Produto ao Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label>Produto *</Label>
              <Select
                value={addItemForm.productId}
                onValueChange={(val) => {
                  const prod = productsList.find((p: any) => String(p.id) === val);
                  setAddItemForm((f) => ({ ...f, productId: val, quantityPerLocation: prod?.defaultQtyPerLocation ?? 500 }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto" />
                </SelectTrigger>
                <SelectContent>
                  {productsList.filter((p: any) => p.isActive).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Quantidade Total *</Label>
                <Input
                  type="number"
                  min={1}
                  value={addItemForm.quantity}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Qtd por Local</Label>
                <Input
                  type="number"
                  min={1}
                  value={addItemForm.quantityPerLocation}
                  onChange={(e) => setAddItemForm((f) => ({ ...f, quantityPerLocation: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Preço Unitário (R$) — deixe em branco para calcular</Label>
              <Input
                type="number"
                step="0.0001"
                min={0}
                value={addItemForm.unitPrice}
                onChange={(e) => setAddItemForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="Auto-calculado pelos tiers"
              />
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Input
                value={addItemForm.notes}
                onChange={(e) => setAddItemForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notas sobre este item (opcional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!addItemForm.productId || !editingId) return toast.error("Selecione um produto");
                addItemMutation.mutate({
                  quotationId: editingId,
                  productId: Number(addItemForm.productId),
                  quantity: addItemForm.quantity,
                  quantityPerLocation: addItemForm.quantityPerLocation || undefined,
                  unitPrice: addItemForm.unitPrice || undefined,
                  notes: addItemForm.notes || undefined,
                });
              }}
              disabled={addItemMutation.isPending || !addItemForm.productId}
            >
              {addItemMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cotação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
