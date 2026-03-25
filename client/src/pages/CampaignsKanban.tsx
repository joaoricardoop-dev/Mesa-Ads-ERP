import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Gift,
  Package,
  Calendar,
  Building2,
  LayoutGrid,
  ExternalLink,
  CheckCircle2,
  Clock,
  Timer,
  Flame,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STAGES = [
  { key: "briefing",     label: "Briefing",     light: "bg-sky-500/10 border-sky-500/30",      text: "text-sky-400",     dot: "bg-sky-500" },
  { key: "design",       label: "Design",        light: "bg-purple-500/10 border-purple-500/30",text: "text-purple-400",  dot: "bg-purple-500" },
  { key: "aprovacao",    label: "Aprovação",     light: "bg-orange-500/10 border-orange-500/30",text: "text-orange-400",  dot: "bg-orange-500" },
  { key: "producao",     label: "Produção",      light: "bg-amber-500/10 border-amber-500/30",  text: "text-amber-400",   dot: "bg-amber-500" },
  { key: "distribuicao", label: "Distribuição",  light: "bg-teal-500/10 border-teal-500/30",    text: "text-teal-400",    dot: "bg-teal-500" },
  { key: "veiculacao",   label: "Veiculação",    light: "bg-emerald-500/10 border-emerald-500/30",text: "text-emerald-400",dot: "bg-emerald-500" },
  { key: "archived",     label: "Arquivado",     light: "bg-gray-500/10 border-gray-500/30",    text: "text-gray-400",    dot: "bg-gray-500" },
] as const;

type StageKey = typeof STAGES[number]["key"];

const KANBAN_STATUSES: StageKey[] = ["briefing", "design", "aprovacao", "producao", "distribuicao", "veiculacao", "archived"];

const SLA_STAGES = new Set(["briefing", "design", "aprovacao"]);
const SLA_WARN_DAYS = 3;
const SLA_CRIT_DAYS = 5;

const STAGE_ENTERED_AT: Partial<Record<StageKey, keyof KanbanCampaign>> = {
  briefing:     "briefingEnteredAt",
  design:       "designEnteredAt",
  aprovacao:    "aprovacaoEnteredAt",
  producao:     "producaoEnteredAt",
  distribuicao: "distribuicaoEnteredAt",
};

function daysSince(ts: Date | string | null | undefined): number | null {
  if (!ts) return null;
  const ms = Date.now() - new Date(ts).getTime();
  return Math.floor(ms / 86_400_000);
}

function isOverdue(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  return new Date(endDate + "T23:59:59") < new Date();
}

