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
import { Plus, Check, X, Building2, Eye, Pencil, Save, XCircle } from "lucide-react";
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

  // View/Edit dialog state
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editBillingType, setEditBillingType] = useState<"bruto" | "liquido">("bruto");
  const [editWithheldTax, setEditWithheldTax] = useState("");
  const [editIssRate, setEditIssRate] = useState("");
  const [editIssRetained, setEditIssRetained] = useState(false);
  const [editNotes, setEditNotes] = useState("");

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
  const [newIssRate, setNewIssRate] = useState("");
  const [newIssRetained, setNewIssRetained] = useState(true);
  const [newPhaseId, setNewPhaseId] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: invoiceList, isLoading } = trpc.financial.listInvoices.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined
  );
  const { data: campaignsForInvoice } = trpc.financial.campaignsForInvoice.useQuery();
  // Carrega fases da campanha selecionada pra oferecer no seletor
  const { data: phasesOfSelectedCamp = [] } = trpc.campaignPhase.listByCampaign.useQuery(
    { campaignId: newCampaignId ? parseInt(newCampaignId) : 0 },
    { enabled: !!newCampaignId },
  );

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
    setNewIssRate("");
    setNewIssRetained(true);
    setNewPhaseId("");
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

  const updateMutation = trpc.financial.updateInvoice.useMutation({
    onSuccess: () => {
      utils.financial.listInvoices.invalidate();
      utils.financial.dashboard.invalidate();
      setIsEditing(false);
      toast.success("Fatura atualizada");
    },
    onError: (err) => toast.error(err.message),
  });

  const viewedInvoice = (invoiceList || []).find((i) => i.id === viewInvoiceId) || null;

  function openInvoice(inv: any) {
    setViewInvoiceId(inv.id);
    setIsEditing(false);
    setEditAmount(inv.amount ?? "");
    setEditIssueDate(inv.issueDate ?? "");
    setEditDueDate(inv.dueDate ?? "");
    setEditPaymentMethod(inv.paymentMethod ?? "");
    setEditBillingType((inv.billingType as any) || "bruto");
    setEditWithheldTax(inv.withheldTax ?? "");
    setEditIssRate(inv.issRate && parseFloat(inv.issRate) > 0 ? inv.issRate : "");
    setEditIssRetained(!!inv.issRetained);
    setEditNotes(inv.notes ?? "");
  }

  function handleSaveEdit() {
    if (!viewedInvoice) return;
    updateMutation.mutate({
      id: viewedInvoice.id,
      amount: editAmount,
      issueDate: editIssueDate,
      dueDate: editDueDate,
      paymentMethod: editPaymentMethod || undefined,
      notes: editNotes,
      billingType: editBillingType,
      withheldTax: editWithheldTax || undefined,
      issRate: editIssRate || "0",
      issRetained: editIssRate && parseFloat(editIssRate) > 0 ? editIssRetained : false,
    });
  }

  const selectedCamp = (campaignsForInvoice || []).find((c) => String(c.id) === newCampaignId);

  const handleCreate = () => {
    if (!newCampaignId || !newAmount || !newDueDate || !newIssueDate) {
      toast.error("Preencha campanha, valor e datas");
      return;
    }
    createMutation.mutate({
      campaignId: parseInt(newCampaignId),
      campaignPhaseId: newPhaseId ? parseInt(newPhaseId) : undefined,
      amount: newAmount,
      issueDate: newIssueDate,
      dueDate: newDueDate,
      paymentMethod: newPaymentMethod || undefined,
      installmentNumber: newInstallmentNumber ? parseInt(newInstallmentNumber) : undefined,
      installmentTotal: selectedCamp?.cycles && selectedCamp.cycles > 1 ? selectedCamp.cycles : undefined,
      notes: newNotes || undefined,
      billingType: newBillingType,
      withheldTax: newWithheldTax || undefined,
      issRate: newIssRate && parseFloat(newIssRate) > 0 ? newIssRate : undefined,
      issRetained: newIssRate && parseFloat(newIssRate) > 0 ? newIssRetained : false,
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

              {/* Fase da campanha (quando aplicável) */}
              {phasesOfSelectedCamp.length > 0 && (
                <div>
                  <Label>Fase <span className="text-muted-foreground text-xs font-normal">— opcional</span></Label>
                  <Select
                    value={newPhaseId || "none"}
                    onValueChange={(v) => {
                      setNewPhaseId(v === "none" ? "" : v);
                      const phase = phasesOfSelectedCamp.find((p: any) => String(p.id) === v);
                      if (phase && phase.expectedRevenue > 0) {
                        setNewAmount(phase.expectedRevenue.toFixed(2));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Fatura da campanha toda (sem fase)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— sem fase (campanha toda) —</SelectItem>
                      {phasesOfSelectedCamp.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          #{p.sequence} · {p.label} — receita prev. {formatCurrency(p.expectedRevenue)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Se selecionar, o valor será pré-preenchido com a receita prevista da fase.
                  </p>
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

              {/* ISS — alíquota + retenção */}
              <div className="border border-border rounded-md p-3 space-y-2 bg-muted/10">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-semibold">
                    ISS — alíquota (%) <span className="text-muted-foreground font-normal">— opcional</span>
                  </Label>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 5,00"
                    value={newIssRate}
                    onChange={(e) => setNewIssRate(e.target.value)}
                  />
                  <div className="flex items-center gap-2 h-9">
                    <input
                      id="issRetained"
                      type="checkbox"
                      className="w-4 h-4 rounded border-border"
                      checked={newIssRetained}
                      onChange={(e) => setNewIssRetained(e.target.checked)}
                      disabled={!newIssRate || parseFloat(newIssRate) === 0}
                    />
                    <Label htmlFor="issRetained" className="text-xs cursor-pointer whitespace-nowrap">
                      Retido pelo tomador
                    </Label>
                  </div>
                </div>
                {newIssRate && parseFloat(newIssRate) > 0 && newAmount && parseFloat(newAmount) > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    ISS {parseFloat(newIssRate).toFixed(2)}% ={" "}
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(newAmount) * parseFloat(newIssRate) / 100)}
                    </span>
                    {" · "}
                    {newIssRetained
                      ? "descontado do que recebemos"
                      : "empresa recolhe depois (não afeta líquido recebido)"}
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
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Emissão</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoiceList.map((inv) => {
                  const gross = parseFloat(inv.amount);
                  const vipRepasse = parseFloat((inv as any).vipRepasseAmount ?? "0");
                  const issAmount = parseFloat((inv as any).issAmount ?? "0");
                  const issRetained = !!(inv as any).issRetained;
                  const issRate = parseFloat((inv as any).issRate ?? "0");
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => openInvoice(inv)}
                      className={`border-b border-border/10 hover:bg-muted/5 transition-colors cursor-pointer ${
                        inv.status === "vencida" ? "bg-red-500/5" : ""
                      }`}
                      data-testid={`row-invoice-${inv.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3">{inv.clientName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>
                          {inv.campaignName}
                          {(inv as any).phaseLabel && (
                            <div className="text-[10px] text-primary/80 font-medium">
                              Fase #{(inv as any).phaseSequence} · {(inv as any).phaseLabel}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div>
                          <span className="font-semibold text-emerald-400">{formatCurrency(gross)}</span>
                          {vipRepasse > 0 && (
                            <p className="text-[11px] text-purple-400/90">
                              repasse VIP{(inv as any).vipProviderName ? ` (${(inv as any).vipProviderName})` : ""}: {formatCurrency(vipRepasse)}
                            </p>
                          )}
                          {issAmount > 0 && !issRetained && (
                            <p className="text-[10px] text-amber-400/80">
                              ISS {issRate.toFixed(2)}% a recolher: {formatCurrency(issAmount)}
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
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openInvoice(inv)}
                            title="Ver detalhes"
                            data-testid={`button-view-invoice-${inv.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
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

      <Dialog open={viewInvoiceId !== null} onOpenChange={(open) => { if (!open) { setViewInvoiceId(null); setIsEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm">{viewedInvoice?.invoiceNumber}</span>
              {viewedInvoice && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[viewedInvoice.status] || ""}`}>
                  {STATUS_LABELS[viewedInvoice.status] || viewedInvoice.status}
                </span>
              )}
              {viewedInvoice?.billingType && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  viewedInvoice.billingType === "liquido"
                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : "bg-sky-500/10 text-sky-400 border-sky-500/20"
                }`}>
                  {viewedInvoice.billingType === "liquido" ? "Líquido" : "Bruto"}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewedInvoice && (() => {
            const inv: any = viewedInvoice;
            const gross = parseFloat(inv.amount);
            const restaurantRepasse = parseFloat(inv.restaurantRepasseAmount ?? "0");
            const vipRepasse = parseFloat(inv.vipRepasseAmount ?? "0");
            const issAmount = parseFloat(inv.issAmount ?? "0");
            const issRetained = !!inv.issRetained;
            const issRate = parseFloat(inv.issRate ?? "0");
            const issDeducted = issRetained ? issAmount : 0;
            const withheld = parseFloat(inv.withheldTax ?? "0");
            const isLocked = inv.status !== "emitida";

            return (
              <div className="space-y-4 pt-2">
                {/* Cabeçalho com cliente e campanha */}
                <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">{inv.clientName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{inv.campaignName}</p>
                  {inv.phaseLabel && (
                    <p className="text-[11px] text-primary/80 font-medium pl-6">
                      Fase #{inv.phaseSequence} · {inv.phaseLabel}
                    </p>
                  )}
                </div>

                {/* Breakdown financeiro */}
                <div className="rounded-md border border-border/30 p-3 space-y-1.5 bg-muted/5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Detalhamento</p>
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total da fatura</span>
                    <span className="font-mono text-emerald-400">{formatCurrency(gross)}</span>
                  </div>
                  {vipRepasse > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex justify-between text-sm text-purple-400/90">
                        <span>Repasse Sala VIP{inv.vipProviderName ? ` — ${inv.vipProviderName}` : ""}</span>
                        <span className="font-mono">{formatCurrency(vipRepasse)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Percentual sobre a receita líquida da tela/janela digital.
                      </p>
                    </>
                  )}
                  {issAmount > 0 && !issRetained && (
                    <p className="text-[11px] text-amber-400/80 mt-1">
                      ISS {issRate.toFixed(2)}% a recolher: {formatCurrency(issAmount)}
                    </p>
                  )}
                </div>

                {/* Campos editáveis ou somente leitura */}
                {!isEditing ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Emissão</p>
                      <p>{formatDate(inv.issueDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vencimento</p>
                      <p>{formatDate(inv.dueDate)}</p>
                    </div>
                    {inv.paymentDate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Data do pagamento</p>
                        <p className="text-emerald-400">{formatDate(inv.paymentDate)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                      <p>{inv.paymentMethod || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Observações</p>
                      <p className="whitespace-pre-wrap text-sm">{inv.notes || "—"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Valor (R$)</Label>
                        <Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} data-testid="input-edit-amount" />
                      </div>
                      <div>
                        <Label>Forma de pagamento</Label>
                        <Select value={editPaymentMethod || "none"} onValueChange={(v) => setEditPaymentMethod(v === "none" ? "" : v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="pix">Pix</SelectItem>
                            <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                            <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Data de Emissão</Label>
                        <Input type="date" value={editIssueDate} onChange={(e) => setEditIssueDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>Data de Vencimento</Label>
                        <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Tipo de Faturamento</Label>
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setEditBillingType("bruto")}
                          className={`flex-1 py-1.5 rounded-md border text-sm font-medium ${
                            editBillingType === "bruto"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border/50 text-muted-foreground"
                          }`}
                        >Bruto</button>
                        <button
                          type="button"
                          onClick={() => setEditBillingType("liquido")}
                          className={`flex-1 py-1.5 rounded-md border text-sm font-medium ${
                            editBillingType === "liquido"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border/50 text-muted-foreground"
                          }`}
                        >Líquido</button>
                      </div>
                    </div>
                    <div>
                      <Label>Retenção na fonte (R$) <span className="text-xs text-muted-foreground font-normal">— opcional</span></Label>
                      <Input type="number" step="0.01" placeholder="0,00" value={editWithheldTax} onChange={(e) => setEditWithheldTax(e.target.value)} />
                    </div>
                    <div className="border border-border rounded-md p-3 space-y-2 bg-muted/10">
                      <Label className="text-xs font-semibold">ISS — alíquota (%)</Label>
                      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                        <Input type="number" step="0.01" min="0" max="100" placeholder="Ex: 5,00" value={editIssRate} onChange={(e) => setEditIssRate(e.target.value)} />
                        <div className="flex items-center gap-2 h-9">
                          <input
                            id="editIssRetained"
                            type="checkbox"
                            className="w-4 h-4 rounded border-border"
                            checked={editIssRetained}
                            onChange={(e) => setEditIssRetained(e.target.checked)}
                            disabled={!editIssRate || parseFloat(editIssRate) === 0}
                          />
                          <Label htmlFor="editIssRetained" className="text-xs cursor-pointer whitespace-nowrap">Retido pelo tomador</Label>
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="resize-none" />
                    </div>
                  </div>
                )}

                {/* Footer com ações */}
                <Separator />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        disabled={isLocked}
                        title={isLocked ? "Apenas faturas emitidas podem ser editadas" : ""}
                        data-testid="button-edit-invoice"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                          data-testid="button-save-invoice"
                        >
                          <Save className="w-3.5 h-3.5 mr-1.5" />
                          {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); openInvoice(inv); }}>
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                  {!isEditing && inv.status === "emitida" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-500 border-emerald-500/30"
                        onClick={() => {
                          setPayDialogId(inv.id);
                          setPayDate(new Date().toISOString().split("T")[0]);
                          setViewInvoiceId(null);
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-1.5" /> Marcar como paga
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-destructive/30"
                        onClick={() => {
                          if (confirm("Cancelar esta fatura?")) {
                            cancelMutation.mutate({ id: inv.id });
                            setViewInvoiceId(null);
                          }
                        }}
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" /> Cancelar fatura
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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
