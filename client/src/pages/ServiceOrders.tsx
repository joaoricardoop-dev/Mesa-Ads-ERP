import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  FileText,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface ServiceOrderForm {
  type: "anunciante" | "producao";
  campaignId?: number;
  clientId?: number;
  description: string;
  coasterVolume?: number;
  networkAllocation: string;
  periodStart: string;
  periodEnd: string;
  totalValue: string;
  paymentTerms: string;
  specs: string;
  supplierName: string;
  estimatedDeadline: string;
  artPdfUrl: string;
  artImageUrls: string;
}

const emptyForm: ServiceOrderForm = {
  type: "anunciante",
  description: "",
  networkAllocation: "",
  periodStart: "",
  periodEnd: "",
  totalValue: "",
  paymentTerms: "",
  specs: "",
  supplierName: "",
  estimatedDeadline: "",
  artPdfUrl: "",
  artImageUrls: "",
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  assinada: "Assinada",
  execucao: "Em Execução",
  concluida: "Concluída",
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  assinada: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  execucao: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  concluida: "bg-primary/20 text-primary border-primary/30",
};

const TYPE_LABELS: Record<string, string> = {
  anunciante: "OS Anunciante",
  producao: "OS Produção",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  rascunho: ["enviada"],
  enviada: ["assinada", "rascunho"],
  assinada: ["execucao"],
  execucao: ["concluida"],
  concluida: [],
};

