import { useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { FileSignature, ExternalLink, CircleCheck, CircleAlert, Calendar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { EmitInvoiceModal } from "./EmitInvoiceModal";

type FinancialsData = RouterOutputs["campaignPhase"]["getFinancials"];
type Invoice = NonNullable<FinancialsData["invoice"]>;

const STATUS_STYLE: Record<string, { label: string; color: string; border: string }> = {
  prevista:  { label: "Prevista",  color: "bg-blue-100 text-blue-800 border-blue-300", border: "border-blue-200" },
  emitida:   { label: "Emitida",   color: "bg-amber-100 text-amber-800 border-amber-300", border: "border-amber-200" },
  paga:      { label: "Paga",      color: "bg-emerald-100 text-emerald-800 border-emerald-300", border: "border-emerald-200" },
  vencida:   { label: "Vencida",   color: "bg-rose-100 text-rose-800 border-rose-300", border: "border-rose-200" },
  cancelada: { label: "Cancelada", color: "bg-zinc-100 text-zinc-700 border-zinc-300", border: "border-zinc-200" },
};

export function BatchInvoiceCard({
  invoice,
  phaseId,
  campaignId,
  onChange,
}: {
  invoice: Invoice | null;
  phaseId: number;
  campaignId: number;
  onChange: () => void;
}) {
  const [emitOpen, setEmitOpen] = useState(false);
  const utils = trpc.useContext();

  const generateMut = trpc.financial.generateScheduledInvoices.useMutation({
    onSuccess: () => {
      toast.success("Fatura prevista gerada");
      onChange();
      utils.campaignPhase.consolidation.invalidate({ campaignId }).catch(() => {});
    },
    onError: (e) => toast.error(e.message),
  });
  const markPaidMut = trpc.financial.markInvoicePaid.useMutation({
    onSuccess: () => { toast.success("Fatura marcada como paga"); onChange(); },
    onError: (e) => toast.error(e.message),
  });

  if (!invoice || invoice.status === "cancelada") {
    const isCancelled = invoice?.status === "cancelada";
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {isCancelled
              ? "Última fatura deste batch foi cancelada — gerar nova prevista para reabrir o ciclo."
              : "Sem fatura prevista para este batch."}
          </div>
          <Button size="sm" onClick={() => generateMut.mutate({ campaignId })} disabled={generateMut.isPending}>
            {isCancelled ? <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> : <Calendar className="w-3.5 h-3.5 mr-1.5" />}
            {isCancelled ? "Gerar nova" : "Agendar fatura"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const style = STATUS_STYLE[invoice.status] ?? STATUS_STYLE.prevista;
  const invoiceAmount = Number(invoice.amount ?? 0);

  return (
    <>
      <Card className={`border-2 ${style.border}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="w-4 h-4" />
            Fatura deste Batch
            <Badge className={`ml-auto ${style.color}`}>{style.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Número</div>
              <div className="font-medium">{invoice.invoiceNumber || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Valor</div>
              <div className="font-medium tabular-nums">{formatCurrency(invoiceAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Emissão</div>
              <div className="font-medium">{invoice.issueDate || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Vencimento</div>
              <div className="font-medium">{invoice.dueDate || "—"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t flex-wrap">
            {invoice.status === "prevista" && (
              <Button size="sm" onClick={() => setEmitOpen(true)}>
                <FileSignature className="w-3.5 h-3.5 mr-1.5" />
                Confirmar emissão
              </Button>
            )}
            {invoice.status === "emitida" && (
              <Button size="sm" variant="default"
                onClick={() => markPaidMut.mutate({
                  id: invoice.id,
                  paymentDate: new Date().toISOString().slice(0, 10),
                })}
                disabled={markPaidMut.isPending}>
                <CircleCheck className="w-3.5 h-3.5 mr-1.5" />
                Marcar como paga
              </Button>
            )}
            {invoice.status === "vencida" && (
              <Button size="sm" variant="destructive"
                onClick={() => markPaidMut.mutate({
                  id: invoice.id,
                  paymentDate: new Date().toISOString().slice(0, 10),
                })}
                disabled={markPaidMut.isPending}>
                <CircleAlert className="w-3.5 h-3.5 mr-1.5" />
                Vencida — registrar pagamento
              </Button>
            )}
            {invoice.status === "paga" && invoice.paymentDate && (
              <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                <CircleCheck className="w-3.5 h-3.5" />
                Paga em {invoice.paymentDate}
                {invoice.receivedDate && ` · entrada conciliada em ${invoice.receivedDate}`}
              </span>
            )}
            {invoice.documentUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={invoice.documentUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Documento
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {emitOpen && (
        <EmitInvoiceModal
          open={emitOpen}
          onOpenChange={setEmitOpen}
          campaignName={`Batch ${phaseId}`}
          slots={[{
            phaseId,
            sequence: 1,
            label: `Batch ${phaseId}`,
            periodStart: invoice.dueDate ?? "",
            periodEnd: invoice.dueDate ?? "",
            expectedRevenue: invoiceAmount,
            invoice: {
              id: invoice.id,
              status: invoice.status,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              issueDate: invoice.issueDate,
              invoiceNumber: invoice.invoiceNumber ?? null,
            },
          }]}
          defaultPhaseId={phaseId}
          onConfirmed={onChange}
        />
      )}
    </>
  );
}
