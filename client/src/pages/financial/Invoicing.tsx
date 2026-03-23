import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const STATUS_STYLES: Record<string, string> = {
  emitida: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  paga: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  vencida: "bg-red-500/10 text-red-500 border-red-500/20",
  cancelada: "bg-muted/20 text-muted-foreground border-border/20",
};

const STATUS_LABELS: Record<string, string> = {
  emitida: "Emitida",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export default function Invoicing() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogId, setPayDialogId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState("");

  const [newCampaignId, setNewCampaignId] = useState<string>("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const utils = trpc.useUtils();
  const { data: invoiceList, isLoading } = trpc.financial.listInvoices.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined
  );
  const { data: campaignsForInvoice } = trpc.financial.campaignsForInvoice.useQuery();

  const createMutation = trpc.financial.createInvoice.useMutation({
    onSuccess: () => {
      utils.financial.listInvoices.invalidate();
      setDialogOpen(false);
      setNewCampaignId("");
      setNewAmount("");
      setNewDueDate("");
      toast.success("Fatura criada com sucesso");
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = trpc.financial.markInvoicePaid.useMutation({
    onSuccess: () => {
      utils.financial.listInvoices.invalidate();
      utils.financial.dashboard.invalidate();
      setPayDialogId(null);
      setPayDate("");
      toast.success("Fatura marcada como paga");
    },
  });

  const cancelMutation = trpc.financial.cancelInvoice.useMutation({
    onSuccess: () => {
      utils.financial.listInvoices.invalidate();
      toast.success("Fatura cancelada");
    },
  });

  const handleCreate = () => {
    if (!newCampaignId || !newAmount || !newDueDate) {
      toast.error("Preencha todos os campos");
      return;
    }
    createMutation.mutate({
      campaignId: parseInt(newCampaignId),
      amount: newAmount,
      dueDate: newDueDate,
    });
  };

  return (
    <PageContainer
      title="Faturamento"
      description="Faturas emitidas para anunciantes"
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Nova Fatura
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Fatura</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Campanha</Label>
                <Select
                  value={newCampaignId}
                  onValueChange={(v) => {
                    setNewCampaignId(v);
                    const camp = (campaignsForInvoice || []).find((c) => String(c.id) === v);
                    if (camp?.invoiceAmount != null) {
                      setNewAmount(camp.invoiceAmount.toFixed(2));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaignsForInvoice || []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} — {c.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newCampaignId && (() => {
                  const camp = (campaignsForInvoice || []).find((c) => String(c.id) === newCampaignId);
                  if (!camp) return null;
                  const method = camp.quotationPaymentMethod === "pix" ? "Pix" : camp.quotationPaymentMethod === "cartao" ? "Cartão" : camp.quotationPaymentMethod === "boleto" ? "Boleto" : camp.quotationPaymentMethod || "—";
                  if (!camp.invoiceAmount) return null;
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      {camp.cycles > 1
                        ? `${camp.cycles}x de ${formatCurrency(camp.invoiceAmount)} · ${method}`
                        : `À vista: ${formatCurrency(camp.invoiceAmount)} · ${method}`}
                    </p>
                  );
                })()}
              </div>
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Data de Vencimento</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Criar Fatura"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !invoiceList?.length ? (
        <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground">
          <p>Nenhuma fatura encontrada</p>
          <p className="text-xs mt-1">Clique em "Nova Fatura" para criar a primeira</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 bg-muted/5">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Número</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Anunciante</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campanha</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Emissão</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoiceList.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b border-border/10 hover:bg-muted/5 transition-colors ${
                      inv.status === "vencida" ? "bg-red-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.campaignName}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(parseFloat(inv.amount))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issueDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_STYLES[inv.status] || ""
                        }`}
                      >
                        {STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === "emitida" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-500"
                              onClick={() => {
                                setPayDialogId(inv.id);
                                setPayDate(new Date().toISOString().split("T")[0]);
                              }}
                              title="Marcar como paga"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => {
                                if (confirm("Cancelar esta fatura?")) {
                                  cancelMutation.mutate({ id: inv.id });
                                }
                              }}
                              title="Cancelar fatura"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={payDialogId !== null} onOpenChange={(open) => !open && setPayDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Paga</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Data de Pagamento</Label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (payDialogId && payDate) {
                  markPaidMutation.mutate({ id: payDialogId, paymentDate: payDate });
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
