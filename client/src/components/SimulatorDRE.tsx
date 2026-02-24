import type { PerRestaurantMetrics, UnitEconomics } from "@/hooks/useSimulator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { motion } from "framer-motion";

interface SimulatorDREProps {
  perRestaurant: PerRestaurantMetrics;
  unitEconomics: UnitEconomics;
  activeRestaurants: number;
  contractDuration: number;
  minMargin: number;
}

function DRERow({
  label,
  perRest,
  total,
  pct,
  bold,
  accent,
  warn,
  sub,
  separator,
}: {
  label: string;
  perRest: string;
  total: string;
  pct?: string;
  bold?: boolean;
  accent?: boolean;
  warn?: boolean;
  sub?: boolean;
  separator?: boolean;
}) {
  const textClass = warn
    ? "text-red-400"
    : accent
      ? "text-emerald-400"
      : bold
        ? "text-foreground"
        : "text-muted-foreground";
  const fontClass = bold ? "font-semibold" : "font-normal";

  return (
    <>
      {separator && <tr><td colSpan={4} className="py-1"><div className="border-t border-border/20" /></td></tr>}
      <tr className={`text-xs ${textClass}`}>
        <td className={`py-1.5 ${sub ? "pl-4" : "pl-0"} ${fontClass}`}>{label}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{perRest}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{total}</td>
        {pct !== undefined && (
          <td className={`py-1.5 text-right font-mono tabular-nums text-[10px] ${textClass}`}>{pct}</td>
        )}
      </tr>
    </>
  );
}

export default function SimulatorDRE({
  perRestaurant,
  unitEconomics,
  activeRestaurants,
  contractDuration,
  minMargin,
}: SimulatorDREProps) {
  const pr = perRestaurant;
  const n = activeRestaurants;

  const totalProduction = pr.productionCost * n;
  const totalRestComm = pr.restaurantCommission * n;
  const totalSellerComm = pr.sellerCommissionValue * n;
  const totalTax = pr.taxValue * n;
  const totalCosts = pr.totalCosts * n;
  const revenue = pr.sellingPrice * n;
  const grossProfit = pr.grossProfit * n;

  const pctOf = (val: number) => revenue > 0 ? `${((val / revenue) * 100).toFixed(1)}%` : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-card border border-border/30 rounded-xl overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border/20 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">DRE da Simulação</h3>
          <p className="text-[10px] text-muted-foreground">Demonstrativo de Resultado — valores mensais</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Restaurantes</p>
            <p className="text-sm font-mono font-bold">{n}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Contrato</p>
            <p className="text-sm font-mono font-bold">{contractDuration}m</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
              <th className="text-left pb-2 font-medium">Item</th>
              <th className="text-right pb-2 font-medium">/ Rest.</th>
              <th className="text-right pb-2 font-medium">Total / Mês</th>
              <th className="text-right pb-2 font-medium">% Receita</th>
            </tr>
          </thead>
          <tbody>
            <DRERow
              label="Receita Bruta (Preço de Venda)"
              perRest={formatCurrency(pr.sellingPrice)}
              total={formatCurrency(revenue)}
              pct="100,0%"
              bold
            />

            <DRERow label="" perRest="" total="" pct="" separator />

            <DRERow
              label="(-) Custo de Produção"
              perRest={formatCurrency(pr.productionCost)}
              total={formatCurrency(totalProduction)}
              pct={pctOf(totalProduction)}
              sub
            />
            <DRERow
              label="(-) Comissão Restaurante"
              perRest={formatCurrency(pr.restaurantCommission)}
              total={formatCurrency(totalRestComm)}
              pct={pctOf(totalRestComm)}
              sub
            />
            <DRERow
              label="(-) Comissão Vendedor"
              perRest={formatCurrency(pr.sellerCommissionValue)}
              total={formatCurrency(totalSellerComm)}
              pct={pctOf(totalSellerComm)}
              sub
            />
            <DRERow
              label="(-) Impostos"
              perRest={formatCurrency(pr.taxValue)}
              total={formatCurrency(totalTax)}
              pct={pctOf(totalTax)}
              sub
            />

            <DRERow label="" perRest="" total="" pct="" separator />

            <DRERow
              label="Total de Custos"
              perRest={formatCurrency(pr.totalCosts)}
              total={formatCurrency(totalCosts)}
              pct={pctOf(totalCosts)}
              bold
              warn={pr.grossMargin < minMargin}
            />

            <DRERow label="" perRest="" total="" pct="" separator />

            <DRERow
              label="Lucro Líquido (Mesa Ads)"
              perRest={formatCurrency(pr.grossProfit)}
              total={formatCurrency(grossProfit)}
              pct={formatPercent(pr.grossMargin)}
              bold
              accent={pr.grossProfit > 0}
              warn={pr.grossProfit <= 0}
            />
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-border/20 bg-card/50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contrato Total</p>
            <p className="font-mono font-bold text-sm text-primary">{formatCurrency(unitEconomics.contractValue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lucro do Contrato</p>
            <p className={`font-mono font-bold text-sm ${unitEconomics.contractProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(unitEconomics.contractProfit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita Anual</p>
            <p className="font-mono font-bold text-sm">{formatCurrency(unitEconomics.annualRevenue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lucro Anual</p>
            <p className={`font-mono font-bold text-sm ${unitEconomics.annualProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(unitEconomics.annualProfit)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
