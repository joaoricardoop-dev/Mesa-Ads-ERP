import PageContainer from "@/components/PageContainer";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle2,
  HandCoins, ChevronRight, Receipt, BarChart3, DollarSign, Percent,
  Users, ArrowUpRight, ArrowDownRight, Minus, FileText,
  Target, Zap, AlertCircle, Info, PieChart, Filter, Hourglass,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function monthLabel(m: string): string {
  const [, mo] = m.split("-");
  return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][parseInt(mo,10)-1] || mo;
}

function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}

function GrowthIndicator({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pct = (value * 100).toFixed(1);
  if (value > 0.02) return <span className="inline-flex items-center gap-0.5 text-xs text-emerald-400 font-medium"><ArrowUpRight className="w-3 h-3" />+{pct}%</span>;
  if (value < -0.02) return <span className="inline-flex items-center gap-0.5 text-xs text-red-400 font-medium"><ArrowDownRight className="w-3 h-3" />{pct}%</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/60"><Minus className="w-3 h-3" />{pct}%</span>;
}

function DreRow({
  label, value, pct, bold, indent, separator, positive, negative,
}: {
  label: string; value: number; pct?: number; bold?: boolean;
  indent?: boolean; separator?: boolean; positive?: boolean; negative?: boolean;
}) {
  const valueColor = positive ? "text-emerald-400" : negative ? "text-red-400" : "";
  return (
    <>
      {separator && <div className="border-t border-border/20 my-1.5" />}
      <div className={`flex items-center justify-between py-2 px-4 rounded-lg ${bold ? "bg-white/[0.03]" : ""}`}>
        <span className={`text-sm ${indent ? "pl-5 text-muted-foreground" : ""} ${bold ? "font-semibold" : ""}`}>{label}</span>
        <div className="flex items-center gap-5">
          {pct != null && <span className="text-xs text-muted-foreground/60 font-mono w-14 text-right">{pct.toFixed(1)}%</span>}
          <span className={`text-sm font-mono font-semibold w-32 text-right ${valueColor}`}>{formatCurrency(value)}</span>
        </div>
      </div>
    </>
  );
}

const TABS = ["Executivo", "DRE", "Faturamento", "Eficiência", "Clientes"] as const;
type Tab = typeof TABS[number];

export default function FinancialDashboard() {
  const { data, isLoading } = trpc.financial.dashboard.useQuery();
  const { data: exp, isLoading: expLoading } = trpc.financial.dashboardExpanded.useQuery();
  const { data: aging } = trpc.financial.delinquency.useQuery();
  const { data: dsoData } = trpc.financial.dso.useQuery();
  const { data: funnel } = trpc.financial.funnel.useQuery();
  const { data: prefs } = trpc.financial.getUserPreferences.useQuery(undefined, { staleTime: 0 });
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("Executivo");
  const [dreRegimeOverride, setDreRegimeOverride] = useState<"competencia" | "caixa" | null>(null);
  const dreRegime: "competencia" | "caixa" = dreRegimeOverride ?? prefs?.dreRegime ?? "competencia";
  const setDreRegime = (r: "competencia" | "caixa") => setDreRegimeOverride(r);

  const utils = trpc.useUtils();
  const setRegimeMut = trpc.financial.setDrePreference.useMutation({
    onSuccess: () => utils.financial.getUserPreferences.invalidate(),
  });

  const { data: dreDual } = trpc.financial.dre.useQuery({ regime: dreRegime });

  const loading = isLoading || expLoading;

  if (loading) {
    return (
      <PageContainer title="Financeiro">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  const overdue = data?.overdue || 0;
  const receivables = data?.receivables || 0;
  const invoicedThisMonth = data?.invoicedThisMonth || 0;
  const revenue = data?.revenue || 0;
  const pendingRp = data?.pendingRestaurantPayments || 0;
  const activeCampaigns = data?.activeCampaigns || 0;

  const ytd = exp?.ytd;
  const currMonth = exp?.currMonth;
  const prevMonthData = exp?.prevMonth;
  const growth = exp?.growth;
  const dre = exp?.dre;
  const quot = exp?.quotations;
  const topClients = exp?.topClients || [];
  const monthlySeries = (exp?.monthlySeries || []).map(m => ({
    month: monthLabel(m.month),
    Faturado: m.invoiced,
    Recebido: m.received,
    "Com. Rest.": m.rpCosts,
  }));

  const alerts: { type: "warn" | "danger" | "info"; title: string; desc: string }[] = [];
  if (overdue > 0) alerts.push({ type: "danger", title: `Inadimplência: ${formatCurrency(overdue)}`, desc: `${data?.overdueCount || 0} fatura${(data?.overdueCount || 0) !== 1 ? "s" : ""} vencida${(data?.overdueCount || 0) !== 1 ? "s" : ""} sem pagamento.` });
  if (growth?.invoiced != null && growth.invoiced < -0.1) alerts.push({ type: "danger", title: "Queda de faturamento", desc: `Faturamento este mês está ${Math.abs(growth.invoiced * 100).toFixed(1)}% abaixo do mês anterior.` });
  if (currMonth && currMonth.grossMargin < 0.2 && currMonth.invoiced > 0) alerts.push({ type: "warn", title: "Margem bruta abaixo de 20%", desc: `Margem atual: ${fmtPct(currMonth.grossMargin)}. Revise custos e descontos.` });
  if (quot && quot.avgDiscountPercent > 10) alerts.push({ type: "warn", title: `Desconto médio elevado: ${quot.avgDiscountPercent.toFixed(1)}%`, desc: "O desconto médio concedido nas cotações ganhas está acima de 10%." });
  if (quot && quot.conversionRate < 0.4 && quot.totalClosed > 3) alerts.push({ type: "warn", title: `Taxa de conversão baixa: ${fmtPct(quot.conversionRate)}`, desc: `Apenas ${quot.won.count} de ${quot.totalClosed} cotações fechadas foram ganhas.` });
  if (pendingRp > 20000) alerts.push({ type: "warn", title: "Pagamentos pendentes a restaurantes", desc: `${formatCurrency(pendingRp)} aguardando pagamento — pode impactar relacionamentos.` });
  if (topClients.length > 0) {
    const topRevenue = topClients[0]?.total || 0;
    const totalReceived = ytd?.received || 0;
    if (totalReceived > 0 && topRevenue / totalReceived > 0.5) {
      alerts.push({ type: "warn", title: "Alta concentração em 1 cliente", desc: `O maior cliente representa ${((topRevenue / totalReceived) * 100).toFixed(0)}% da receita recebida.` });
    }
  }
  if (receivables > invoicedThisMonth * 2 && invoicedThisMonth > 0) alerts.push({ type: "info", title: "Volume alto a receber", desc: `${formatCurrency(receivables)} em faturas abertas — acompanhe os vencimentos.` });

  const chartStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

  const grossMarginOk = (currMonth?.grossMargin || 0) >= 0.3;

  return (
    <PageContainer title="Financeiro" description="Painel de gestão financeira">

      <div className="flex items-center gap-1 border-b border-border/20 pb-0 -mt-2 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Executivo" && (
        <div className="space-y-8">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/20 bg-gradient-to-br from-violet-500/10 via-card to-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-violet-400" />
                <span className="text-xs text-muted-foreground font-medium">Receita Total</span>
              </div>
              <div className="flex items-end gap-3 mb-1">
                <span className="text-3xl font-bold tracking-tight">{formatCurrency(invoicedThisMonth)}</span>
                <GrowthIndicator value={growth?.invoiced} />
              </div>
              <p className="text-xs text-muted-foreground/60">
                faturamento bruto do mês · vs mês anterior: {formatCurrency(prevMonthData?.invoiced || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-border/20 bg-gradient-to-br from-red-500/10 via-card to-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-muted-foreground font-medium">Custos</span>
              </div>
              <span className="text-3xl font-bold tracking-tight">{formatCurrency(data?.totalCosts || 0)}</span>
              <p className="text-xs text-muted-foreground/60 mt-1">produção + frete + comissões/repasses</p>
            </div>

            <div className={`rounded-2xl border border-border/20 p-6 ${grossMarginOk ? "bg-gradient-to-br from-emerald-500/10 via-card to-card" : "bg-gradient-to-br from-amber-500/10 via-card to-card"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Percent className="w-4 h-4" style={{ color: grossMarginOk ? "rgb(52 211 153)" : "rgb(251 191 36)" }} />
                <span className="text-xs text-muted-foreground font-medium">Margem</span>
              </div>
              <span className="text-3xl font-bold tracking-tight">{fmtPct(currMonth?.grossMargin)}</span>
              <p className="text-xs text-muted-foreground/60 mt-1">Lucro: {formatCurrency(currMonth?.grossProfit || 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "A Receber", value: formatCurrency(receivables), sub: `${data?.receivablesCount || 0} faturas`, icon: Clock, accent: "amber", path: "/financeiro/faturamento" },
              { label: "Inadimplente", value: formatCurrency(overdue), sub: `${data?.overdueCount || 0} vencidas`, icon: AlertTriangle, accent: overdue > 0 ? "red" : "zinc", path: "/financeiro/faturamento" },
              { label: "Contas a Pagar", value: formatCurrency(pendingRp), sub: `${data?.pendingRestaurantCount || 0} pendentes`, icon: HandCoins, accent: pendingRp > 0 ? "orange" : "zinc", path: "/financeiro/contas-pagar" },
              { label: "Campanhas Ativas", value: String(activeCampaigns), sub: "em execução", icon: Target, accent: "blue", path: "/campanhas" },
            ].map(item => {
              const accentColors: Record<string, string> = {
                amber: "text-amber-400", red: "text-red-400", orange: "text-orange-400", blue: "text-blue-400", zinc: "text-muted-foreground",
              };
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="group text-left rounded-xl border border-border/20 bg-card hover:bg-white/[0.03] transition-all p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <item.icon className={`w-4 h-4 ${accentColors[item.accent]}`} />
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  </div>
                  <p className="text-lg font-bold tracking-tight">{item.value}</p>
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground/50">{item.sub}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-border/20 bg-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Faturado vs Recebido</span>
                <span className="text-[10px] text-muted-foreground ml-auto">últimos 6 meses</span>
              </div>
              {(data?.monthlyData || []).some(d => d.invoiced > 0 || d.received > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={(data?.monthlyData || []).map(m => ({ month: monthLabel(m.month), Faturado: m.invoiced, Recebido: m.received }))} barCategoryGap="30%" barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n]} contentStyle={chartStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="Faturado" fill="hsl(262,83%,58%)" radius={[4,4,0,0]} />
                    <Bar dataKey="Recebido" fill="hsl(152,70%,45%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">Nenhuma fatura emitida ainda</div>
              )}
            </div>

            <div className="rounded-2xl border border-border/20 bg-card p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Situação das Faturas</span>
              </div>
              <div className="space-y-4 flex-1">
                {[
                  { key: "paga", label: "Pagas", color: "bg-emerald-400", tc: "text-emerald-400" },
                  { key: "emitida", label: "Em aberto", color: "bg-amber-400", tc: "text-amber-400" },
                  { key: "vencida_calc", label: "Vencidas", color: "bg-red-400", tc: "text-red-400", isOverdue: true },
                  { key: "cancelada", label: "Canceladas", color: "bg-zinc-500", tc: "text-zinc-500" },
                ].map(item => {
                  const d = item.isOverdue
                    ? { count: data?.overdueCount || 0, total: overdue }
                    : (data?.invoiceStatusSummary?.[item.key] || { count: 0, total: 0 });
                  if (!d.count && !item.isOverdue) return null;
                  return (
                    <div key={item.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <div>
                          <p className="text-xs font-medium">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground/50">{d.count} faturas</p>
                        </div>
                      </div>
                      <p className={`text-sm font-mono font-semibold ${item.tc}`}>{formatCurrency(d.total)}</p>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs mt-4 rounded-lg" onClick={() => navigate("/financeiro/faturamento")}>
                Ver faturas <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Alertas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {alerts.map((a, i) => {
                  const cfg = {
                    warn: { border: "border-amber-500/20", bg: "bg-amber-500/5", icon: AlertTriangle, color: "text-amber-400" },
                    danger: { border: "border-red-500/20", bg: "bg-red-500/5", icon: AlertCircle, color: "text-red-400" },
                    info: { border: "border-blue-500/20", bg: "bg-blue-500/5", icon: Info, color: "text-blue-400" },
                  }[a.type];
                  return (
                    <div key={i} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cfg.border} ${cfg.bg}`}>
                      <cfg.icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div>
                        <p className={`text-xs font-semibold ${cfg.color}`}>{a.title}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{a.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Próximos vencimentos</span>
                </div>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-muted-foreground" onClick={() => navigate("/financeiro/faturamento")}>
                  Ver todas <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
              {(data?.upcomingInvoices || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                  <CheckCircle2 className="w-8 h-8 opacity-15" />
                  <p className="text-xs">Nenhum vencimento nos próximos 30 dias</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(data?.upcomingInvoices || []).slice(0, 5).map(inv => {
                    const days = daysUntil(inv.dueDate);
                    const urgent = days <= 5;
                    return (
                      <div key={inv.id} className={`flex items-center justify-between p-3 rounded-xl border ${urgent ? "border-red-500/20 bg-red-500/5" : "border-border/10 bg-white/[0.02]"}`}>
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-medium truncate">{inv.clientName}</p>
                          <p className="text-[10px] text-muted-foreground/50 truncate">{inv.campaignName} · {inv.invoiceNumber}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono font-semibold">{formatCurrency(parseFloat(inv.amount))}</p>
                          <p className={`text-[10px] ${urgent ? "text-red-400" : "text-amber-400"}`}>
                            {days === 0 ? "Vence hoje" : days === 1 ? "Amanhã" : `${days}d · ${fmtDate(inv.dueDate)}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/20 bg-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Acesso Rápido</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Faturamento", desc: "Emitir e gerenciar", icon: Receipt, accent: "text-violet-400", bg: "bg-violet-500/10", path: "/financeiro/faturamento", badge: data?.receivablesCount },
                  { label: "Pagamentos", desc: "Comissões restaurantes", icon: HandCoins, accent: "text-orange-400", bg: "bg-orange-500/10", path: "/financeiro/pagamentos", badge: data?.pendingRestaurantCount },
                  { label: "Custos", desc: "Produção e frete", icon: TrendingDown, accent: "text-blue-400", bg: "bg-blue-500/10", path: "/financeiro/custos", badge: null },
                  { label: "Relatórios", desc: "Análise por período", icon: BarChart3, accent: "text-emerald-400", bg: "bg-emerald-500/10", path: "/financeiro/relatorios", badge: null },
                  { label: "Comissão Parceiros", desc: "Relatório de comissão", icon: Users, accent: "text-purple-400", bg: "bg-purple-500/10", path: "/financeiro/comissao-parceiros", badge: null },
                ].map(item => (
                  <button key={item.label} onClick={() => navigate(item.path)} className="relative flex flex-col gap-3 p-4 rounded-xl border border-border/10 hover:bg-white/[0.03] hover:border-border/30 transition-all text-left group">
                    {item.badge ? <span className="absolute top-3 right-3 bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{item.badge}</span> : null}
                    <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                      <item.icon className={`w-4 h-4 ${item.accent}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground/50">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── KPIs Finrefac #7: DSO + Inadimplência (aging) + Funil ──── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/20 bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Hourglass className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold">DSO — Days Sales Outstanding</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight">{(dsoData?.currentDso || 0).toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">dias</span>
                {dsoData?.trend != null && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${dsoData.trend > 0.05 ? "text-red-400" : dsoData.trend < -0.05 ? "text-emerald-400" : "text-muted-foreground/60"}`}>
                    {dsoData.trend > 0.05 ? <ArrowUpRight className="w-3 h-3" /> : dsoData.trend < -0.05 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {(dsoData.trend * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-2">
                Média emissão→recebimento (últimos 90d · {dsoData?.currentSampleSize || 0} faturas)
              </p>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                Período anterior: {(dsoData?.previousDso || 0).toFixed(1)} dias
              </p>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card p-6 lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold">Inadimplência por Aging</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  Total: {formatCurrency(aging?.totalAmount || 0)} · {aging?.totalCount || 0} faturas
                </span>
              </div>
              {(aging?.totalCount || 0) === 0 ? (
                <div className="flex items-center justify-center h-20 gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400/60" />
                  <p className="text-xs">Nenhuma fatura vencida</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {(["0-30", "30-60", "60-90", "90+"] as const).map((b, idx) => {
                    const bucket = aging?.buckets?.[b] || { count: 0, total: 0 };
                    const colors = ["bg-amber-400", "bg-orange-400", "bg-red-400", "bg-red-500"];
                    const tcolor = ["text-amber-400", "text-orange-400", "text-red-400", "text-red-500"];
                    return (
                      <div key={b} className="rounded-xl bg-white/[0.02] border border-border/10 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${colors[idx]}`} />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{b} dias</span>
                        </div>
                        <p className={`text-base font-bold font-mono ${tcolor[idx]}`}>{formatCurrency(bucket.total)}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{bucket.count} faturas</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Funil — Cotação → Fatura → Recebido</span>
              <span className="text-xs text-muted-foreground ml-auto">YTD</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-5">Conversão por etapa do pipeline financeiro</p>
            {(() => {
              const stages = [
                { key: "sent",     label: "Cotações",        value: funnel?.sent.total || 0,     count: funnel?.sent.count || 0,     color: "bg-blue-400",    tcolor: "text-blue-400" },
                { key: "won",      label: "Cotações Ganhas", value: funnel?.won.total || 0,      count: funnel?.won.count || 0,      color: "bg-violet-400",  tcolor: "text-violet-400" },
                { key: "invoiced", label: "Faturas Emitidas",value: funnel?.invoiced.total || 0, count: funnel?.invoiced.count || 0, color: "bg-amber-400",   tcolor: "text-amber-400" },
                { key: "received", label: "Faturas Pagas",   value: funnel?.received.total || 0, count: funnel?.received.count || 0, color: "bg-emerald-400", tcolor: "text-emerald-400" },
              ];
              const max = Math.max(...stages.map(s => s.value), 1);
              const hasAny = stages.some(s => s.value > 0 || s.count > 0);
              if (!hasAny) {
                return <p className="text-sm text-muted-foreground py-4">Sem dados de pipeline ainda.</p>;
              }
              return (
                <div className="space-y-3 max-w-2xl">
                  {stages.map((s, i) => {
                    const w = (s.value / max) * 100;
                    const prev = i > 0 ? stages[i - 1].value : null;
                    const conv = prev && prev > 0 ? (s.value / prev) * 100 : null;
                    return (
                      <div key={s.key}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${s.color}`} />
                            <span className="text-muted-foreground">{s.label}</span>
                            {conv != null && (
                              <span className="text-[10px] text-muted-foreground/50">→ {conv.toFixed(0)}% da etapa anterior</span>
                            )}
                          </div>
                          <span className="font-mono">
                            <span className={`font-semibold ${s.tcolor}`}>{formatCurrency(s.value)}</span>
                            <span className="text-muted-foreground/50 ml-2">({s.count})</span>
                          </span>
                        </div>
                        <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${Math.max(w, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-4">Acumulado do Ano</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Faturamento YTD", value: formatCurrency(ytd?.invoiced || 0), sub: `${ytd?.paidInvoiceCount || 0} faturas emitidas (bruto)`, icon: FileText, accent: "text-violet-400" },
                { label: "Receita Recebida", value: formatCurrency(ytd?.received || 0), sub: "faturas pagas (bruto)", icon: DollarSign, accent: "text-emerald-400" },
                { label: "Ticket Médio", value: formatCurrency(ytd?.avgTicket || 0), sub: "por fatura paga", icon: Receipt, accent: "text-blue-400" },
                { label: "Receita/Cliente", value: formatCurrency(ytd?.avgRevenuePerClient || 0), sub: `${ytd?.activeClientsCount || 0} clientes ativos`, icon: Users, accent: "text-purple-400" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className={`w-3.5 h-3.5 ${item.accent}`} />
                    <span className="text-[11px] text-muted-foreground">{item.label}</span>
                  </div>
                  <p className="text-xl font-bold tracking-tight">{item.value}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "DRE" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center justify-between gap-4 mb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">
                  DRE — Acumulado do Ano ({dreRegime === "caixa" ? "Regime de Caixa" : "Regime de Competência"})
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-border/30 p-0.5 bg-white/[0.02]">
                {(["competencia", "caixa"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      setDreRegime(r);
                      setRegimeMut.mutate({ regime: r });
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${dreRegime === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {r === "competencia" ? "Competência" : "Caixa"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-6">
              {dreRegime === "caixa"
                ? "Receita = data de recebimento; custos = data de pagamento."
                : "Receita = data de emissão; custos = mês de competência."}
            </p>

            {(() => {
              const L = dreDual?.lines;
              const gross = L?.grossRevenue || 0;
              const pct = (v: number) => (gross > 0 ? (v / gross) * 100 : 0);
              return (
                <div className="space-y-0.5 max-w-2xl">
                  <DreRow label="Receita Bruta" value={gross} pct={100} bold />
                  <DreRow label="(-) Comissão Restaurantes" value={-(L?.restaurantCommissions || 0)} pct={pct(L?.restaurantCommissions || 0)} indent negative />
                  <DreRow label="(-) Repasse VIP" value={-(L?.vipRepasses || 0)} pct={pct(L?.vipRepasses || 0)} indent negative />
                  <DreRow label="(-) Impostos sobre Receita" value={-(L?.taxes || 0)} pct={pct(L?.taxes || 0)} indent negative />
                  <DreRow label="(=) Receita Líquida (Nossa Parte)" value={L?.netRevenue || 0} pct={pct(L?.netRevenue || 0)} bold separator positive />
                  <div className="my-3" />
                  <DreRow label="(-) Custos de Produção" value={-(L?.productionCosts || 0)} pct={pct(L?.productionCosts || 0)} indent negative />
                  <DreRow label="(-) Frete e Distribuição" value={-(L?.freightCosts || 0)} pct={pct(L?.freightCosts || 0)} indent negative />
                  <DreRow label="(-) Comissão Parceiros" value={-(L?.partnerCommissions || 0)} pct={pct(L?.partnerCommissions || 0)} indent negative />
                  {(L?.otherCosts || 0) > 0 && (
                    <DreRow label="(-) Outros" value={-(L?.otherCosts || 0)} pct={pct(L?.otherCosts || 0)} indent negative />
                  )}
                  <DreRow label="Total Custos Operacionais" value={-(L?.totalCosts || 0)} pct={pct(L?.totalCosts || 0)} bold separator negative />
                  <div className="my-3" />
                  <DreRow label="(=) Lucro Bruto" value={L?.grossProfit || 0} pct={(L?.grossMarginPct || 0) * 100} bold separator positive={(L?.grossProfit || 0) > 0} negative={(L?.grossProfit || 0) < 0} />
                  <DreRow label="(-) IRPJ estimado (6%)" value={-(L?.irpj || 0)} pct={pct(L?.irpj || 0)} indent negative />
                  <DreRow label="(=) Lucro Líquido (estimado)" value={L?.netProfit || 0} pct={(L?.netMarginPct || 0) * 100} bold separator positive={(L?.netProfit || 0) > 0} negative={(L?.netProfit || 0) < 0} />
                </div>
              );
            })()}

            <div className="border-t border-border/10 mt-6 pt-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Margem Bruta", value: fmtPct(dreDual?.lines.grossMarginPct), color: (dreDual?.lines.grossMarginPct || 0) >= 0.3 ? "text-emerald-400" : "text-amber-400" },
                  { label: "IRPJ (estimado)", value: formatCurrency(dreDual?.lines.irpj || 0), color: "text-muted-foreground" },
                  { label: "Lucro Líquido (est.)", value: formatCurrency(dreDual?.lines.netProfit || 0), color: (dreDual?.lines.netProfit || 0) >= 0 ? "text-emerald-400" : "text-red-400" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl bg-white/[0.03] p-4 text-center">
                    <p className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Composição de Custos</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-5">Distribuição percentual dos custos diretos sobre a receita bruta</p>
            {(dre?.grossRevenue || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de faturamento ainda.</p>
            ) : (
              <div className="space-y-4 max-w-lg">
                {[
                  { label: "Comissões Restaurantes", value: dre?.restaurantCommissions || 0, color: "bg-orange-400" },
                  { label: "Custos de Produção", value: dre?.productionCosts || 0, color: "bg-blue-400" },
                  { label: "Frete", value: dre?.freightCosts || 0, color: "bg-purple-400" },
                  { label: "IRPJ (est.)", value: dre?.irpj || 0, color: "bg-red-400" },
                ].map(item => {
                  const pct = dre?.grossRevenue ? (item.value / dre.grossRevenue) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-medium">{formatCurrency(item.value)} <span className="text-muted-foreground/50">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground/70">
                <strong className="text-amber-400">Nota metodológica:</strong> A DRE usa dados reais disponíveis no sistema. O IRPJ é estimado a 6% sobre a receita bruta (Simples Nacional). Custos de produção/frete não têm data registrada — são totais acumulados.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Faturamento" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Evolução — últimos 12 meses</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-5">Faturamento emitido vs receita recebida</p>
            {monthlySeries.some(d => d.Faturado > 0 || d.Recebido > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n]} contentStyle={chartStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area type="monotone" dataKey="Faturado" fill="hsl(262,83%,58%,0.12)" stroke="hsl(262,83%,58%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="Recebido" stroke="hsl(152,70%,45%)" strokeWidth={2} dot={{ r: 3 }} />
                  <Bar dataKey="Com. Rest." fill="hsl(25,90%,55%)" radius={[3,3,0,0]} opacity={0.6} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">Sem dados de faturamento ainda.</div>
            )}
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Tabela por Mês</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/15">
                    <th className="text-left p-3 font-medium text-muted-foreground/60 text-[11px] uppercase tracking-wider">Mês</th>
                    <th className="text-right p-3 font-medium text-muted-foreground/60 text-[11px] uppercase tracking-wider">Faturado</th>
                    <th className="text-right p-3 font-medium text-muted-foreground/60 text-[11px] uppercase tracking-wider">Recebido</th>
                    <th className="text-right p-3 font-medium text-muted-foreground/60 text-[11px] uppercase tracking-wider">Com. Rest.</th>
                    <th className="text-right p-3 font-medium text-muted-foreground/60 text-[11px] uppercase tracking-wider">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {(exp?.monthlySeries || []).map(m => {
                    const grossProfit = m.invoiced - m.rpCosts;
                    const margin = m.invoiced > 0 ? grossProfit / m.invoiced : null;
                    return (
                      <tr key={m.month} className="border-b border-border/5 hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 font-medium">{monthLabel(m.month)}</td>
                        <td className="p-3 text-right font-mono">{m.invoiced > 0 ? formatCurrency(m.invoiced) : "—"}</td>
                        <td className="p-3 text-right font-mono text-emerald-400">{m.received > 0 ? formatCurrency(m.received) : "—"}</td>
                        <td className="p-3 text-right font-mono text-orange-400">{m.rpCosts > 0 ? formatCurrency(m.rpCosts) : "—"}</td>
                        <td className={`p-3 text-right font-mono ${margin != null && margin >= 0.3 ? "text-emerald-400" : margin != null && margin < 0.1 ? "text-red-400" : "text-amber-400"}`}>
                          {margin != null && m.invoiced > 0 ? `${(margin * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/20 bg-white/[0.02] font-semibold">
                    <td className="p-3">Total YTD</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(ytd?.invoiced || 0)}</td>
                    <td className="p-3 text-right font-mono text-emerald-400">{formatCurrency(ytd?.received || 0)}</td>
                    <td className="p-3 text-right font-mono text-orange-400">{formatCurrency(dre?.restaurantCommissions || 0)}</td>
                    <td className={`p-3 text-right font-mono ${(ytd?.grossMargin || 0) >= 0.3 ? "text-emerald-400" : "text-amber-400"}`}>{fmtPct(ytd?.grossMargin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Mês Atual", invoiced: currMonth?.invoiced || 0, received: currMonth?.received || 0 },
              { label: "Mês Anterior", invoiced: prevMonthData?.invoiced || 0, received: prevMonthData?.received || 0 },
              { label: "Acumulado YTD", invoiced: ytd?.invoiced || 0, received: ytd?.received || 0 },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-border/20 bg-card p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">{item.label}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Faturado</span>
                    <span className="text-base font-mono font-bold">{formatCurrency(item.invoiced)}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-muted-foreground">Recebido</span>
                    <span className="text-base font-mono font-bold text-emerald-400">{formatCurrency(item.received)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Eficiência" && (
        <div className="space-y-6">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Taxa de Conversão", value: fmtPct(quot?.conversionRate), sub: `${quot?.won.count || 0} / ${quot?.totalClosed || 0} fechadas`, icon: Target, accent: (quot?.conversionRate || 0) >= 0.5 ? "text-emerald-400" : "text-amber-400" },
              { label: "Receita Ganha", value: formatCurrency(quot?.won.total || 0), sub: `${quot?.won.count || 0} cotações`, icon: CheckCircle2, accent: "text-emerald-400" },
              { label: "Receita Perdida", value: formatCurrency(quot?.lostRevenue || 0), sub: `${(quot?.lost.count || 0) + (quot?.cancelled.count || 0)} perdidas/canceladas`, icon: TrendingDown, accent: "text-red-400" },
              { label: "Em Negociação", value: formatCurrency(quot?.sent.total || 0), sub: `${quot?.sent.count || 0} enviadas`, icon: Clock, accent: "text-blue-400" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border/20 bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={`w-4 h-4 ${item.accent}`} />
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-xl font-bold tracking-tight">{item.value}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Descontos Dados", value: formatCurrency(quot?.totalDiscountsGiven || 0), sub: "cotações ganhas", accent: "text-orange-400" },
              { label: "Desconto Médio", value: `${(quot?.avgDiscountPercent || 0).toFixed(1)}%`, sub: "por cotação ganha", accent: (quot?.avgDiscountPercent || 0) > 10 ? "text-red-400" : "text-amber-400" },
              { label: "Bonificações", value: String(quot?.bonificadas.count || 0), sub: formatCurrency(quot?.bonificadas.total || 0), accent: (quot?.bonificadas.count || 0) > 0 ? "text-amber-400" : "text-muted-foreground" },
              { label: "Impacto Desconto", value: quot?.won.total && quot.totalDiscountsGiven ? `${((quot.totalDiscountsGiven / (quot.won.total + quot.totalDiscountsGiven)) * 100).toFixed(1)}%` : "—", sub: "potencial sacrificado", accent: "text-violet-400" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border/20 bg-card p-4">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <p className={`text-xl font-bold tracking-tight mt-1 ${item.accent}`}>{item.value}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Pipeline de Cotações</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-5">Distribuição por status</p>
            <div className="space-y-4 max-w-lg">
              {[
                { label: "Ganhas", count: quot?.won.count || 0, total: quot?.won.total || 0, color: "bg-emerald-400" },
                { label: "Enviadas", count: quot?.sent.count || 0, total: quot?.sent.total || 0, color: "bg-blue-400" },
                { label: "Rascunho", count: quot?.draft.count || 0, total: quot?.draft.total || 0, color: "bg-zinc-500" },
                { label: "Perdidas", count: quot?.lost.count || 0, total: quot?.lost.total || 0, color: "bg-red-400" },
                { label: "Canceladas", count: quot?.cancelled.count || 0, total: quot?.cancelled.total || 0, color: "bg-zinc-600" },
              ].map(item => {
                const totalAll = (quot?.won.count || 0) + (quot?.sent.count || 0) + (quot?.draft.count || 0) + (quot?.lost.count || 0) + (quot?.cancelled.count || 0);
                const pct = totalAll > 0 ? (item.count / totalAll) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono">{item.count} · {formatCurrency(item.total)} <span className="text-muted-foreground/40">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Simulação: Impacto do Desconto</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Receita realizada (c/ desc.)", value: quot?.won.total || 0, color: "text-foreground" },
                { label: "Receita potencial (s/ desc.)", value: (quot?.won.total || 0) + (quot?.totalDiscountsGiven || 0), color: "text-emerald-400" },
                { label: "Sacrificado em descontos", value: quot?.totalDiscountsGiven || 0, color: "text-red-400" },
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-white/[0.03] p-5 text-center">
                  <p className={`text-2xl font-bold font-mono ${item.color}`}>{formatCurrency(item.value)}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Clientes" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Clientes Ativos", value: String(ytd?.activeClientsCount || 0), sub: "com faturas pagas", icon: Users, accent: "text-blue-400" },
              { label: "Receita Total", value: formatCurrency(ytd?.received || 0), sub: "acumulado", icon: DollarSign, accent: "text-emerald-400" },
              { label: "Ticket Médio", value: formatCurrency(ytd?.avgTicket || 0), sub: "por fatura", icon: Receipt, accent: "text-violet-400" },
              { label: "Receita/Cliente", value: formatCurrency(ytd?.avgRevenuePerClient || 0), sub: "média", icon: PieChart, accent: "text-purple-400" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border/20 bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={`w-4 h-4 ${item.accent}`} />
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                </div>
                <p className="text-xl font-bold tracking-tight">{item.value}</p>
                <p className="text-[10px] text-muted-foreground/40 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Top Clientes por Receita</span>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mb-5">Ranking de clientes (faturas pagas — histórico completo)</p>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma fatura paga registrada ainda.</p>
            ) : (
              <div className="space-y-1">
                {topClients.map((client, i) => {
                  const maxTotal = topClients[0]?.total || 1;
                  const barWidth = (client.total / maxTotal) * 100;
                  const totalReceived = ytd?.received || 1;
                  const share = (client.total / totalReceived) * 100;
                  return (
                    <div key={client.name} className="flex items-center gap-3 py-2.5 border-b border-border/5 last:border-0">
                      <span className="text-sm font-bold text-muted-foreground/30 w-5 shrink-0 text-center font-mono">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium truncate">{client.name}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-[10px] text-muted-foreground/40">{client.count} fat. · {share.toFixed(1)}%</span>
                            <span className="text-sm font-mono font-semibold text-emerald-400">{formatCurrency(client.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full bg-primary/40 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {topClients.length >= 3 && (
            <div className="rounded-2xl border border-border/20 bg-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <PieChart className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Concentração de Receita</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 3, 5].map(n => {
                  const slice = topClients.slice(0, n);
                  const totalSlice = slice.reduce((s, c) => s + c.total, 0);
                  const totalAll = ytd?.received || 1;
                  const pct = (totalSlice / totalAll) * 100;
                  return (
                    <div key={n} className={`rounded-xl p-5 text-center border ${pct > 80 ? "border-red-500/20 bg-red-500/5" : pct > 50 ? "border-amber-500/20 bg-amber-500/5" : "border-border/20 bg-white/[0.02]"}`}>
                      <p className={`text-2xl font-bold font-mono ${pct > 80 ? "text-red-400" : pct > 50 ? "text-amber-400" : "text-emerald-400"}`}>{pct.toFixed(0)}%</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1">Top {n} cliente{n > 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-muted-foreground/40">{formatCurrency(totalSlice)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </PageContainer>
  );
}