interface KanbanCampaign {
  id: number;
  name: string;
  status: string;
  clientName?: string | null;
  clientCompany?: string | null;
  productName?: string | null;
  coastersPerRestaurant: number;
  activeRestaurants: number;
  endDate?: string | null;
  materialReceivedDate?: string | null;
  isBonificada?: boolean | null;
  campaignNumber?: string | null;
  briefingEnteredAt?: Date | string | null;
  designEnteredAt?: Date | string | null;
  aprovacaoEnteredAt?: Date | string | null;
  producaoEnteredAt?: Date | string | null;
  distribuicaoEnteredAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

function getDaysInStage(c: KanbanCampaign): number | null {
  const fieldKey = STAGE_ENTERED_AT[c.status as StageKey];
  if (fieldKey) {
    const d = daysSince(c[fieldKey] as string | null);
    if (d !== null) return d;
  }
  return daysSince(c.updatedAt);
}

function getSlaElapsed(c: KanbanCampaign): number | null {
  if (!SLA_STAGES.has(c.status)) return null;
  return daysSince(c.briefingEnteredAt);
}

function SlaChip({ days }: { days: number }) {
  if (days < SLA_WARN_DAYS) return null;
  const isCrit = days >= SLA_CRIT_DAYS;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
      isCrit
        ? "bg-red-500/20 border-red-500/40 text-red-400"
        : "bg-amber-500/20 border-amber-500/40 text-amber-400"
    }`}>
      {isCrit ? <Flame className="w-2.5 h-2.5" /> : <Timer className="w-2.5 h-2.5" />}
      SLA {days}d
    </span>
  );
}

function CampaignCard({
  campaign,
  stageIndex,
  onMove,
  moving,
}: {
  campaign: KanbanCampaign;
  stageIndex: number;
  onMove: (id: number, newStatus: StageKey) => void;
  moving: boolean;
}) {
  const [, navigate] = useLocation();
  const overdue = isOverdue(campaign.endDate);
  const hasMaterial = !!campaign.materialReceivedDate;
  const canMovePrev = stageIndex > 0;
  const canMoveNext = stageIndex < KANBAN_STATUSES.length - 1;
  const daysInStage = getDaysInStage(campaign);
  const slaElapsed = getSlaElapsed(campaign);

  return (
    <div
      className={`bg-card border rounded-lg p-3 space-y-2 transition-all hover:shadow-md cursor-pointer group ${
        overdue ? "border-red-500/40 hover:border-red-500/60" : "border-border/30 hover:border-border/60"
      }`}
      onClick={() => navigate(`/campanhas/${campaign.id}`)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
            {campaign.name}
          </p>
          {campaign.campaignNumber && (
            <span className="text-[10px] font-mono text-muted-foreground">{campaign.campaignNumber}</span>
          )}
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
      </div>

      {campaign.clientName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{campaign.clientCompany || campaign.clientName}</span>
        </div>
      )}

      {campaign.productName && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Package className="w-3 h-3 shrink-0" />
          <span className="truncate">{campaign.productName}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{(campaign.coastersPerRestaurant * campaign.activeRestaurants).toLocaleString("pt-BR")} un.</span>
        <span className="text-border">·</span>
        <span>{campaign.activeRestaurants} rest.</span>
      </div>

      {campaign.endDate && (
        <div className={`flex items-center gap-1 text-xs ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
          {overdue ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <Calendar className="w-3 h-3 shrink-0" />}
          <span>{overdue ? "Atrasada · " : ""}{new Date(campaign.endDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {daysInStage !== null && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
            <Clock className="w-2.5 h-2.5" />
            {daysInStage === 0 ? "hoje" : daysInStage === 1 ? "1 dia" : `${daysInStage} dias`}
          </span>
        )}
        {slaElapsed !== null && <SlaChip days={slaElapsed} />}
        {hasMaterial && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-2.5 h-2.5" /> Material
          </span>
        )}
        {campaign.isBonificada && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
            <Gift className="w-2.5 h-2.5" /> Bonificada
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/20" onClick={(e) => e.stopPropagation()}>
        <button
          disabled={!canMovePrev || moving}
          onClick={() => onMove(campaign.id, KANBAN_STATUSES[stageIndex - 1])}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1 py-0.5 rounded hover:bg-muted/50"
        >
          <ChevronLeft className="w-3 h-3" />
          {stageIndex > 0 ? STAGES[stageIndex - 1].label : ""}
        </button>
        <button
          disabled={!canMoveNext || moving}
          onClick={() => onMove(campaign.id, KANBAN_STATUSES[stageIndex + 1])}
          className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-1 py-0.5 rounded hover:bg-muted/50"
        >
          {stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1].label : ""}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function CampaignsKanban() {
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterBonificada, setFilterBonificada] = useState(false);
  const [filterSla, setFilterSla] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);

  const { data: campaigns = [], refetch } = trpc.campaign.list.useQuery();

  const updateMutation = trpc.campaign.update.useMutation({
    onSuccess: () => { refetch(); setMovingId(null); },
    onError: (err: any) => { toast.error(err.message ?? "Erro ao mover campanha"); setMovingId(null); },
  });

  const handleMove = (id: number, newStatus: StageKey) => {
    setMovingId(id);
    updateMutation.mutate({ id, status: newStatus });
  };

  const kanbanCampaigns = useMemo(() =>
    (campaigns as KanbanCampaign[]).filter((c) => KANBAN_STATUSES.includes(c.status as StageKey)),
    [campaigns]
  );

  const uniqueClients = useMemo(() => {
    const seen = new Map<string, string>();
    kanbanCampaigns.forEach((c) => { if (c.clientName) seen.set(c.clientName, c.clientCompany || c.clientName); });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [kanbanCampaigns]);

  const filtered = useMemo(() => {
    return kanbanCampaigns.filter((c) => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !(c.clientName || "").toLowerCase().includes(q) && !(c.clientCompany || "").toLowerCase().includes(q)) return false;
      if (filterClient !== "all" && c.clientName !== filterClient) return false;
      if (filterOverdue && !isOverdue(c.endDate)) return false;
      if (filterBonificada && !c.isBonificada) return false;
      if (filterSla) {
        const sla = getSlaElapsed(c);
        if (sla === null || sla < SLA_WARN_DAYS) return false;
      }
      return true;
    });
  }, [kanbanCampaigns, search, filterClient, filterOverdue, filterBonificada, filterSla]);

  const byStage = useMemo(() => {
    const map: Record<StageKey, KanbanCampaign[]> = {
      briefing: [], design: [], aprovacao: [], producao: [],
      distribuicao: [], veiculacao: [], archived: [],
    };
    filtered.forEach((c) => { if (c.status in map) map[c.status as StageKey].push(c); });
    return map;
  }, [filtered]);

  const totalAtivas   = kanbanCampaigns.filter((c) => c.status !== "archived").length;
  const emProducao    = kanbanCampaigns.filter((c) => c.status === "producao").length;
  const atrasadas     = kanbanCampaigns.filter((c) => c.status !== "archived" && isOverdue(c.endDate)).length;
  const emRiscoSla    = kanbanCampaigns.filter((c) => { const s = getSlaElapsed(c); return s !== null && s >= SLA_WARN_DAYS; }).length;

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3 space-y-3 border-b border-border/20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-card border border-border/30 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ativas</p>
            <p className="text-xl font-bold">{totalAtivas}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Em Produção</p>
            <p className="text-xl font-bold text-amber-400">{emProducao}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Atrasadas</p>
            <p className={`text-xl font-bold ${atrasadas > 0 ? "text-red-400" : "text-muted-foreground"}`}>{atrasadas}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Risco SLA</p>
            <p className={`text-xl font-bold ${emRiscoSla > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{emRiscoSla}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha ou cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-background border-border/30"
            />
          </div>

          {uniqueClients.length > 0 && (
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="h-8 text-xs w-44 bg-background border-border/30">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {uniqueClients.map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <button
            onClick={() => setFilterSla((v) => !v)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs border transition-colors ${
              filterSla
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-background border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Timer className="w-3 h-3" />
            Risco SLA
          </button>

          <button
            onClick={() => setFilterOverdue((v) => !v)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs border transition-colors ${
              filterOverdue
                ? "bg-red-500/20 border-red-500/40 text-red-400"
                : "bg-background border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Atrasadas
          </button>

          <button
            onClick={() => setFilterBonificada((v) => !v)}
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs border transition-colors ${
              filterBonificada
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-background border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gift className="w-3 h-3" />
            Bonificadas
          </button>

          {filtered.length !== kanbanCampaigns.length && (
            <span className="text-xs text-muted-foreground">{filtered.length} de {kanbanCampaigns.length}</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-3 p-4 min-w-max" style={{ height: "calc(100vh - 280px)" }}>
          {STAGES.map((stage, stageIndex) => {
            const cards = byStage[stage.key];
            const hasSlaRisk = SLA_STAGES.has(stage.key as any);
            const slaRiskCount = hasSlaRisk
              ? cards.filter((c) => { const s = getSlaElapsed(c); return s !== null && s >= SLA_WARN_DAYS; }).length
              : 0;

            return (
              <div
                key={stage.key}
                className={`flex flex-col w-72 shrink-0 rounded-xl border ${stage.light} overflow-hidden`}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-current/10">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className={`text-sm font-semibold ${stage.text}`}>{stage.label}</span>
                    {slaRiskCount > 0 && (
                      <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.5 rounded-full">
                        {slaRiskCount} SLA
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-mono font-bold ${stage.text} bg-current/10 px-1.5 py-0.5 rounded`}>
                    {cards.length}
                  </span>
                </div>

                {hasSlaRisk && (
                  <div className={`px-3 py-1 text-[10px] border-b border-current/10 ${stage.text} opacity-60`}>
                    SLA: <span className="text-amber-400">⚠ ≥3d</span> · <span className="text-red-400">🔥 ≥5d</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0 scrollbar-hide">
                  {cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <LayoutGrid className="w-6 h-6 text-muted-foreground/30 mb-1" />
                      <p className="text-xs text-muted-foreground/50">Nenhuma campanha</p>
                    </div>
                  ) : (
                    cards.map((c) => (
                      <CampaignCard
                        key={c.id}
                        campaign={c}
                        stageIndex={stageIndex}
                        onMove={handleMove}
                        moving={movingId === c.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
