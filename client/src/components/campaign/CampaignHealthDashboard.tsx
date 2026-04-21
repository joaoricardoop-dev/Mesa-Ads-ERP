import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Wallet,
  Clock,
  Target,
  Gauge,
  Building2,
  Users,
  Calendar,
  UserRound,
  Package,
  CircleDollarSign,
  CheckCircle2,
  CircleSlash,
  Info,
} from "lucide-react";

type Props = { campaignId: number };

const STATUS_COLORS: Record<string, string> = {
  concluida: "#10b981",
  ativa: "#3b82f6",
  planejada: "#64748b",
  cancelada: "#ef4444",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  prevista: "Prevista",
  emitida: "Emitida",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}

function fmtMonth(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

function marginHealth(pct: number): { color: string; label: string } {
  if (pct >= 30) return { color: "text-emerald-400", label: "Saudável" };
  if (pct >= 15) return { color: "text-amber-400", label: "Atenção" };
  if (pct > 0) return { color: "text-orange-400", label: "Baixa" };
  return { color: "text-red-400", label: "Crítica" };
}

function dsoHealth(dso: number | null): { color: string; label: string } {
  if (dso === null) return { color: "text-muted-foreground", label: "s/ dados" };
  if (dso <= 15) return { color: "text-emerald-400", label: "Excelente" };
  if (dso <= 30) return { color: "text-amber-400", label: "Normal" };
  return { color: "text-red-400", label: "Alto" };
}

export default function CampaignHealthDashboard({ campaignId }: Props) {
  const { data, isLoading, error } = trpc.campaignPhase.campaignOverview.useQuery(
    { campaignId },
    { enabled: campaignId > 0 },
  );

  const dreWaterfall = useMemo(() => {
    if (!data?.dre) return [];
    const d = data.dre;
    return [
      { name: "Receita", value: d.receita, type: "positive" as const },
      { name: "Impostos", value: -d.impostos, type: "negative" as const },
      {
        name: d.canalTipo === "vip" ? "Repasse VIP" : d.canalTipo === "restaurante" ? "Com. Rest." : "Canal",
        value: -d.canalValor,
        type: "negative" as const,
      },
      { name: "Frete", value: -d.custoFrete, type: "negative" as const },
      { name: "Produção", value: -d.custoProducao, type: "negative" as const },
      { name: "Com. Vendedor", value: -d.sellerCommission, type: "negative" as const },
      { name: "Lucro", value: d.lucroLiquido, type: "total" as const },
    ];
  }, [data]);

  const batchesChart = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.map((t) => {
      const custos = t.custoFrete + t.custoProducao;
      return {
        label: `B${t.sequence}`,
        periodo: fmtMonth(t.periodStart),
        status: t.status,
        receita: t.receita,
        custos,
        lucro: t.lucroLiquido,
        margemPct: t.margemPct,
      };
    });
  }, [data]);

  const cashflowChart = useMemo(() => {
    if (!data?.timeline) return [];
    return data.timeline.map((t) => ({
      label: `B${t.sequence}`,
      periodo: fmtMonth(t.periodStart),
      Previsto: t.invoice?.amount ?? t.receita,
      Faturado: t.invoice && (t.invoice.status === "emitida" || t.invoice.status === "paga") ? t.invoice.amount : 0,
      Recebido: t.invoice && t.invoice.status === "paga" ? t.invoice.amount : 0,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <section className="bg-card border border-border/30 rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 bg-muted rounded"></div>
          <div className="grid grid-cols-4 gap-4">
            {[0,1,2,3].map((i) => <div key={i} className="h-24 bg-muted rounded"></div>)}
          </div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="bg-card border border-border/30 rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="w-4 h-4" /> Não foi possível carregar a saúde da campanha.
        </div>
      </section>
    );
  }

  if (data.empty) {
    return (
      <section className="bg-card border border-border/30 rounded-xl p-6 text-center">
        <CircleSlash className="w-10 h-10 mx-auto text-muted-foreground mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">Sem batches cadastrados. Cadastre ao menos um batch para ver a saúde financeira.</p>
      </section>
    );
  }

  const { campaign, dre, bv, kpis, timeline, alerts } = data;
  const mh = dre ? marginHealth(dre.margemPct) : null;
  const dh = kpis ? dsoHealth(kpis.dsoMedio) : null;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Saúde da Campanha
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visão gerencial consolidada · {timeline.length} batch(es) · canal{" "}
            <span className="font-semibold">
              {dre?.canalTipo === "vip" ? "Sala VIP" : dre?.canalTipo === "restaurante" ? "Restaurante" : "—"}
            </span>
          </p>
        </div>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 4).map((a, i) => {
            const color = a.severity === "danger"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : a.severity === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-blue-500/10 border-blue-500/30 text-blue-400";
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${color}`}>
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{a.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs principais */}
      {kpis && dre && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            icon={Target}
            label="Progresso Operacional"
            primary={`${kpis.progressoOperacional.pct.toFixed(0)}%`}
            secondary={`${kpis.progressoOperacional.concluidas}/${kpis.progressoOperacional.total} batches`}
            progress={kpis.progressoOperacional.pct}
            progressColor="bg-emerald-400"
          />
          <KpiCard
            icon={Wallet}
            label="Faturado"
            primary={formatCurrency(kpis.progressoFinanceiro.faturado)}
            secondary={`${kpis.progressoFinanceiro.pctFaturado.toFixed(0)}% do previsto`}
            progress={kpis.progressoFinanceiro.pctFaturado}
            progressColor="bg-blue-400"
          />
          <KpiCard
            icon={CircleDollarSign}
            label="Recebido"
            primary={formatCurrency(kpis.progressoFinanceiro.recebido)}
            secondary={`${kpis.progressoFinanceiro.pctRecebido.toFixed(0)}% do previsto`}
            progress={kpis.progressoFinanceiro.pctRecebido}
            progressColor="bg-emerald-400"
          />
          <KpiCard
            icon={Gauge}
            label="Margem Consolidada"
            primary={`${dre.margemPct.toFixed(1)}%`}
            secondary={formatCurrency(dre.lucroLiquido)}
            primaryClass={mh?.color}
            badge={mh?.label}
          />
          <KpiCard
            icon={Clock}
            label="DSO Médio"
            primary={kpis.dsoMedio !== null ? `${kpis.dsoMedio.toFixed(0)} dias` : "—"}
            secondary="Emissão → recebimento"
            primaryClass={dh?.color}
            badge={dh?.label}
          />
          <KpiCard
            icon={AlertTriangle}
            label="Inadimplência"
            primary={formatCurrency(kpis.inadimplencia.valor)}
            secondary={`${kpis.inadimplencia.quantidade} fatura(s) vencida(s)`}
            primaryClass={kpis.inadimplencia.quantidade > 0 ? "text-red-400" : "text-emerald-400"}
          />
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DRE Waterfall */}
        {dre && (
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-primary" /> DRE Consolidado
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Σ dos {timeline.length} batches
              </span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dreWaterfall} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                <RechartsTooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number) => formatCurrency(Math.abs(v))}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {dreWaterfall.map((d, i) => (
                    <Cell key={i} fill={
                      d.type === "positive" ? "#3b82f6"
                      : d.type === "negative" ? "#ef4444"
                      : "#10b981"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 text-[11px] mt-2 pt-2 border-t border-border/20">
              <DreMiniLine label="Receita" value={dre.receita} color="text-blue-400" />
              <DreMiniLine label="Base Contribuição" value={dre.baseContribuicao} color="text-foreground" />
              <DreMiniLine label="Lucro Líquido" value={dre.lucroLiquido} color="text-emerald-400" bold />
            </div>
          </div>
        )}

        {/* Receita × Custo × Lucro por batch */}
        <div className="bg-card border border-border/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Performance por Batch
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">receita · custo · margem</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={batchesChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 100]} />
              <RechartsTooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                formatter={(v: number, name: string) =>
                  name === "margemPct" ? `${v.toFixed(1)}%` : formatCurrency(v)
                }
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar yAxisId="left" dataKey="receita" name="Receita" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="custos" name="Custos" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="lucro" name="Lucro" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="margemPct" name="Margem %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Cashflow por batch (previsto × faturado × recebido) */}
        <div className="bg-card border border-border/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" /> Cashflow por Batch
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">previsto · faturado · recebido</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={cashflowChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <RechartsTooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Previsto" fill="#64748b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Faturado" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Recebido" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status dos batches */}
        <div className="bg-card border border-border/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Status dos Batches
            </h3>
          </div>
          <div className="space-y-1.5">
            {timeline.map((t) => {
              const color = STATUS_COLORS[t.status] ?? "#64748b";
              const invStatus = t.invoice?.status;
              const invLabel = invStatus ? INVOICE_STATUS_LABEL[invStatus] ?? invStatus : "sem fatura";
              return (
                <div key={t.phaseId} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded hover:bg-muted/20">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <div className="min-w-[60px] font-semibold tabular-nums">B{t.sequence}</div>
                  <div className="min-w-[80px] text-muted-foreground">{fmtMonth(t.periodStart)}</div>
                  <div className="flex-1 truncate capitalize">{t.status}</div>
                  <div className="tabular-nums text-muted-foreground">{formatCurrency(t.receita)}</div>
                  <Badge variant="outline" className="text-[9px] capitalize">
                    {invLabel}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BV informativo */}
      {bv?.applicable && bv.valor > 0 && (
        <div className="bg-card border border-dashed border-pink-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-pink-400">BV da Campanha <span className="text-[10px] font-normal text-muted-foreground ml-1">(informativo — não deduz)</span></h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <InfoCell label="Parceiro" value={bv.parceiroNome ?? "—"} />
            <InfoCell label="% s/ Faturamento" value={`${bv.percent.toFixed(2)}%`} />
            <InfoCell label="Valor do BV" value={formatCurrency(bv.valor)} highlight />
            <InfoCell label="Total ao cliente" value={formatCurrency(bv.totalCliente)} />
          </div>
        </div>
      )}

      {/* Infos Gerais compactas */}
      <div className="bg-card border border-border/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Informações Gerais</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <InfoCell icon={Building2} label="Cliente" value={campaign.clientName ?? `#${campaign.clientId}`} />
          <InfoCell icon={Package} label="Produto" value={campaign.productName ?? "—"} />
          <InfoCell icon={Users} label="Parceiro" value={campaign.partnerName ?? "—"} />
          <InfoCell icon={Calendar} label="Início" value={fmtDate(campaign.startDate)} />
          <InfoCell icon={Calendar} label="Fim" value={fmtDate(campaign.endDate)} />
          <InfoCell icon={UserRound} label="Responsável" value={campaign.assignedToName ?? "—"} />
        </div>
        {campaign.notes && (
          <div className="mt-3 pt-3 border-t border-border/20">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Observações</div>
            <p className="text-xs whitespace-pre-wrap text-muted-foreground">{campaign.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function KpiCard({
  icon: Icon, label, primary, secondary, progress, progressColor, primaryClass, badge,
}: {
  icon: any; label: string; primary: string; secondary?: string;
  progress?: number; progressColor?: string; primaryClass?: string; badge?: string;
}) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-lg font-bold tabular-nums mt-1 ${primaryClass ?? ""}`}>{primary}</div>
      {secondary && <div className="text-[10px] text-muted-foreground truncate">{secondary}</div>}
      {badge && (
        <div className={`text-[9px] uppercase tracking-wider font-semibold mt-1 ${primaryClass ?? ""}`}>
          {badge}
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-muted/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColor ?? "bg-primary"}`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

function DreMiniLine({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`tabular-nums ${color ?? ""} ${bold ? "font-semibold" : ""}`}>{formatCurrency(value)}</div>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value, highlight }: { icon?: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </div>
      <div className={`text-sm truncate ${highlight ? "font-bold text-pink-400" : "font-medium"}`} title={value}>
        {value}
      </div>
    </div>
  );
}
