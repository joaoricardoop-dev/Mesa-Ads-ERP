import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PieChartIcon, TrendingUp, BarChart3 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { PerRestaurantMetrics, UnitEconomics } from "@/hooks/useSimulator";

interface DashboardChartsProps {
  perRestaurant: PerRestaurantMetrics;
  unitEconomics: UnitEconomics;
  activeRestaurants: number;
  cumulativeProfit: Array<{
    month: number;
    profit: number;
    revenue: number;
  }>;
  revenueVsRestaurants: Array<{
    restaurants: number;
    revenue: number;
    profit: number;
  }>;
  minMargin: number;
}

const CHART_COLORS_DARK = {
  grid: "rgba(255,255,255,0.05)",
  axis: "rgba(255,255,255,0.3)",
  tooltipBg: "#1a1a1a",
  tooltipBorder: "rgba(255,255,255,0.15)",
};

const CHART_COLORS_LIGHT = {
  grid: "rgba(0,0,0,0.08)",
  axis: "rgba(0,0,0,0.4)",
  tooltipBg: "#ffffff",
  tooltipBorder: "rgba(0,0,0,0.12)",
};

const CHART_COLORS = {
  emerald: "#34d399",
  blue: "#60a5fa",
  amber: "#fbbf24",
  red: "#f87171",
  purple: "#a78bfa",
  orange: "#fb923c",
};

const PIE_COLORS = ["#fb923c", "#3b82f6", "#fbbf24", "#ef4444"];

function CustomTooltip({ active, payload, label, formatter, tooltipBg, tooltipBorder }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg p-3 shadow-xl"
      style={{ backgroundColor: tooltipBg || "#1a1a1a", border: `1px solid ${tooltipBorder || "rgba(255,255,255,0.15)"}` }}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardCharts({
  perRestaurant,
  unitEconomics,
  activeRestaurants,
  cumulativeProfit,
  revenueVsRestaurants,
  minMargin,
}: DashboardChartsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const themeColors = isDark ? CHART_COLORS_DARK : CHART_COLORS_LIGHT;
  const pr = perRestaurant;

  const costPieData = [
    { name: "Produção", value: pr.productionCost },
    { name: "Com. Restaurante", value: pr.restaurantCommission },
    { name: "Com. Vendedor", value: pr.sellerCommissionValue },
    { name: "Impostos", value: pr.taxValue },
  ].filter(d => d.value > 0);

  const costBarData = [
    { name: "Preço Venda", valor: pr.sellingPrice, fill: CHART_COLORS.blue },
    { name: "Produção", valor: pr.productionCost, fill: PIE_COLORS[0] },
    { name: "Com. Rest.", valor: pr.restaurantCommission, fill: PIE_COLORS[1] },
    { name: "Com. Vend.", valor: pr.sellerCommissionValue, fill: PIE_COLORS[2] },
    { name: "Impostos", valor: pr.taxValue, fill: PIE_COLORS[3] },
    { name: "Lucro", valor: pr.grossProfit, fill: CHART_COLORS.emerald },
  ];

  const revenueScaleData = revenueVsRestaurants.filter(
    (_, i) => i % 5 === 0 || i === revenueVsRestaurants.length - 1
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="border-border/30 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
            <PieChartIcon className="w-3.5 h-3.5 text-primary" />
            Composição de Custos / Rest.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {costPieData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      label="Custos"
                      tooltipBg={themeColors.tooltipBg}
                      tooltipBorder={themeColors.tooltipBorder}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
            {costPieData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                {item.name}: {formatCurrency(item.value)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/30 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            Decomposição do Preço / Rest.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costBarData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke={themeColors.grid} horizontal={false} />
                <XAxis
                  type="number"
                  stroke={themeColors.axis}
                  tick={{ fontSize: 9, fill: themeColors.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={themeColors.axis}
                  tick={{ fontSize: 9, fill: themeColors.axis }}
                  tickLine={false}
                  width={65}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      label=""
                      tooltipBg={themeColors.tooltipBg}
                      tooltipBorder={themeColors.tooltipBorder}
                    />
                  }
                />
                <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                  {costBarData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-1">
            <span className="text-[10px] text-muted-foreground">
              Preço de venda: <span className="text-foreground font-mono font-semibold">{formatCurrency(pr.sellingPrice)}</span>
              {" · "}Margem: <span className={`font-mono font-semibold ${pr.grossMargin >= minMargin ? "text-emerald-400" : "text-red-400"}`}>{formatPercent(pr.grossMargin)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/30 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            Projeção de Lucro Acumulado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeProfit}>
                <defs>
                  <linearGradient id="gradCumProfitNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={themeColors.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke={themeColors.axis}
                  tick={{ fontSize: 9, fill: themeColors.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `M${v}`}
                />
                <YAxis
                  stroke={themeColors.axis}
                  tick={{ fontSize: 9, fill: themeColors.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      label=""
                      tooltipBg={themeColors.tooltipBg}
                      tooltipBorder={themeColors.tooltipBorder}
                    />
                  }
                />
                <ReferenceLine y={0} stroke={themeColors.axis} strokeWidth={1} />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Lucro Acumulado"
                  stroke={CHART_COLORS.emerald}
                  fill="url(#gradCumProfitNew)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Receita Acumulada"
                  stroke={CHART_COLORS.blue}
                  fill="none"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-3 h-0.5 bg-emerald-400 rounded" />
              Lucro
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div className="w-3 h-0.5 bg-blue-400 rounded border-dashed" />
              Receita
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
