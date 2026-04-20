import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarRange, Pause, Play, Pencil, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

export interface OccupancyPhase {
  phaseId: number;
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  campaignNumber?: string | null;
  isBonificada?: boolean;
  clientId: number;
  clientName: string | null;
  sequence: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  phaseStatus: string;
  phaseNotes?: string | null;
  itemCount?: number;
  products: Array<{ productId: number; productName: string; tipo: string | null }>;
  locations: Array<{ restaurantId: number; restaurantName: string }>;
}

type GroupBy = "campaign" | "client" | "product" | "location";

interface Props {
  phases: OccupancyPhase[];
  groupBy: GroupBy;
  isLoading?: boolean;
  /** Reload after a mutation */
  onChanged?: () => void;
  /** ISO date (yyyy-mm-dd) lower bound, defaults to min of phases */
  rangeStart?: string;
  /** ISO date (yyyy-mm-dd) upper bound, defaults to max of phases */
  rangeEnd?: string;
}

const PHASE_COLORS: Record<string, string> = {
  planejada: "bg-zinc-500/70 border-zinc-400",
  ativa: "bg-emerald-500/80 border-emerald-400",
  concluida: "bg-blue-500/70 border-blue-400",
  cancelada: "bg-red-500/70 border-red-400",
};
const PHASE_LABELS: Record<string, string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", active: "Ativa", paused: "Pausada", completed: "Concluída",
  quotation: "Cotação", archived: "Arquivada", briefing: "Briefing",
  design: "Design", aprovacao: "Aprovação", producao: "Produção",
  transito: "Trânsito", executar: "Executar", distribuicao: "Distribuição",
  veiculacao: "Veiculação", inativa: "Inativa",
};

