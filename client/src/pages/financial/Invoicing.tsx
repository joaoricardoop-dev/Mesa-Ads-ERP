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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Plus, Check, X, Building2 } from "lucide-react";
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

  const today = new Date().toISOString().split("T")[0];
  const [newCampaignId, setNewCampaignId] = useState<string>("");
  const [newAmount, setNewAmount] = useState("");
  const [newIssueDate, setNewIssueDate] = useState(today);
  const [newDueDate, setNewDueDate] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [newInstallmentNumber, setNewInstallmentNumber] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newBillingType, setNewBillingType] = useState<"bruto" | "liquido">("bruto");
  const [newWithheldTax, setNewWithheldTax] = useState("");

  const utils = trpc.useUtils();
  const { data: invoiceList, isLoading } = trpc.financial.listInvoices.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined
  );
  const { data: campaignsForInvoice } = trpc.financial.campaignsForInvoice.useQuery();

  function resetForm() {
    setNewCampaignId("");
    setNewAmount("");
    setNewIssueDate(today);
    setNewDueDate("");
    setNewPaymentMethod("");
    setNewInstallmentNumber("");
    setNewNotes("");
    setNewBillingType("bruto");
    setNewWithheldTax("");
  }

  const createMutation = trpc.financial.createInvoice.useMutation({
    onSuccess: () => {
      utils.financial.listInvoices.invalidate();
      utils.financial.dashboard.invalidate();
      setDialogOpen(false);
      resetForm();
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

  const selectedCamp = (campaignsForInvoice || []).find((c) => String(c.id) === newCampaignId);

  const handleCreate = () => {
    if (!newCampaignId || !newAmount || !newDueDate || !newIssueDate) {
      toast.error("Preencha campanha, valor e datas");
      return;
    }
    createMutation.mutate({
      campaignId: parseInt(newCampaignId),
      amount: newAmount,
      issueDate: newIssueDate,
      dueDate: newDueDate,
      paymentMethod: newPaymentMethod || undefined,
      installmentNumber: newInstallmentNumber ? parseInt(newInstallmentNumber) : undefined,
      installmentTotal: selectedCamp?.cycles && selectedCamp.cycles > 1 ? selectedCamp.cycles : undefined,
      notes: newNotes || undefined,
      billingType: newBillingType,
      withheldTax: newWithheldTax || undefined,
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Fatura</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">

              {/* Campanha */}
              <div>
                <Label>Campanha <span className="text-destructive">*</span></Label>
                <Select
                  value={newCampaignId}
                  onValueChange={(v) => {
                    setNewCampaignId(v);
                    const camp = (campaignsForInvoice || []).find((c) => String(c.id) === v);
                    if (camp?.invoiceAmount != null) {
                      setNewAmount(camp.invoiceAmount.toFixed(2));
                      if (camp.cycles > 1) setNewInstallmentNumber("1");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {(campaignsForInvoice || []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cliente (leitura) */}
              {selectedCamp && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/50">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{selectedCamp.clientName}</p>
                    {selectedCamp.invoiceAmount && (
                      <p className="text-xs text-muted-foreground">
                        {selectedCamp.cycles > 1
                          ? `Contrato: ${selectedCamp.cycles}x de ${formatCurrency(selectedCamp.invoiceAmount)}`
                          : `Contrato à vista: ${formatCurrency(selectedCamp.invoiceAmount)}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Tipo de Faturamento */}
              <div>
                <Label>Tipo de Faturamento</Label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setNewBillingType("bruto")}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                      newBillingType === "bruto"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    Bruto
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewBillingType("liquido")}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                      newBillingType === "liquido"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    Líquido
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {newBillingType === "bruto"
                    ? "Bruto: cliente paga o valor total; impostos são responsabilidade da empresa."
                    : "Líquido: cliente retém impostos na fonte e paga o valor líquido."}
                </p>
              </div>

              {/* Datas lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de Emissão <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={newIssueDate}
                    onChange={(e) => setNewIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data de Vencimento <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Valor e Parcela lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$) <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>
                    Parcela nº
                    {selectedCamp?.cycles && selectedCamp.cycles > 1
                      ? ` (de ${selectedCamp.cycles})`
                      : ""}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedCamp?.cycles || 999}
                    placeholder={selectedCamp?.cycles ? `1–${selectedCamp.cycles}` : "—"}
                    value={newInstallmentNumber}
                    onChange={(e) => setNewInstallmentNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Retenção na fonte */}
              <div>
                <Label>Retenção na fonte (R$) <span className="text-muted-foreground text-xs font-normal">— opcional</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={newWithheldTax}
                  onChange={(e) => setNewWithheldTax(e.target.value)}
                />
                {newWithheldTax && parseFloat(newWithheldTax) > 0 && newAmount && parseFloat(newAmount) > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Valor líquido recebido: {formatCurrency(parseFloat(newAmount) - parseFloat(newWithheldTax))}
                  </p>
                )}
              </div>

              {/* Forma de pagamento */}
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                    <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Observações */}
              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Informações adicionais sobre esta fatura..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Emitir Fatura"}
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
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Nossa parte</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Emissão</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoiceList.map((inv) => {
                  const gross = parseFloat(inv.amount);
                  const ourShare = parseFloat((inv as any).netAmount ?? inv.amount);
                  const restaurantRepasse = parseFloat((inv as any).restaurantRepasseAmount ?? "0");
                  const vipRepasse = parseFloat((inv as any).vipRepasseAmount ?? "0");
                  const totalRepasses = restaurantRepasse + vipRepasse;
                  return (
                    <tr
                      key={inv.id}
                      className={`border-b border-border/10 hover:bg-muted/5 transition-colors ${
                        inv.status === "vencida" ? "bg-red-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">{inv.clientName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{inv.campaignName}</td>
                      <td className="px-4 py-3 text-right">
                        <div
                          title={totalRepasses > 0
                            ? `Bruto: ${formatCurrency(gross)}\n− Comissão restaurante: ${formatCurrency(restaurantRepasse)}${vipRepasse > 0 ? `\n− Repasse VIP: ${formatCurrency(vipRepasse)}` : ""}\n= Nossa parte: ${formatCurrency(ourShare)}`
                            : undefined}
                        >
                          <span className="font-semibold text-emerald-400">{formatCurrency(ourShare)}</span>
                          {totalRepasses > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              bruto {formatCurrency(gross)} · repasses {formatCurrency(totalRepasses)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                              STATUS_STYLES[inv.status] || ""
                            }`}
                          >
                            {STATUS_LABELS[inv.status] || inv.status}
                          </span>
                          {inv.billingType && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              inv.billingType === "liquido"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            }`}>
                              {inv.billingType === "liquido" ? "Líquido" : "Bruto"}
                            </span>
                          )}
                        </div>
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
