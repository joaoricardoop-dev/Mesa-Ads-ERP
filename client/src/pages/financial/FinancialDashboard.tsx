import PageContainer from "@/components/PageContainer";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, Building2, CheckCircle2,
  HandCoins, ChevronRight, Receipt, BarChart3, DollarSign, Percent,
  Users, ShoppingBag, ArrowUpRight, ArrowDownRight, Minus, FileText,
  Target, Zap, AlertCircle, Info, PieChart,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area, AreaChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function GrowthBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-muted-foreground">sem dado</span>;
  const pct = (value * 100).toFixed(1);
  if (value > 0.02) return <span className="inline-flex items-center gap-0.5 text-xs text-emerald-500 font-medium"><ArrowUpRight className="w-3 h-3" />+{pct}%</span>;
  if (value < -0.02) return <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-medium"><ArrowDownRight className="w-3 h-3" />{pct}%</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground font-medium"><Minus className="w-3 h-3" />{pct}%</span>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, bg, onClick, growth, badge,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color: string; bg: string; onClick?: () => void; growth?: number | null; badge?: string | null;
}) {
  const Wrap = onClick ? "button" : "div";
  return (
    <Wrap
      onClick={onClick}
      className={`rounded-xl border border-border/30 bg-card p-4 flex flex-col gap-1.5 text-left ${onClick ? "hover:bg-muted/5 transition-colors cursor-pointer group" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>
        {onClick && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
        {badge && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{badge}</Badge>}
      </div>
      <div>
        <p className="text-base font-bold tracking-tight leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
        {growth != null && <div className="mt-1"><GrowthBadge value={growth} /></div>}
      </div>
    </Wrap>
  );
}

function DreRow({
  label, value, pct, bold, accent, indent, separator, positive, negative,
}: {
  label: string; value: number; pct?: number; bold?: boolean; accent?: boolean;
  indent?: boolean; separator?: boolean; positive?: boolean; negative?: boolean;
}) {
  const valueColor = positive ? "text-emerald-500" : negative ? "text-red-500" : accent ? "text-primary" : "";
  return (
    <>
      {separator && <div className="border-t border-border/30 my-1" />}
      <div className={`flex items-center justify-between py-1.5 px-3 rounded-md ${bold ? "bg-muted/20" : ""}`}>
        <span className={`text-sm ${indent ? "pl-4 text-muted-foreground" : ""} ${bold ? "font-semibold" : ""}`}>{label}</span>
        <div className="flex items-center gap-4">
          {pct != null && <span className="text-xs text-muted-foreground font-mono w-14 text-right">{pct.toFixed(1)}%</span>}
          <span className={`text-sm font-mono font-semibold w-32 text-right ${valueColor}`}>{formatCurrency(value)}</span>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function Alert({ type, title, desc }: { type: "warn" | "danger" | "info"; title: string; desc: string }) {
  const configs = {
    warn: { bg: "bg-amber-500/10 border-amber-500/30", icon: AlertTriangle, color: "text-amber-500" },
    danger: { bg: "bg-red-500/10 border-red-500/30", icon: AlertCircle, color: "text-red-500" },
    info: { bg: "bg-blue-500/10 border-blue-500/30", icon: Info, color: "text-blue-500" },
  };
  const cfg = configs[type];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cfg.bg}`}>
      <cfg.icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
      <div>
        <p className={`text-xs font-semibold ${cfg.color}`}>{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

const TABS = ["Executivo", "DRE", "Faturamento", "Eficiência", "Clientes"] as const;
type Tab = typeof TABS[number];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinancialDashboard() {
  const { data, isLoading } = trpc.financial.dashboard.useQuery();
  const { data: exp, isLoading: expLoading } = trpc.financial.dashboardExpanded.useQuery();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("Executivo");

  const loading = isLoading || expLoading;

  if (loading) {
    return (
      <PageContainer title="Dashboard Financeiro">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  // ── Base data ──────────────────────────────────────────────────────────────
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

  // ── Alerts ────────────────────────────────────────────────────────────────
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
  if (alerts.length === 0) alerts.push({ type: "info", title: "Tudo dentro do esperado", desc: "Nenhum alerta crítico identificado no momento." });

  // ── Chart color ───────────────────────────────────────────────────────────
  const chartStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" };

  return (
    <PageContainer title="Dashboard Financeiro" description="Central gerencial financeira do negócio">

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/30 pb-0 -mt-2 mb-2 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════ EXECUTIVO ══════════════════════════ */}
      {activeTab === "Executivo" && (
        <div className="space-y-6">

          {/* KPI grid — row 1: revenue */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mês Atual</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Faturado" value={formatCurrency(invoicedThisMonth)} sub="este mês" icon={Receipt} color="text-violet-500" bg="bg-violet-500/10" growth={growth?.invoiced} onClick={() => navigate("/financeiro/faturamento")} />
              <KpiCard label="Recebido" value={formatCurrency(revenue)} sub="faturas pagas" icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" growth={growth?.received} onClick={() => navigate("/financeiro/faturamento")} />
              <KpiCard label="Lucro Bruto (mês)" value={formatCurrency(currMonth?.grossProfit || 0)} sub={`margem ${fmtPct(currMonth?.grossMargin)}`} icon={TrendingUp} color="text-blue-500" bg="bg-blue-500/10" growth={growth?.profit} />
              <KpiCard label="Margem Bruta" value={fmtPct(currMonth?.grossMargin)} sub="receita − comissões rest." icon={Percent} color={((currMonth?.grossMargin || 0) >= 0.3) ? "text-emerald-500" : "text-amber-500"} bg={((currMonth?.grossMargin || 0) >= 0.3) ? "bg-emerald-500/10" : "bg-amber-500/10"} />
            </div>
          </div>

          {/* KPI grid — row 2: risk */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="A Receber" value={formatCurrency(receivables)} sub={`${data?.receivablesCount || 0} faturas abertas`} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" onClick={() => navigate("/financeiro/faturamento")} />
            <KpiCard label="Inadimplente" value={formatCurrency(overdue)} sub={`${data?.overdueCount || 0} vencidas`} icon={AlertTriangle} color={overdue > 0 ? "text-red-500" : "text-muted-foreground"} bg={overdue > 0 ? "bg-red-500/10" : "bg-muted/10"} onClick={() => navigate("/financeiro/faturamento")} />
            <KpiCard label="Pagar Restaurantes" value={formatCurrency(pendingRp)} sub={`${data?.pendingRestaurantCount || 0} pendentes`} icon={HandCoins} color={pendingRp > 0 ? "text-orange-500" : "text-muted-foreground"} bg={pendingRp > 0 ? "bg-orange-500/10" : "bg-muted/10"} onClick={() => navigate("/financeiro/pagamentos")} />
            <KpiCard label="Campanhas Ativas" value={String(activeCampaigns)} sub="em execução" icon={Building2} color="text-blue-500" bg="bg-blue-500/10" onClick={() => navigate("/campanhas")} />
          </div>

          {/* KPI grid — row 3: ytd summary */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Acumulado do Ano (YTD)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Faturamento YTD" value={formatCurrency(ytd?.invoiced || 0)} sub={`${ytd?.paidInvoiceCount || 0} faturas emitidas`} icon={FileText} color="text-violet-500" bg="bg-violet-500/10" />
              <KpiCard label="Receita Recebida YTD" value={formatCurrency(ytd?.received || 0)} sub="faturas pagas" icon={DollarSign} color="text-emerald-500" bg="bg-emerald-500/10" />
              <KpiCard label="Ticket Médio" value={formatCurrency(ytd?.avgTicket || 0)} sub="por fatura paga" icon={ShoppingBag} color="text-blue-500" bg="bg-blue-500/10" />
              <KpiCard label="Rec. Média/Cliente" value={formatCurrency(ytd?.avgRevenuePerClient || 0)} sub={`${ytd?.activeClientsCount || 0} clientes ativos`} icon={Users} color="text-purple-500" bg="bg-purple-500/10" />
            </div>
          </div>

          {/* 6-month chart + invoice status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border/30 rounded-xl p-5">
              <SectionTitle icon={BarChart3} title="Faturado vs Recebido — últimos 6 meses" />
              {(data?.monthlyData || []).some(d => d.invoiced > 0 || d.received > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(data?.monthlyData || []).map(m => ({ month: monthLabel(m.month), Faturado: m.invoiced, Recebido: m.received }))} barCategoryGap="30%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n]} contentStyle={chartStyle} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="Faturado" fill="hsl(262,83%,68%)" radius={[3,3,0,0]} />
                    <Bar dataKey="Recebido" fill="#27d803" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">Nenhuma fatura emitida ainda</div>
              )}
            </div>

            <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
              <SectionTitle icon={DollarSign} title="Situação das Faturas" />
              {[
                { key: "paga", label: "Pagas", color: "bg-emerald-500", tc: "text-emerald-500" },
                { key: "emitida", label: "Em aberto", color: "bg-amber-500", tc: "text-amber-500" },
                { key: "vencida_calc", label: "Vencidas", color: "bg-red-500", tc: "text-red-500", isOverdue: true },
                { key: "cancelada", label: "Canceladas", color: "bg-muted", tc: "text-muted-foreground" },
              ].map(item => {
                const d = item.isOverdue
                  ? { count: data?.overdueCount || 0, total: overdue }
                  : (data?.invoiceStatusSummary?.[item.key] || { count: 0, total: 0 });
                if (!d.count && !item.isOverdue) return null;
                return (
                  <div key={item.key} className="flex items-center justify-between py-1.5 border-b border-border/10 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{d.count} fat.</p>
                      </div>
                    </div>
                    <p className={`text-xs font-mono font-semibold ${item.tc}`}>{formatCurrency(d.total)}</p>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="w-full text-xs mt-2" onClick={() => navigate("/financeiro/faturamento")}>Ver todas as faturas</Button>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Alertas Automáticos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alerts.map((a, i) => <Alert key={i} {...a} />)}
            </div>
          </div>

          {/* Upcoming + quick actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle icon={Clock} title="Vencimentos próximos (30 dias)" />
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/financeiro/faturamento")}>Ver todas <ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
              </div>
              {(data?.upcomingInvoices || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 text-sm text-muted-foreground gap-1"><CheckCircle2 className="w-8 h-8 opacity-20" /><p>Nenhum vencimento nos próximos 30 dias</p></div>
              ) : (
                <div className="space-y-2">
                  {(data?.upcomingInvoices || []).slice(0, 5).map(inv => {
                    const days = daysUntil(inv.dueDate);
                    const urgent = days <= 5;
                    return (
                      <div key={inv.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${urgent ? "border-red-500/30 bg-red-500/5" : "border-border/20 bg-muted/5"}`}>
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-medium truncate">{inv.clientName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{inv.campaignName} · {inv.invoiceNumber}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono font-semibold">{formatCurrency(parseFloat(inv.amount))}</p>
                          <p className={`text-[10px] ${urgent ? "text-red-500" : "text-amber-500"}`}>{days === 0 ? "Vence hoje" : days === 1 ? "Amanhã" : `${days}d · ${fmtDate(inv.dueDate)}`}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-card border border-border/30 rounded-xl p-5">
              <SectionTitle icon={Zap} title="Acesso Rápido" />
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Faturamento", desc: "Emitir e gerenciar faturas", icon: Receipt, color: "text-violet-500", bg: "bg-violet-500/10", path: "/financeiro/faturamento", badge: data?.receivablesCount },
                  { label: "Pagamentos", desc: "Comissões restaurantes", icon: HandCoins, color: "text-orange-500", bg: "bg-orange-500/10", path: "/financeiro/pagamentos", badge: data?.pendingRestaurantCount },
                  { label: "Custos", desc: "Produção e frete", icon: TrendingDown, color: "text-blue-500", bg: "bg-blue-500/10", path: "/financeiro/custos", badge: null },
                  { label: "Relatórios", desc: "Análise por período", icon: BarChart3, color: "text-emerald-500", bg: "bg-emerald-500/10", path: "/financeiro/relatorios", badge: null },
                ].map(item => (
                  <button key={item.label} onClick={() => navigate(item.path)} className="relative flex flex-col gap-2 p-3 rounded-lg border border-border/20 hover:bg-muted/10 transition-colors text-left group">
                    {item.badge ? <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{item.badge}</span> : null}
                    <div className={`w-7 h-7 rounded-lg ${item.bg} flex items-center justify-center`}><item.icon className={`w-3.5 h-3.5 ${item.color}`} /></div>
                    <div><p className="text-xs font-semibold">{item.label}</p><p className="text-[10px] text-muted-foreground">{item.desc}</p></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ DRE ════════════════════════════════ */}
      {activeTab === "DRE" && (
        <div className="space-y-6">
          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={FileText} title="DRE Gerencial — Acumulado do Ano" sub="Demonstração do Resultado do Exercício (baseado em faturamento emitido)" />

            <div className="space-y-0.5 max-w-2xl">
              <DreRow label="Receita Bruta (faturamento emitido)" value={dre?.grossRevenue || 0} pct={100} bold />
              <DreRow label="(-) IRPJ estimado (6%)" value={-(dre?.irpj || 0)} pct={dre?.grossRevenue ? (dre.irpj / dre.grossRevenue) * 100 : 0} indent negative />
              <DreRow label="(=) Receita Líquida Estimada" value={(dre?.grossRevenue || 0) - (dre?.irpj || 0)} pct={dre?.grossRevenue ? (((dre.grossRevenue - dre.irpj) / dre.grossRevenue) * 100) : 0} bold separator positive />

              <div className="my-2" />
              <DreRow label="(-) Comissões Restaurantes (pagas)" value={-(dre?.restaurantCommissions || 0)} pct={dre?.grossRevenue ? (dre.restaurantCommissions / dre.grossRevenue) * 100 : 0} indent negative />
              <DreRow label="(-) Custos de Produção" value={-(dre?.productionCosts || 0)} pct={dre?.grossRevenue ? (dre.productionCosts / dre.grossRevenue) * 100 : 0} indent negative />
              <DreRow label="(-) Frete e Distribuição" value={-(dre?.freightCosts || 0)} pct={dre?.grossRevenue ? (dre.freightCosts / dre.grossRevenue) * 100 : 0} indent negative />
              <DreRow label="Total Custos Diretos" value={-(dre?.totalDirectCosts || 0)} pct={dre?.grossRevenue ? (dre.totalDirectCosts / dre.grossRevenue) * 100 : 0} bold separator negative />

              <div className="my-2" />
              <DreRow
                label="(=) Lucro Bruto"
                value={dre?.grossProfit || 0}
                pct={dre?.grossRevenue ? (dre.grossMarginPct * 100) : 0}
                bold separator
                positive={(dre?.grossProfit || 0) > 0}
                negative={(dre?.grossProfit || 0) < 0}
              />

              <div className="my-4 border-t border-border/30" />

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Margem Bruta", value: fmtPct(dre?.grossMarginPct), color: (dre?.grossMarginPct || 0) >= 0.3 ? "text-emerald-500" : "text-amber-500" },
                  { label: "IRPJ (estimado)", value: formatCurrency(dre?.irpj || 0), color: "text-muted-foreground" },
                  { label: "Lucro Líquido (est.)", value: formatCurrency(dre?.netProfit || 0), color: (dre?.netProfit || 0) >= 0 ? "text-emerald-500" : "text-red-500" },
                ].map(item => (
                  <div key={item.label} className="bg-muted/20 rounded-lg p-3 text-center">
                    <p className={`text-base font-bold font-mono ${item.color}`}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={BarChart3} title="Composição de Custos" sub="Distribuição percentual dos custos diretos sobre a receita bruta" />
            {(dre?.grossRevenue || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados de faturamento ainda.</p>
            ) : (
              <div className="space-y-3 max-w-md">
                {[
                  { label: "Comissões Restaurantes", value: dre?.restaurantCommissions || 0, color: "bg-orange-500" },
                  { label: "Custos de Produção", value: dre?.productionCosts || 0, color: "bg-blue-500" },
                  { label: "Frete", value: dre?.freightCosts || 0, color: "bg-purple-500" },
                  { label: "IRPJ (est.)", value: dre?.irpj || 0, color: "bg-red-400" },
                ].map(item => {
                  const pct = dre?.grossRevenue ? (item.value / dre.grossRevenue) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-medium">{formatCurrency(item.value)} <span className="text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-amber-600 dark:text-amber-400">Nota metodológica:</strong> A DRE usa dados reais disponíveis no sistema. O IRPJ é estimado a 6% sobre a receita bruta (Simples Nacional). Custos de produção/frete não têm data registrada — são totais acumulados. Para uma DRE contábil completa, recomenda-se integração com o sistema de contabilidade.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ FATURAMENTO ════════════════════════ */}
      {activeTab === "Faturamento" && (
        <div className="space-y-6">
          {/* 12-month area chart */}
          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={TrendingUp} title="Evolução — últimos 12 meses" sub="Faturamento emitido vs receita recebida" />
            {monthlySeries.some(d => d.Faturado > 0 || d.Recebido > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n]} contentStyle={chartStyle} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Area type="monotone" dataKey="Faturado" fill="hsl(262,83%,68%,0.15)" stroke="hsl(262,83%,68%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="Recebido" stroke="#27d803" strokeWidth={2} dot={{ r: 3 }} />
                  <Bar dataKey="Com. Rest." fill="hsl(25,90%,60%)" radius={[2,2,0,0]} opacity={0.7} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">Sem dados de faturamento ainda.</div>
            )}
          </div>

          {/* Monthly table */}
          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={BarChart3} title="Tabela por Mês" sub="Faturado, recebido e comissões pagas a restaurantes" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left p-2.5 font-medium text-muted-foreground">Mês</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Faturado</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Recebido</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Com. Rest.</th>
                    <th className="text-right p-2.5 font-medium text-muted-foreground">Margem Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {(exp?.monthlySeries || []).map(m => {
                    const grossProfit = m.invoiced - m.rpCosts;
                    const margin = m.invoiced > 0 ? grossProfit / m.invoiced : null;
                    return (
                      <tr key={m.month} className="border-b border-border/10 hover:bg-muted/10">
                        <td className="p-2.5 font-medium">{monthLabel(m.month)}</td>
                        <td className="p-2.5 text-right font-mono">{m.invoiced > 0 ? formatCurrency(m.invoiced) : "—"}</td>
                        <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{m.received > 0 ? formatCurrency(m.received) : "—"}</td>
                        <td className="p-2.5 text-right font-mono text-orange-500">{m.rpCosts > 0 ? formatCurrency(m.rpCosts) : "—"}</td>
                        <td className={`p-2.5 text-right font-mono text-xs ${margin != null && margin >= 0.3 ? "text-emerald-500" : margin != null && margin < 0.1 ? "text-red-500" : "text-amber-500"}`}>
                          {margin != null && m.invoiced > 0 ? `${(margin * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border/30 bg-muted/10 font-semibold">
                    <td className="p-2.5">Total YTD</td>
                    <td className="p-2.5 text-right font-mono">{formatCurrency(ytd?.invoiced || 0)}</td>
                    <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(ytd?.received || 0)}</td>
                    <td className="p-2.5 text-right font-mono text-orange-500">{formatCurrency(dre?.restaurantCommissions || 0)}</td>
                    <td className={`p-2.5 text-right font-mono ${(ytd?.grossMargin || 0) >= 0.3 ? "text-emerald-500" : "text-amber-500"}`}>{fmtPct(ytd?.grossMargin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Comparison card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Mês Atual", invoiced: currMonth?.invoiced || 0, received: currMonth?.received || 0 },
              { label: "Mês Anterior", invoiced: prevMonthData?.invoiced || 0, received: prevMonthData?.received || 0 },
              { label: "Acumulado YTD", invoiced: ytd?.invoiced || 0, received: ytd?.received || 0 },
            ].map(item => (
              <div key={item.label} className="bg-card border border-border/30 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Faturado</span>
                  <span className="text-sm font-mono font-semibold">{formatCurrency(item.invoiced)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Recebido</span>
                  <span className="text-sm font-mono font-semibold text-emerald-500">{formatCurrency(item.received)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════ EFICIÊNCIA ════════════════════════ */}
      {activeTab === "Eficiência" && (
        <div className="space-y-6">

          {/* Pipeline conversion KPIs */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Eficiência Comercial</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Taxa de Conversão" value={fmtPct(quot?.conversionRate)} sub={`${quot?.won.count || 0} ganhas / ${quot?.totalClosed || 0} fechadas`} icon={Target} color={(quot?.conversionRate || 0) >= 0.5 ? "text-emerald-500" : "text-amber-500"} bg={(quot?.conversionRate || 0) >= 0.5 ? "bg-emerald-500/10" : "bg-amber-500/10"} />
              <KpiCard label="Receita Ganha" value={formatCurrency(quot?.won.total || 0)} sub={`${quot?.won.count || 0} cotações ganhas`} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" />
              <KpiCard label="Receita Perdida" value={formatCurrency(quot?.lostRevenue || 0)} sub={`${quot?.lost.count || 0} perdidas + ${quot?.cancelled.count || 0} canceladas`} icon={TrendingDown} color="text-red-500" bg="bg-red-500/10" />
              <KpiCard label="Em Negociação" value={formatCurrency(quot?.sent.total || 0)} sub={`${quot?.sent.count || 0} cotações enviadas`} icon={Clock} color="text-blue-500" bg="bg-blue-500/10" />
            </div>
          </div>

          {/* Discounts KPIs */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descontos Concedidos</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Total Descontos Dados" value={formatCurrency(quot?.totalDiscountsGiven || 0)} sub="nas cotações ganhas" icon={PieChart} color="text-orange-500" bg="bg-orange-500/10" />
              <KpiCard label="Desconto Médio" value={`${(quot?.avgDiscountPercent || 0).toFixed(1)}%`} sub="por cotação ganha" icon={Percent} color={(quot?.avgDiscountPercent || 0) > 10 ? "text-red-500" : "text-amber-500"} bg={(quot?.avgDiscountPercent || 0) > 10 ? "bg-red-500/10" : "bg-amber-500/10"} />
              <KpiCard label="Bonificações" value={String(quot?.bonificadas.count || 0)} sub={`${formatCurrency(quot?.bonificadas.total || 0)} de receita`} icon={AlertTriangle} color={(quot?.bonificadas.count || 0) > 0 ? "text-amber-500" : "text-muted-foreground"} bg={(quot?.bonificadas.count || 0) > 0 ? "bg-amber-500/10" : "bg-muted/10"} />
              <KpiCard label="Impacto do Desconto" value={quot?.won.total && quot.totalDiscountsGiven ? `${((quot.totalDiscountsGiven / (quot.won.total + quot.totalDiscountsGiven)) * 100).toFixed(1)}%` : "—"} sub="do potencial sacrificado" icon={AlertCircle} color="text-violet-500" bg="bg-violet-500/10" />
            </div>
          </div>

          {/* Quotation funnel */}
          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={BarChart3} title="Pipeline de Cotações — Funil" sub="Distribuição de todas as cotações por status" />
            <div className="space-y-3">
              {[
                { label: "Ganhas", count: quot?.won.count || 0, total: quot?.won.total || 0, color: "bg-emerald-500" },
                { label: "Enviadas / Em negociação", count: quot?.sent.count || 0, total: quot?.sent.total || 0, color: "bg-blue-500" },
                { label: "Rascunho", count: quot?.draft.count || 0, total: quot?.draft.total || 0, color: "bg-muted-foreground" },
                { label: "Perdidas", count: quot?.lost.count || 0, total: quot?.lost.total || 0, color: "bg-red-500" },
                { label: "Canceladas", count: quot?.cancelled.count || 0, total: quot?.cancelled.total || 0, color: "bg-gray-400" },
              ].map(item => {
                const totalAll = (quot?.won.count || 0) + (quot?.sent.count || 0) + (quot?.draft.count || 0) + (quot?.lost.count || 0) + (quot?.cancelled.count || 0);
                const pct = totalAll > 0 ? (item.count / totalAll) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono">{item.count} · {formatCurrency(item.total)} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount sensitivity simulator */}
          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={TrendingUp} title="Simulação: Impacto do Desconto na Receita" sub="Quanto a receita teria sido sem os descontos concedidos" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Receita realizada (c/ desc.)", value: quot?.won.total || 0, color: "text-foreground" },
                { label: "Receita potencial (s/ desc.)", value: (quot?.won.total || 0) + (quot?.totalDiscountsGiven || 0), color: "text-emerald-500" },
                { label: "Sacrificado em descontos", value: quot?.totalDiscountsGiven || 0, color: "text-red-500" },
              ].map(item => (
                <div key={item.label} className="bg-muted/20 rounded-lg p-4 text-center">
                  <p className={`text-lg font-bold font-mono ${item.color}`}>{formatCurrency(item.value)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════ CLIENTES ═══════════════════════════ */}
      {activeTab === "Clientes" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Clientes Ativos" value={String(ytd?.activeClientsCount || 0)} sub="com faturas pagas" icon={Users} color="text-blue-500" bg="bg-blue-500/10" />
            <KpiCard label="Receita Total Paga" value={formatCurrency(ytd?.received || 0)} sub="acumulado histórico" icon={DollarSign} color="text-emerald-500" bg="bg-emerald-500/10" />
            <KpiCard label="Ticket Médio" value={formatCurrency(ytd?.avgTicket || 0)} sub="por fatura paga" icon={ShoppingBag} color="text-violet-500" bg="bg-violet-500/10" />
            <KpiCard label="Receita Média/Cliente" value={formatCurrency(ytd?.avgRevenuePerClient || 0)} sub="receita ÷ clientes ativos" icon={PieChart} color="text-purple-500" bg="bg-purple-500/10" />
          </div>

          <div className="bg-card border border-border/30 rounded-xl p-5">
            <SectionTitle icon={Users} title="Top Clientes por Receita Recebida" sub="Ranking dos maiores clientes (faturas pagas — histórico completo)" />
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
                    <div key={client.name} className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0">
                      <span className="text-sm font-bold text-muted-foreground w-5 shrink-0 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate">{client.name}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-[10px] text-muted-foreground">{client.count} fat. · {share.toFixed(1)}%</span>
                            <span className="text-sm font-mono font-semibold text-emerald-500">{formatCurrency(client.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Revenue concentration */}
          {topClients.length >= 3 && (
            <div className="bg-card border border-border/30 rounded-xl p-5">
              <SectionTitle icon={PieChart} title="Concentração de Receita" sub="Percentual dos maiores clientes no total recebido" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 3, 5].map(n => {
                  const slice = topClients.slice(0, n);
                  const totalSlice = slice.reduce((s, c) => s + c.total, 0);
                  const totalAll = ytd?.received || 1;
                  const pct = (totalSlice / totalAll) * 100;
                  return (
                    <div key={n} className={`rounded-xl p-4 text-center border ${pct > 80 ? "border-red-500/30 bg-red-500/5" : pct > 50 ? "border-amber-500/30 bg-amber-500/5" : "border-border/30 bg-muted/10"}`}>
                      <p className={`text-xl font-bold font-mono ${pct > 80 ? "text-red-500" : pct > 50 ? "text-amber-500" : "text-emerald-500"}`}>{pct.toFixed(0)}%</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Top {n} cliente{n > 1 ? "s" : ""}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(totalSlice)}</p>
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
