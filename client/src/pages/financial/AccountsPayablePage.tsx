import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Check, Plus, Trash2, Pencil, Factory, Truck, HandCoins, CircleDollarSign, Crown, X } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  producao: { label: "Produção", icon: Factory, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  frete: { label: "Frete", icon: Truck, color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  comissao: { label: "Comissão", icon: HandCoins, color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  repasse_vip: { label: "Repasse Sala VIP", icon: Crown, color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  outro: { label: "Outro", icon: CircleDollarSign, color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

export default function AccountsPayablePage() {
  // Lê ?campaignId=X da URL (navegação vinda da tela de Custos)
  const [campaignIdFilter, setCampaignIdFilter] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const param = new URLSearchParams(window.location.search).get("campaignId");
    const n = param ? parseInt(param) : NaN;
    return Number.isFinite(n) ? n : null;
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Mantém a URL sincronizada se o filtro de campanha mudar programaticamente
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (campaignIdFilter) url.searchParams.set("campaignId", String(campaignIdFilter));
    else url.searchParams.delete("campaignId");
    window.history.replaceState({}, "", url.toString());
  }, [campaignIdFilter]);
  const [payDialogId, setPayDialogId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [proofUrl, setProofUrl] = useState("");
  const [editDialog, setEditDialog] = useState<any>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    campaignId: "",
    supplierId: "",
    type: "producao",
    description: "",
    amount: "",
    dueDate: "",
    recipientType: "fornecedor",
    notes: "",
  });

  const utils = trpc.useUtils();
  const filters: any = {};
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.type = typeFilter;
  if (campaignIdFilter) filters.campaignId = campaignIdFilter;
  const { data: payables, isLoading } = trpc.financial.listAccountsPayable.useQuery(
    Object.keys(filters).length > 0 ? filters : undefined
  );
  const { data: suppliersList = [] } = trpc.supplier.list.useQuery();
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList = Array.isArray(campaignsData) ? campaignsData : (campaignsData as any)?.items ?? [];

  const markPaidMutation = trpc.financial.markAccountPayablePaid.useMutation({
    onSuccess: () => { utils.financial.listAccountsPayable.invalidate(); setPayDialogId(null); toast.success("Pagamento registrado"); },
  });

  const updateMutation = trpc.financial.updateAccountPayable.useMutation({
    onSuccess: () => { utils.financial.listAccountsPayable.invalidate(); setEditDialog(null); toast.success("Atualizado"); },
  });

  const deleteMutation = trpc.financial.deleteAccountPayable.useMutation({
    onSuccess: () => { utils.financial.listAccountsPayable.invalidate(); toast.success("Removido"); },
  });

  const createMutation = trpc.financial.createAccountPayable.useMutation({
    onSuccess: () => {
      utils.financial.listAccountsPayable.invalidate();
      setCreateDialog(false);
      setCreateForm({ campaignId: "", supplierId: "", type: "producao", description: "", amount: "", dueDate: "", recipientType: "fornecedor", notes: "" });
      toast.success("Conta a pagar criada");
    },
  });

  const totalPendente = (payables || []).filter(p => p.status === "pendente").reduce((s, p) => s + Number(p.amount), 0);
  const totalPago = (payables || []).filter(p => p.status === "pago").reduce((s, p) => s + Number(p.amount), 0);
  const totalGeral = (payables || []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <PageContainer
      title="Contas a Pagar"
      description="Gerencie pagamentos de produção, frete, comissões e repasses"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <Button size="sm" className="gap-1.5" onClick={() => setCreateDialog(true)}>
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Pendente</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(totalPendente)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Pago</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPago)}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Geral</p>
            <p className="text-xl font-bold text-primary mt-1">{formatCurrency(totalGeral)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
              <SelectItem value="frete">Frete</SelectItem>
              <SelectItem value="comissao">Comissão</SelectItem>
              <SelectItem value="repasse_vip">Repasse Sala VIP</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>

          {campaignIdFilter && (
            <Badge variant="outline" className="h-9 px-3 gap-2 text-xs bg-primary/10 text-primary border-primary/30">
              Campanha #{campaignIdFilter}
              <button onClick={() => setCampaignIdFilter(null)} className="hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {(statusFilter || typeFilter || campaignIdFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs gap-1"
              onClick={() => {
                setStatusFilter("");
                setTypeFilter("");
                setCampaignIdFilter(null);
              }}
            >
              <X className="w-3 h-3" /> Limpar
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !payables || payables.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CircleDollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma conta a pagar encontrada</p>
          </div>
        ) : (
          <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/20">
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Tipo</th>
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Descrição</th>
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:table-cell">Campanha</th>
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden lg:table-cell">Fornecedor</th>
                    <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Valor</th>
                    <th className="text-center py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:table-cell">Vencimento</th>
                    <th className="text-center py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((p: any) => {
                    const tc = TYPE_CONFIG[p.type] || TYPE_CONFIG.outro;
                    const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
                    const IconComp = tc.icon;
                    const isOverdue = p.status === "pendente" && p.dueDate && p.dueDate < new Date().toISOString().split("T")[0];
                    return (
                      <tr key={p.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={`text-[9px] gap-1 ${tc.color}`}>
                            <IconComp className="w-3 h-3" />
                            {tc.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-xs">{p.description}</p>
                          {p.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{p.notes}</p>}
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">
                          {p.campaignName || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs hidden lg:table-cell">
                          {p.supplierName || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-xs">
                          {formatCurrency(Number(p.amount))}
                        </td>
                        <td className="py-3 px-4 text-center text-xs hidden md:table-cell">
                          <span className={isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground"}>
                            {formatDate(p.dueDate)}
                            {isOverdue && " (atrasado)"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className={`text-[9px] ${sc.color}`}>{sc.label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {p.status === "pendente" && (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400" title="Marcar como pago"
                                  onClick={() => { setPayDialogId(p.id); setPayDate(new Date().toISOString().split("T")[0]); }}>
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar"
                                  onClick={() => setEditDialog({ id: p.id, dueDate: p.dueDate || "", amount: p.amount, supplierId: p.supplierId ? String(p.supplierId) : "", notes: p.notes || "" })}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" title="Remover"
                              onClick={() => { if (confirm("Remover esta conta a pagar?")) deleteMutation.mutate({ id: p.id }); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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
      </div>

      <Dialog open={payDialogId !== null} onOpenChange={() => setPayDialogId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Data do Pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Comprovante (URL)</Label>
              <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="URL do comprovante (opcional)" />
            </div>
            <Button className="w-full" disabled={!payDate || markPaidMutation.isPending}
              onClick={() => payDialogId && markPaidMutation.mutate({ id: payDialogId, paymentDate: payDate, proofUrl: proofUrl || undefined })}>
              {markPaidMutation.isPending ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog !== null} onOpenChange={() => setEditDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Editar Conta a Pagar</DialogTitle></DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Data de Vencimento</Label>
                <Input type="date" value={editDialog.dueDate} onChange={(e) => setEditDialog({ ...editDialog, dueDate: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input value={editDialog.amount} onChange={(e) => setEditDialog({ ...editDialog, amount: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Select value={editDialog.supplierId || "none"} onValueChange={(v) => setEditDialog({ ...editDialog, supplierId: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliersList.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Notas</Label>
                <Input value={editDialog.notes} onChange={(e) => setEditDialog({ ...editDialog, notes: e.target.value })} />
              </div>
              <Button className="w-full" disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({
                  id: editDialog.id,
                  dueDate: editDialog.dueDate || undefined,
                  amount: editDialog.amount || undefined,
                  supplierId: editDialog.supplierId ? parseInt(editDialog.supplierId) : null,
                  notes: editDialog.notes || undefined,
                })}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Campanha *</Label>
              <Select value={createForm.campaignId || "none"} onValueChange={(v) => setCreateForm({ ...createForm, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {campaignsList.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={createForm.type} onValueChange={(v) => setCreateForm({ ...createForm, type: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="producao">Produção</SelectItem>
                    <SelectItem value="frete">Frete</SelectItem>
                    <SelectItem value="comissao">Comissão</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fornecedor</Label>
                <Select value={createForm.supplierId || "none"} onValueChange={(v) => setCreateForm({ ...createForm, supplierId: v === "none" ? "" : v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {suppliersList.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Ex: Produção de bolachas - Lote 1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$) *</Label>
                <Input value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={createForm.dueDate} onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Input value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Observações (opcional)" />
            </div>
            <Button className="w-full" disabled={!createForm.description || !createForm.amount || !createForm.campaignId || createMutation.isPending}
              onClick={() => createMutation.mutate({
                campaignId: parseInt(createForm.campaignId),
                type: createForm.type,
                description: createForm.description,
                amount: createForm.amount,
                dueDate: createForm.dueDate || undefined,
                supplierId: createForm.supplierId ? parseInt(createForm.supplierId) : undefined,
                recipientType: createForm.recipientType || undefined,
                notes: createForm.notes || undefined,
              })}>
              {createMutation.isPending ? "Criando..." : "Criar Conta a Pagar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
