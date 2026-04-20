import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Check,
  Plus,
  Trash2,
  Pencil,
  Factory,
  Truck,
  HandCoins,
  CircleDollarSign,
  Crown,
  X,
  Utensils,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import type { RouterOutputs, RouterInputs } from "@/lib/trpc";

type Payable = RouterOutputs["financial"]["listAccountsPayable"][number];
type Supplier = RouterOutputs["supplier"]["list"][number];
type ListPayableInput = NonNullable<RouterInputs["financial"]["listAccountsPayable"]>;
type CampaignSummary = { id: number; name: string };

type EditPayableForm = {
  id: number;
  dueDate: string;
  amount: string;
  supplierId: string;
  notes: string;
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

type SourceType =
  | "restaurant_commission"
  | "vip_repasse"
  | "supplier_cost"
  | "freight_cost"
  | "manual";

const TAB_CONFIG: Record<SourceType, { label: string; icon: LucideIcon; description: string }> = {
  restaurant_commission: {
    label: "Comissões Restaurantes",
    icon: Utensils,
    description: "Pagamentos a restaurantes pela veiculação de campanhas (substitui a antiga tela de Pagamentos a Restaurantes).",
  },
  vip_repasse: {
    label: "Repasse Sala VIP",
    icon: Crown,
    description: "Repasses para provedores de Sala VIP por veiculação em telas e janelas.",
  },
  supplier_cost: {
    label: "Fornecedores",
    icon: Factory,
    description: "Custos de produção e demais valores devidos a fornecedores.",
  },
  freight_cost: {
    label: "Frete",
    icon: Truck,
    description: "Despesas com frete e logística.",
  },
  manual: {
    label: "Manuais & Outros",
    icon: ReceiptIcon,
    description: "Contas avulsas, impostos, comissões de parceiros/vendedores e demais lançamentos manuais.",
  },
};

const TABS: SourceType[] = [
  "restaurant_commission",
  "vip_repasse",
  "supplier_cost",
  "freight_cost",
  "manual",
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

function mapSourceForManualBucket(s: string | null | undefined): SourceType {
  if (!s) return "manual";
  if (TABS.includes(s as SourceType)) return s as SourceType;
  return "manual";
}

export default function AccountsPayablePage() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");

  const tabParam = (params.get("tab") || "restaurant_commission") as SourceType;
  const activeTab: SourceType = TABS.includes(tabParam) ? tabParam : "restaurant_commission";

  const [campaignIdFilter, setCampaignIdFilter] = useState<number | null>(() => {
    const v = params.get("campaignId");
    const n = v ? parseInt(v) : NaN;
    return Number.isFinite(n) ? n : null;
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [dueFrom, setDueFrom] = useState<string>("");
  const [dueTo, setDueTo] = useState<string>("");

  function setActiveTab(next: string) {
    const np = new URLSearchParams(params);
    np.set("tab", next);
    navigate(`/financeiro/contas-pagar?${np.toString()}`);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (campaignIdFilter) url.searchParams.set("campaignId", String(campaignIdFilter));
    else url.searchParams.delete("campaignId");
    window.history.replaceState({}, "", url.toString());
  }, [campaignIdFilter]);

  const [payDialogId, setPayDialogId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [proofUrl, setProofUrl] = useState("");
  const [editDialog, setEditDialog] = useState<EditPayableForm | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    sourceType: activeTab as SourceType,
    campaignId: "",
    supplierId: "",
    type: "outro",
    description: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [bulkPayDate, setBulkPayDate] = useState(new Date().toISOString().split("T")[0]);

  const utils = trpc.useUtils();
  const filters: ListPayableInput = { sourceType: activeTab };
  if (statusFilter) filters.status = statusFilter;
  if (campaignIdFilter) filters.campaignId = campaignIdFilter;
  if (supplierFilter) filters.supplierId = parseInt(supplierFilter);
  if (dueFrom) filters.dueDateFrom = dueFrom;
  if (dueTo) filters.dueDateTo = dueTo;

  const { data: payables, isLoading } = trpc.financial.listAccountsPayable.useQuery(filters);
  const { data: suppliersList = [] } = trpc.supplier.list.useQuery();
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList: CampaignSummary[] = Array.isArray(campaignsData)
    ? (campaignsData as CampaignSummary[])
    : ((campaignsData as { items?: CampaignSummary[] } | undefined)?.items ?? []);

  // For "manual" tab, server filter only matches sourceType=manual; we extend it to also include
  // tax / partner_commission / seller_commission via separate queries merged in memory.
  const { data: taxRows = [] } = trpc.financial.listAccountsPayable.useQuery(
    { ...filters, sourceType: "tax" },
    { enabled: activeTab === "manual" },
  );
  const { data: partnerRows = [] } = trpc.financial.listAccountsPayable.useQuery(
    { ...filters, sourceType: "partner_commission" },
    { enabled: activeTab === "manual" },
  );
  const { data: sellerRows = [] } = trpc.financial.listAccountsPayable.useQuery(
    { ...filters, sourceType: "seller_commission" },
    { enabled: activeTab === "manual" },
  );

  const visibleRows = useMemo<Payable[]>(() => {
    const base: Payable[] = payables || [];
    if (activeTab !== "manual") return base;
    const merged: Payable[] = [...base, ...taxRows, ...partnerRows, ...sellerRows];
    return merged.sort((a, b) => {
      const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bc - ac;
    });
  }, [payables, taxRows, partnerRows, sellerRows, activeTab]);

  // Reset selection when tab changes
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, statusFilter, supplierFilter, dueFrom, dueTo, campaignIdFilter]);

  // Update default sourceType for create form when tab changes
  useEffect(() => {
    setCreateForm((f) => ({ ...f, sourceType: activeTab }));
  }, [activeTab]);

  const markPaidMutation = trpc.financial.markAccountPayablePaid.useMutation({
    onSuccess: () => {
      utils.financial.listAccountsPayable.invalidate();
      setPayDialogId(null);
      toast.success("Pagamento registrado");
    },
  });

  const bulkPaidMutation = trpc.financial.bulkMarkAccountsPayablePaid.useMutation({
    onSuccess: (res) => {
      utils.financial.listAccountsPayable.invalidate();
      setSelectedIds([]);
      setBulkPayOpen(false);
      toast.success(`${res.count} conta(s) marcada(s) como paga(s)`);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.financial.updateAccountPayable.useMutation({
    onSuccess: () => {
      utils.financial.listAccountsPayable.invalidate();
      setEditDialog(null);
      toast.success("Atualizado");
    },
  });

  const deleteMutation = trpc.financial.deleteAccountPayable.useMutation({
    onSuccess: () => {
      utils.financial.listAccountsPayable.invalidate();
      toast.success("Removido");
    },
  });

  const createMutation = trpc.financial.createAccountPayable.useMutation({
    onSuccess: () => {
      utils.financial.listAccountsPayable.invalidate();
      setCreateDialog(false);
      setCreateForm({
        sourceType: activeTab,
        campaignId: "",
        supplierId: "",
        type: "outro",
        description: "",
        amount: "",
        dueDate: "",
        notes: "",
      });
      toast.success("Conta a pagar criada");
    },
    onError: (err) => toast.error(err.message),
  });

  const totalPendente = visibleRows.filter((p) => p.status === "pendente").reduce((s, p) => s + Number(p.amount), 0);
  const totalPago = visibleRows.filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.amount), 0);
  const totalSel = selectedIds.reduce((acc, id) => {
    const row = visibleRows.find((r) => r.id === id);
    return acc + (row ? Number(row.amount) : 0);
  }, 0);

  const allPendingIds = visibleRows.filter((p) => p.status === "pendente").map((p) => p.id);
  const allPendingSelected = allPendingIds.length > 0 && allPendingIds.every((id) => selectedIds.includes(id));

  function toggleSelectAll() {
    if (allPendingSelected) setSelectedIds([]);
    else setSelectedIds(allPendingIds);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <PageContainer
      title="Contas a Pagar"
      description="Ledger único de obrigações: comissões a restaurantes, repasses Sala VIP, fornecedores, frete e lançamentos manuais."
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((key) => {
            const cfg = TAB_CONFIG[key];
            const Icon = cfg.icon;
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((key) => (
          <TabsContent key={key} value={key} className="mt-0 space-y-4">
            <p className="text-xs text-muted-foreground">{TAB_CONFIG[key].description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border/30 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pendente</p>
                <p className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(totalPendente)}</p>
              </div>
              <div className="bg-card border border-border/30 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pago</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPago)}</p>
              </div>
              <div className="bg-card border border-border/30 rounded-lg p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Selecionado</p>
                <p className="text-xl font-bold text-primary mt-1">{formatCurrency(totalSel)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={supplierFilter || "all"} onValueChange={(v) => setSupplierFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos fornecedores</SelectItem>
                  {suppliersList.map((s: Supplier) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 text-xs">
                <Label className="text-[10px] text-muted-foreground">De</Label>
                <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="h-9 w-[140px] text-xs" />
                <Label className="text-[10px] text-muted-foreground ml-1">Até</Label>
                <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="h-9 w-[140px] text-xs" />
              </div>

              {campaignIdFilter && (
                <Badge variant="outline" className="h-9 px-3 gap-2 text-xs bg-primary/10 text-primary border-primary/30">
                  Campanha #{campaignIdFilter}
                  <button onClick={() => setCampaignIdFilter(null)} className="hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}

              {(statusFilter || supplierFilter || dueFrom || dueTo || campaignIdFilter) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs gap-1"
                  onClick={() => { setStatusFilter(""); setSupplierFilter(""); setDueFrom(""); setDueTo(""); setCampaignIdFilter(null); }}>
                  <X className="w-3 h-3" /> Limpar filtros
                </Button>
              )}

              <div className="ml-auto flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <Button size="sm" className="gap-1.5" onClick={() => { setBulkPayDate(new Date().toISOString().split("T")[0]); setBulkPayOpen(true); }}>
                    <Check className="w-4 h-4" /> Marcar {selectedIds.length} como pago
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateDialog(true)}>
                  <Plus className="w-4 h-4" /> Nova Conta
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : visibleRows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CircleDollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma conta encontrada nesta categoria</p>
              </div>
            ) : (
              <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="text-left py-3 px-3 w-8">
                          <input type="checkbox" checked={allPendingSelected} onChange={toggleSelectAll} aria-label="Selecionar pendentes" />
                        </th>
                        <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Descrição</th>
                        <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:table-cell">Campanha</th>
                        <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden lg:table-cell">Beneficiário</th>
                        <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Valor</th>
                        <th className="text-center py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:table-cell">Vencimento</th>
                        <th className="text-center py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hidden md:table-cell">Pagamento</th>
                        <th className="text-center py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Status</th>
                        <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((p) => {
                        const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
                        const isOverdue = p.status === "pendente" && p.dueDate && p.dueDate < new Date().toISOString().split("T")[0];
                        const checked = selectedIds.includes(p.id);
                        return (
                          <tr key={p.id} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-3">
                              {p.status === "pendente" && (
                                <input type="checkbox" checked={checked} onChange={() => toggleSelect(p.id)} aria-label={`Selecionar conta ${p.id}`} />
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-medium text-xs">{p.description}</p>
                              {p.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{p.notes}</p>}
                              {activeTab === "manual" && p.sourceType && p.sourceType !== "manual" && (
                                <Badge variant="outline" className="mt-1 text-[9px] bg-muted/10">{p.sourceType}</Badge>
                              )}
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
                            <td className="py-3 px-4 text-center text-xs hidden md:table-cell">
                              {p.paymentDate ? <span className="text-emerald-400">{formatDate(p.paymentDate)}</span> : "—"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant="outline" className={`text-[9px] ${sc.color}`}>{sc.label}</Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {p.status === "pendente" && (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400" title="Marcar como pago"
                                      onClick={() => { setPayDialogId(p.id); setPayDate(new Date().toISOString().split("T")[0]); setProofUrl(""); }}>
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
          </TabsContent>
        ))}
      </Tabs>

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

      <Dialog open={bulkPayOpen} onOpenChange={setBulkPayOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Marcar {selectedIds.length} contas como pagas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Total: <strong>{formatCurrency(totalSel)}</strong></p>
            <div>
              <Label className="text-xs">Data do Pagamento</Label>
              <Input type="date" value={bulkPayDate} onChange={(e) => setBulkPayDate(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!bulkPayDate || bulkPaidMutation.isPending}
              onClick={() => bulkPaidMutation.mutate({ ids: selectedIds, paymentDate: bulkPayDate })}>
              {bulkPaidMutation.isPending ? "Registrando..." : "Confirmar pagamento em lote"}
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
                    {suppliersList.map((s: Supplier) => (
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Nova Conta a Pagar (manual)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Categoria *</Label>
              <Select value={createForm.sourceType} onValueChange={(v) => setCreateForm({ ...createForm, sourceType: v as SourceType })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant_commission">Comissão Restaurante</SelectItem>
                  <SelectItem value="vip_repasse">Repasse Sala VIP</SelectItem>
                  <SelectItem value="supplier_cost">Fornecedor (Produção)</SelectItem>
                  <SelectItem value="freight_cost">Frete</SelectItem>
                  <SelectItem value="manual">Outros / Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Campanha *</Label>
              <Select value={createForm.campaignId || "none"} onValueChange={(v) => setCreateForm({ ...createForm, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione a campanha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {campaignsList.map((c: CampaignSummary) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fornecedor (opcional)</Label>
              <Select value={createForm.supplierId || "none"} onValueChange={(v) => setCreateForm({ ...createForm, supplierId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {suppliersList.map((s: Supplier) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Ex: NF #1234 - Lote 2" />
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
                sourceType: createForm.sourceType,
                description: createForm.description,
                amount: createForm.amount,
                dueDate: createForm.dueDate || undefined,
                supplierId: createForm.supplierId ? parseInt(createForm.supplierId) : undefined,
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
