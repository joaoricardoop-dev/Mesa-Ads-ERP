/*
 * Design: Bloomberg Terminal Reimaginado
 * Painel de Unit Economics com métricas-chave em destaque
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UnitEconomics } from "@/hooks/useSimulator";
import { formatCurrency, formatCompact } from "@/lib/format";
import { Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface UnitEconomicsPanelProps {
  data: UnitEconomics;
  cacPerRestaurant: number;
  contractDuration: number;
}

export default function UnitEconomicsPanel({
  data,
  cacPerRestaurant,
  contractDuration,
}: UnitEconomicsPanelProps) {
  const ltvCacHealthy = data.ltvCacRatio >= 3;
  const ltvCacGood = data.ltvCacRatio >= 5;

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Unit Economics — Mesa Ads
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Métricas da Mesa Ads por restaurante parceiro. LTV baseado no lucro líquido (após comissão ao restaurante e produção).
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* LTV */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="col-span-2 md:col-span-1 rounded-lg border border-primary/30 bg-primary/5 p-4"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              LTV (Lifetime Value)
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums text-primary">
              {formatCurrency(data.ltv)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Lucro Mesa Ads x {contractDuration} meses
            </p>
          </motion.div>

          {/* LTV/CAC */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`rounded-lg border p-4 ${
              ltvCacGood
                ? "border-emerald-500/30 bg-emerald-500/5"
                : ltvCacHealthy
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-red-500/30 bg-red-500/5"
            }`}
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              LTV / CAC
            </p>
            <p
              className={`font-mono text-2xl font-bold tabular-nums ${
                ltvCacGood
                  ? "text-emerald-400"
                  : ltvCacHealthy
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {data.ltvCacRatio.toFixed(1)}x
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ltvCacGood
                ? "Excelente"
                : ltvCacHealthy
                  ? "Saudável"
                  : "Abaixo do ideal (< 3x)"}
            </p>
          </motion.div>

          {/* CAC */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-lg border border-border/30 bg-secondary/20 p-4"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              CAC
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {formatCurrency(cacPerRestaurant)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Custo de aquisição do restaurante
            </p>
          </motion.div>

          {/* Flow: LTV → CAC → Ratio */}
          <div className="col-span-2 md:col-span-3 rounded-lg border border-border/30 bg-secondary/10 p-4">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Faturamento Mensal
                </p>
                <p className="font-mono text-sm font-bold tabular-nums">
                  {formatCompact(data.monthlyRevenue)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Lucro Mensal Mesa Ads
                </p>
                <p className="font-mono text-sm font-bold tabular-nums text-emerald-400">
                  {formatCompact(data.monthlyProfit)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Faturamento Anual
                </p>
                <p className="font-mono text-sm font-bold tabular-nums">
                  {formatCompact(data.annualRevenue)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Lucro Anual Mesa Ads
                </p>
                <p className="font-mono text-sm font-bold tabular-nums text-emerald-400">
                  {formatCompact(data.annualProfit)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
