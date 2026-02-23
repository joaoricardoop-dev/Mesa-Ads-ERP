/*
 * Design: Bloomberg Terminal Reimaginado
 * Cards de KPI com números grandes em JetBrains Mono
 * Indicadores de cor: verde para positivo, vermelho para alerta
 */

import { Card, CardContent } from "@/components/ui/card";
import type { PerRestaurantMetrics, UnitEconomics } from "@/hooks/useSimulator";
import { formatCurrency, formatNumber, formatPercent, formatCompact } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Eye,
  DollarSign,
  BarChart3,
  Target,
  Zap,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";

interface KPICardsProps {
  perRestaurant: PerRestaurantMetrics;
  unitEconomics: UnitEconomics;
  activeRestaurants: number;
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  highlight?: boolean;
  delay?: number;
}

function KPICard({ title, value, subtitle, icon, trend, highlight, delay = 0 }: KPICardProps) {
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-red-400"
        : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card
        className={`border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 ${
          highlight ? "border-primary/40 shadow-md shadow-primary/10" : ""
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              {title}
            </span>
            <div className={`p-1.5 rounded-md bg-primary/10 ${trendColor}`}>
              {icon}
            </div>
          </div>
          <div className="font-mono text-xl font-bold tabular-nums tracking-tight">
            {value}
          </div>
          {subtitle && (
            <div className={`text-xs mt-1 flex items-center gap-1 ${trendColor}`}>
              {trend === "up" && <TrendingUp className="w-3 h-3" />}
              {trend === "down" && <TrendingDown className="w-3 h-3" />}
              {subtitle}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function KPICards({
  perRestaurant,
  unitEconomics,
  activeRestaurants,
}: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard
        title="Impressões / Restaurante"
        value={formatNumber(perRestaurant.impressions)}
        subtitle="por mês"
        icon={<Eye className="w-3.5 h-3.5" />}
        trend="neutral"
        delay={0}
      />
      <KPICard
        title="Faturamento Mesa Ads / Rest."
        value={formatCurrency(perRestaurant.revenue)}
        subtitle={`Receita bruta por ponto`}
        icon={<DollarSign className="w-3.5 h-3.5" />}
        trend="up"
        delay={0.05}
      />
      <KPICard
        title="Lucro Mesa Ads / Rest."
        value={formatCurrency(perRestaurant.grossProfit)}
        subtitle={`Após comissão e produção`}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        trend={perRestaurant.grossProfit > 0 ? "up" : "down"}
        highlight={perRestaurant.grossProfit > 0}
        delay={0.1}
      />
      <KPICard
        title="Margem Bruta"
        value={formatPercent(perRestaurant.grossMargin)}
        subtitle={perRestaurant.grossMargin >= 30 ? "Saudável" : "Atenção"}
        icon={<Target className="w-3.5 h-3.5" />}
        trend={perRestaurant.grossMargin >= 30 ? "up" : "down"}
        delay={0.15}
      />
      <KPICard
        title="LTV"
        value={formatCurrency(unitEconomics.ltv)}
        subtitle={`LTV/CAC: ${unitEconomics.ltvCacRatio.toFixed(1)}x`}
        icon={<Zap className="w-3.5 h-3.5" />}
        trend={unitEconomics.ltvCacRatio >= 3 ? "up" : "down"}
        highlight={unitEconomics.ltvCacRatio >= 3}
        delay={0.2}
      />
      <KPICard
        title="Faturamento Mensal Mesa Ads"
        value={formatCompact(unitEconomics.monthlyRevenue)}
        subtitle={`${activeRestaurants} restaurantes ativos`}
        icon={<DollarSign className="w-3.5 h-3.5" />}
        trend="up"
        delay={0.25}
      />
      <KPICard
        title="Lucro Mensal Mesa Ads"
        value={formatCompact(unitEconomics.monthlyProfit)}
        subtitle="após comissões e produção"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        trend={unitEconomics.monthlyProfit > 0 ? "up" : "down"}
        delay={0.3}
      />
      <KPICard
        title="Faturamento Anual Projetado"
        value={formatCompact(unitEconomics.annualRevenue)}
        subtitle={`Lucro: ${formatCompact(unitEconomics.annualProfit)}`}
        icon={<Calendar className="w-3.5 h-3.5" />}
        trend="up"
        delay={0.35}
      />
    </div>
  );
}
