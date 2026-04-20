import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  Plus, Pencil, Trash2, CalendarRange, Package, ChevronDown, ChevronUp,
  CircleDollarSign, TrendingUp, TrendingDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  planejada: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  ativa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  concluida: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  cancelada: "bg-red-500/10 text-red-400 border-red-500/30",
};

const INVOICE_BADGE_META: Record<string, { label: string; cls: string }> = {
  prevista: { label: "Fatura prevista", cls: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30" },
  emitida: { label: "Fatura emitida", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  paga: { label: "Fatura paga", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  vencida: { label: "Fatura vencida", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  cancelada: { label: "Fatura cancelada", cls: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30" },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface Props {
  campaignId: number;
  /** Duração do contrato em meses, pra sugerir datas no wizard. Opcional. */
  contractDuration?: number;
  /** Data de início da campanha, pra sugerir periodStart da fase 1. */
  startDate?: string;
  /** Quando true, oculta todas as ações de edição (criar/editar/excluir fases e itens). */
  readOnly?: boolean;
}

export default function CampaignPhases({ campaignId, contractDuration, startDate, readOnly = false }: Props) {
  const utils = trpc.useUtils();
  const { data: phases = [], isLoading } = trpc.campaignPhase.listByCampaign.useQuery({ campaignId });
  const { data: productsList = [] } = trpc.product.list.useQuery();

  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [phaseForm, setPhaseForm] = useState({
    label: "",
    periodStart: "",
    periodEnd: "",
    status: "planejada" as "planejada" | "ativa" | "concluida" | "cancelada",
    notes: "",
  });

  const [itemDialogOpen, setItemDialogOpen] = useState<{ phaseId: number; itemId?: number } | null>(null);
  const [itemForm, setItemForm] = useState({
    productId: "",
    quantity: "1",
    unitPrice: "0",
    productionCost: "0",
    freightCost: "0",
    notes: "",
  });

  const [expandedPhaseId, setExpandedPhaseId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardForm, setWizardForm] = useState({
    startDate: startDate || new Date().toISOString().split("T")[0],
    numberOfPhases: String(contractDuration || 3),
    baseLabel: "Mês",
    productId: "",
    quantity: "500",
    unitPrice: "0",
    productionCost: "0",
    freightCost: "0",
  });

  const createPhase = trpc.campaignPhase.createPhase.useMutation({
    onSuccess: () => { utils.campaignPhase.listByCampaign.invalidate({ campaignId }); setPhaseDialogOpen(false); toast.success("Fase criada"); },
    onError: (e) => toast.error(e.message),
  });
  const updatePhase = trpc.campaignPhase.updatePhase.useMutation({
    onSuccess: () => { utils.campaignPhase.listByCampaign.invalidate({ campaignId }); setPhaseDialogOpen(false); toast.success("Fase atualizada"); },
    onError: (e) => toast.error(e.message),
  });
  const deletePhase = trpc.campaignPhase.deletePhase.useMutation({
    onSuccess: () => { utils.campaignPhase.listByCampaign.invalidate({ campaignId }); toast.success("Fase excluída"); },
    onError: (e) => toast.error(e.message),
  });

  const createItem = trpc.campaignPhase.createItem.useMutation({
    onSuccess: () => { utils.campaignPhase.listByCampaign.invalidate({ campaignId }); setItemDialogOpen(null); toast.success("Item adicionado"); },
    onError: (e) => toast.error(e.message),
  });
  const updateItem = trpc.campaignPhase.updateItem.useMutation({
    onSuccess: () => { utils.campaignPhase.listByCampaign.invalidate({ campaignId }); setItemDialogOpen(null); toast.success("Item atualizado"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteItem = trpc.campaignPhase.deleteItem.useMutation({
    onSuccess: () => { utils.campaignPhase.listByCampaign.invalidate({ campaignId }); toast.success("Item removido"); },
    onError: (e) => toast.error(e.message),
  });

  const bulkCreate = trpc.campaignPhase.bulkCreate.useMutation({
    onSuccess: (res) => {
      utils.campaignPhase.listByCampaign.invalidate({ campaignId });
      setWizardOpen(false);
      toast.success(`${res.count} fases criadas`);
    },
    onError: (e) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    let expectedRevenue = 0, expectedCosts = 0;
    let totalInvoiced = 0, totalReceived = 0, totalDue = 0, totalPaid = 0;
    for (const p of phases) {
      expectedRevenue += p.expectedRevenue;
      expectedCosts += p.expectedCosts;
      totalInvoiced += p.financial.totalInvoiced;
      totalReceived += p.financial.totalReceived;
      totalDue += p.financial.totalDue;
      totalPaid += p.financial.totalPaid;
    }
    return {
      expectedRevenue,
      expectedCosts,
      expectedMargin: expectedRevenue - expectedCosts,
      expectedMarginPct: expectedRevenue > 0 ? ((expectedRevenue - expectedCosts) / expectedRevenue) * 100 : 0,
      totalInvoiced, totalReceived, totalDue, totalPaid,
    };
  }, [phases]);

  function openCreatePhase() {
    setEditingPhaseId(null);
    setPhaseForm({
      label: `Fase ${phases.length + 1}`,
      periodStart: phases.length > 0
        ? phases[phases.length - 1].periodEnd
        : (startDate || new Date().toISOString().split("T")[0]),
      periodEnd: "",
      status: "planejada",
      notes: "",
    });
    setPhaseDialogOpen(true);
  }

  function openEditPhase(p: typeof phases[number]) {
    setEditingPhaseId(p.id);
    setPhaseForm({
      label: p.label,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      status: p.status as any,
      notes: p.notes ?? "",
    });
    setPhaseDialogOpen(true);
  }

  function handleSavePhase() {
    if (!phaseForm.label || !phaseForm.periodStart || !phaseForm.periodEnd) {
      toast.error("Preencha label e datas");
      return;
    }
    if (editingPhaseId) {
      updatePhase.mutate({
        id: editingPhaseId,
        label: phaseForm.label,
        periodStart: phaseForm.periodStart,
        periodEnd: phaseForm.periodEnd,
        status: phaseForm.status,
        notes: phaseForm.notes || null,
      });
    } else {
      createPhase.mutate({
        campaignId,
        label: phaseForm.label,
        periodStart: phaseForm.periodStart,
        periodEnd: phaseForm.periodEnd,
        status: phaseForm.status,
        notes: phaseForm.notes || undefined,
      });
    }
  }

  function openCreateItem(phaseId: number) {
    setItemDialogOpen({ phaseId });
    setItemForm({ productId: "", quantity: "1", unitPrice: "0", productionCost: "0", freightCost: "0", notes: "" });
  }

  function openEditItem(phaseId: number, item: any) {
    setItemDialogOpen({ phaseId, itemId: item.id });
    setItemForm({
      productId: String(item.productId),
      quantity: String(item.quantity),
      unitPrice: item.unitPrice,
      productionCost: item.productionCost,
      freightCost: item.freightCost,
      notes: item.notes ?? "",
    });
  }

  function handleSaveItem() {
    if (!itemDialogOpen) return;
    if (itemDialogOpen.itemId) {
      updateItem.mutate({
        id: itemDialogOpen.itemId,
        quantity: parseInt(itemForm.quantity) || 1,
        unitPrice: itemForm.unitPrice,
        productionCost: itemForm.productionCost,
        freightCost: itemForm.freightCost,
        notes: itemForm.notes || null,
      });
    } else {
      if (!itemForm.productId) {
        toast.error("Selecione um produto");
        return;
      }
      createItem.mutate({
        campaignPhaseId: itemDialogOpen.phaseId,
        productId: parseInt(itemForm.productId),
        quantity: parseInt(itemForm.quantity) || 1,
        unitPrice: itemForm.unitPrice,
        productionCost: itemForm.productionCost,
        freightCost: itemForm.freightCost,
        notes: itemForm.notes || undefined,
      });
    }
  }

  function handleWizard() {
    const num = parseInt(wizardForm.numberOfPhases);
    if (!num || num < 1) {
      toast.error("Número de fases inválido");
      return;
    }
    const start = new Date(wizardForm.startDate + "T00:00:00");
    const phasesToCreate = Array.from({ length: num }, (_, i) => {
      const pStart = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
      const pEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, start.getDate() - 1);
      return {
        label: `${wizardForm.baseLabel} ${i + 1}`,
        periodStart: pStart.toISOString().split("T")[0],
        periodEnd: pEnd.toISOString().split("T")[0],
        status: "planejada" as const,
        items: wizardForm.productId
          ? [{
              productId: parseInt(wizardForm.productId),
              quantity: parseInt(wizardForm.quantity) || 1,
              unitPrice: wizardForm.unitPrice,
              productionCost: wizardForm.productionCost,
              freightCost: wizardForm.freightCost,
            }]
          : [],
      };
    });
    bulkCreate.mutate({
      campaignId,
      phases: phasesToCreate,
      replaceExisting: false,
    });
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando fases…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Economics agregados ficam no Consolidado da Campanha (seção topo de
          CampaignOverview). Este componente foca só em operação dos batches. */}

      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-primary" />
          Fases da campanha ({phases.length})
        </h3>
        <div className="flex items-center gap-2">
          {!readOnly && phases.length === 0 && (
            <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Wizard de fases
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gerar fases em lote</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Data de início</Label>
                      <Input
                        type="date"
                        value={wizardForm.startDate}
                        onChange={(e) => setWizardForm({ ...wizardForm, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nº de fases (meses)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={wizardForm.numberOfPhases}
                        onChange={(e) => setWizardForm({ ...wizardForm, numberOfPhases: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Prefixo do label</Label>
                    <Input
                      placeholder="Ex: Mês, Ciclo, Semana"
                      value={wizardForm.baseLabel}
                      onChange={(e) => setWizardForm({ ...wizardForm, baseLabel: e.target.value })}
                    />
                  </div>
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground">Item padrão para cada fase (opcional)</p>
                    <div>
                      <Label className="text-xs">Produto</Label>
                      <Select
                        value={wizardForm.productId || "none"}
                        onValueChange={(v) => setWizardForm({ ...wizardForm, productId: v === "none" ? "" : v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— sem item padrão —</SelectItem>
                          {productsList.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name} {p.tipo ? `(${p.tipo})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {wizardForm.productId && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Quantidade</Label>
                          <Input type="number" value={wizardForm.quantity} onChange={(e) => setWizardForm({ ...wizardForm, quantity: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Preço unit.</Label>
                          <Input type="number" step="0.0001" value={wizardForm.unitPrice} onChange={(e) => setWizardForm({ ...wizardForm, unitPrice: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Prod./fase</Label>
                          <Input type="number" step="0.01" value={wizardForm.productionCost} onChange={(e) => setWizardForm({ ...wizardForm, productionCost: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Frete/fase</Label>
                          <Input type="number" step="0.01" value={wizardForm.freightCost} onChange={(e) => setWizardForm({ ...wizardForm, freightCost: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => setWizardOpen(false)}>Cancelar</Button>
                    <Button onClick={handleWizard} disabled={bulkCreate.isPending}>Gerar</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {!readOnly && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={openCreatePhase}>
              <Plus className="w-3.5 h-3.5" /> Nova fase
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de criar/editar fase */}
      <Dialog open={phaseDialogOpen} onOpenChange={setPhaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPhaseId ? "Editar fase" : "Nova fase"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={phaseForm.label} onChange={(e) => setPhaseForm({ ...phaseForm, label: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início do período</Label>
                <Input type="date" value={phaseForm.periodStart} onChange={(e) => setPhaseForm({ ...phaseForm, periodStart: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Fim do período</Label>
                <Input type="date" value={phaseForm.periodEnd} onChange={(e) => setPhaseForm({ ...phaseForm, periodEnd: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={phaseForm.status} onValueChange={(v: any) => setPhaseForm({ ...phaseForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={phaseForm.notes} onChange={(e) => setPhaseForm({ ...phaseForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPhaseDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSavePhase} disabled={createPhase.isPending || updatePhase.isPending}>
                {editingPhaseId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de criar/editar item */}
      <Dialog open={itemDialogOpen !== null} onOpenChange={(open) => !open && setItemDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemDialogOpen?.itemId ? "Editar item" : "Adicionar item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!itemDialogOpen?.itemId && (
              <div>
                <Label className="text-xs">Produto</Label>
                <Select
                  value={itemForm.productId || "none"}
                  onValueChange={(v) => setItemForm({ ...itemForm, productId: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— selecione —</SelectItem>
                    {productsList.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} {p.tipo ? `(${p.tipo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" min="1" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Preço unit.</Label>
                <Input type="number" step="0.0001" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Custo produção</Label>
                <Input type="number" step="0.01" value={itemForm.productionCost} onChange={(e) => setItemForm({ ...itemForm, productionCost: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Frete</Label>
                <Input type="number" step="0.01" value={itemForm.freightCost} onChange={(e) => setItemForm({ ...itemForm, freightCost: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setItemDialogOpen(null)}>Cancelar</Button>
              <Button onClick={handleSaveItem} disabled={createItem.isPending || updateItem.isPending}>
                {itemDialogOpen?.itemId ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de fases */}
      {phases.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-sm text-muted-foreground">
          <CalendarRange className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p>Nenhuma fase cadastrada.</p>
          {!readOnly && (
            <p className="text-xs mt-1">Use o wizard para gerar várias fases de uma vez, ou crie manualmente.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {phases.map((p) => {
            const isExpanded = expandedPhaseId === p.id;
            const statusCls = STATUS_COLORS[p.status] || "";
            const statusLabel = STATUS_LABELS[p.status] || p.status;
            return (
              <div key={p.id} className="rounded-xl border border-border/30 bg-card overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/5"
                  onClick={() => setExpandedPhaseId(isExpanded ? null : p.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {p.sequence}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{p.label}</span>
                        <Badge variant="outline" className={`text-[9px] ${statusCls}`}>{statusLabel}</Badge>
                        {(p as any).activeInvoice?.status && (() => {
                          const invMeta = INVOICE_BADGE_META[(p as any).activeInvoice.status] ?? null;
                          if (!invMeta) return null;
                          return (
                            <Badge variant="outline" className={`text-[9px] uppercase ${invMeta.cls}`} data-testid={`badge-row-invoice-${p.sequence}`}>
                              {invMeta.label}
                            </Badge>
                          );
                        })()}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(p.periodStart)} → {fmtDate(p.periodEnd)} · {p.itemCount} {p.itemCount === 1 ? "item" : "itens"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/20 p-4 space-y-3">
                    {/* Tabela de itens */}
                    <div className="border border-border/30 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/10">
                          <tr>
                            <th className="text-left p-2 font-medium text-muted-foreground">Produto</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Qtd</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Preço un.</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Total</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Produção</th>
                            <th className="text-right p-2 font-medium text-muted-foreground">Frete</th>
                            {!readOnly && <th className="text-right p-2 font-medium text-muted-foreground w-16"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.length === 0 ? (
                            <tr>
                              <td colSpan={readOnly ? 6 : 7} className="p-4 text-center text-muted-foreground">{readOnly ? "Nenhum item." : "Nenhum item. Adicione abaixo."}</td>
                            </tr>
                          ) : (
                            p.items.map((it) => (
                              <tr key={it.id} className="border-t border-border/20">
                                <td className="p-2">
                                  <div className="flex items-center gap-1.5">
                                    <Package className="w-3 h-3 text-muted-foreground" />
                                    <span>{it.productName}</span>
                                    {it.productTipo && (
                                      <span className="text-[9px] text-muted-foreground">({it.productTipo})</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {it.quantity.toLocaleString("pt-BR")} {it.productUnitLabelPlural}
                                </td>
                                <td className="p-2 text-right font-mono">{formatCurrency(parseFloat(it.unitPrice))}</td>
                                <td className="p-2 text-right font-mono font-semibold text-emerald-400">{formatCurrency(it.resolvedTotalPrice)}</td>
                                <td className="p-2 text-right font-mono text-red-400/80">{formatCurrency(parseFloat(it.productionCost))}</td>
                                <td className="p-2 text-right font-mono text-red-400/80">{formatCurrency(parseFloat(it.freightCost))}</td>
                                {!readOnly && (
                                  <td className="p-2 text-right">
                                    <div className="flex gap-0.5 justify-end">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditItem(p.id, it)}>
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => {
                                        if (confirm("Remover este item?")) deleteItem.mutate({ id: it.id });
                                      }}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!readOnly && (
                      <div className="flex justify-between gap-2 items-center">
                        <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => openCreateItem(p.id)}>
                          <Plus className="w-3 h-3" /> Adicionar item
                        </Button>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => openEditPhase(p)}>
                            <Pencil className="w-3 h-3 mr-1" /> Editar fase
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs text-red-400" onClick={() => {
                            if (confirm(`Excluir a fase "${p.label}"? Isso só é permitido se não houver faturas nem contas a pagar vinculadas.`)) {
                              deletePhase.mutate({ id: p.id });
                            }
                          }}>
                            <Trash2 className="w-3 h-3 mr-1" /> Excluir
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
