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
} from "lucide-react";
import { toast } from "sonner";

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

export default function OpportunitiesBoard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const opportunitiesQuery = trpc.opportunity.list.useQuery();
  const clientsList = trpc.advertiser.list.useQuery();
  const internalUsers = trpc.lead.listUsers.useQuery();
  const partnersList = trpc.partner.list.useQuery();

  const opportunities = opportunitiesQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState("");

  const selected = trpc.opportunity.get.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null }
  );

  function invalidate() {
    utils.opportunity.list.invalidate();
    if (selectedId != null) utils.opportunity.get.invalidate({ id: selectedId });
  }

  const createMutation = trpc.opportunity.create.useMutation({
    onSuccess: () => {
      toast.success("Oportunidade criada");
      setCreateOpen(false);
      setFormData({ ...emptyForm });
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

  const generateQuotationMutation = trpc.quotation.create.useMutation({
    onSuccess: (q: any) => {
      toast.success("Cotação gerada");
      setLocation(`/comercial/cotacoes/${q.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  function handleCreate() {
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
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
    });
  }

  function moveStage(id: number, currentStage: string, direction: "next" | "prev") {
    const idx = OPPORTUNITY_STAGES.findIndex((s) => s.key === currentStage);
    if (idx === -1) return;
    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= OPPORTUNITY_STAGES.length) return;
    changeStageMutation.mutate({ id, stage: OPPORTUNITY_STAGES[newIdx].key });
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
        changeStageMutation.mutate({ id, stage: stageKey });
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

  const oppsByStage = OPPORTUNITY_STAGES.map((stage) => ({
    ...stage,
    items: opportunities.filter((o: any) => o.stage === stage.key),
  }));

  const sel = selected.data as any;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Funil de negócios — um anunciante pode ter várias oportunidades simultâneas.
        </p>
        <Button size="sm" onClick={() => { setFormData({ ...emptyForm }); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          Nova Oportunidade
        </Button>
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
                      <span className="text-[9px] text-muted-foreground">{formatDate(opp.updatedAt)}</span>
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Oportunidade</DialogTitle>
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
                onValueChange={(v) => setFormData({ ...formData, clientId: v === "none" ? undefined : Number(v) })}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Oportunidade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={selectedId != null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setLossReason(""); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{sel?.title ?? "Oportunidade"}</SheetTitle>
          </SheetHeader>

          {selected.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {sel && (
            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Estágio" value={OPPORTUNITY_STAGES.find((s) => s.key === sel.stage)?.label ?? sel.stage} />
                <Info label="Valor estimado" value={formatCurrency(sel.estimatedValue)} />
                <Info label="Anunciante" value={sel.clientName ?? "—"} />
                <Info label="Responsável" value={[sel.ownerFirstName, sel.ownerLastName].filter(Boolean).join(" ") || "—"} />
                <Info label="Tipo" value={sel.opportunityType ?? "—"} />
                <Info label="Receita" value={sel.revenueType ?? "—"} />
                <Info label="Praça" value={sel.praca ? (PRACA_LABELS[sel.praca] ?? sel.praca) : "—"} />
                <Info label="Fechamento previsto" value={formatDate(sel.expectedCloseDate)} />
                <Info label="Parceiro" value={sel.partnerName ?? "—"} />
                <Info label="Origem" value={sel.source ?? "—"} />
              </div>

              {sel.stage === "perdida" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs">Motivo da perda</Label>
                  <p className="text-xs text-muted-foreground">{sel.lossReason || "—"}</p>
                </div>
              )}

              {sel.stage === "ganha" && (
                <Button
                  className="w-full gap-1.5"
                  onClick={() => handleGenerateQuotation(sel)}
                  disabled={generateQuotationMutation.isPending}
                >
                  <FileText className="w-4 h-4" />
                  Gerar cotação vinculada
                </Button>
              )}

              {sel.stage !== "perdida" && (
                <div className="grid gap-1.5 border-t pt-4">
                  <Label className="text-xs">Marcar como perdida</Label>
                  <Textarea
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    placeholder="Motivo da perda..."
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeStageMutation.mutate({ id: sel.id, stage: "perdida", lossReason: lossReason || undefined })}
                    disabled={changeStageMutation.isPending}
                  >
                    Marcar perdida
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1.5"
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
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5 truncate">{value}</p>
    </div>
  );
}
