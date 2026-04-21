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
  FileText,
  Factory,
  Truck,
  Receipt,
  TrendingUpIcon,
  Crown,
  Utensils,
  Target,
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

  const { campaign, dre, bv, kpis, timeline } = data;
  const alerts = data.alerts ?? [];
  const mh = dre ? marginHealth(dre.margemPct) : null;

  // Duração efetiva = nº de batches não-cancelados (cada batch = 1 mês)
  const batchesAtivos = timeline.filter((t) => t.status !== "cancelada").length;
  const duracao = Math.max(1, batchesAtivos || campaign.contractDuration || timeline.length);

  // Per-mês (médio sobre os batches ativos)
  const receitaMensal = dre ? dre.receita / duracao : 0;
  const lucroMensal = dre ? dre.lucroLiquido / duracao : 0;
  const impostosMensal = dre ? dre.impostos / duracao : 0;
  const canalMensal = dre ? dre.canalValor / duracao : 0;
  const producaoMensal = dre ? dre.custoProducao / duracao : 0;
  const freteMensal = dre ? dre.custoFrete / duracao : 0;
  const sellerMensal = dre ? dre.sellerCommission / duracao : 0;

  // Labels do canal
  const canalLabel = dre?.canalTipo === "vip" ? "Repasse Sala VIP"
    : dre?.canalTipo === "restaurante" ? "Com. Restaurante"
    : "Canal";
  const canalIcon = dre?.canalTipo === "vip" ? Crown : Utensils;

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

        {/* Progresso operacional — barra compacta no header */}
        {kpis && (
          <div className="min-w-[280px]">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Progresso Operacional</span>
              <span className="font-semibold text-foreground">
                {kpis.progressoOperacional.concluidas}/{kpis.progressoOperacional.total} batches
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${Math.max(0, Math.min(100, kpis.progressoOperacional.pct))}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 text-right">
              {kpis.progressoOperacional.pct.toFixed(0)}% concluído
            </div>
          </div>
        )}
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

      {/* ── LINHA 1 — Visão do deal ───────────────────────────────────────── */}
      {dre && kpis && (
        <>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Visão do Contrato
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={FileText}
              label="Valor do Contrato"
              primary={formatCurrency(dre.receita)}
              secondary={`${duracao} ${duracao === 1 ? "mês" : "meses"}`}
              accent="text-blue-400"
            />
            <KpiCard
              icon={Calendar}
              label="Valor / mês"
              primary={formatCurrency(receitaMensal)}
              secondary="Receita média mensal"
            />
            <KpiCard
              icon={TrendingUpIcon}
              label="Lucro / mês"
              primary={formatCurrency(lucroMensal)}
              secondary="Resultado médio mensal"
              accent={lucroMensal >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <KpiCard
              icon={Gauge}
              label="Margem"
              primary={`${dre.margemPct.toFixed(1)}%`}
              secondary={formatCurrency(dre.lucroLiquido) + " total"}
              accent={mh?.color}
              badge={mh?.label}
            />
            <KpiCard
              icon={Wallet}
              label="Faturado"
              primary={formatCurrency(kpis.progressoFinanceiro.faturado)}
              secondary={`${kpis.progressoFinanceiro.pctFaturado.toFixed(0)}% do contrato`}
              progress={kpis.progressoFinanceiro.pctFaturado}
              progressColor="bg-blue-400"
            />
            <KpiCard
              icon={CircleDollarSign}
              label="Recebido"
              primary={formatCurrency(kpis.progressoFinanceiro.recebido)}
              secondary={`${kpis.progressoFinanceiro.pctRecebido.toFixed(0)}% do contrato`}
              progress={kpis.progressoFinanceiro.pctRecebido}
              progressColor="bg-emerald-400"
            />
          </div>

          {/* ── LINHA 2 — Deduções e repasses ──────────────────────────────── */}
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1 pt-2">
            Deduções e Repasses
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={Receipt}
              label="Impostos"
              primary={formatCurrency(dre.impostos)}
              secondary={`${formatCurrency(impostosMensal)}/mês`}
              accent="text-red-400"
            />
            <KpiCard
              icon={canalIcon}
              label={canalLabel}
              primary={formatCurrency(dre.canalValor)}
              secondary={`${formatCurrency(canalMensal)}/mês`}
              accent={dre.canalTipo === "vip" ? "text-violet-400" : "text-orange-400"}
            />
            <KpiCard
              icon={Factory}
              label="Custo Produção"
              primary={formatCurrency(dre.custoProducao)}
              secondary={`${formatCurrency(producaoMensal)}/mês`}
              accent="text-emerald-400"
            />
            <KpiCard
              icon={Truck}
              label="Custo Frete"
              primary={formatCurrency(dre.custoFrete)}
              secondary={`${formatCurrency(freteMensal)}/mês`}
              accent="text-cyan-400"
            />
            <KpiCard
              icon={UserRound}
              label="Com. Vendedor"
              primary={formatCurrency(dre.sellerCommission)}
              secondary={`${formatCurrency(sellerMensal)}/mês`}
              accent="text-slate-400"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Inadimplência"
              primary={formatCurrency(kpis.inadimplencia.valor)}
              secondary={`${kpis.inadimplencia.quantidade} fatura(s) vencida(s)`}
              accent={kpis.inadimplencia.quantidade > 0 ? "text-red-400" : "text-emerald-400"}
            />
          </div>
        </>
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

        {/* Performance por Batch */}
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
      </div>

      {/* Status dos batches — full width agora que removemos cashflow */}
      <div className="bg-card border border-border/30 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Status dos Batches
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            progresso operacional + financeiro por batch
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2 pr-3 font-semibold">Batch</th>
                <th className="text-left py-2 pr-3 font-semibold">Período</th>
                <th className="text-left py-2 pr-3 font-semibold">Status</th>
                <th className="text-right py-2 pr-3 font-semibold">Receita</th>
                <th className="text-right py-2 pr-3 font-semibold">Lucro</th>
                <th className="text-right py-2 pr-3 font-semibold">Margem</th>
                <th className="text-center py-2 pr-3 font-semibold">Fatura</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t) => {
                const color = STATUS_COLORS[t.status] ?? "#64748b";
                const invStatus = t.invoice?.status;
                const invLabel = invStatus ? INVOICE_STATUS_LABEL[invStatus] ?? invStatus : "sem fatura";
                const mhRow = marginHealth(t.margemPct);
                return (
                  <tr key={t.phaseId} className="border-b border-border/10 hover:bg-muted/20">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="font-semibold tabular-nums">B{t.sequence}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{fmtMonth(t.periodStart)}</td>
                    <td className="py-2 pr-3 capitalize">{t.status}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(t.receita)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {formatCurrency(t.lucroLiquido)}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${mhRow.color}`}>
                      {t.margemPct.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <Badge variant="outline" className="text-[9px] capitalize">{invLabel}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BV informativo */}
      {bv?.applicable && bv.valor > 0 && (
        <div className="bg-card border border-dashed border-pink-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-semibold text-pink-400">
              BV da Campanha{" "}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                (informativo — não deduz)
              </span>
            </h3>
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
  icon: Icon, label, primary, secondary, progress, progressColor, accent, badge,
}: {
  icon: any;
  label: string;
  primary: string;
  secondary?: string;
  progress?: number;
  progressColor?: string;
  accent?: string;
  badge?: string;
}) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="w-3 h-3 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-base sm:text-lg font-bold tabular-nums mt-1 truncate ${accent ?? ""}`}>
        {primary}
      </div>
      {secondary && (
        <div className="text-[10px] text-muted-foreground truncate" title={secondary}>
          {secondary}
        </div>
      )}
      {badge && (
        <div className={`text-[9px] uppercase tracking-wider font-semibold mt-1 ${accent ?? ""}`}>
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
