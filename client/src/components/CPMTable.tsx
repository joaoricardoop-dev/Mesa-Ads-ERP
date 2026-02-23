import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarkupTableRow } from "@/hooks/useSimulator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { BarChart3 } from "lucide-react";

interface MarkupTableProps {
  data: MarkupTableRow[];
  currentMarkup: number;
  minMargin: number;
}

export default function MarkupTable({ data, currentMarkup, minMargin }: MarkupTableProps) {
  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Precificação por Markup — Faturamento Mesa Ads
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Receita da Mesa Ads por restaurante, variando markup de 50% a 300% sobre o custo de produção. Comissão é paga ao restaurante parceiro.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Markup
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Faturamento
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Comissão Rest.
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Produção
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Lucro Mesa Ads
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Margem
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const isActive = row.markup === currentMarkup || (currentMarkup >= row.markup && i < data.length - 1 && currentMarkup < data[i + 1].markup);
                const isBelowMargin = row.margin < minMargin;

                return (
                  <tr
                    key={row.markup}
                    className={`border-b border-border/20 transition-colors ${
                      isActive
                        ? "bg-primary/10 border-primary/30"
                        : i % 2 === 0
                          ? "bg-transparent"
                          : "bg-secondary/20"
                    } ${isBelowMargin ? "opacity-60" : ""}`}
                  >
                    <td className="p-3 font-mono font-semibold">
                      <span className="flex items-center gap-2">
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                        {row.markup}%
                      </span>
                    </td>
                    <td className="p-3 font-mono text-right tabular-nums">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="p-3 font-mono text-right tabular-nums text-amber-400/80">
                      {formatCurrency(row.commission)}
                    </td>
                    <td className="p-3 font-mono text-right tabular-nums text-muted-foreground">
                      {formatCurrency(row.production)}
                    </td>
                    <td
                      className={`p-3 font-mono text-right tabular-nums font-semibold ${
                        row.profit > 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                          isBelowMargin
                            ? "bg-red-500/20 text-red-400"
                            : row.margin >= 50
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {formatPercent(row.margin)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
