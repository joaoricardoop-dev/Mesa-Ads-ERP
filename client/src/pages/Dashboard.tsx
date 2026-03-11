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
  { label: "Em Produção", icon: Factory, color: "text-yellow-400 bg-yellow-500/10", path: "/campanhas", statusKey: "producao" },
  { label: "Em Trânsito", icon: Truck, color: "text-orange-400 bg-orange-500/10", path: "/campanhas", statusKey: "transito" },
  { label: "Executar", icon: Play, color: "text-blue-400 bg-blue-500/10", path: "/campanhas", statusKey: "executar" },
  { label: "Em Veiculação", icon: Radio, color: "text-emerald-400 bg-emerald-500/10", path: "/campanhas", statusKey: "veiculacao" },
];

const PIPELINE_STAGE_DEFS = [
  { label: "Cotação", statusKey: "quotation", color: "bg-amber-500" },
  { label: "Produção", statusKey: "producao", color: "bg-yellow-500" },
  { label: "Trânsito", statusKey: "transito", color: "bg-orange-500" },
  { label: "Executar", statusKey: "executar", color: "bg-blue-500" },
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
    counts["producao"] = campaignStatusCounts["producao"] || 0;
    counts["transito"] = campaignStatusCounts["transito"] || 0;
    counts["executar"] = campaignStatusCounts["executar"] || 0;
    counts["veiculacao"] = campaignStatusCounts["veiculacao"] || 0;
    counts["inativa"] = campaignStatusCounts["inativa"] || 0;
    counts["active"] = campaignStatusCounts["active"] || 0;
    counts["draft"] = campaignStatusCounts["draft"] || 0;
    counts["completed"] = campaignStatusCounts["completed"] || 0;

    const totalCampaignValue = campaigns.reduce((sum, c) => {
      const price = parseFloat((c as any).fixedPrice || "0");
      return sum + price;
    }, 0);

    const activeCampaigns = campaigns.filter(
      (c) => c.status === "active" || c.status === "veiculacao" || c.status === "producao" || c.status === "transito" || c.status === "executar"
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

      <RecentActivity />
    </PageContainer>
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
    active: "Ativa",
    producao: "Produção",
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
    active: "bg-emerald-500/20 text-emerald-400",
    producao: "bg-yellow-500/20 text-yellow-400",
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
