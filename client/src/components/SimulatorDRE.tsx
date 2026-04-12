import type { PerRestaurantMetrics, UnitEconomics } from "@/hooks/useSimulator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { motion } from "framer-motion";

interface SimulatorDREProps {
  perRestaurant: PerRestaurantMetrics;
  unitEconomics: UnitEconomics;
  activeRestaurants: number;
  contractDuration: number;
  minMargin: number;
  weightedScore?: number;
  allocationValid?: boolean;
}

function DRERow({
  label,
  perRest,
  total,
  contract,
  pct,
  bold,
  accent,
  warn,
  sub,
  separator,
  muted,
}: {
  label: string;
  perRest: string;
  total: string;
  contract: string;
  pct?: string;
  bold?: boolean;
  accent?: boolean;
  warn?: boolean;
  sub?: boolean;
  separator?: boolean;
  muted?: boolean;
}) {
  const textClass = warn
    ? "text-red-400"
    : accent
      ? "text-emerald-400"
      : muted
        ? "text-muted-foreground/60"
        : bold
          ? "text-foreground"
          : "text-muted-foreground";
  const fontClass = bold ? "font-semibold" : "font-normal";

  return (
    <>
      {separator && <tr><td colSpan={5} className="py-1"><div className="border-t border-border/20" /></td></tr>}
      <tr className={`text-xs ${textClass}`}>
        <td className={`py-1.5 ${sub ? "pl-4" : "pl-0"} ${fontClass}`}>{label}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{perRest}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{total}</td>
        <td className={`py-1.5 text-right font-mono tabular-nums ${fontClass}`}>{contract}</td>
        {pct !== undefined && (
          <td className={`py-1.5 text-right font-mono tabular-nums text-[10px] ${textClass}`}>{pct}</td>
        )}
      </tr>
    </>
  );
}

function CostCard({ label, value, monthly }: { label: string; value: string; monthly: string }) {
  return (
    <div className="bg-background/50 border border-border/20 rounded-lg p-3 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className="font-mono font-bold text-sm mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{monthly}/mês</p>
    </div>
  );
}

