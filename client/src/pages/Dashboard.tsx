import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatCompact } from "@/lib/format";
import { useLocation } from "wouter";
import {
  ClipboardList,
  Factory,
  Truck,
  Play,
  Radio,
  ArrowRight,
  DollarSign,
  TrendingUp,
  Activity,
  Clock,
  FileText,
  Pencil,
  CheckSquare,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useMemo } from "react";

interface StatusCardDef {
  label: string;
  icon: LucideIcon;
  color: string;
  path: string;
  statusKey: string;
}

const STATUS_CARD_DEFS: StatusCardDef[] = [
  { label: "Cotações Ativas", icon: ClipboardList, color: "text-amber-400 bg-amber-500/10", path: "/comercial/cotacoes", statusKey: "quotations_active" },
  { label: "Briefing / Design", icon: FileText, color: "text-violet-400 bg-violet-500/10", path: "/campanhas", statusKey: "briefing_design" },
  { label: "Em Produção Gráf.", icon: Factory, color: "text-yellow-400 bg-yellow-500/10", path: "/campanhas", statusKey: "producao" },
  { label: "Em Distribuição", icon: Truck, color: "text-orange-400 bg-orange-500/10", path: "/campanhas", statusKey: "distribuicao" },
  { label: "Em Veiculação", icon: Radio, color: "text-emerald-400 bg-emerald-500/10", path: "/campanhas", statusKey: "veiculacao" },
];

const PIPELINE_STAGE_DEFS = [
  { label: "Cotação", statusKey: "quotation", color: "bg-amber-500" },
  { label: "Briefing", statusKey: "briefing", color: "bg-violet-500" },
  { label: "Design", statusKey: "design", color: "bg-purple-500" },
  { label: "Aprovação", statusKey: "aprovacao", color: "bg-pink-500" },
  { label: "Produção", statusKey: "producao", color: "bg-yellow-500" },
  { label: "Distribuição", statusKey: "distribuicao", color: "bg-orange-500" },
  { label: "Veiculação", statusKey: "veiculacao", color: "bg-emerald-500" },
  { label: "Inativa", statusKey: "inativa", color: "bg-muted" },
];

function useStatusCounts() {
  const quotationsQuery = trpc.quotation.list.useQuery(undefined, { staleTime: 30000 });
  const campaignsQuery = trpc.campaign.list.useQuery(undefined, { staleTime: 30000 });

  return useMemo(() => {
    const counts: Record<string, number> = {};

    const quotations = quotationsQuery.data || [];
    counts["quotations_active"] = quotations.filter(
      (q) => q.status === "ativa" || q.status === "enviada" || q.status === "rascunho"
    ).length;

    const campaigns = campaignsQuery.data || [];
    const campaignStatusCounts: Record<string, number> = {};
    for (const c of campaigns) {
      campaignStatusCounts[c.status] = (campaignStatusCounts[c.status] || 0) + 1;
    }

    counts["quotation"] = campaignStatusCounts["quotation"] || 0;
    counts["briefing"] = campaignStatusCounts["briefing"] || 0;
    counts["design"] = campaignStatusCounts["design"] || 0;
    counts["aprovacao"] = campaignStatusCounts["aprovacao"] || 0;
    counts["producao"] = campaignStatusCounts["producao"] || 0;
    counts["distribuicao"] = campaignStatusCounts["distribuicao"] || 0;
    counts["transito"] = campaignStatusCounts["transito"] || 0;
    counts["executar"] = campaignStatusCounts["executar"] || 0;
    counts["veiculacao"] = campaignStatusCounts["veiculacao"] || 0;
    counts["inativa"] = campaignStatusCounts["inativa"] || 0;
    counts["active"] = campaignStatusCounts["active"] || 0;
    counts["draft"] = campaignStatusCounts["draft"] || 0;
    counts["completed"] = campaignStatusCounts["completed"] || 0;
    counts["briefing_design"] = (campaignStatusCounts["briefing"] || 0) + (campaignStatusCounts["design"] || 0) + (campaignStatusCounts["aprovacao"] || 0);

    const totalCampaignValue = campaigns.reduce((sum, c) => {
      const price = parseFloat((c as any).fixedPrice || "0");
      return sum + price;
    }, 0);

    const activeCampaigns = campaigns.filter(
      (c) => c.status === "active" || c.status === "veiculacao" || c.status === "producao" ||
             c.status === "transito" || c.status === "executar" || c.status === "briefing" ||
             c.status === "design" || c.status === "aprovacao" || c.status === "distribuicao"
    );

    return {
      counts,
      totalCampaigns: campaigns.length,
      activeCampaigns: activeCampaigns.length,
      totalCampaignValue,
      quotationsTotal: quotations.length,
      quotationsWon: quotations.filter((q) => q.status === "win").length,
      isLoading: quotationsQuery.isLoading || campaignsQuery.isLoading,
    };
  }, [quotationsQuery.data, campaignsQuery.data, quotationsQuery.isLoading, campaignsQuery.isLoading]);
}

