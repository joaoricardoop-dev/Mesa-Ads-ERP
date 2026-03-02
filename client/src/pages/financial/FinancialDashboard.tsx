import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { formatCurrency, formatPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  PieChart as PieChartIcon,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#27d803", "hsl(200, 70%, 50%)", "hsl(150, 60%, 45%)"];

export default function FinancialDashboard() {
  const { data, isLoading } = trpc.financial.dashboard.useQuery();

  const kpis = [
    {
      label: "Faturamento do Mês",
      value: formatCurrency(data?.revenue || 0),
      icon: BarChart3,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Custo Operacional",
      value: formatCurrency(data?.totalCosts || 0),
      icon: TrendingDown,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Margem Bruta",
      value: `${formatCurrency(data?.margin || 0)} (${formatPercent(data?.marginPercent || 0)})`,
      icon: TrendingUp,
      color: (data?.margin || 0) >= 0 ? "text-emerald-500" : "text-red-500",
      bg: (data?.margin || 0) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      label: "Inadimplência",
      value: formatCurrency(data?.overdue || 0),
      icon: AlertTriangle,
      color: (data?.overdue || 0) > 0 ? "text-red-500" : "text-muted-foreground",
      bg: (data?.overdue || 0) > 0 ? "bg-red-500/10" : "bg-muted/10",
    },
    {
      label: "A Receber",
      value: formatCurrency(data?.receivables || 0),
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  const pieData = data
    ? [
        { name: "Produção", value: data.costBreakdown.production },
        { name: "Frete", value: data.costBreakdown.freight },
        { name: "Remuneração", value: data.costBreakdown.restaurantCosts },
      ].filter((d) => d.value > 0)
    : [];

  const marginData = (data?.monthlyRevenue || []).map((m) => ({
    month: m.month.slice(5),
    revenue: m.revenue,
  }));

  if (isLoading) {
    return (
      <PageContainer title="Dashboard Financeiro">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Dashboard Financeiro" description="Visão geral financeira do negócio">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border/30 bg-card p-4 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${kpi.bg}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold tracking-tight">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Faturamento Mensal" icon={BarChart3}>
          {marginData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={marginData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Faturamento"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Bar dataKey="revenue" fill="#27d803" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Nenhum dado de faturamento disponível
            </div>
          )}
        </Section>

        <Section title="Composição de Custos" icon={PieChartIcon}>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value)]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Nenhum custo registrado
            </div>
          )}
        </Section>
      </div>

      <Section title="Evolução do Faturamento" icon={TrendingUp}>
        {marginData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Receita"]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Line type="monotone" dataKey="revenue" stroke="#27d803" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Nenhum dado disponível
          </div>
        )}
      </Section>

      <Section title="Projeções" icon={Target}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border/20 bg-muted/5">
            <p className="text-xs text-muted-foreground mb-1">Pipeline Comercial</p>
            <p className="text-2xl font-bold">{data?.pipeline || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">cotações ativas</p>
          </div>
          <div className="p-4 rounded-lg border border-border/20 bg-muted/5">
            <p className="text-xs text-muted-foreground mb-1">Receita Projetada (3 meses)</p>
            <p className="text-2xl font-bold">{formatCurrency((data?.revenue || 0) * 3)}</p>
            <p className="text-xs text-muted-foreground mt-1">baseado no mês atual</p>
          </div>
        </div>
      </Section>
    </PageContainer>
  );
}
