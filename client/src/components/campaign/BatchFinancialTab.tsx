import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { BatchEconomicsOverride } from "./BatchEconomicsOverride";
import { BatchDRE } from "./BatchDRE";
import { BatchPayablesList } from "./BatchPayablesList";
import { BatchInvoiceCard } from "./BatchInvoiceCard";

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

  return (
    <div className="space-y-4">
      <BatchEconomicsOverride
        phaseId={phaseId}
        financials={data.financials}
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