export default function ServiceOrders() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceOrderForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);

  const utils = trpc.useUtils();
  const { data: ordersList = [], isLoading } = trpc.serviceOrder.list.useQuery();
  const { data: clientsData } = trpc.advertiser.list.useQuery();
  const clientsList = clientsData?.items ?? [];
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList = campaignsData?.items ?? [];
  const { data: batchesList = [] } = trpc.batch.list.useQuery({ year: new Date().getFullYear() });
  const { data: campaignBatches = [] } = trpc.batch.getCampaignBatches.useQuery(
    { campaignId: form.campaignId! },
    { enabled: !!form.campaignId }
  );

  const createMutation = trpc.serviceOrder.create.useMutation({
    onSuccess: () => {
      utils.serviceOrder.list.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("OS criada com sucesso!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.serviceOrder.update.useMutation({
    onSuccess: () => {
      utils.serviceOrder.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("OS atualizada!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.serviceOrder.delete.useMutation({
    onSuccess: () => {
      utils.serviceOrder.list.invalidate();
      setDeleteId(null);
      toast.success("OS removida!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const statusMutation = trpc.serviceOrder.updateStatus.useMutation({
    onSuccess: () => {
      utils.serviceOrder.list.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.type) {
      toast.error("Tipo é obrigatório");
      return;
    }

    let periodStart = form.periodStart || undefined;
    let periodEnd = form.periodEnd || undefined;
    if (form.campaignId && campaignBatches.length > 0) {
      const sorted = [...campaignBatches].sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
      periodStart = sorted[0].startDate;
      periodEnd = sorted[sorted.length - 1].endDate;
    } else if (selectedBatchIds.length > 0) {
      const selected = batchesList
        .filter((b: any) => selectedBatchIds.includes(b.id))
        .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
      if (selected.length > 0) {
        periodStart = selected[0].startDate;
        periodEnd = selected[selected.length - 1].endDate;
      }
    }

    const selectedCampaign = form.campaignId ? campaignsList.find(c => c.id === form.campaignId) : null;
    const payload: any = {
      type: form.type,
      description: form.description || undefined,
      networkAllocation: form.networkAllocation || undefined,
      periodStart,
      periodEnd,
      totalValue: form.totalValue || undefined,
      paymentTerms: form.paymentTerms || undefined,
      specs: form.specs || undefined,
      supplierName: form.supplierName || undefined,
      estimatedDeadline: form.estimatedDeadline || undefined,
      artPdfUrl: form.artPdfUrl || undefined,
      artImageUrls: form.artImageUrls || undefined,
      coasterVolume: form.coasterVolume || undefined,
      campaignId: form.campaignId || undefined,
      clientId: form.clientId || undefined,
      productId: selectedCampaign?.productId || undefined,
    };

    if (editingId) {
      const { type, ...updateData } = payload;
      updateMutation.mutate({ id: editingId, ...updateData });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (order: (typeof ordersList)[0]) => {
    setEditingId(order.id);
    setForm({
      type: order.type as "anunciante" | "producao",
      campaignId: order.campaignId ?? undefined,
      clientId: order.clientId ?? undefined,
      description: order.description || "",
      coasterVolume: order.coasterVolume ?? undefined,
      networkAllocation: order.networkAllocation || "",
      periodStart: order.periodStart || "",
      periodEnd: order.periodEnd || "",
      totalValue: order.totalValue || "",
      paymentTerms: order.paymentTerms || "",
      specs: order.specs || "",
      supplierName: order.supplierName || "",
      estimatedDeadline: order.estimatedDeadline || "",
      artPdfUrl: order.artPdfUrl || "",
      artImageUrls: order.artImageUrls || "",
    });
    setSelectedBatchIds([]);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedBatchIds([]);
    setIsDialogOpen(true);
  };

  const handleStatusTransition = (id: number, newStatus: string) => {
    statusMutation.mutate({
      id,
      status: newStatus as "rascunho" | "enviada" | "assinada" | "execucao" | "concluida",
    });
  };

  const filtered = ordersList.filter((o) => {
    if (filterType !== "all" && o.type !== filterType) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(s) ||
        (o.description || "").toLowerCase().includes(s) ||
        (o.campaignName || "").toLowerCase().includes(s) ||
        (o.clientName || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const countByStatus = (status: string) => ordersList.filter((o) => o.status === status).length;

  return (
    <PageContainer
      title="Ordens de Serviço"
      description="Gestão de OS para Anunciantes e Produção"
      actions={
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova OS
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold font-mono">{ordersList.length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Rascunho</p>
          <p className="text-2xl font-bold font-mono text-muted-foreground">{countByStatus("rascunho")}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Enviadas</p>
          <p className="text-2xl font-bold font-mono text-blue-400">{countByStatus("enviada")}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Em Execução</p>
          <p className="text-2xl font-bold font-mono text-orange-400">{countByStatus("execucao")}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Concluídas</p>
          <p className="text-2xl font-bold font-mono text-primary">{countByStatus("concluida")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar OS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/30"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px] bg-card border-border/30">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="anunciante">OS Anunciante</SelectItem>
            <SelectItem value="producao">OS Produção</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-card border-border/30">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="assinada">Assinada</SelectItem>
            <SelectItem value="execucao">Em Execução</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 bg-muted/30">
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Número</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Tipo</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Cliente/Campanha</th>
                <th className="text-left p-3 font-medium text-xs text-muted-foreground">Período</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Valor</th>
                <th className="text-center p-3 font-medium text-xs text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-xs text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {search || filterType !== "all" || filterStatus !== "all"
                      ? "Nenhuma OS encontrada com os filtros aplicados"
                      : 'Nenhuma OS cadastrada. Clique em "Nova OS" para criar.'}
                  </td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const nextStatuses = STATUS_TRANSITIONS[order.status] || [];
                  return (
                    <tr key={order.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono font-medium text-xs">{order.orderNumber}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[order.type] || order.type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="text-sm font-medium truncate max-w-[200px]">{order.clientName || "—"}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {order.campaignName || "—"}
                            {order.productName ? ` · ${order.productName}` : ""}
                          </p>
                        </div>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {order.periodStart && order.periodEnd
                          ? `${order.periodStart} — ${order.periodEnd}`
                          : order.periodStart || order.periodEnd || "—"}
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        {order.totalValue ? formatCurrency(Number(order.totalValue)) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={STATUS_COLORS[order.status] || ""}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {nextStatuses.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {nextStatuses.map((s) => (
                                  <DropdownMenuItem key={s} onClick={() => handleStatusTransition(order.id, s)}>
                                    Mover para: {STATUS_LABELS[s]}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(order)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(order.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar OS" : "Nova Ordem de Serviço"}</DialogTitle>
          </DialogHeader>
          {editingId && (() => {
            const editingOrder = ordersList.find(o => o.id === editingId);
            return editingOrder?.orderNumber ? (
              <div className="flex items-center gap-2 px-1 -mt-1 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Número OS</span>
                <span className="font-mono text-base font-bold text-primary">{editingOrder.orderNumber}</span>
              </div>
            ) : null;
          })()}
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as "anunciante" | "producao" })}
                  disabled={!!editingId}
                >
                  <SelectTrigger className="bg-background border-border/30 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anunciante">OS Anunciante</SelectItem>
                    <SelectItem value="producao">OS Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select
                  value={form.clientId ? String(form.clientId) : "none"}
                  onValueChange={(v) => setForm({ ...form, clientId: v === "none" ? undefined : parseInt(v) })}
                >
                  <SelectTrigger className="bg-background border-border/30 h-9 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clientsList
                      .filter((cl) => cl.status === "active")
                      .map((cl) => (
                        <SelectItem key={cl.id} value={String(cl.id)}>
                          {cl.name}
                          {cl.company ? ` (${cl.company})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Campanha</Label>
              <Select
                value={form.campaignId ? String(form.campaignId) : "none"}
                onValueChange={(v) => setForm({ ...form, campaignId: v === "none" ? undefined : parseInt(v) })}
              >
                <SelectTrigger className="bg-background border-border/30 h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {campaignsList.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {(c as any).campaignNumber ? `${(c as any).campaignNumber} — ` : ""}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(() => {
              const editingOrder = editingId ? ordersList.find(o => o.id === editingId) : null;
              const selectedCampaign = form.campaignId ? campaignsList.find(c => c.id === form.campaignId) : null;
              const pName = editingOrder?.productName || selectedCampaign?.productName || null;
              return pName ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Produto</Label>
                  <div className="bg-muted/50 border border-border/30 rounded-md px-3 py-2 text-sm text-muted-foreground">{pName}</div>
                </div>
              ) : null;
            })()}

            <div className="grid gap-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição da ordem de serviço"
                className="bg-background border-border/30 text-sm min-h-[80px]"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Volume de Coasters</Label>
              <Input
                type="number"
                value={form.coasterVolume || ""}
                onChange={(e) =>
                  setForm({ ...form, coasterVolume: e.target.value ? Number(e.target.value) : undefined })
                }
                placeholder="10000"
                className="bg-background border-border/30 h-9 text-sm font-mono"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Período (Batches)</Label>
              {form.campaignId && campaignBatches.length > 0 ? (
                <div className="bg-muted/50 border border-border/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Período da campanha vinculada:</p>
                  <p className="text-sm font-medium">
                    {campaignBatches.map((b: any) => b.label).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {campaignBatches[0]?.startDate} — {campaignBatches[campaignBatches.length - 1]?.endDate}
                  </p>
                </div>
              ) : (
                <div className="bg-background border border-border/30 rounded-lg p-3 max-h-[180px] overflow-y-auto space-y-1">
                  {batchesList.map((batch: any) => (
                    <label key={batch.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/30 cursor-pointer">
                      <Checkbox
                        checked={selectedBatchIds.includes(batch.id)}
                        onCheckedChange={(checked) => {
                          setSelectedBatchIds(prev =>
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
                  {batchesList.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhum batch disponível</p>
                  )}
                </div>
              )}
              {selectedBatchIds.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {selectedBatchIds.length} batch(es) selecionado(s) — Período: {
                    (() => {
                      const selected = batchesList
                        .filter((b: any) => selectedBatchIds.includes(b.id))
                        .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate));
                      return selected.length > 0
                        ? `${selected[0].startDate} a ${selected[selected.length - 1].endDate}`
                        : "";
                    })()
                  }
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Valor Total (R$)</Label>
                <Input
                  value={form.totalValue}
                  onChange={(e) => setForm({ ...form, totalValue: e.target.value })}
                  placeholder="0.00"
                  className="bg-background border-border/30 h-9 text-sm font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Condições de Pagamento</Label>
                <Input
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  placeholder="Ex: 30/60/90 dias"
                  className="bg-background border-border/30 h-9 text-sm"
                />
              </div>
            </div>

            {form.type === "producao" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Fornecedor</Label>
                    <Input
                      value={form.supplierName}
                      onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                      placeholder="Nome do fornecedor"
                      className="bg-background border-border/30 h-9 text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Prazo Estimado</Label>
                    <Input
                      type="date"
                      value={form.estimatedDeadline}
                      onChange={(e) => setForm({ ...form, estimatedDeadline: e.target.value })}
                      className="bg-background border-border/30 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Especificações</Label>
                  <Textarea
                    value={form.specs}
                    onChange={(e) => setForm({ ...form, specs: e.target.value })}
                    placeholder="Especificações técnicas da produção"
                    className="bg-background border-border/30 text-sm min-h-[60px]"
                  />
                </div>
              </>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs">Alocação na Rede</Label>
              <Input
                value={form.networkAllocation}
                onChange={(e) => setForm({ ...form, networkAllocation: e.target.value })}
                placeholder="Distribuição na rede de restaurantes"
                className="bg-background border-border/30 h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Salvar" : "Criar OS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
