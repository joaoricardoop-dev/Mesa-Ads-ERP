import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { useLocation } from "wouter";
import {
  Radio,
  ArrowRight,
  AlertTriangle,
  CheckSquare,
  Clock,
  Timer,
  Layers,
  Printer,
  Activity,
  Package,
  ChevronRight,
  TrendingUp,
  Building2,
  Calendar,
} from "lucide-react";
import { useMemo } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSince(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d as string).getTime()) / 86_400_000);
}

function isOverdue(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  return new Date(endDate + "T23:59:59") < new Date();
}

const SLA_WARN = 3;
const SLA_CRIT = 5;
const PRE_PROD_STAGES = new Set(["briefing", "design", "aprovacao"]);

function getPreProdDays(c: { status: string; briefingEnteredAt?: any; producaoEnteredAt?: any }): number | null {
  if (!c.briefingEnteredAt) return null;
  if (PRE_PROD_STAGES.has(c.status)) return daysSince(c.briefingEnteredAt);
  if (c.producaoEnteredAt) {
    return Math.max(0, Math.floor(
      (new Date(c.producaoEnteredAt).getTime() - new Date(c.briefingEnteredAt).getTime()) / 86_400_000
    ));
  }
  return null;
}

function calcMonthlyRevenue(c: {
  coastersPerRestaurant: number; activeRestaurants: number; pricingType: string;
  markupPercent: string; fixedPrice: string; commissionType: string;
  restaurantCommission: string; fixedCommission: string; sellerCommission: string;
  taxRate: string; batchSize: number; batchCost: string;
}): number {
  const unitCost = Number(c.batchCost) / c.batchSize;
  const prodCost = c.coastersPerRestaurant * unitCost;
  const restFixed = c.commissionType === "fixed" ? Number(c.fixedCommission) * c.coastersPerRestaurant : 0;
  const custoPD = prodCost + restFixed;
  const restVar = c.commissionType === "variable" ? Number(c.restaurantCommission) / 100 : 0;
  const totalVarRate = Number(c.sellerCommission) / 100 + Number(c.taxRate) / 100 + restVar;
  const denom = 1 - totalVarRate;
  const custoBruto = denom > 0 ? custoPD / denom : custoPD;
  const price = c.pricingType === "fixed"
    ? custoBruto + Number(c.fixedPrice)
    : custoBruto * (1 + Number(c.markupPercent) / 100);
  return price * c.activeRestaurants;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", quotation: "Cotação", briefing: "Briefing", design: "Design",
  aprovacao: "Aprovação", producao: "Produção", distribuicao: "Distribuição",
  veiculacao: "Veiculação", inativa: "Inativa", archived: "Arquivada",
  active: "Ativa", transito: "Trânsito",
};

const STATUS_COLORS: Record<string, string> = {
  briefing: "bg-sky-500/20 text-sky-400", design: "bg-purple-500/20 text-purple-400",
  aprovacao: "bg-orange-500/20 text-orange-400", producao: "bg-amber-500/20 text-amber-400",
  distribuicao: "bg-teal-500/20 text-teal-400", veiculacao: "bg-emerald-500/20 text-emerald-400",
  active: "bg-emerald-500/20 text-emerald-400", draft: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground", inativa: "bg-muted text-muted-foreground",
};

const PIPELINE_STAGES = [
  { label: "Briefing", key: "briefing", color: "bg-sky-500" },
  { label: "Design", key: "design", color: "bg-purple-500" },
  { label: "Aprovação", key: "aprovacao", color: "bg-pink-500" },
  { label: "Produção", key: "producao", color: "bg-amber-500" },
  { label: "Distribuição", key: "distribuicao", color: "bg-teal-500" },
  { label: "Veiculação", key: "veiculacao", color: "bg-emerald-500" },
];

