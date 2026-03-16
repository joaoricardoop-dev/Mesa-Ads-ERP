import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Package } from "lucide-react";

interface TierForm {
  volumeMin: string;
  volumeMax: string;
  custoUnitario: string;
  frete: string;
  margem: string;
  artes: string;
}

const emptyTier: TierForm = { volumeMin: "", volumeMax: "", custoUnitario: "", frete: "", margem: "50.00", artes: "1" };

interface ProductForm {
  name: string;
  description: string;
  unitLabel: string;
  unitLabelPlural: string;
  defaultQtyPerLocation: string;
  irpj: string;
  comRestaurante: string;
  comComercial: string;
  isActive: boolean;
}

const emptyProduct: ProductForm = {
  name: "",
  description: "",
  unitLabel: "unidade",
  unitLabelPlural: "unidades",
  defaultQtyPerLocation: "500",
  irpj: "6.00",
  comRestaurante: "15.00",
  comComercial: "10.00",
  isActive: true,
};

export default function Products() {
  const utils = trpc.useUtils();
  const { data: productsList = [], isLoading } = trpc.product.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyProduct);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [tiersDialogOpen, setTiersDialogOpen] = useState(false);
  const [tiersProductId, setTiersProductId] = useState<number | null>(null);
  const [tiersForm, setTiersForm] = useState<TierForm[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const createMutation = trpc.product.create.useMutation({
    onSuccess: () => { utils.product.list.invalidate(); setDialogOpen(false); toast.success("Produto criado"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.product.update.useMutation({
    onSuccess: () => { utils.product.list.invalidate(); setDialogOpen(false); toast.success("Produto atualizado"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.product.delete.useMutation({
    onSuccess: () => { utils.product.list.invalidate(); setDeleteConfirm(null); toast.success("Produto excluído"); },
    onError: (e) => toast.error(e.message),
  });

  const upsertTiersMutation = trpc.product.upsertTiers.useMutation({
    onSuccess: () => { utils.product.listTiers.invalidate(); setTiersDialogOpen(false); toast.success("Faixas de preço atualizadas"); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  }

  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      unitLabel: p.unitLabel,
      unitLabelPlural: p.unitLabelPlural,
      defaultQtyPerLocation: String(p.defaultQtyPerLocation || 500),
      irpj: p.irpj || "6.00",
      comRestaurante: p.comRestaurante || "15.00",
      comComercial: p.comComercial || "10.00",
      isActive: p.isActive,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      unitLabel: form.unitLabel,
      unitLabelPlural: form.unitLabelPlural,
      defaultQtyPerLocation: parseInt(form.defaultQtyPerLocation) || 500,
      irpj: form.irpj,
      comRestaurante: form.comRestaurante,
      comComercial: form.comComercial,
      isActive: form.isActive,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function openTiersEditor(productId: number) {
    setTiersProductId(productId);
    setTiersDialogOpen(true);
  }

  function handleSaveTiers() {
    if (!tiersProductId) return;
    const tiers = tiersForm
      .filter(t => t.volumeMin.trim() !== "")
      .map(t => ({
        volumeMin: parseInt(t.volumeMin),
        volumeMax: t.volumeMax.trim() === "" ? null : parseInt(t.volumeMax),
        custoUnitario: t.custoUnitario,
        frete: t.frete,
        margem: t.margem,
        artes: parseInt(t.artes) || 1,
      }));
    upsertTiersMutation.mutate({ productId: tiersProductId, tiers });
  }

  function addTierRow() {
    setTiersForm(prev => [...prev, { ...emptyTier }]);
  }

  function removeTierRow(idx: number) {
    setTiersForm(prev => prev.filter((_, i) => i !== idx));
  }

  function updateTierRow(idx: number, field: keyof TierForm, val: string) {
    setTiersForm(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />
            Produtos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os produtos e suas faixas de precificação
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Produto
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : productsList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum produto cadastrado</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Qtd Padrão/Ponto</TableHead>
                <TableHead>IRPJ</TableHead>
                <TableHead>Com. Rest.</TableHead>
                <TableHead>Com. Com.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsList.map((p: any) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setDeleteConfirm(p.id)}
                  onEditTiers={() => openTiersEditor(p.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Bolacha de Chopp" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidade (singular)</Label>
                <Input value={form.unitLabel} onChange={e => setForm({ ...form, unitLabel: e.target.value })} placeholder="bolacha" />
              </div>
              <div>
                <Label>Unidade (plural)</Label>
                <Input value={form.unitLabelPlural} onChange={e => setForm({ ...form, unitLabelPlural: e.target.value })} placeholder="bolachas" />
              </div>
            </div>
            <div>
              <Label>Qtd padrão por ponto de venda</Label>
              <Input type="number" value={form.defaultQtyPerLocation} onChange={e => setForm({ ...form, defaultQtyPerLocation: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>IRPJ (%)</Label>
                <Input value={form.irpj} onChange={e => setForm({ ...form, irpj: e.target.value })} />
              </div>
              <div>
                <Label>Com. Restaurante (%)</Label>
                <Input value={form.comRestaurante} onChange={e => setForm({ ...form, comRestaurante: e.target.value })} />
              </div>
              <div>
                <Label>Com. Comercial (%)</Label>
                <Input value={form.comComercial} onChange={e => setForm({ ...form, comComercial: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} />
              <Label>Produto ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este produto? As faixas de preço associadas também serão removidas.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })} disabled={deleteMutation.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TiersDialog
        open={tiersDialogOpen}
        onOpenChange={setTiersDialogOpen}
        productId={tiersProductId}
        tiers={tiersForm}
        setTiers={setTiersForm}
        onSave={handleSaveTiers}
        onAddRow={addTierRow}
        onRemoveRow={removeTierRow}
        onUpdateRow={updateTierRow}
        saving={upsertTiersMutation.isPending}
      />
    </div>
  );
}

function ProductRow({ product: p, expanded, onToggle, onEdit, onDelete, onEditTiers }: {
  product: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditTiers: () => void;
}) {
  const { data: tiers = [] } = trpc.product.listTiers.useQuery(
    { productId: p.id },
    { enabled: expanded }
  );

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">{p.name}</TableCell>
        <TableCell className="text-muted-foreground">{p.unitLabelPlural}</TableCell>
        <TableCell>{p.defaultQtyPerLocation?.toLocaleString("pt-BR")}</TableCell>
        <TableCell>{p.irpj}%</TableCell>
        <TableCell>{p.comRestaurante}%</TableCell>
        <TableCell>{p.comComercial}%</TableCell>
        <TableCell>
          <Badge variant={p.isActive ? "default" : "secondary"} className={p.isActive ? "bg-green-600" : ""}>
            {p.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Faixas de Precificação ({tiers.length})</h3>
              <Button size="sm" variant="outline" onClick={onEditTiers}>
                <Pencil className="h-3 w-3 mr-1" /> Editar Faixas
              </Button>
            </div>
            {tiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma faixa cadastrada</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Volume Mín</TableHead>
                      <TableHead>Volume Máx</TableHead>
                      <TableHead>Custo Unit.</TableHead>
                      <TableHead>Frete</TableHead>
                      <TableHead>Margem</TableHead>
                      <TableHead>Artes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.volumeMin.toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{t.volumeMax ? t.volumeMax.toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell className="font-mono">R$ {Number(t.custoUnitario).toFixed(4)}</TableCell>
                        <TableCell className="font-mono">R$ {Number(t.frete).toFixed(2)}</TableCell>
                        <TableCell>{t.margem}%</TableCell>
                        <TableCell>{t.artes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {p.description && (
              <p className="text-xs text-muted-foreground mt-3">{p.description}</p>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TiersDialog({ open, onOpenChange, productId, tiers, setTiers, onSave, onAddRow, onRemoveRow, onUpdateRow, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: number | null;
  tiers: TierForm[];
  setTiers: (t: TierForm[]) => void;
  onSave: () => void;
  onAddRow: () => void;
  onRemoveRow: (i: number) => void;
  onUpdateRow: (i: number, field: keyof TierForm, val: string) => void;
  saving: boolean;
}) {
  const { data: existingTiers } = trpc.product.listTiers.useQuery(
    { productId: productId! },
    { enabled: open && productId !== null }
  );

  const hydratedForRef = useRef<string>("");

  useEffect(() => {
    if (!open) {
      hydratedForRef.current = "";
      return;
    }
    if (!existingTiers) return;
    const key = `${productId}:${existingTiers.length}`;
    if (key === hydratedForRef.current) return;
    hydratedForRef.current = key;
    setTiers(existingTiers.map((t: any) => ({
      volumeMin: String(t.volumeMin),
      volumeMax: t.volumeMax !== null ? String(t.volumeMax) : "",
      custoUnitario: String(t.custoUnitario),
      frete: String(t.frete),
      margem: String(t.margem),
      artes: String(t.artes || 1),
    })));
  }, [open, existingTiers, productId, setTiers]);

  const inputCls = "h-8 text-xs font-mono px-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Faixas de Precificação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma faixa. Clique em "Adicionar Faixa" para começar.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Vol. Mín</TableHead>
                    <TableHead className="w-24">Vol. Máx</TableHead>
                    <TableHead className="w-28">Custo Unit. (R$)</TableHead>
                    <TableHead className="w-24">Frete (R$)</TableHead>
                    <TableHead className="w-20">Margem (%)</TableHead>
                    <TableHead className="w-16">Artes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((t, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Input className={inputCls} value={t.volumeMin} onChange={e => onUpdateRow(idx, "volumeMin", e.target.value)} /></TableCell>
                      <TableCell><Input className={inputCls} value={t.volumeMax} onChange={e => onUpdateRow(idx, "volumeMax", e.target.value)} placeholder="∞" /></TableCell>
                      <TableCell><Input className={inputCls} value={t.custoUnitario} onChange={e => onUpdateRow(idx, "custoUnitario", e.target.value)} /></TableCell>
                      <TableCell><Input className={inputCls} value={t.frete} onChange={e => onUpdateRow(idx, "frete", e.target.value)} /></TableCell>
                      <TableCell><Input className={inputCls} value={t.margem} onChange={e => onUpdateRow(idx, "margem", e.target.value)} /></TableCell>
                      <TableCell><Input className={inputCls} value={t.artes} onChange={e => onUpdateRow(idx, "artes", e.target.value)} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemoveRow(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onAddRow}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar Faixa
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Faixas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
