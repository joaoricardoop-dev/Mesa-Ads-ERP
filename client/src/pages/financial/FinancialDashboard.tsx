import PageContainer from "@/components/PageContainer";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Building2,
  CheckCircle2,
  HandCoins,
  ChevronRight,
  Receipt,
  BarChart3,
  DollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function MonthLabel(month: string) {
  const [, m] = month.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return names[parseInt(m, 10) - 1] || m;
}

export default function FinancialDashboard() {
  const { data, isLoading } = trpc.financial.dashboard.useQuery();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <PageContainer title="Dashboard Financeiro">
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

  const chartData = (data?.monthlyData || []).map((m) => ({
    month: MonthLabel(m.month),
    "Faturado": m.invoiced,
    "Recebido": m.received,
  }));

  const upcomingInvoices = data?.upcomingInvoices || [];

  const kpis = [
    {
      label: "Faturado este mês",
      value: formatCurrency(invoicedThisMonth),
      sub: "faturas emitidas",
      icon: Receipt,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      onClick: () => navigate("/financeiro/faturamento"),
    },
    {
      label: "Recebido este mês",
      value: formatCurrency(revenue),
      sub: "faturas pagas",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      onClick: () => navigate("/financeiro/faturamento"),
    },
    {
      label: "A Receber (em aberto)",
      value: formatCurrency(receivables),
      sub: `${data?.receivablesCount || 0} faturas pendentes`,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      onClick: () => navigate("/financeiro/faturamento"),
    },
    {
      label: "Inadimplente",
      value: formatCurrency(overdue),
      sub: `${data?.overdueCount || 0} faturas vencidas`,
      icon: AlertTriangle,
      color: overdue > 0 ? "text-red-500" : "text-muted-foreground",
      bg: overdue > 0 ? "bg-red-500/10" : "bg-muted/10",
      onClick: () => navigate("/financeiro/faturamento"),
    },
    {
      label: "Pagar Restaurantes",
      value: formatCurrency(pendingRp),
      sub: `${data?.pendingRestaurantCount || 0} pagamentos pendentes`,
      icon: HandCoins,
      color: pendingRp > 0 ? "text-orange-500" : "text-muted-foreground",
      bg: pendingRp > 0 ? "bg-orange-500/10" : "bg-muted/10",
      onClick: () => navigate("/financeiro/pagamentos"),
    },
    {
      label: "Campanhas Ativas",
      value: String(activeCampaigns),
      sub: "em execução",
      icon: Building2,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      onClick: () => navigate("/campanhas"),
    },
  ];

  return (
    <PageContainer title="Dashboard Financeiro" description="Visão geral financeira do negócio">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            onClick={kpi.onClick}
            className="rounded-xl border border-border/30 bg-card p-4 flex flex-col gap-2 text-left hover:bg-muted/5 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight leading-tight">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground/60">{kpi.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Chart + Status Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly Chart */}
        <div className="lg:col-span-2 bg-card border border-border/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Faturado vs Recebido — últimos 6 meses</h3>
          </div>
          {chartData.some((d) => d["Faturado"] > 0 || d["Recebido"] > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Faturado" fill="hsl(262, 83%, 68%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Recebido" fill="#27d803" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[240px] text-sm text-muted-foreground gap-2">
              <BarChart3 className="w-8 h-8 opacity-20" />
              <p>Nenhuma fatura emitida ainda</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/financeiro/faturamento")}>
                Ir para Faturamento
              </Button>
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-card border border-border/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Situação das Faturas</h3>
          </div>

          {[
            { key: "paga", label: "Pagas", color: "bg-emerald-500", textColor: "text-emerald-500" },
            { key: "emitida", label: "Em aberto", color: "bg-amber-500", textColor: "text-amber-500" },
            { key: "vencida_calc", label: "Vencidas", color: "bg-red-500", textColor: "text-red-500", isOverdue: true },
            { key: "cancelada", label: "Canceladas", color: "bg-muted", textColor: "text-muted-foreground" },
          ].map((item) => {
            const statusData = item.isOverdue
              ? { count: data?.overdueCount || 0, total: data?.overdue || 0 }
              : (data?.invoiceStatusSummary?.[item.key] || { count: 0, total: 0 });
            if (statusData.count === 0 && !item.isOverdue) return null;
            return (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{statusData.count} fatura{statusData.count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <p className={`text-sm font-mono font-semibold ${item.textColor}`}>
                  {formatCurrency(statusData.total)}
                </p>
              </div>
            );
          })}

          <div className="pt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pgtos rest. pendentes</span>
              <span className={`text-xs font-mono font-medium ${pendingRp > 0 ? "text-orange-500" : "text-muted-foreground"}`}>
                {formatCurrency(pendingRp)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pgtos rest. realizados</span>
              <span className="text-xs font-mono font-medium text-emerald-500">
                {formatCurrency(data?.costBreakdown?.restaurantCosts || 0)}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 text-xs"
            onClick={() => navigate("/financeiro/faturamento")}
          >
            Ver todas as faturas
          </Button>
        </div>
      </div>

      {/* Upcoming Invoices + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming due dates */}
        <div className="bg-card border border-border/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Vencimentos próximos (30 dias)</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate("/financeiro/faturamento")}>
              Ver todas <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {upcomingInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground gap-1">
              <CheckCircle2 className="w-8 h-8 opacity-20" />
              <p>Nenhum vencimento nos próximos 30 dias</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingInvoices.slice(0, 6).map((inv) => {
                const days = daysUntil(inv.dueDate);
                const urgent = days <= 5;
                return (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${urgent ? "border-red-500/30 bg-red-500/5" : "border-border/20 bg-muted/5"}`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-sm font-medium truncate">{inv.clientName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{inv.campaignName} · {inv.invoiceNumber}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-semibold">{formatCurrency(parseFloat(inv.amount))}</p>
                      <p className={`text-[11px] font-medium ${urgent ? "text-red-500" : "text-amber-500"}`}>
                        {days === 0 ? "Vence hoje" : days === 1 ? "Vence amanhã" : `${days}d · ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick access cards */}
        <div className="bg-card border border-border/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Acesso Rápido</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Faturamento",
                desc: "Emitir e gerenciar faturas",
                icon: Receipt,
                color: "text-violet-500",
                bg: "bg-violet-500/10",
                path: "/financeiro/faturamento",
                badge: (data?.receivablesCount || 0) > 0 ? String(data?.receivablesCount) : null,
              },
              {
                label: "Pagamentos",
                desc: "Pagamentos a restaurantes",
                icon: HandCoins,
                color: "text-orange-500",
                bg: "bg-orange-500/10",
                path: "/financeiro/pagamentos",
                badge: (data?.pendingRestaurantCount || 0) > 0 ? String(data?.pendingRestaurantCount) : null,
              },
              {
                label: "Custos",
                desc: "Custos operacionais",
                icon: TrendingDown,
                color: "text-blue-500",
                bg: "bg-blue-500/10",
                path: "/financeiro/custos",
                badge: null,
              },
              {
                label: "Relatórios",
                desc: "Análise por período",
                icon: BarChart3,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
                path: "/financeiro/relatorios",
                badge: null,
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col gap-2 p-4 rounded-lg border border-border/20 hover:bg-muted/10 transition-colors text-left group"
              >
                {item.badge && (
                  <span className="absolute top-2.5 right-2.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="absolute bottom-3 right-3 w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
