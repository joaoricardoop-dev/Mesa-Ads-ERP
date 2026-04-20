import { useMemo, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Sparkles, Calendar } from "lucide-react";

type SeasonalRow = RouterOutputs["seasonalMultiplier"]["list"][number];
type ProductRow = RouterOutputs["product"]["list"][number];
type RestaurantRow = RouterOutputs["activeRestaurant"]["list"][number];

interface FormState {
  id?: number;
  productId: string;
  restaurantId: string;
  seasonLabel: string;
  startDate: string;
  endDate: string;
  multiplier: string;
}

const EMPTY_FORM: FormState = {
  productId: "",
  restaurantId: "",
  seasonLabel: "",
  startDate: "",
  endDate: "",
  multiplier: "1.20",
};

function fmtDate(s: string) {
  if (!s) return "—";
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return s;
  }
}

export default function SeasonalMultipliers() {
  const utils = trpc.useUtils();
  const listQ = trpc.seasonalMultiplier.list.useQuery();
  const productsQ = trpc.product.list.useQuery();
  const restaurantsQ = trpc.activeRestaurant.list.useQuery();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterProduct, setFilterProduct] = useState<string>("all");

  const createMut = trpc.seasonalMultiplier.create.useMutation({
    onSuccess: () => {
      toast.success("Multiplicador criado.");
      utils.seasonalMultiplier.list.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.seasonalMultiplier.update.useMutation({
    onSuccess: () => {
      toast.success("Multiplicador atualizado.");
      utils.seasonalMultiplier.list.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.seasonalMultiplier.delete.useMutation({
    onSuccess: () => {
      toast.success("Multiplicador removido.");
      utils.seasonalMultiplier.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const products = productsQ.data ?? [];
  const restaurants = restaurantsQ.data ?? [];
  const rows = listQ.data ?? [];
  const filteredRows = useMemo(() => {
    if (filterProduct === "all") return rows;
    const id = parseInt(filterProduct, 10);
    return rows.filter((r) => r.productId === id);
  }, [rows, filterProduct]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(row: SeasonalRow) {
    setForm({
      id: row.id,
      productId: String(row.productId),
      restaurantId: row.restaurantId != null ? String(row.restaurantId) : "",
      seasonLabel: row.seasonLabel,
      startDate: row.startDate,
      endDate: row.endDate,
      multiplier: row.multiplier,
    });
    setOpen(true);
  }

  function handleSubmit() {
    if (!form.productId) return toast.error("Selecione um produto.");
    if (!form.seasonLabel.trim()) return toast.error("Informe um rótulo.");
    if (!form.startDate || !form.endDate) return toast.error("Informe o intervalo de datas.");
    const m = parseFloat(form.multiplier);
    if (!isFinite(m) || m <= 0) return toast.error("Multiplicador deve ser maior que zero.");
    const payload = {
      productId: parseInt(form.productId, 10),
      restaurantId: form.restaurantId ? parseInt(form.restaurantId, 10) : null,
      seasonLabel: form.seasonLabel.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      multiplier: form.multiplier,
    };
    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleDelete(id: number) {
    if (!confirm("Remover este multiplicador?")) return;
    deleteMut.mutate({ id });
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Multiplicadores Sazonais
          </h1>
          <p className="text-sm text-muted-foreground">
            Janelas sazonais com multiplicador de preço aplicado quando o período da campanha cruza a janela.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo multiplicador
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs">Filtrar por produto</Label>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-64 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {products.map((p: ProductRow) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rótulo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Multiplicador</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!listQ.isLoading && filteredRows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Nenhum multiplicador cadastrado.</TableCell></TableRow>
            )}
            {filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.seasonLabel}</TableCell>
                <TableCell>{row.productName ?? `#${row.productId}`}</TableCell>
                <TableCell>
                  {row.restaurantId == null
                    ? <Badge variant="outline" className="text-[10px]">Global</Badge>
                    : (row.restaurantName ?? `#${row.restaurantId}`)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {fmtDate(row.startDate)} → {fmtDate(row.endDate)}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">×{parseFloat(row.multiplier).toFixed(2)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)} className="h-7 w-7">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(row.id)} className="h-7 w-7 text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar multiplicador" : "Novo multiplicador sazonal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Produto *</Label>
              <Select value={form.productId} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: ProductRow) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Local (opcional — em branco = global)</Label>
              <Select
                value={form.restaurantId || "__null__"}
                onValueChange={v => setForm(f => ({ ...f, restaurantId: v === "__null__" ? "" : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null__">Global (todos os locais)</SelectItem>
                  {restaurants.map((r: RestaurantRow) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Rótulo *</Label>
              <Input
                value={form.seasonLabel}
                onChange={e => setForm(f => ({ ...f, seasonLabel: e.target.value }))}
                placeholder="Ex.: Carnaval 2026, Dezembro alta"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Início *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fim *</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Multiplicador * (ex.: 1.30 para +30%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.multiplier}
                onChange={e => setForm(f => ({ ...f, multiplier: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
