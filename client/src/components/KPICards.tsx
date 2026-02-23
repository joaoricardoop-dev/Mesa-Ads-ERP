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
  HandCoins,
  Users,
  Factory,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";

interface KPICardsProps {
  perRestaurant: PerRestaurantMetrics;
  unitEconomics: UnitEconomics;
  activeRestaurants: number;
  contractDuration: number;
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
  contractDuration,
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
        title="Preço de Venda / Rest."
        value={formatCurrency(perRestaurant.totalCosts + perRestaurant.markupValue)}
        subtitle={`Custo bruto: ${formatCurrency(perRestaurant.totalCosts)}`}
        icon={<DollarSign className="w-3.5 h-3.5" />}
        trend="up"
        delay={0.05}
      />
      <KPICard
        title="Lucro Mesa Ads / Rest."
        value={formatCurrency(perRestaurant.grossProfit)}
        subtitle="Após todos os custos"
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        trend={perRestaurant.grossProfit > 0 ? "up" : "down"}
        highlight={perRestaurant.grossProfit > 0}
        delay={0.1}
      />
      <KPICard
        title="Margem Real"
        value={formatPercent(perRestaurant.grossMargin)}
        subtitle={perRestaurant.grossMargin >= 15 ? "Saudável" : "Atenção"}
        icon={<Target className="w-3.5 h-3.5" />}
        trend={perRestaurant.grossMargin >= 15 ? "up" : "down"}
        delay={0.15}
      />
      <KPICard
        title="Preço Final do Contrato"
        value={formatCurrency((perRestaurant.totalCosts + perRestaurant.markupValue) * activeRestaurants * contractDuration)}
        subtitle={`Custos + markup × ${activeRestaurants} rest. × ${contractDuration} meses`}
        icon={<FileText className="w-3.5 h-3.5" />}
        trend="up"
        highlight
        delay={0.2}
      />
      <KPICard
        title="Comissão / Restaurante"
        value={formatCurrency(perRestaurant.restaurantCommission)}
        subtitle="Pago ao restaurante/mês"
        icon={<HandCoins className="w-3.5 h-3.5" />}
        trend="neutral"
        delay={0.25}
      />
      <KPICard
        title="Comissão Vendedor / Rest."
        value={formatCurrency(perRestaurant.sellerCommissionValue)}
        subtitle="Sobre preço de venda"
        icon={<Users className="w-3.5 h-3.5" />}
        trend="neutral"
        delay={0.3}
      />
      <KPICard
        title="Custo de Produção / Rest."
        value={formatCurrency(perRestaurant.productionCost)}
        subtitle={`Unitário: ${formatCurrency(perRestaurant.unitProductionCost)}`}
        icon={<Factory className="w-3.5 h-3.5" />}
        trend="down"
        delay={0.35}
      />
    </div>
  );
}
