import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Crown, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FormState {
  name: string;
  company: string;
  cnpj: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  location: string;
  commissionPercent: string;
  billingMode: "bruto" | "liquido";
  status: "active" | "inactive";
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  company: "",
  cnpj: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  location: "",
  commissionPercent: "10.00",
  billingMode: "bruto",
  status: "active",
  notes: "",
};

export default function VipProvidersPage() {
  const utils = trpc.useUtils();
  const { data: providers = [], isLoading } = trpc.vipProvider.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const createMutation = trpc.vipProvider.create.useMutation({
    onSuccess: () => {
      utils.vipProvider.list.invalidate();
      setDialogOpen(false);
      toast.success("Provedor VIP criado");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.vipProvider.update.useMutation({
    onSuccess: () => {
      utils.vipProvider.list.invalidate();
      setDialogOpen(false);
      toast.success("Provedor VIP atualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.vipProvider.delete.useMutation({
    onSuccess: () => {
      utils.vipProvider.list.invalidate();
      setDeleteConfirm(null);
      toast.success("Provedor VIP excluído");
    },
    onError: (e) => {
      toast.error(e.message);
      setDeleteConfirm(null);
    },
  });

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(p: typeof providers[number]) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      company: p.company ?? "",
      cnpj: p.cnpj ?? "",
      contactName: p.contactName ?? "",
      contactPhone: p.contactPhone ?? "",
      contactEmail: p.contactEmail ?? "",
      location: p.location ?? "",
      commissionPercent: p.commissionPercent || "10.00",
      billingMode: (p.billingMode as "bruto" | "liquido") || "bruto",
      status: (p.status as "active" | "inactive") || "active",
      notes: p.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      cnpj: form.cnpj.trim() || undefined,
      contactName: form.contactName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      location: form.location.trim() || undefined,
      commissionPercent: form.commissionPercent || "10.00",
      billingMode: form.billingMode,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <PageContainer
      title="Provedores de Sala VIP"
      description="Parceiros que recebem repasse automático pela veiculação em telas e janelas digitais."
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> Novo Provedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Provedor VIP" : "Novo Provedor VIP"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex: Aeroporto Eduardo Gomes"
                  />
                </div>
                <div>
                  <Label>Empresa/Operadora</Label>
                  <Input
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Ex: Vinci Airports"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div>
                  <Label>Localização</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Manaus/AM"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Contato (nome)</Label>
                  <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>% Repasse padrão *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.commissionPercent}
                    onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Pode ser sobrescrito por produto.</p>
                </div>
                <div>
                  <Label>Base de cálculo</Label>
                  <Select value={form.billingMode} onValueChange={(v) => setForm({ ...form, billingMode: v as "bruto" | "liquido" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bruto">Valor bruto da nota</SelectItem>
                      <SelectItem value="liquido">Valor líquido (após impostos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Regras de repasse, contrato, etc."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Salvar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : providers.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum provedor cadastrado.</p>
          <Button variant="outline" className="mt-3" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro provedor
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className="border border-border rounded-lg p-4 flex items-center justify-between hover:bg-accent/5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.company && (
                    <span className="text-sm text-muted-foreground">— {p.company}</span>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      p.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-muted/20 text-muted-foreground"
                    }
                  >
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  {p.location && <span>📍 {p.location}</span>}
                  <span>💰 {p.commissionPercent}% sobre {p.billingMode === "bruto" ? "valor bruto" : "valor líquido"}</span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {p.productsCount} {p.productsCount === 1 ? "produto" : "produtos"}
                  </span>
                  <span>💸 Pago: {formatCurrency(Number(p.totalPaid))}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEditDialog(p)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => setDeleteConfirm(p.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Provedor VIP?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. Se houver produtos vinculados, a exclusão será bloqueada.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
