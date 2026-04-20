import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  CircleDollarSign,
  TrendingUp,
  Wallet,
  AlertTriangle,
  FileSignature,
  CalendarClock,
  Layers,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { InvoiceSchedule, type ScheduleSlot } from "./InvoiceSchedule";
import { EmitInvoiceModal } from "./EmitInvoiceModal";

export function CampaignConsolidated({ campaignId }: { campaignId: number }) {
  const utils = trpc.useContext();
  const { data, isLoading } = trpc.campaignPhase.consolidation.useQuery(
    { campaignId },
    { enabled: campaignId > 0 },
  );

  const [emitOpen, setEmitOpen] = useState(false);
  const [selectedPhaseForEmit, setSelectedPhaseForEmit] = useState<number | null>(null);

  const generateMut = trpc.financial.generateScheduledInvoices.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.created > 0
          ? `${res.created} fatura(s) prevista(s) gerada(s) (${res.skipped} já existiam)`
          : "Cronograma já está atualizado — nada a gerar",
      );
      utils.campaignPhase.consolidation.invalidate({ campaignId }).catch(() => {});
      utils.campaignPhase.listByCampaign.invalidate({ campaignId }).catch(() => {});
    },
    onError: (err) => toast.error(err.message || "Erro ao gerar cronograma"),
  });

  const slots: ScheduleSlot[] = useMemo(() => {
    if (!data?.phaseBreakdown) return [];
    return data.phaseBreakdown.map((p: any) => ({
      phaseId: p.phaseId,
      sequence: p.sequence,
      label: p.label,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      expectedRevenue: p.expectedRevenue,
      invoice: p.invoice ?? null,
    }));
  }, [data]);

  const previstaCount = slots.filter((s) => s.invoice?.status === "prevista").length;
  const noneCount = slots.filter((s) => !s.invoice).length;
  const overdueCount = slots.filter((s) => s.invoice?.status === "vencida").length;

  // Próxima a emitir (mês corrente ou primeira prevista)
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextToEmit =
    slots.find(
      (s) => s.invoice?.status === "prevista" && s.invoice.issueDate <= todayIso,
    ) ?? slots.find((s) => s.invoice?.status === "prevista") ?? null;

  if (isLoading) {
    return (
      <div className="bg-card border border-border/30 rounded-xl p-5 text-sm text-muted-foreground text-center">
        Carregando consolidado…
      </div>
    );
  }
  if (!data) return null;

  const summary = data.summary as any;

  // Faturado / recebido / a vencer (calculados a partir do cronograma)
  const recebido = slots.reduce(
    (s, x) => s + (x.invoice?.status === "paga" ? x.invoice.amount : 0),
    0,
  );
  const aVencer = slots.reduce(
    (s, x) => s + ((x.invoice?.status === "emitida" || x.invoice?.status === "vencida") ? x.invoice.amount : 0),
    0,
  );
  const previsto = slots.reduce(
    (s, x) => s + (x.invoice?.status === "prevista" ? x.invoice.amount : 0),
    0,
  );

  return (
    <section className="bg-card border border-border/30 rounded-xl overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Consolidado da Campanha</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {(noneCount > 0 || previstaCount === 0) && slots.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => generateMut.mutate({ campaignId })}
              disabled={generateMut.isPending}
              data-testid="button-generate-scheduled-invoices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generateMut.isPending ? "animate-spin" : ""}`} />
              {noneCount > 0 ? "Agendar faturas" : "Regenerar cronograma"}
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => {
              setSelectedPhaseForEmit(nextToEmit?.phaseId ?? null);
              setEmitOpen(true);
            }}
            disabled={previstaCount === 0}
            data-testid="button-emit-invoice"
          >
            <FileSignature className="w-3.5 h-3.5" />
            {nextToEmit ? `Emitir próxima (B${nextToEmit.sequence})` : "Emitir fatura"}
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-border/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide">
              <CircleDollarSign className="w-3 h-3" /> Receita prevista
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1">
              {formatCurrency(summary.expectedRevenue)}
            </div>
          </div>
          <div className="rounded-lg border border-border/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide">
              <FileSignature className="w-3 h-3" /> Faturado
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1 text-blue-400">
              {formatCurrency(summary.invoiced)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">A vencer: {formatCurrency(aVencer)}</div>
          </div>
          <div className="rounded-lg border border-border/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide">
              <Wallet className="w-3 h-3" /> Recebido
            </div>
            <div className="text-lg font-semibold tabular-nums mt-1 text-emerald-400">
              {formatCurrency(recebido)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Previsto: {formatCurrency(previsto)}</div>
          </div>
          <div className="rounded-lg border border-border/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide">
              <TrendingUp className="w-3 h-3" /> Margem prev.
            </div>
            <div className={`text-lg font-semibold tabular-nums mt-1 ${summary.expectedMargin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(summary.expectedMargin)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{summary.expectedMarginPct.toFixed(1)}%</div>
          </div>
        </div>

        {/* Cronograma de faturamento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground tracking-wide">
              <CalendarClock className="w-3.5 h-3.5" /> Cronograma de Faturamento
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {slots.filter((s) => s.invoice?.status === "paga" || s.invoice?.status === "emitida" || s.invoice?.status === "vencida").length} de {slots.length} emitidas
            </div>
          </div>
          <InvoiceSchedule
            slots={slots}
            onSelect={(s) => {
              if (s.invoice?.status === "prevista") {
                setSelectedPhaseForEmit(s.phaseId);
                setEmitOpen(true);
              }
            }}
          />
        </div>

        {/* Alertas */}
        {(overdueCount > 0 || noneCount > 0) && (
          <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              {overdueCount > 0 && (
                <div data-testid="alert-overdue-count">
                  {overdueCount} fatura(s) vencida(s) sem pagamento.
                </div>
              )}
              {noneCount > 0 && (
                <div data-testid="alert-none-count">
                  {noneCount} batch(es) sem fatura agendada — clique em "Agendar faturas".
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <EmitInvoiceModal
        open={emitOpen}
        onOpenChange={setEmitOpen}
        campaignName={data.campaign?.name ?? ""}
        slots={slots}
        defaultPhaseId={selectedPhaseForEmit}
        onConfirmed={() => setSelectedPhaseForEmit(null)}
      />
    </section>
  );
}
