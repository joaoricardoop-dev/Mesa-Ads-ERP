import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function getPaymentStatus(status: string, paymentDate: string | null | undefined): { label: string; style: string } {
  if (status === "paid") return { label: "Pago", style: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
  const today = new Date().toISOString().split("T")[0];
  if (paymentDate && paymentDate < today && status === "pending") {
    return { label: "Atrasado", style: "bg-red-500/10 text-red-500 border-red-500/20" };
  }
  return { label: "Pendente", style: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
}

export default function RestaurantPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [payDialogId, setPayDialogId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState("");
  const [proofUrl, setProofUrl] = useState("");

  const utils = trpc.useUtils();
  const { data: payments, isLoading } = trpc.financial.listPayments.useQuery(
    statusFilter ? { status: statusFilter } : undefined
  );

  const markPaidMutation = trpc.financial.markPaymentPaid.useMutation({
    onSuccess: () => {
      utils.financial.listPayments.invalidate();
      utils.financial.dashboard.invalidate();
      setPayDialogId(null);
      setPayDate("");
      setProofUrl("");
      toast.success("Pagamento marcado como pago");
    },
  });

  return (
    <PageContainer title="Pagamentos a Locais" description="Controle de pagamentos aos parceiros">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !payments?.length ? (
        <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground">
          <p>Nenhum pagamento registrado</p>
          <p className="text-xs mt-1">Pagamentos são gerados automaticamente ao finalizar campanhas</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 bg-muted/5">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Local</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campanha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Período</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Comprovante</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const st = getPaymentStatus(p.status, p.paymentDate);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border/10 hover:bg-muted/5 transition-colors ${
                        st.label === "Atrasado" ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{p.restaurantName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.campaignName}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.periodStart && p.periodEnd
                          ? `${formatDate(p.periodStart)} — ${formatDate(p.periodEnd)}`
                          : p.referenceMonth}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(parseFloat(p.amount))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(p.paymentDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${st.style}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.proofUrl ? (
                          <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                            <ExternalLink className="w-3 h-3" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-500"
                            onClick={() => {
                              setPayDialogId(p.id);
                              setPayDate(new Date().toISOString().split("T")[0]);
                            }}
                            title="Marcar como pago"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={payDialogId !== null} onOpenChange={(open) => !open && setPayDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Data de Pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label>URL do Comprovante (opcional)</Label>
              <Input
                placeholder="https://..."
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (payDialogId && payDate) {
                  markPaidMutation.mutate({
                    id: payDialogId,
                    paymentDate: payDate,
                    proofUrl: proofUrl || undefined,
                  });
                }
              }}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? "Salvando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