function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}
function fmtDateShort(d: string): string {
  const dt = parseDate(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export default function OccupancyCalendar({
  phases,
  groupBy,
  isLoading,
  onChanged,
  rangeStart,
  rangeEnd,
}: Props) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<OccupancyPhase | null>(null);
  const [editForm, setEditForm] = useState<{
    periodStart: string;
    periodEnd: string;
    status: "planejada" | "ativa" | "concluida" | "cancelada";
  }>({ periodStart: "", periodEnd: "", status: "planejada" });

  const updatePhase = trpc.campaignPhase.updatePhase.useMutation({
    onSuccess: () => {
      utils.ops.invalidate();
      utils.campaignPhase.invalidate();
      setEditing(null);
      onChanged?.();
      toast.success("Fase atualizada");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateCampaign = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.ops.invalidate();
      utils.campaign.invalidate();
      onChanged?.();
      toast.success("Campanha atualizada");
    },
    onError: (e) => toast.error(e.message),
  });

  // Compute date range / scale
  const { minDate, maxDate, totalDays, monthMarkers } = useMemo(() => {
    if (phases.length === 0) {
      const today = new Date();
      const min = new Date(today.getFullYear(), today.getMonth(), 1);
      const max = new Date(today.getFullYear(), today.getMonth() + 3, 0);
      return { minDate: min, maxDate: max, totalDays: diffDays(min, max) + 1, monthMarkers: [] as Array<{ date: Date; label: string }> };
    }
    let min = rangeStart ? parseDate(rangeStart) : parseDate(phases[0].periodStart);
    let max = rangeEnd ? parseDate(rangeEnd) : parseDate(phases[0].periodEnd);
    for (const p of phases) {
      const s = parseDate(p.periodStart);
      const e = parseDate(p.periodEnd);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    // pad 5 days each side
    min = new Date(min.getFullYear(), min.getMonth(), 1);
    max = new Date(max.getFullYear(), max.getMonth() + 1, 0);
    const total = diffDays(min, max) + 1;
    // monthly markers
    const markers: Array<{ date: Date; label: string }> = [];
    const cursor = new Date(min);
    while (cursor <= max) {
      markers.push({
        date: new Date(cursor),
        label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { minDate: min, maxDate: max, totalDays: total, monthMarkers: markers };
  }, [phases, rangeStart, rangeEnd]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; subtitle?: string; phases: OccupancyPhase[] }>();
    for (const p of phases) {
      let entries: Array<{ key: string; label: string; subtitle?: string }> = [];
      if (groupBy === "campaign") {
        entries = [{
          key: `c-${p.campaignId}`,
          label: p.campaignName,
          subtitle: p.clientName ?? undefined,
        }];
      } else if (groupBy === "client") {
        entries = [{
          key: `cli-${p.clientId}`,
          label: p.clientName ?? "—",
        }];
      } else if (groupBy === "product") {
        entries = p.products.length > 0
          ? p.products.map((pr) => ({
              key: `pr-${pr.productId}`,
              label: pr.productName,
              subtitle: pr.tipo ?? undefined,
            }))
          : [{ key: "pr-none", label: "Sem produto" }];
      } else if (groupBy === "location") {
        entries = p.locations.length > 0
          ? p.locations.map((l) => ({
              key: `loc-${l.restaurantId}`,
              label: l.restaurantName || `Local #${l.restaurantId}`,
            }))
          : [{ key: "loc-none", label: "Rede inteira" }];
      }
      for (const e of entries) {
        if (!map.has(e.key)) map.set(e.key, { ...e, phases: [] });
        map.get(e.key)!.phases.push(p);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [phases, groupBy]);

  function offsetPct(d: string): number {
    const dt = parseDate(d);
    return (diffDays(minDate, dt) / totalDays) * 100;
  }
  function widthPct(start: string, end: string): number {
    const days = diffDays(parseDate(start), parseDate(end)) + 1;
    return (days / totalDays) * 100;
  }

  function openEdit(p: OccupancyPhase) {
    setEditing(p);
    setEditForm({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      status: (p.phaseStatus as any) ?? "planejada",
    });
  }

  function handleReschedule(daysDelta: number) {
    if (!editing) return;
    const s = parseDate(editing.periodStart);
    const e = parseDate(editing.periodEnd);
    s.setDate(s.getDate() + daysDelta);
    e.setDate(e.getDate() + daysDelta);
    setEditForm((f) => ({
      ...f,
      periodStart: s.toISOString().split("T")[0],
      periodEnd: e.toISOString().split("T")[0],
    }));
  }

  function handleSavePhase() {
    if (!editing) return;
    updatePhase.mutate({
      id: editing.phaseId,
      periodStart: editForm.periodStart,
      periodEnd: editForm.periodEnd,
      status: editForm.status,
    });
  }

  function handleTogglePauseCampaign(p: OccupancyPhase) {
    const next = p.campaignStatus === "paused" ? "active" : "paused";
    updateCampaign.mutate({ id: p.campaignId, status: next as any });
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando calendário…</div>;
  }
  if (phases.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card p-12 text-center text-sm text-muted-foreground">
        Nenhuma fase encontrada para os filtros atuais.
      </div>
    );
  }

  const LABEL_COL_W = 220;

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      {/* Cabeçalho com escala mensal */}
      <div className="flex items-stretch border-b border-border/40 bg-muted/20 sticky top-0 z-10">
        <div
          className="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground border-r border-border/40 flex items-center gap-1"
          style={{ width: LABEL_COL_W }}
        >
          <CalendarRange className="w-3.5 h-3.5" />
          {groupBy === "campaign" && "Campanha"}
          {groupBy === "client" && "Anunciante"}
          {groupBy === "product" && "Produto"}
          {groupBy === "location" && "Local"}
        </div>
        <div className="relative flex-1 h-9">
          {monthMarkers.map((m, i) => {
            const left = (diffDays(minDate, m.date) / totalDays) * 100;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-border/40 text-[10px] uppercase text-muted-foreground px-1 flex items-center"
                style={{ left: `${left}%` }}
              >
                {m.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Linhas */}
      <div className="max-h-[600px] overflow-y-auto">
        {groups.map((g) => (
          <div key={g.key} className="flex items-stretch border-b border-border/30 hover:bg-muted/10">
            <div
              className="shrink-0 px-3 py-3 border-r border-border/40 flex flex-col justify-center"
              style={{ width: LABEL_COL_W }}
            >
              <div className="text-xs font-semibold truncate" title={g.label}>{g.label}</div>
              {g.subtitle && (
                <div className="text-[10px] text-muted-foreground truncate" title={g.subtitle}>{g.subtitle}</div>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5">{g.phases.length} fase{g.phases.length === 1 ? "" : "s"}</div>
            </div>
            <div className="relative flex-1 min-h-[60px] py-2">
              {/* faint month grid */}
              {monthMarkers.map((m, i) => {
                const left = (diffDays(minDate, m.date) / totalDays) * 100;
                return (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${left}%` }} />
                );
              })}
              {g.phases.map((p) => {
                const left = offsetPct(p.periodStart);
                const width = Math.max(widthPct(p.periodStart, p.periodEnd), 1);
                const color = PHASE_COLORS[p.phaseStatus] ?? PHASE_COLORS.planejada;
                const paused = p.campaignStatus === "paused";
                return (
                  <Popover key={p.phaseId}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`absolute h-7 rounded border ${color} ${paused ? "opacity-50 ring-2 ring-yellow-400/60" : ""} text-[10px] text-white px-1.5 truncate text-left hover:brightness-110 transition`}
                        style={{ left: `${left}%`, width: `${width}%`, top: "8px" }}
                        title={`${p.campaignName} · ${p.label} · ${fmtDateShort(p.periodStart)} → ${fmtDateShort(p.periodEnd)}`}
                      >
                        {p.label} · {p.campaignName}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{p.campaignName}</div>
                            <div className="text-xs text-muted-foreground">{p.clientName ?? "—"}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {CAMPAIGN_STATUS_LABELS[p.campaignStatus] ?? p.campaignStatus}
                          </Badge>
                        </div>
                        <div className="text-xs">
                          <div className="font-semibold">{p.label}</div>
                          <div className="text-muted-foreground">
                            {fmtDateShort(p.periodStart)} → {fmtDateShort(p.periodEnd)} · {PHASE_LABELS[p.phaseStatus] ?? p.phaseStatus}
                          </div>
                        </div>
                        {p.products.length > 0 && (
                          <div className="text-[11px]">
                            <div className="text-muted-foreground">Produtos:</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {p.products.slice(0, 6).map((pr) => (
                                <Badge key={pr.productId} variant="secondary" className="text-[10px]">{pr.productName}</Badge>
                              ))}
                              {p.products.length > 6 && (
                                <span className="text-muted-foreground">+{p.products.length - 6}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {p.locations.length > 0 && (
                          <div className="text-[11px]">
                            <div className="text-muted-foreground">Locais:</div>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {p.locations.slice(0, 6).map((l) => (
                                <Badge key={l.restaurantId} variant="outline" className="text-[10px]">{l.restaurantName}</Badge>
                              ))}
                              {p.locations.length > 6 && (
                                <span className="text-muted-foreground">+{p.locations.length - 6}</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openEdit(p)}>
                            <Pencil className="w-3 h-3" /> Reagendar
                          </Button>
                          <Button
                            size="sm"
                            variant={paused ? "default" : "outline"}
                            className="text-xs gap-1"
                            onClick={() => handleTogglePauseCampaign(p)}
                            disabled={updateCampaign.isPending}
                          >
                            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            {paused ? "Retomar" : "Pausar"} campanha
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs gap-1 col-span-2"
                            onClick={() => setLocation(`/campanhas/${p.campaignId}/fase/${p.phaseId}`)}
                          >
                            <ExternalLink className="w-3 h-3" /> Abrir fase
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Dialog: editar período / status / duração */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar fase</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                {editing.campaignName} · {editing.label}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="date"
                    value={editForm.periodStart}
                    onChange={(e) => setEditForm({ ...editForm, periodStart: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Fim (define duração)</Label>
                  <Input
                    type="date"
                    value={editForm.periodEnd}
                    onChange={(e) => setEditForm({ ...editForm, periodEnd: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v: any) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PHASE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] uppercase text-muted-foreground self-center">Deslocar:</span>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleReschedule(-7)}>−7d</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleReschedule(-1)}>−1d</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleReschedule(1)}>+1d</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleReschedule(7)}>+7d</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleReschedule(30)}>+30d</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSavePhase} disabled={updatePhase.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