function formatRelativeDate(dateStr: string | Date): string {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHr < 24) return `${diffHr}h atrás`;
  if (diffDay < 7) return `${diffDay}d atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { counts, activeCampaigns, totalCampaigns, quotationsTotal, quotationsWon, isLoading } = useStatusCounts();

  const pipelineTotal = PIPELINE_STAGE_DEFS.reduce((sum, s) => sum + (counts[s.statusKey] || 0), 0);
  const maxPipelineCount = Math.max(...PIPELINE_STAGE_DEFS.map((s) => counts[s.statusKey] || 0), 1);

  const conversionRate = quotationsTotal > 0 ? ((quotationsWon / quotationsTotal) * 100).toFixed(1) : "0.0";

  return (
    <PageContainer title="Dashboard" description="Visão executiva do Mesa Ads">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATUS_CARD_DEFS.map((card) => {
          const Icon = card.icon;
          const count = counts[card.statusKey] || 0;
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.path)}
              className="bg-card border border-border/30 rounded-xl p-4 text-left hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="font-mono text-2xl font-bold tabular-nums">
                {isLoading ? "—" : count}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{card.label}</p>
            </button>
          );
        })}
      </div>

      <Section title="Pipeline" icon={Factory} description="Volume por status no funil de campanhas">
        <div className="flex items-end gap-1 h-24 overflow-x-auto scrollbar-hide">
          {PIPELINE_STAGE_DEFS.map((stage) => {
            const count = counts[stage.statusKey] || 0;
            const barHeight = maxPipelineCount > 0 ? Math.max(8, (count / maxPipelineCount) * 60) : 8;
            return (
              <div key={stage.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs font-mono font-semibold tabular-nums">
                  {isLoading ? "—" : count}
                </span>
                <div
                  className={`w-full rounded-t-sm ${stage.color} opacity-60 transition-all duration-500`}
                  style={{ height: `${barHeight}px` }}
                />
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{stage.label}</span>
              </div>
            );
          })}
        </div>
        {!isLoading && (
          <div className="mt-3 pt-3 border-t border-border/20 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total no pipeline</span>
            <span className="text-sm font-mono font-semibold">{pipelineTotal}</span>
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-card border border-border/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">Campanhas Ativas</span>
          </div>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {isLoading ? "—" : activeCampaigns}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            de {isLoading ? "—" : totalCampaigns} total
          </p>
        </div>

        <div className="bg-card border border-border/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-sm font-semibold">Taxa de Conversão</span>
          </div>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {isLoading ? "—" : `${conversionRate}%`}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {isLoading ? "—" : `${quotationsWon} wins de ${quotationsTotal} cotações`}
          </p>
        </div>

        <div className="bg-card border border-border/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <span className="text-sm font-semibold">Projeções</span>
          </div>
          <p className="font-mono text-2xl font-bold tabular-nums">
            {isLoading ? "—" : activeCampaigns}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            campanhas gerando receita
          </p>
        </div>
      </div>

      <SlaAlerts />

      <RecentActivity />
    </PageContainer>
  );
}

function SlaAlerts() {
  const campaignsQuery = trpc.campaign.list.useQuery(undefined, { staleTime: 30000 });
  const soQuery = trpc.serviceOrder.list.useQuery({ type: "distribuicao" }, { staleTime: 30000 });
  const [, navigate] = useLocation();

  const { staleCampaigns, lateFreight } = useMemo(() => {
    const now = Date.now();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const SLA_THRESHOLD = 5;

    const staleCampaigns = (campaignsQuery.data || [])
      .filter(c => ["briefing", "design", "aprovacao"].includes(c.status))
      .map(c => {
        const ref = (c as any).proposalSignedAt ? new Date((c as any).proposalSignedAt) : new Date(c.createdAt);
        const days = Math.floor((now - ref.getTime()) / MS_PER_DAY);
        return { ...c, staleDays: days };
      })
      .filter(c => c.staleDays > SLA_THRESHOLD)
      .sort((a, b) => b.staleDays - a.staleDays);

    const today = new Date().toISOString().split("T")[0];
    const lateFreight = (soQuery.data || [])
      .filter(s => (s as any).freightExpectedDate && (s as any).freightExpectedDate < today)
      .map(s => {
        const days = Math.floor((now - new Date((s as any).freightExpectedDate).getTime()) / MS_PER_DAY);
        return { ...s, lateDays: days };
      })
      .sort((a, b) => b.lateDays - a.lateDays);

    return { staleCampaigns, lateFreight };
  }, [campaignsQuery.data, soQuery.data]);

  const total = staleCampaigns.length + lateFreight.length;
  if (total === 0) return null;

  const stageLabels: Record<string, string> = { briefing: "Briefing", design: "Design", aprovacao: "Aprovação" };

  return (
    <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-red-400">Alertas SLA — {total} item{total !== 1 ? "s" : ""} requer{total === 1 ? "" : "em"} atenção</span>
      </div>

      {staleCampaigns.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pipeline parado (&gt;5 dias)</p>
          {staleCampaigns.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/campanhas/${c.id}`)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-red-500/10 hover:bg-red-500/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate">{c.name}</span>
                {(c as any).campaignNumber && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{(c as any).campaignNumber}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">
                  {stageLabels[c.status] || c.status}
                </span>
                <span className="text-xs font-mono font-semibold text-red-400">{c.staleDays}d</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {lateFreight.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Frete em atraso</p>
          {lateFreight.map(s => (
            <div
              key={s.id}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-orange-500/10 border border-orange-500/20"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-muted-foreground shrink-0">{s.orderNumber}</span>
                <span className="text-xs truncate">{s.campaignName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(s as any).freightProvider && (
                  <span className="text-[10px] text-muted-foreground">{(s as any).freightProvider}</span>
                )}
                <span className="text-xs font-mono font-semibold text-orange-400">{s.lateDays}d atraso</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentActivity() {
  const campaignsQuery = trpc.campaign.list.useQuery(undefined, { staleTime: 30000 });

  const recentCampaigns = useMemo(() => {
    if (!campaignsQuery.data) return [];
    return [...campaignsQuery.data]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [campaignsQuery.data]);

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    quotation: "Cotação",
    briefing: "Briefing",
    design: "Design",
    aprovacao: "Aprovação",
    active: "Ativa",
    producao: "Produção",
    distribuicao: "Distribuição",
    transito: "Trânsito",
    executar: "Executar",
    veiculacao: "Veiculação",
    inativa: "Inativa",
    paused: "Pausada",
    completed: "Concluída",
    archived: "Arquivada",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    quotation: "bg-amber-500/20 text-amber-400",
    briefing: "bg-violet-500/20 text-violet-400",
    design: "bg-purple-500/20 text-purple-400",
    aprovacao: "bg-pink-500/20 text-pink-400",
    active: "bg-emerald-500/20 text-emerald-400",
    producao: "bg-yellow-500/20 text-yellow-400",
    distribuicao: "bg-orange-500/20 text-orange-400",
    transito: "bg-orange-500/20 text-orange-400",
    executar: "bg-blue-500/20 text-blue-400",
    veiculacao: "bg-emerald-500/20 text-emerald-400",
    inativa: "bg-muted text-muted-foreground",
    paused: "bg-red-500/20 text-red-400",
    completed: "bg-purple-500/20 text-purple-400",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <Section title="Atividade Recente" icon={Clock} description="Últimas campanhas criadas ou atualizadas">
      {recentCampaigns.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentCampaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => window.location.assign(`/campanhas/${campaign.id}`)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{campaign.name}</span>
                  {(campaign as any).campaignNumber && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {(campaign as any).campaignNumber}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatRelativeDate(campaign.createdAt)}
                </p>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[campaign.status] || "bg-muted text-muted-foreground"}`}
              >
                {statusLabels[campaign.status] || campaign.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