export default function SimulatorDRE({
  perRestaurant,
  unitEconomics,
  activeRestaurants,
  contractDuration,
  minMargin,
  weightedScore,
  allocationValid,
}: SimulatorDREProps) {
  const pr = perRestaurant;
  const n = activeRestaurants;
  const d = contractDuration;

  const totalProduction = pr.productionCost * n;
  const totalRestComm = pr.restaurantCommission * n;
  const totalAgencyComm = pr.agencyCommission * n;
  const totalSellerComm = pr.sellerCommissionValue * n;
  const totalTax = pr.taxValue * n;
  const totalCosts = pr.totalCosts * n;
  const revenue = pr.sellingPrice * n;
  const grossProfit = pr.grossProfit * n;

  const veiculacaoPerRest = pr.grossProfit;
  const veiculacaoTotal = grossProfit;

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
          <h3 className="text-sm font-semibold">Orçamento da Simulação</h3>
          <p className="text-[10px] text-muted-foreground">Composição do preço — por restaurante, mensal e contrato</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Locais</p>
            <p className="text-sm font-mono font-bold">{n}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Contrato</p>
            <p className="text-sm font-mono font-bold">{d}m</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
              <th className="text-left pb-2 font-medium">Componente</th>
              <th className="text-right pb-2 font-medium">/ Rest.</th>
              <th className="text-right pb-2 font-medium">Total / Mês</th>
              <th className="text-right pb-2 font-medium">Contrato ({d}m)</th>
              <th className="text-right pb-2 font-medium">% Preço</th>
            </tr>
          </thead>
          <tbody>
            <DRERow
              label="Receita de Veiculação"
              perRest={formatCurrency(veiculacaoPerRest)}
              total={formatCurrency(veiculacaoTotal)}
              contract={formatCurrency(veiculacaoTotal * d)}
              pct={pctOf(veiculacaoTotal)}
              bold
              accent={veiculacaoPerRest > 0}
              warn={veiculacaoPerRest <= 0}
            />

            <DRERow label="" perRest="" total="" contract="" pct="" separator />

            <DRERow
              label="Receita de Produção"
              perRest={formatCurrency(pr.productionCost)}
              total={formatCurrency(totalProduction)}
              contract={formatCurrency(totalProduction * d)}
              pct={pctOf(totalProduction)}
              sub
            />
            <DRERow
              label="Receita de Comissão Local"
              perRest={formatCurrency(pr.restaurantCommission)}
              total={formatCurrency(totalRestComm)}
              contract={formatCurrency(totalRestComm * d)}
              pct={pctOf(totalRestComm)}
              sub
            />
            <DRERow
              label="Receita de Comissão Agência"
              perRest={formatCurrency(pr.agencyCommission)}
              total={formatCurrency(totalAgencyComm)}
              contract={formatCurrency(totalAgencyComm * d)}
              pct={pctOf(totalAgencyComm)}
              sub
            />
            <DRERow
              label="Receita de Comissão Vendedor"
              perRest={formatCurrency(pr.sellerCommissionValue)}
              total={formatCurrency(totalSellerComm)}
              contract={formatCurrency(totalSellerComm * d)}
              pct={pctOf(totalSellerComm)}
              sub
            />
            <DRERow
              label="Impostos"
              perRest={formatCurrency(pr.taxValue)}
              total={formatCurrency(totalTax)}
              contract={formatCurrency(totalTax * d)}
              pct={pctOf(totalTax)}
              sub
            />

            <DRERow label="" perRest="" total="" contract="" pct="" separator />

            <DRERow
              label="Preço Total (cobrado do cliente)"
              perRest={formatCurrency(pr.sellingPrice)}
              total={formatCurrency(revenue)}
              contract={formatCurrency(revenue * d)}
              pct="100,0%"
              bold
            />

            <DRERow label="" perRest="" total="" contract="" pct="" separator />

            <DRERow
              label="Margem Mesa Ads"
              perRest={formatCurrency(pr.grossProfit)}
              total={formatCurrency(grossProfit)}
              contract={formatCurrency(grossProfit * d)}
              pct={formatPercent(pr.grossMargin)}
              bold
              accent={pr.grossProfit > 0}
              warn={pr.grossProfit <= 0}
            />
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-border/20 bg-card/50">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
          Composição do Contrato ({d} meses × {n} restaurantes)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          <CostCard label="Veiculação" value={formatCurrency(veiculacaoTotal * d)} monthly={formatCurrency(veiculacaoTotal)} />
          <CostCard label="Produção" value={formatCurrency(totalProduction * d)} monthly={formatCurrency(totalProduction)} />
          <CostCard label="Com. Local" value={formatCurrency(totalRestComm * d)} monthly={formatCurrency(totalRestComm)} />
          <CostCard label="Com. Agência" value={formatCurrency(totalAgencyComm * d)} monthly={formatCurrency(totalAgencyComm)} />
          <CostCard label="Com. Vendedor" value={formatCurrency(totalSellerComm * d)} monthly={formatCurrency(totalSellerComm)} />
          <CostCard label="Impostos" value={formatCurrency(totalTax * d)} monthly={formatCurrency(totalTax)} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t border-border/20 pt-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita Contrato</p>
            <p className="font-mono font-bold text-sm text-primary">{formatCurrency(unitEconomics.contractValue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Repasses</p>
            <p className="font-mono font-bold text-sm text-red-400">{formatCurrency(totalCosts * d)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Margem Contrato</p>
            <p className={`font-mono font-bold text-sm ${unitEconomics.contractProfit > 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(unitEconomics.contractProfit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita Anual</p>
            <p className="font-mono font-bold text-sm">{formatCurrency(unitEconomics.annualRevenue)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
