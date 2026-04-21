import { trpc } from "@/lib/trpc";
import { Banknote, Loader2, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { BatchEconomicsOverride } from "./BatchEconomicsOverride";
import { BatchDRE } from "./BatchDRE";
import { BatchPayablesList } from "./BatchPayablesList";
import { BatchInvoiceCard } from "./BatchInvoiceCard";

function KPI({
  label, value, icon, accent, warn,
}: { label: string; value: string; icon: React.ReactNode; accent?: boolean; warn?: boolean }) {
  const tone = accent ? "text-emerald-600" : warn ? "text-rose-600" : "text-foreground";
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3 flex items-center gap-3">
      <div className={`shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className={`text-base font-semibold tabular-nums truncate ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

export function BatchFinancialTab({
  campaignId,
  phaseId,
}: {
  campaignId: number;
  phaseId: number;
}) {
  const { data, isLoading, refetch } = trpc.campaignPhase.getFinancials.useQuery(
    { phaseId },
    { enabled: phaseId > 0 },
  );

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando dados financeiros do batch…
      </div>
    );
  }

  const f = data.financials;
  const custosTotais = Math.max(0, f.receita - f.lucroLiquido);
  const marginPct = (f.margemPct * 100);
  const roi = custosTotais > 0 ? (f.lucroLiquido / custosTotais) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* ─── Indicadores do Batch ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Receita do Batch" value={formatCurrency(f.receita)} icon={<Banknote className="w-5 h-5" />} />
        <KPI label="Lucro do Batch" value={formatCurrency(f.lucroLiquido)} icon={<TrendingUp className="w-5 h-5" />} accent={f.lucroLiquido > 0} warn={f.lucroLiquido <= 0} />
        <KPI
          label="Margem"
          value={`${marginPct.toFixed(1).replace(".", ",")}%`}
          icon={<ShieldCheck className="w-5 h-5" />}
          accent={marginPct >= 20}
          warn={marginPct < 15}
        />
        <KPI
          label="ROI"
          value={`${roi.toFixed(1).replace(".", ",")}%`}
          icon={<Target className="w-5 h-5" />}
          accent={roi > 0}
          warn={roi <= 0}
        />
      </div>

      <BatchEconomicsOverride
        phaseId={phaseId}
        financials={data.financials}
        inherited={data.inherited}
        overrides={data.overrides}
        partner={data.partner}
        onChange={() => refetch()}
      />
      <BatchDRE financials={data.financials} partner={data.partner} />
      <BatchInvoiceCard
        invoice={data.invoice}
        phaseId={phaseId}
        campaignId={campaignId}
        onChange={() => refetch()}
      />
      <BatchPayablesList
        phaseId={phaseId}
        campaignId={campaignId}
        invoice={data.invoice}
        payables={data.payables}
        onChange={() => refetch()}
      />
    </div>
  );
}
