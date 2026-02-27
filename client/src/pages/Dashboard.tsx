import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { useLocation } from "wouter";
import {
  ClipboardList,
  Factory,
  Truck,
  Play,
  Radio,
  ArrowRight,
} from "lucide-react";

const STATUS_CARDS = [
  { label: "Cotações Ativas", count: 0, icon: ClipboardList, color: "text-amber-400 bg-amber-500/10", path: "/comercial/cotacoes" },
  { label: "Em Produção", count: 0, icon: Factory, color: "text-yellow-400 bg-yellow-500/10", path: "/campanhas" },
  { label: "Em Trânsito", count: 0, icon: Truck, color: "text-orange-400 bg-orange-500/10", path: "/campanhas" },
  { label: "Executar", count: 0, icon: Play, color: "text-blue-400 bg-blue-500/10", path: "/campanhas" },
  { label: "Em Veiculação", count: 0, icon: Radio, color: "text-emerald-400 bg-emerald-500/10", path: "/campanhas" },
];

const PIPELINE_STAGES = [
  { label: "Cotação", count: 0, color: "bg-amber-500" },
  { label: "Produção", count: 0, color: "bg-yellow-500" },
  { label: "Trânsito", count: 0, color: "bg-orange-500" },
  { label: "Executar", count: 0, color: "bg-blue-500" },
  { label: "Veiculação", count: 0, color: "bg-emerald-500" },
  { label: "Inativa", count: 0, color: "bg-muted" },
];

export default function Dashboard() {
  const [, navigate] = useLocation();

  return (
    <PageContainer title="Dashboard" description="Visão executiva do Mesa Ads">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {STATUS_CARDS.map((card) => {
          const Icon = card.icon;
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
              <p className="font-mono text-2xl font-bold tabular-nums">{card.count}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{card.label}</p>
            </button>
          );
        })}
      </div>

      <Section title="Pipeline" icon={Factory} description="Volume por status no funil de campanhas">
        <div className="flex items-end gap-1 h-16">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.label} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-xs font-mono font-semibold tabular-nums">{stage.count}</span>
              <div className={`w-full rounded-t-sm ${stage.color} opacity-60`} style={{ height: "8px" }} />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{stage.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Atividade Recente" description="Últimos eventos no sistema">
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Nenhuma atividade recente</p>
        </div>
      </Section>
    </PageContainer>
  );
}
