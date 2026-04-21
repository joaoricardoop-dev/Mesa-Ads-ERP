import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { CircleDollarSign, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { RouterOutputs } from "@/lib/trpc";

type FinancialsData = RouterOutputs["campaignPhase"]["getFinancials"];
type Financials = FinancialsData["financials"];
type Partner = FinancialsData["partner"];

function pct(v: number) { return `${(v * 100).toFixed(1).replace(".", ",")}%`; }

function Row({
  label, value, kind = "default", tooltip, indent = 0,
}: {
  label: string;
  value: number;
  kind?: "default" | "subtract" | "subtotal" | "total";
  tooltip?: string;
  indent?: number;
}) {
  const baseLabel = (
    <span className={kind === "subtotal" || kind === "total" ? "font-semibold" : ""}>
      {kind === "subtract" && <span className="text-muted-foreground mr-1">(−)</span>}
      {kind === "subtotal" && <span className="text-muted-foreground mr-1">=</span>}
      {label}
    </span>
  );
  const valueClass =
    kind === "total" ? "font-bold text-emerald-700" :
    kind === "subtotal" ? "font-semibold" :
    kind === "subtract" ? "text-rose-700" : "";
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        kind === "subtotal" ? "border-t border-dashed mt-1 pt-2" :
        kind === "total" ? "border-t-2 border-emerald-300 mt-2 pt-2" : ""
      }`}
      style={{ paddingLeft: indent * 16 }}
    >
      <div className="flex items-center gap-1.5 text-sm">
        {baseLabel}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className={`text-sm tabular-nums ${valueClass}`}>{formatCurrency(value)}</div>
    </div>
  );
}

export function BatchDRE({ financials, partner }: { financials: Financials; partner: Partner }) {
  const f = financials;
  const margin = f.margemPct;
  const marginColor =
    margin >= 0.15 ? "bg-emerald-100 text-emerald-800" :
    margin >= 0.05 ? "bg-amber-100 text-amber-800" :
    "bg-rose-100 text-rose-800";

  const showRestaurante = f.canalTipo === "restaurante";
  const showVip = f.canalTipo === "vip";
  const showBV = (f.bvTotal ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CircleDollarSign className="w-4 h-4" />
          DRE deste Batch
          <Badge className={`ml-auto ${marginColor}`}>Margem {pct(margin)}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Row label="Faturamento Bruto" value={f.receita} />
        <Row
          label={`Impostos (${(f.effective.taxRate.value).toFixed(1).replace(".", ",")}% + PIS/COFINS)`}
          value={f.impostos}
          kind="subtract"
          tooltip={`IRPJ: ${formatCurrency(f.details.taxesBreakdown.irpj)} · PIS/COFINS: ${formatCurrency(f.details.taxesBreakdown.pisCofins)} · ISS: ${formatCurrency(f.details.taxesBreakdown.iss)}`}
        />
        {showRestaurante && (
          <Row
            label={`Comissão Restaurante (${(f.effective.restaurantCommission.value).toFixed(1).replace(".", ",")}%)`}
            value={f.canalValor}
            kind="subtract"
            tooltip="Repasse ao restaurante sobre o faturamento bruto."
          />
        )}
        {showVip && (
          <Row
            label={`Repasse Sala VIP (${(f.effective.vipRepasse.value).toFixed(1).replace(".", ",")}%)`}
            value={f.canalValor}
            kind="subtract"
            tooltip="Repasse à operadora VIP sobre receita líquida de impostos e comissão."
          />
        )}
        <Row label="Base após Canal" value={f.base} kind="subtotal" />

        <Row label="Custo Frete" value={f.freightCost} kind="subtract" />
        <Row label="Custo Produção" value={f.productionCost} kind="subtract" />
        <Row label="Base de Contribuição" value={f.baseContribuicao} kind="subtotal" />

        <Row
          label={`Comissão Vendedor (${(f.effective.sellerCommission.value).toFixed(1).replace(".", ",")}%)`}
          value={f.sellerCommission}
          kind="subtract"
          tooltip="Comissão do vendedor rateada por receita do batch."
        />

        <Row label="Lucro Líquido" value={f.lucroLiquido} kind="total" />

        {showBV && (
          <div className="mt-4 pt-3 border-t border-amber-200 bg-amber-50/40 -mx-4 px-4 -mb-4 pb-3 rounded-b-md">
            <div className="text-xs font-medium text-amber-800 mb-1 flex items-center gap-1">
              <Info className="w-3 h-3" />
              BV da Campanha · acréscimo comercial (não afeta o DRE)
              {partner?.name && <span className="text-muted-foreground font-normal">· Pago a: {partner.name}</span>}
            </div>
            <Row
              label={`BV Líquido (${(f.effective.bvPercent.value).toFixed(1).replace(".", ",")}% × base)`}
              value={f.bvLiquido}
              indent={1}
            />
            <Row
              label={`Gross-up tributário (${(f.effective.grossUpRate.value).toFixed(2).replace(".", ",")}%)`}
              value={f.bvGrossUp}
              indent={1}
            />
            <Row label="BV Total a Pagar" value={f.bvTotal} kind="subtotal" indent={1} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
