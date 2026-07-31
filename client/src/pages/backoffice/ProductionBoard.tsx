import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Package, History } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  aguardando_arte: "Aguardando arte",
  arte_enviada_fornecedor: "Arte no fornecedor",
  prova_recebida: "Prova recebida",
  prova_aprovada: "Prova aprovada",
  em_producao: "Em produção",
  em_transporte: "Em transporte",
  recebida: "Recebida",
};
const STATUS_ORDER = Object.keys(STATUS_LABELS);
const STATUS_COLOR: Record<string, string> = {
  aguardando_arte: "bg-red-500/15 text-red-400 border-red-500/30",
  arte_enviada_fornecedor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  prova_recebida: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  prova_aprovada: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_producao: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  em_transporte: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  recebida: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

type CreateForm = {
  campaignId: string;
  supplierId: string;
  label: string;
  quantity: string;
  notes: string;
};

const EMPTY_FORM: CreateForm = { campaignId: "", supplierId: "", label: "", quantity: "", notes: "" };

export default function ProductionBoard() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [logsFor, setLogsFor] = useState<{ id: number; label: string } | null>(null);
  const { data: logs = [], isLoading: loadingLogs } = trpc.backoffice.production.logs.useQuery(
    { productionOrderId: logsFor?.id ?? 0 },
    { enabled: !!logsFor },
  );

  const utils = trpc.useUtils();
  const { data: orders = [], isLoading } = trpc.backoffice.production.list.useQuery(
    statusFilter ? { status: statusFilter as any } : undefined,
  );
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList = campaignsData?.items ?? [];
  const { data: suppliersList = [] } = trpc.supplier.list.useQuery();

  const createMutation = trpc.backoffice.production.create.useMutation({
    onSuccess: () => {
      utils.backoffice.production.list.invalidate();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Pedido de produção criado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.backoffice.production.update.useMutation({
    onSuccess: () => {
      utils.backoffice.production.list.invalidate();
      toast.success("Status atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleCreate = () => {
    if (!form.label.trim() || !form.quantity) {
      toast.error("Preencha ao menos o rótulo e a quantidade.");
      return;
    }
    createMutation.mutate({
      campaignId: form.campaignId ? Number(form.campaignId) : undefined,
      supplierId: form.supplierId ? Number(form.supplierId) : undefined,
      label: form.label.trim(),
      quantity: Number(form.quantity),
      notes: form.notes.trim() || undefined,
    });
  };

  const handleStatusChange = (id: number, status: string) => {
    const dateField: Record<string, string> = {
      arte_enviada_fornecedor: "artSentToSupplierAt",
      prova_recebida: "proofReceivedAt",
      prova_aprovada: "proofApprovedAt",
      em_transporte: "shippedAt",
      recebida: "receivedAt",
    };
    const field = dateField[status];
    const today = new Date().toISOString().slice(0, 10);
    updateMutation.mutate({ id, status: status as any, ...(field ? { [field]: today } : {}) });
  };

  return (
    <PageContainer
      title="Produção de Bolachas"
      description="Arte → Grupo Portacopos → prova → produção → frete → recebimento."
      actions={
        <div className="flex items-center gap-2">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo pedido
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Campanha (contexto)</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rastreio</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                <Package className="w-6 h-6 mx-auto mb-2 opacity-40" /> Nenhum pedido de produção ainda.
              </TableCell></TableRow>
            ) : (
              orders.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.campaignName ? (
                      <>
                        {o.campaignName}
                        <div className="text-[10px] mt-0.5">
                          status campanha: {o.campaignStatus || "—"}
                          {o.campaignMaterialReceivedDate ? ` · material: ${o.campaignMaterialReceivedDate}` : ""}
                        </div>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{o.supplierName || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{o.quantity}</TableCell>
                  <TableCell>
                    <Select value={o.status} onValueChange={(v) => handleStatusChange(o.id, v)}>
                      <SelectTrigger className={`h-7 text-[11px] w-[170px] border ${STATUS_COLOR[o.status] || ""}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.trackingCode || "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLogsFor({ id: o.id, label: o.label })} data-testid={`production-logs-${o.id}`}>
                      <History className="w-3.5 h-3.5 mr-1" />Histórico
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo pedido de produção</DialogTitle>
            <DialogDescription>Um lote de bolachas para um cliente/campanha.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Rótulo *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Brahma — Lote 08" />
            </div>
            <div className="grid gap-2">
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Campanha (opcional)</Label>
              <Select value={form.campaignId || "none"} onValueChange={(v) => setForm({ ...form, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem campanha vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem campanha vinculada</SelectItem>
                  {campaignsList.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fornecedor (opcional)</Label>
              <Select value={form.supplierId || "none"} onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Ex: Grupo Portacopos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— selecione —</SelectItem>
                  {(suppliersList as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!logsFor} onOpenChange={(o) => !o && setLogsFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico — {logsFor?.label}</DialogTitle>
            <DialogDescription>Todas as atualizações deste pedido, da mais recente para a mais antiga.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {loadingLogs ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atualização registrada ainda.</p>
            ) : (
              logs.map((l: any) => (
                <div key={l.id} className="rounded-lg border border-border/30 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{l.action}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(l.createdAt).toLocaleString("pt-BR")}{l.performedBy ? ` · ${l.performedBy}` : ""}
                    </span>
                  </div>
                  <p className="text-xs mt-1">{l.details}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
