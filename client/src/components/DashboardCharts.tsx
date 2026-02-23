/*
 * Design: Bloomberg Terminal Reimaginado
 * Gráficos Recharts com tema dark, cores emerald/amber/blue
 * Grid 2x2 de gráficos
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import { BarChart3, TrendingUp, Activity, Percent } from "lucide-react";

interface DashboardChartsProps {
  revenueVsRestaurants: Array<{
    restaurants: number;
    revenue: number;
    profit: number;
  }>;
  marginVsCpm: Array<{ cpm: number; margin: number; profit: number }>;
  cumulativeProfit: Array<{
    month: number;
    profit: number;
    revenue: number;
  }>;
  discountSensitivity: Array<{
    discount: number;
    margin: number;
    profit: number;
    belowMin: boolean;
  }>;
  minMargin: number;
}

const CHART_COLORS = {
  emerald: "#34d399",
  emeraldDark: "#059669",
  amber: "#fbbf24",
  blue: "#60a5fa",
  red: "#f87171",
  grid: "rgba(255,255,255,0.05)",
  axis: "rgba(255,255,255,0.3)",
  tooltip: "#1e293b",
};

function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e293b] border border-border/50 rounded-lg p-3 shadow-xl">
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
          <span className="font-mono font-semibold tabular-nums">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardCharts({
  revenueVsRestaurants,
  marginVsCpm,
  cumulativeProfit,
  discountSensitivity,
  minMargin,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Receita vs Restaurantes */}
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Faturamento Mesa Ads vs Restaurantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueVsRestaurants}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="restaurants"
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                />
                <YAxis
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      label=""
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Faturamento"
                  stroke={CHART_COLORS.emerald}
                  fill="url(#gradRevenue)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Lucro Mesa Ads"
                  stroke={CHART_COLORS.blue}
                  fill="url(#gradProfit)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Margem vs CPM */}
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" />
            Margem Mesa Ads vs CPM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginVsCpm}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="cpm"
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `R$${v}`}
                />
                <YAxis
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatPercent(v)}
                      label=""
                    />
                  }
                />
                <ReferenceLine
                  y={minMargin}
                  stroke={CHART_COLORS.red}
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Min ${minMargin}%`,
                    position: "right",
                    fill: CHART_COLORS.red,
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  name="Margem Mesa Ads"
                  stroke={CHART_COLORS.emerald}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: CHART_COLORS.emerald }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Lucro Acumulado */}
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Lucro Acumulado (24 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeProfit}>
                <defs>
                  <linearGradient id="gradCumProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `M${v}`}
                />
                <YAxis
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatCurrency(v)}
                      label=""
                    />
                  }
                />
                <ReferenceLine y={0} stroke={CHART_COLORS.axis} strokeWidth={1} />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Lucro Acumulado Mesa Ads"
                  stroke={CHART_COLORS.emerald}
                  fill="url(#gradCumProfit)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sensibilidade de Desconto */}
      <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Sensibilidade de Desconto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={discountSensitivity}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="discount"
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  stroke={CHART_COLORS.axis}
                  tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <RechartsTooltip
                  content={
                    <CustomTooltip
                      formatter={(v: number) => formatPercent(v)}
                      label=""
                    />
                  }
                />
                <ReferenceLine
                  y={minMargin}
                  stroke={CHART_COLORS.red}
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Min ${minMargin}%`,
                    position: "right",
                    fill: CHART_COLORS.red,
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="margin" name="Margem Mesa Ads" radius={[3, 3, 0, 0]}>
                  {discountSensitivity.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.belowMin ? CHART_COLORS.red : CHART_COLORS.emerald}
                      fillOpacity={entry.belowMin ? 0.6 : 0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
