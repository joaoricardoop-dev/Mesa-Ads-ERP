import type { PerRestaurantMetrics, UnitEconomics } from "@/hooks/useSimulator";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  Target,
  BarChart3,
  Package,
  Store,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";

interface KPICardsProps {
  perRestaurant: PerRestaurantMetrics;
  unitEconomics: UnitEconomics;
  activeRestaurants: number;
  contractDuration: number;
  coastersPerRestaurant: number;
  minMargin: number;
}

function KPICard({
  label,
  value,
  sub,
  icon,
  accent,
  warn,
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  warn?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`bg-card border rounded-xl p-4 transition-colors ${
        warn
          ? "border-red-500/30"
          : accent
            ? "border-primary/30"
            : "border-border/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
          {label}
        </span>
        <div
          className={`p-1.5 rounded-md ${
            warn
              ? "bg-red-500/10 text-red-400"
              : accent
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
      </div>
      <div
        className={`font-mono text-xl font-bold tabular-nums tracking-tight ${
          warn ? "text-red-400" : accent ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          {warn && <TrendingDown className="w-3 h-3 text-red-400" />}
          {accent && !warn && <TrendingUp className="w-3 h-3 text-emerald-400" />}
          {sub}
        </p>
      )}
    </motion.div>
  );
}

export default function KPICards({
  perRestaurant,
  unitEconomics,
  activeRestaurants,
  contractDuration,
  coastersPerRestaurant,
  minMargin,
}: KPICardsProps) {
  const totalImpressionsMonth = perRestaurant.impressions * activeRestaurants;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KPICard
        label="Receita Mensal"
        value={formatCurrency(unitEconomics.monthlyRevenue)}
        sub={`${formatCurrency(perRestaurant.sellingPrice)} × ${activeRestaurants} rest.`}
        icon={<Banknote className="w-3.5 h-3.5" />}
        accent
        delay={0}
      />
      <KPICard
        label="Lucro Líquido / Mês"
        value={formatCurrency(unitEconomics.monthlyProfit)}
        sub={`${formatCurrency(perRestaurant.grossProfit)} / rest.`}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        accent={unitEconomics.monthlyProfit > 0}
        warn={unitEconomics.monthlyProfit <= 0}
        delay={0.05}
      />
      <KPICard
        label="Margem Líquida"
        value={formatPercent(perRestaurant.grossMargin)}
        sub={perRestaurant.grossMargin >= minMargin ? "Margem saudável" : "Abaixo do mínimo"}
        icon={<Target className="w-3.5 h-3.5" />}
        accent={perRestaurant.grossMargin >= minMargin}
        warn={perRestaurant.grossMargin < minMargin}
        delay={0.1}
      />
      <KPICard
        label="Valor do Contrato"
        value={formatCurrency(unitEconomics.contractValue)}
        sub={`${contractDuration} meses · Lucro: ${formatCurrency(unitEconomics.contractProfit)}`}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        accent
        delay={0.15}
      />
      <KPICard
        label="Impressões / Mês"
        value={formatNumber(totalImpressionsMonth)}
        sub={`${formatNumber(perRestaurant.impressions)} / rest.`}
        icon={<Eye className="w-3.5 h-3.5" />}
        delay={0.2}
      />
      <KPICard
        label="Coasters Totais"
        value={formatNumber(coastersPerRestaurant * activeRestaurants)}
        sub={`${formatNumber(coastersPerRestaurant)} / rest.`}
        icon={<Package className="w-3.5 h-3.5" />}
        delay={0.25}
      />
      <KPICard
        label="Restaurantes"
        value={String(activeRestaurants)}
        sub={`Preço/rest: ${formatCurrency(perRestaurant.sellingPrice)}`}
        icon={<Store className="w-3.5 h-3.5" />}
        delay={0.3}
      />
      <KPICard
        label="Receita Anual"
        value={formatCurrency(unitEconomics.annualRevenue)}
        sub={`Lucro anual: ${formatCurrency(unitEconomics.annualProfit)}`}
        icon={<Banknote className="w-3.5 h-3.5" />}
        accent
        delay={0.35}
      />
    </div>
  );
}
