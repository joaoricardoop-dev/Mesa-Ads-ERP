/*
 * Design: Bloomberg Terminal Reimaginado
 * Comparação visual de 3 cenários: Conservador, Base, Premium
 * Cards lado a lado com destaque no cenário Base
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScenarioData } from "@/hooks/useSimulator";
import { formatCurrency, formatPercent, formatCompact } from "@/lib/format";
import { Layers, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";

interface ScenarioComparisonProps {
  scenarios: ScenarioData[];
}

export default function ScenarioComparison({ scenarios }: ScenarioComparisonProps) {
  const scenarioStyles = [
    {
      border: "border-blue-500/30",
      bg: "bg-blue-500/5",
      accent: "text-blue-400",
      badge: "bg-blue-500/20 text-blue-400",
      icon: <Minus className="w-4 h-4" />,
    },
    {
      border: "border-primary/50",
      bg: "bg-primary/10",
      accent: "text-primary",
      badge: "bg-primary/20 text-primary",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      accent: "text-amber-400",
      badge: "bg-amber-500/20 text-amber-400",
      icon: <TrendingUp className="w-4 h-4" />,
    },
  ];

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Simulador de Cenários — Mesa Ads
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Comparação de faturamento e lucro da Mesa Ads em 3 cenários de markup. Restaurantes recebem comissão.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((scenario, i) => {
            const style = scenarioStyles[i];
            const isBase = i === 1;

            return (
              <motion.div
                key={scenario.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div
                  className={`rounded-lg border p-4 ${style.border} ${style.bg} ${
                    isBase ? "ring-1 ring-primary/30 shadow-lg shadow-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}
                    >
                      {style.icon}
                      {scenario.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      Markup {scenario.markup}%
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        Faturamento Mesa Ads / Rest.
                      </p>
                      <p className="font-mono text-lg font-bold tabular-nums">
                        {formatCurrency(scenario.revenue)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        Lucro Mesa Ads / Rest.
                      </p>
                      <p
                        className={`font-mono text-lg font-bold tabular-nums ${
                          scenario.profit > 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatCurrency(scenario.profit)}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Margem
                        </span>
                        <span
                          className={`font-mono text-sm font-semibold ${
                            scenario.margin >= 30 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {formatPercent(scenario.margin)}
                        </span>
                      </div>
                      {/* Margin bar */}
                      <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            scenario.margin >= 50
                              ? "bg-emerald-400"
                              : scenario.margin >= 30
                                ? "bg-amber-400"
                                : "bg-red-400"
                          }`}
                          style={{ width: `${Math.min(Math.max(scenario.margin, 0), 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/30 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-muted-foreground">Lucro Mensal Total</span>
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {formatCompact(scenario.monthlyTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-muted-foreground">Anual Projetado</span>
                        <span className="font-mono text-xs font-semibold tabular-nums">
                          {formatCompact(scenario.annualTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
