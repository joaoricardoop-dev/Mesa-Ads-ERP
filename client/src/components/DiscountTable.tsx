/*
 * Design: Bloomberg Terminal Reimaginado
 * Tabela de desconto progressivo com alertas de margem mínima
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiscountTableRow } from "@/hooks/useSimulator";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Tag, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DiscountTableProps {
  data: DiscountTableRow[];
  minMargin: number;
}

export default function DiscountTable({ data, minMargin }: DiscountTableProps) {
  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          Desconto Progressivo por Volume — Mesa Ads
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Desconto oferecido ao anunciante conforme volume de restaurantes contratados. Faturamento e lucro são da Mesa Ads. Margem mínima protegida em{" "}
          <span className="text-primary font-mono">{formatPercent(minMargin, 0)}</span>
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Restaurantes
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Desconto
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Preço Unit.
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Faturamento Total
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Lucro Mesa Ads
                </th>
                <th className="text-right p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Margem
                </th>
                <th className="text-center p-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.restaurants}
                  className={`border-b border-border/20 transition-colors ${
                    i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"
                  } ${row.marginWarning ? "bg-amber-500/5" : ""}`}
                >
                  <td className="p-3 font-mono font-semibold">
                    {row.restaurants}
                  </td>
                  <td className="p-3 font-mono text-right tabular-nums text-amber-400/80">
                    {formatPercent(row.discountPercent)}
                  </td>
                  <td className="p-3 font-mono text-right tabular-nums">
                    {formatCurrency(row.unitPrice)}
                  </td>
                  <td className="p-3 font-mono text-right tabular-nums">
                    {formatCurrency(row.totalRevenue)}
                  </td>
                  <td
                    className={`p-3 font-mono text-right tabular-nums font-semibold ${
                      row.totalProfit > 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {formatCurrency(row.totalProfit)}
                  </td>
                  <td className="p-3 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                        row.margin < minMargin
                          ? "bg-red-500/20 text-red-400"
                          : row.margin >= 50
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {formatPercent(row.margin)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {row.marginWarning ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            Ajustado
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            Desconto limitado para manter margem mínima de{" "}
                            {formatPercent(minMargin, 0)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px]">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
