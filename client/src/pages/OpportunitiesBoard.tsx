import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Building2,
  Handshake,
  Trash2,
  FileText,
  Loader2,
  Sprout,
  RotateCcw,
  Users,
  Link2,
  X,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { CsvExportButton, downloadCsv } from "@/components/CsvExportButton";
import { useConfigOptions } from "@/lib/configOptions";
import type { ContactRecordFilter } from "./Leads";

export const OPPORTUNITY_STAGES = [
  { key: "qualificada", label: "Qualificada", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { key: "reuniao_realizada", label: "Reunião realizada", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { key: "proposta", label: "Proposta", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { key: "negociacao", label: "Negociação", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  { key: "ganha", label: "Ganha", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { key: "perdida", label: "Perdida", color: "bg-red-500/10 text-red-500 border-red-500/20" },
] as const;

const PRACA_LABELS: Record<string, string> = {
  manaus: "Manaus",
  rio: "Rio",
  ambas: "Ambas",
};

const TYPE_LABELS: Record<string, string> = {
  new: "New",
  upsell: "Upsell",
  renewal: "Renovação",
};

const REVENUE_LABELS: Record<string, string> = {
  mrr: "MRR",
  oneshot: "One Shot",
};

const emptyForm = {
  title: "",
  clientId: undefined as number | undefined,
  ownerId: undefined as string | undefined,
  estimatedValue: "",
  expectedCloseDate: "",
  opportunityType: undefined as string | undefined,
  revenueType: undefined as string | undefined,
  praca: undefined as string | undefined,
  source: "",
  partnerId: undefined as number | undefined,
};

function formatCurrency(v: string | number | null | undefined) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function OpportunitiesBoard({ onViewContacts }: { onViewContacts?: (filter: NonNullable<ContactRecordFilter>) => void }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [farmingOnly, setFarmingOnly] = useState(false);

  const opportunitiesQuery = trpc.opportunity.list.useQuery();
  const clientsList = trpc.advertiser.list.useQuery();
  const internalUsers = trpc.lead.listUsers.useQuery();
  const partnersList = trpc.partner.list.useQuery();

  const opportunities = opportunitiesQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");
  const [lossReasonNotes, setLossReasonNotes] = useState("");
  const [lossDialogId, setLossDialogId] = useState<number | null>(null);
  const [dialogLossReason, setDialogLossReason] = useState("");
  const [dialogLossNotes, setDialogLossNotes] = useState("");
  const [linkQuotationId, setLinkQuotationId] = useState<string>("");
  const [createQuotationIds, setCreateQuotationIds] = useState<number[]>([]);
  const { options: lossOptions, labelOf: lossLabelOf } = useConfigOptions("loss_reason");
  const { options: originOptions, labelOf: originLabelOf } = useConfigOptions("origin_category");
  const isValidLoss = (code: string) => lossOptions.some((o) => o.code === code);

  const selected = trpc.opportunity.get.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null }
  );

  const sel = selected.data as any;

  // Cotações já vinculadas à oportunidade aberta no painel de detalhe.
  const linkedQuotationsQuery = trpc.quotation.list.useQuery(
    { opportunityId: selectedId! },
    { enabled: selectedId != null }
  );

  // Cotações do mesmo anunciante ainda sem oportunidade (para vincular no detalhe).
  const clientQuotationsQuery = trpc.quotation.list.useQuery(
    { clientId: sel?.clientId },
    { enabled: selectedId != null && sel?.clientId != null }
  );

  // Cotações do anunciante selecionado no diálogo de criação, sem oportunidade.
  const createClientQuotationsQuery = trpc.quotation.list.useQuery(
    { clientId: formData.clientId! },
    { enabled: createOpen && formData.clientId != null }
  );

  const linkableQuotations = (clientQuotationsQuery.data ?? []).filter(
    (q: any) => !q.opportunityId
  );
  const createLinkableQuotations = (createClientQuotationsQuery.data ?? []).filter(
    (q: any) => !q.opportunityId
  );

  function invalidate() {
    utils.opportunity.list.invalidate();
    utils.quotation.list.invalidate();
    if (selectedId != null) utils.opportunity.get.invalidate({ id: selectedId });
  }

  const createMutation = trpc.opportunity.create.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade criada");
      setCreateOpen(false);
      setFormData({ ...emptyForm });
      setCreateQuotationIds([]);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.opportunity.update.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade atualizada");
      setCreateOpen(false);
      setEditId(null);
      setFormData({ ...emptyForm });
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const linkQuotationMutation = trpc.quotation.linkOpportunity.useMutation({
    onSuccess: () => {
      toast.success("Cotação vinculada");
      setLinkQuotationId("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const unlinkQuotationMutation = trpc.quotation.linkOpportunity.useMutation({
    onSuccess: () => {
      toast.success("Cotação desvinculada");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const changeStageMutation = trpc.opportunity.changeStage.useMutation({
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.opportunity.delete.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade removida");
      setSelectedId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reactivateMutation = trpc.opportunity.reactivate.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade reativada do farming");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const generateQuotationMutation = trpc.quotation.create.useMutation({
    onSuccess: (q: any) => {
      toast.success("Cotação gerada");
      setLocation(`/comercial/cotacoes/${q.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setFormData({ ...emptyForm });
    setCreateQuotationIds([]);
    setCreateOpen(true);
  }

  function openEdit(opp: any) {
    setEditId(opp.id);
    setFormData({
      title: opp.title ?? "",
      clientId: opp.clientId ?? undefined,
      ownerId: opp.ownerId ?? undefined,
      estimatedValue: opp.estimatedValue != null ? String(opp.estimatedValue) : "",
      expectedCloseDate: opp.expectedCloseDate
        ? String(opp.expectedCloseDate).slice(0, 10)
        : "",
      opportunityType: opp.opportunityType ?? undefined,
      revenueType: opp.revenueType ?? undefined,
      praca: opp.praca ?? undefined,
      source: opp.source ?? "",
      partnerId: opp.partnerId ?? undefined,
    });
    setCreateQuotationIds([]);
    setCreateOpen(true);
  }

  function handleCreate() {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    if (editId != null) {
      updateMutation.mutate({
        id: editId,
        title: formData.title.trim(),
        clientId: formData.clientId ?? null,
        ownerId: formData.ownerId ?? null,
        estimatedValue: formData.estimatedValue || null,
        expectedCloseDate: formData.expectedCloseDate || null,
        opportunityType: (formData.opportunityType as any) ?? null,
        revenueType: (formData.revenueType as any) ?? null,
        praca: (formData.praca as any) ?? null,
        source: formData.source || null,
        partnerId: formData.partnerId ?? null,
      });
      return;
    }
    createMutation.mutate({
      title: formData.title.trim(),
      clientId: formData.clientId,
      ownerId: formData.ownerId,
      estimatedValue: formData.estimatedValue || undefined,
      expectedCloseDate: formData.expectedCloseDate || undefined,
      opportunityType: formData.opportunityType as any,
      revenueType: formData.revenueType as any,
      praca: formData.praca as any,
      source: formData.source || undefined,
      partnerId: formData.partnerId,
      quotationIds: createQuotationIds.length > 0 ? createQuotationIds : undefined,
    });
  }

  function requestLoss(id: number) {
    setLossDialogId(id);
    setDialogLossReason("");
    setDialogLossNotes("");
  }

  function moveStage(id: number, currentStage: string, direction: "next" | "prev") {
    const idx = OPPORTUNITY_STAGES.findIndex((s) => s.key === currentStage);
    if (idx === -1) return;
    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= OPPORTUNITY_STAGES.length) return;
    const target = OPPORTUNITY_STAGES[newIdx].key;
    if (target === "perdida") { requestLoss(id); return; }
    changeStageMutation.mutate({ id, stage: target });
  }

  function handleDragStart(e: React.DragEvent, id: number) {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  }

  function handleDragEnd(e: React.DragEvent) {
    setDraggedId(null);
    setDragOverStage(null);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
  }

  function handleDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) setDragOverStage(stageKey);
  }

  function handleDragLeave(e: React.DragEvent, stageKey: string) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      if (dragOverStage === stageKey) setDragOverStage(null);
    }
  }

  function handleDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    setDragOverStage(null);
    const id = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(id)) {
      const opp = opportunities.find((o: any) => o.id === id);
      if (opp && opp.stage !== stageKey) {
        if (stageKey === "perdida") requestLoss(id);
        else changeStageMutation.mutate({ id, stage: stageKey });
      }
    }
    setDraggedId(null);
  }

  function handleGenerateQuotation(opp: any) {
    if (!opp.clientId) {
      toast.error("Vincule um anunciante à oportunidade antes de gerar a cotação");
      return;
    }
    generateQuotationMutation.mutate({
      clientId: opp.clientId,
      opportunityId: opp.id,
      coasterVolume: 0,
      partnerId: opp.partnerId ?? undefined,
    });
  }

  const visibleOpportunities = farmingOnly
    ? opportunities.filter((o: any) => o.farmingStatus)
    : opportunities;

  const farmingCount = opportunities.filter((o: any) => o.farmingStatus).length;

  const oppsByStage = OPPORTUNITY_STAGES.map((stage) => ({
    ...stage,
    items: visibleOpportunities.filter((o: any) => o.stage === stage.key),
  }));

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Funil de negócios — um anunciante pode ter várias oportunidades simultâneas.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant={farmingOnly ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setFarmingOnly((v) => !v)}
            title="Filtrar oportunidades em farming"
          >
            <Sprout className="w-3.5 h-3.5" />
            Farming
            {farmingCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{farmingCount}</Badge>
            )}
          </Button>
          <CsvExportButton
            onExport={async (range) => {
              const res = await utils.opportunity.exportCsv.fetch({
                farmingStatus: farmingOnly ? "pausado" : undefined,
                dateFrom: range.dateFrom,
                dateTo: range.dateTo,
              });
              downloadCsv(res.filename, res.csv);
            }}
          />
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="inline-flex gap-3">
          {oppsByStage.map((column) => (
            <div
              key={column.key}
              className={`w-[240px] shrink-0 rounded-lg transition-colors ${dragOverStage === column.key ? "bg-primary/5 ring-2 ring-primary/30" : ""}`}
              onDragOver={(e) => handleDragOver(e, column.key)}
              onDragLeave={(e) => handleDragLeave(e, column.key)}
              onDrop={(e) => handleDrop(e, column.key)}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${column.color}`}>
                  {column.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {column.items.length}
                </span>
              </div>

              <div className="space-y-2 min-h-[120px]">
                {column.items.map((opp: any) => (
                  <Card
                    key={opp.id}
                    className={`p-2.5 cursor-grab hover:border-primary/40 transition-all group ${draggedId === opp.id ? "opacity-50 scale-95" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, opp.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedId(opp.id)}
                  >
                    <p className="text-xs font-medium truncate leading-tight">{opp.title}</p>

                    {opp.clientName && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Building2 className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{opp.clientName}</span>
                      </div>
                    )}

                    {opp.estimatedValue && (
                      <p className="text-[11px] font-semibold text-foreground mt-1">{formatCurrency(opp.estimatedValue)}</p>
                    )}

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {opp.opportunityType === "new" && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-green-500/15 text-green-500 border-green-500/30">New</Badge>
                      )}
                      {opp.opportunityType === "upsell" && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-blue-500/15 text-blue-500 border-blue-500/30">Upsell</Badge>
                      )}
                      {opp.opportunityType === "renewal" && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-teal-500/15 text-teal-500 border-teal-500/30">Renovação</Badge>
                      )}
                      {opp.revenueType === "mrr" && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-purple-500/15 text-purple-500 border-purple-500/30">MRR</Badge>
                      )}
                      {opp.revenueType === "oneshot" && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-amber-500/15 text-amber-500 border-amber-500/30">One Shot</Badge>
                      )}
                      {opp.praca && (
                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1">{PRACA_LABELS[opp.praca] ?? opp.praca}</Badge>
                      )}
                      {opp.farmingStatus && (
                        <Badge className="text-[9px] h-3.5 px-1 bg-lime-500/15 text-lime-600 border-lime-500/30 gap-0.5">
                          <Sprout className="w-2.5 h-2.5" />
                          Farming
                        </Badge>
                      )}
                    </div>

                    {opp.partnerName && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Handshake className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="text-[9px] text-muted-foreground truncate">{opp.partnerName}</span>
                      </div>
                    )}

                    {opp.stage === "ganha" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-6 mt-2 text-[10px] gap-1"
                        onClick={(e) => { e.stopPropagation(); handleGenerateQuotation(opp); }}
                        disabled={generateQuotationMutation.isPending}
                      >
                        <FileText className="w-3 h-3" />
                        Gerar cotação
                      </Button>
                    )}

                    {opp.farmingStatus && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-6 mt-2 text-[10px] gap-1 border-lime-500/40 text-lime-600 hover:bg-lime-500/10"
                        onClick={(e) => { e.stopPropagation(); reactivateMutation.mutate({ id: opp.id }); }}
                        disabled={reactivateMutation.isPending}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reativar
                      </Button>
                    )}

                    <div className="flex items-center justify-between mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); moveStage(opp.id, opp.stage, "prev"); }}
                        disabled={column.key === "qualificada"}
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </Button>
                      <button
                        className="inline-flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (opp.clientId) onViewContacts?.({ kind: "client", id: opp.clientId, label: opp.clientName || opp.title });
                          else if (opp.leadId) onViewContacts?.({ kind: "lead", id: opp.leadId, label: opp.title });
                          else toast.error("Oportunidade sem anunciante ou lead vinculado");
                        }}
                        title="Ver contatos"
                      >
                        <Users className="w-3 h-3" /> Contatos
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); moveStage(opp.id, opp.stage, "next"); }}
                        disabled={column.key === "perdida"}
                      >
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </Card>
                ))}

                {column.items.length === 0 && (
                  <div className={`flex items-center justify-center h-[80px] rounded-lg border border-dashed transition-colors ${dragOverStage === column.key ? "border-primary/60 bg-primary/5" : "border-border/40"}`}>
                    <p className="text-[10px] text-muted-foreground">
                      {draggedId ? "Soltar aqui" : "Nenhuma oportunidade"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setEditId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId != null ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex.: Campanha verão — Cervejaria X"
                className="h-9"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Anunciante</Label>
              <Select
                value={formData.clientId ? String(formData.clientId) : "none"}
                onValueChange={(v) => { setFormData({ ...formData, clientId: v === "none" ? undefined : Number(v) }); setCreateQuotationIds([]); }}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Sem vínculo</SelectItem>
                  {(clientsList.data?.items ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.cnpj ? ` — ${c.cnpj}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Valor estimado</Label>
                <Input
                  type="number"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  placeholder="0,00"
                  className="h-9"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Fechamento previsto</Label>
                <Input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={formData.opportunityType ?? "none"}
                  onValueChange={(v) => setFormData({ ...formData, opportunityType: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="upsell">Upsell</SelectItem>
                    <SelectItem value="renewal">Renovação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Receita</Label>
                <Select
                  value={formData.revenueType ?? "none"}
                  onValueChange={(v) => setFormData({ ...formData, revenueType: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="mrr">MRR</SelectItem>
                    <SelectItem value="oneshot">One Shot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Praça</Label>
                <Select
                  value={formData.praca ?? "none"}
                  onValueChange={(v) => setFormData({ ...formData, praca: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="manaus">Manaus</SelectItem>
                    <SelectItem value="rio">Rio</SelectItem>
                    <SelectItem value="ambas">Ambas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={formData.ownerId ?? "none"}
                  onValueChange={(v) => setFormData({ ...formData, ownerId: v === "none" ? undefined : v })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(internalUsers.data ?? []).map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName ?? ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Parceiro (opcional)</Label>
              <Select
                value={formData.partnerId ? String(formData.partnerId) : "none"}
                onValueChange={(v) => setFormData({ ...formData, partnerId: v === "none" ? undefined : Number(v) })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {(partnersList.data || []).filter((p: any) => p.status === "active").map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.company ? ` (${p.company})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Origem</Label>
              <Select
                value={formData.source || "none"}
                onValueChange={(v) => setFormData({ ...formData, source: v === "none" ? "" : v })}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="select-opportunity-origin"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {originOptions.map((o) => (
                    <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editId == null && formData.clientId && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Vincular cotações existentes</Label>
                {createLinkableQuotations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {createClientQuotationsQuery.isLoading
                      ? "Carregando cotações..."
                      : "Nenhuma cotação disponível para este anunciante."}
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                    {createLinkableQuotations.map((q: any) => {
                      const checked = createQuotationIds.includes(q.id);
                      return (
                        <label
                          key={q.id}
                          className="flex items-center gap-2 px-2.5 py-2 text-xs cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            className="accent-primary"
                            checked={checked}
                            onChange={(e) =>
                              setCreateQuotationIds((prev) =>
                                e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                              )
                            }
                          />
                          <span className="flex-1 truncate">
                            <span className="font-medium">{q.quotationNumber}</span>
                            {q.quotationName ? ` · ${q.quotationName}` : ""}
                          </span>
                          <span className="text-muted-foreground shrink-0">{formatCurrency(q.totalValue)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditId(null); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId != null
                ? (updateMutation.isPending ? "Salvando..." : "Salvar alterações")
                : (createMutation.isPending ? "Criando..." : "Criar Oportunidade")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loss reason dialog (drag/drop + arrow moves to "perdida") */}
      <Dialog open={lossDialogId != null} onOpenChange={(open) => { if (!open) { setLossDialogId(null); setDialogLossReason(""); setDialogLossNotes(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como perdida</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold">Motivo da perda</Label>
              <Select value={dialogLossReason} onValueChange={setDialogLossReason}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {lossOptions.map((o) => (
                    <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={dialogLossNotes}
              onChange={(e) => setDialogLossNotes(e.target.value)}
              placeholder="Detalhe (opcional): contexto, concorrente, valor..."
              rows={2}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossDialogId(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (lossDialogId == null || !isValidLoss(dialogLossReason)) {
                  toast.error("Selecione o motivo da perda");
                  return;
                }
                changeStageMutation.mutate(
                  {
                    id: lossDialogId,
                    stage: "perdida",
                    lossReason: dialogLossReason,
                    lossReasonNotes: dialogLossNotes.trim() || undefined,
                  },
                  { onSuccess: () => { setLossDialogId(null); setDialogLossReason(""); setDialogLossNotes(""); } },
                );
              }}
              disabled={!isValidLoss(dialogLossReason) || changeStageMutation.isPending}
            >
              {changeStageMutation.isPending ? "Salvando..." : "Marcar perdida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={selectedId != null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setLossReason(""); setLossReasonNotes(""); setLinkQuotationId(""); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="text-base leading-tight pr-8">{sel?.title ?? "Oportunidade"}</SheetTitle>
            {sel && (
              <div className="flex items-center justify-between gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={`w-fit text-[10px] px-1.5 py-0 ${OPPORTUNITY_STAGES.find((s) => s.key === sel.stage)?.color ?? ""}`}
                >
                  {OPPORTUNITY_STAGES.find((s) => s.key === sel.stage)?.label ?? sel.stage}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => openEdit(sel)}
                >
                  <Pencil className="w-3 h-3" />
                  Editar
                </Button>
              </div>
            )}
          </SheetHeader>

          {selected.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {sel && (
            <div className="px-6 py-6 space-y-8 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Info label="Valor estimado" value={formatCurrency(sel.estimatedValue)} />
                <Info label="Fechamento previsto" value={formatDate(sel.expectedCloseDate)} />
                <Info label="Anunciante" value={sel.clientName ?? "—"} />
                <Info label="Responsável" value={[sel.ownerFirstName, sel.ownerLastName].filter(Boolean).join(" ") || "—"} />
                <Info label="Tipo" value={sel.opportunityType ? (TYPE_LABELS[sel.opportunityType] ?? sel.opportunityType) : "—"} />
                <Info label="Receita" value={sel.revenueType ? (REVENUE_LABELS[sel.revenueType] ?? sel.revenueType) : "—"} />
                <Info label="Praça" value={sel.praca ? (PRACA_LABELS[sel.praca] ?? sel.praca) : "—"} />
                <Info label="Parceiro" value={sel.partnerName ?? "—"} />
                <Info label="Origem" value={originLabelOf(sel.source)} />
              </div>

              {/* Cotações vinculadas */}
              <div className="space-y-3 border-t pt-6">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs font-semibold">Cotações vinculadas</Label>
                </div>

                {(linkedQuotationsQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma cotação vinculada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(linkedQuotationsQuery.data ?? []).map((q: any) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs"
                      >
                        <button
                          className="flex-1 min-w-0 flex items-center gap-1.5 text-left hover:text-primary transition-colors"
                          onClick={() => setLocation(`/comercial/cotacoes/${q.id}`)}
                        >
                          <span className="font-medium shrink-0">{q.quotationNumber}</span>
                          <span className="truncate text-muted-foreground">{q.quotationName ?? ""}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                        </button>
                        <span className="text-muted-foreground shrink-0">{formatCurrency(q.totalValue)}</span>
                        <button
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          title="Desvincular"
                          onClick={() => unlinkQuotationMutation.mutate({ quotationId: q.id, opportunityId: null })}
                          disabled={unlinkQuotationMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {sel.clientId ? (
                  <div className="flex items-center gap-2">
                    <Select value={linkQuotationId} onValueChange={setLinkQuotationId}>
                      <SelectTrigger className="h-9 text-xs flex-1">
                        <SelectValue placeholder="Vincular cotação existente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {linkableQuotations.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma cotação disponível</div>
                        ) : (
                          linkableQuotations.map((q: any) => (
                            <SelectItem key={q.id} value={String(q.id)}>
                              {q.quotationNumber}{q.quotationName ? ` · ${q.quotationName}` : ""}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5"
                      disabled={!linkQuotationId || linkQuotationMutation.isPending}
                      onClick={() =>
                        linkQuotationMutation.mutate({ quotationId: Number(linkQuotationId), opportunityId: sel.id })
                      }
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Vincular
                    </Button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Vincule um anunciante à oportunidade para listar cotações existentes.
                  </p>
                )}

                {sel.stage === "ganha" && (
                  <Button
                    className="w-full gap-1.5"
                    onClick={() => handleGenerateQuotation(sel)}
                    disabled={generateQuotationMutation.isPending}
                  >
                    <FileText className="w-4 h-4" />
                    Gerar nova cotação vinculada
                  </Button>
                )}
              </div>

              {sel.stage === "perdida" && (
                <div className="grid gap-1.5 border-t pt-6">
                  <Label className="text-xs font-semibold">Motivo da perda</Label>
                  <p className="text-sm">
                    {(() => {
                      return lossLabelOf(sel.lossReason);
                    })()}
                  </p>
                  {sel.lossReasonNotes && (
                    <p className="text-xs text-muted-foreground">{sel.lossReasonNotes}</p>
                  )}
                </div>
              )}

              {sel.stage !== "perdida" && (
                <div className="grid gap-2 border-t pt-6">
                  <Label className="text-xs font-semibold">Marcar como perdida</Label>
                  <Select value={lossReason} onValueChange={setLossReason}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-opportunity-loss">
                      <SelectValue placeholder="Selecione o motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {lossOptions.map((o) => (
                        <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={lossReasonNotes}
                    onChange={(e) => setLossReasonNotes(e.target.value)}
                    placeholder="Detalhe (opcional): contexto, concorrente, valor..."
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!isValidLoss(lossReason)) {
                        toast.error("Selecione o motivo da perda");
                        return;
                      }
                      changeStageMutation.mutate({
                        id: sel.id,
                        stage: "perdida",
                        lossReason,
                        lossReasonNotes: lossReasonNotes.trim() || undefined,
                      });
                    }}
                    disabled={!isValidLoss(lossReason) || changeStageMutation.isPending}
                  >
                    Marcar perdida
                  </Button>
                </div>
              )}

              <div className="border-t pt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1.5 px-0"
                  onClick={() => {
                    if (confirm("Remover esta oportunidade?")) deleteMutation.mutate({ id: sel.id });
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm mt-1 break-words">{value}</p>
    </div>
  );
}