function formatRelativeDate(d: string | Date): string {
  const ms = Date.now() - new Date(d as string).getTime();
  const min = Math.floor(ms / 60000);
  const hr  = Math.floor(ms / 3600000);
  const day = Math.floor(ms / 86400000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  if (hr < 24) return `${hr}h atrás`;
  if (day < 7) return `${day}d atrás`;
  return new Date(d as string).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const ACTION_LABELS: Record<string, string> = {
  briefing:    "Movida para Briefing",
  design:      "Movida para Design",
  aprovacao:   "Enviada para Aprovação",
  producao:    "Entrou em Produção",
  distribuicao:"Em Distribuição",
  veiculacao:  "Em Veiculação",
  active:      "Ativada",
  archived:    "Arquivada",
  inativa:     "Marcada como Inativa",
  draft:       "Rascunho criado",
  quotation:   "Cotação vinculada",
  paused:      "Pausada",
  completed:   "Concluída",
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: campaigns = [], isLoading } = trpc.campaign.list.useQuery(undefined, { staleTime: 30000 });

  const kpis = useMemo(() => {
    const ativas      = campaigns.filter((c) => c.status !== "archived").length;
    const preProducao = campaigns.filter((c) => PRE_PROD_STAGES.has(c.status)).length;
    const producao    = campaigns.filter((c) => ["producao", "distribuicao"].includes(c.status)).length;
    const veiculacao  = campaigns.filter((c) => c.status === "veiculacao").length;
    const atrasadas   = campaigns.filter((c) => c.status !== "archived" && isOverdue(c.endDate)).length;
    const riscoSla    = campaigns.filter((c) => {
      const pp = getPreProdDays(c as any);
      return PRE_PROD_STAGES.has(c.status) && pp !== null && pp >= SLA_WARN;
    }).length;
    return { ativas, preProducao, producao, veiculacao, atrasadas, riscoSla };
  }, [campaigns]);

  const billing = useMemo(() => {
    let monthlyTotal = 0;
    let contractTotal = 0;
    for (const c of campaigns) {
      if ((c as any).isBonificada || c.status === "archived") continue;
      const monthly = calcMonthlyRevenue(c as any);
      monthlyTotal += monthly;
      contractTotal += monthly * c.contractDuration;
    }
    const activeBilling = campaigns.filter(
      (c) => !(c as any).isBonificada && ["veiculacao","producao","distribuicao"].includes(c.status)
    );
    const activeMontly = activeBilling.reduce((s, c) => s + calcMonthlyRevenue(c as any), 0);
    return { monthlyTotal, contractTotal, activeMontly };
  }, [campaigns]);

  const pipelineMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of campaigns) m[c.status] = (m[c.status] || 0) + 1;
    return m;
  }, [campaigns]);

  const maxPipeline = Math.max(...PIPELINE_STAGES.map((s) => pipelineMap[s.key] || 0), 1);

  const atrasadasList = useMemo(() =>
    campaigns
      .filter((c) => c.status !== "archived" && isOverdue(c.endDate))
      .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""))
      .slice(0, 6),
    [campaigns]
  );

  const slaList = useMemo(() =>
    campaigns
      .filter((c) => {
        const pp = getPreProdDays(c as any);
        return PRE_PROD_STAGES.has(c.status) && pp !== null && pp >= SLA_WARN && !isOverdue(c.endDate);
      })
      .map((c) => ({ ...c, pp: getPreProdDays(c as any)! }))
      .sort((a, b) => b.pp - a.pp)
      .slice(0, 6),
    [campaigns]
  );

  const recent = useMemo(() =>
    [...campaigns]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
      .slice(0, 8),
    [campaigns]
  );

  return (
    <PageContainer title="Dashboard" description="Gestão de campanhas · Mesa Ads">

      {/* ── KPIs de Campanha ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Visão Geral de Campanhas</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Ativas", value: kpis.ativas, sub: "não arquivadas", icon: Package, color: "" },
            { label: "Pré-prod", value: kpis.preProducao, sub: "briefing → aprovação", icon: Layers, color: kpis.preProducao > 0 ? "text-violet-400" : "" },
            { label: "Produção", value: kpis.producao, sub: "produção + distribuição", icon: Printer, color: kpis.producao > 0 ? "text-amber-400" : "" },
            { label: "Veiculação", value: kpis.veiculacao, sub: "campanhas ao vivo", icon: Radio, color: kpis.veiculacao > 0 ? "text-emerald-400" : "" },
            { label: "Atrasadas", value: kpis.atrasadas, sub: "prazo de fim vencido", icon: AlertTriangle, color: kpis.atrasadas > 0 ? "text-red-400" : "" },
            { label: "Risco SLA", value: kpis.riscoSla, sub: "pré-prod ≥ 3 dias", icon: Timer, color: kpis.riscoSla > 0 ? "text-amber-400" : "" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border/30 rounded-lg px-3 py-2 flex flex-col gap-1">
              <div className={`flex items-center gap-1.5 ${color || "text-muted-foreground"}`}>
                <Icon className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wide">{label}</span>
              </div>
              <p className={`text-2xl font-bold leading-none ${color || ""}`}>{isLoading ? "—" : value}</p>
              <p className="text-[9px] text-muted-foreground/60">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Faturamento ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Faturamento</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Faturamento Mensal Projetado</p>
            <p className="text-2xl font-bold font-mono text-emerald-400">
              {isLoading ? "—" : formatCurrency(billing.monthlyTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">soma de todas as campanhas ativas</p>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Faturamento em Veiculação</p>
            <p className="text-2xl font-bold font-mono text-sky-400">
              {isLoading ? "—" : formatCurrency(billing.activeMontly)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">produção + distribuição + veiculação</p>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total em Carteira (contratos)</p>
            <p className="text-2xl font-bold font-mono">
              {isLoading ? "—" : formatCurrency(billing.contractTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">valor total dos contratos vigentes</p>
          </div>
        </div>
      </div>

      {/* ── Pipeline ── */}
      <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Pipeline de Campanhas</p>
            <p className="text-[10px] text-muted-foreground">Volume por etapa do funil</p>
          </div>
        </div>
        <div className="flex items-end gap-2 h-24">
          {PIPELINE_STAGES.map((stage) => {
            const count = pipelineMap[stage.key] || 0;
            const barH = Math.max(6, (count / maxPipeline) * 72);
            const pct = ((count / Math.max(campaigns.filter(c=>c.status!=="archived").length, 1)) * 100).toFixed(0);
            return (
              <div key={stage.key} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-mono font-bold tabular-nums">{isLoading ? "—" : count}</span>
                <div className={`w-full rounded-t ${stage.color} opacity-70 transition-all duration-500`} style={{ height: `${barH}px` }} />
                <span className="text-[9px] text-muted-foreground text-center leading-tight">{stage.label}</span>
                {!isLoading && count > 0 && <span className="text-[9px] text-muted-foreground/50">{pct}%</span>}
              </div>
            );
          })}
        </div>
        <div className="pt-2 border-t border-border/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total no pipeline</span>
          <span className="font-mono font-semibold">{PIPELINE_STAGES.reduce((s, st) => s + (pipelineMap[st.key] || 0), 0)}</span>
        </div>
      </div>

      {/* ── Alertas de atraso ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Campanhas atrasadas */}
        <div className={`rounded-xl border p-4 space-y-2 ${atrasadasList.length > 0 ? "bg-red-500/5 border-red-500/30" : "bg-emerald-500/5 border-emerald-500/20"}`}>
          <div className="flex items-center gap-2">
            {atrasadasList.length > 0
              ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              : <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />}
            <span className={`text-sm font-semibold ${atrasadasList.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {atrasadasList.length > 0 ? `${atrasadasList.length} campanha${atrasadasList.length > 1 ? "s" : ""} atrasada${atrasadasList.length > 1 ? "s" : ""}` : "Nenhuma campanha atrasada"}
            </span>
          </div>
          {atrasadasList.length > 0 && (
            <div className="space-y-1">
              {atrasadasList.map((c) => {
                const daysLate = c.endDate ? Math.floor((Date.now() - new Date(c.endDate + "T23:59:59").getTime()) / 86_400_000) : 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/campanhas/${c.id}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/15 transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />{c.clientName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                      <span className="text-xs font-mono font-bold text-red-400">{daysLate}d</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Risco SLA */}
        <div className={`rounded-xl border p-4 space-y-2 ${slaList.length > 0 ? "bg-amber-500/5 border-amber-500/30" : "bg-emerald-500/5 border-emerald-500/20"}`}>
          <div className="flex items-center gap-2">
            {slaList.length > 0
              ? <Timer className="w-4 h-4 text-amber-400 shrink-0" />
              : <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />}
            <span className={`text-sm font-semibold ${slaList.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {slaList.length > 0 ? `${slaList.length} campanha${slaList.length > 1 ? "s" : ""} em risco SLA` : "Nenhum risco de SLA"}
            </span>
          </div>
          {slaList.length > 0 && (
            <div className="space-y-1">
              {slaList.map((c) => {
                const isCrit = c.pp >= SLA_CRIT;
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/campanhas/${c.id}`)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left group ${isCrit ? "bg-red-500/10 hover:bg-red-500/15" : "bg-amber-500/10 hover:bg-amber-500/15"}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5" />{c.clientName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                      <span className={`text-xs font-mono font-bold ${isCrit ? "text-red-400" : "text-amber-400"}`}>
                        {isCrit ? <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" /> : null}{c.pp}d pré-prod
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Atividade Recente ── */}
      <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Atividade Recente</p>
            <p className="text-[10px] text-muted-foreground">Últimas campanhas atualizadas</p>
          </div>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade</p>
        ) : (
          <div className="space-y-1">
            {recent.map((c) => {
              const actionLabel = ACTION_LABELS[c.status] || `Atualizada → ${STATUS_LABELS[c.status] || c.status}`;
              const overdueFlag = isOverdue(c.endDate) && c.status !== "archived";
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/campanhas/${c.id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group border-b border-border/10 last:border-0"
                >
                  {/* Indicador de cor lateral */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${STATUS_COLORS[c.status]?.split(" ")[0] || "bg-muted"}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      {(c as any).campaignNumber && (
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-muted px-1 rounded">{(c as any).campaignNumber}</span>
                      )}
                    </div>
                    {/* Ação realizada */}
                    <p className="text-[11px] text-foreground/70 font-medium mt-0.5">{actionLabel}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="w-2.5 h-2.5" />{c.clientName}
                      <span className="text-border mx-0.5">·</span>
                      <Calendar className="w-2.5 h-2.5" />{formatRelativeDate((c as any).updatedAt || c.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {overdueFlag && (
                      <span className="text-[10px] text-red-400 font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Atrasada
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

    </PageContainer>
  );
}
