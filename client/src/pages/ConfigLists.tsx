import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ListChecks, Tag, ArrowUp, ArrowDown, Monitor } from "lucide-react";

type ConfigOptionRow = RouterOutputs["configOption"]["listAdmin"][number];
type ListType = "loss_reason" | "origin_category" | "screen_category";

const PLACEHOLDER_BY_TYPE: Record<ListType, string> = {
  loss_reason: "Ex.: Mudança de prioridade",
  origin_category: "Ex.: Feira / Networking",
  screen_category: "Ex.: Shopping",
};

interface ConfigSectionProps {
  type: ListType;
  title: string;
  description: string;
  icon: React.ReactNode;
}

function ConfigSection({ type, title, description, icon }: ConfigSectionProps) {
  const utils = trpc.useUtils();
  const listQ = trpc.configOption.listAdmin.useQuery({ type });
  const rows = listQ.data ?? [];

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [label, setLabel] = useState("");

  function invalidate() {
    utils.configOption.listAdmin.invalidate({ type });
    utils.configOption.list.invalidate({ type });
  }

  const createMut = trpc.configOption.create.useMutation({
    onSuccess: () => { toast.success("Item adicionado."); invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.configOption.update.useMutation({
    onSuccess: () => { toast.success("Item atualizado."); invalidate(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.configOption.delete.useMutation({
    onSuccess: () => { toast.success("Item removido."); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setLabel("");
    setOpen(true);
  }

  function openEdit(row: ConfigOptionRow) {
    setEditId(row.id);
    setLabel(row.label);
    setOpen(true);
  }

  function handleSubmit() {
    const trimmed = label.trim();
    if (!trimmed) return toast.error("Informe um rótulo.");
    if (editId != null) {
      updateMut.mutate({ id: editId, label: trimmed });
    } else {
      createMut.mutate({ type, label: trimmed });
    }
  }

  function toggleActive(row: ConfigOptionRow) {
    updateMut.mutate({ id: row.id, isActive: !row.isActive });
  }

  function move(row: ConfigOptionRow, direction: "up" | "down") {
    const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    const idx = sorted.findIndex((r) => r.id === row.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];
    updateMut.mutate({ id: row.id, sortOrder: other.sortOrder });
    updateMut.mutate({ id: other.id, sortOrder: row.sortOrder });
  }

  function handleDelete(row: ConfigOptionRow) {
    if (!confirm(`Remover "${row.label}"? Registros antigos que usam este valor mantêm o texto gravado.`)) return;
    deleteMut.mutate({ id: row.id });
  }

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">{icon}{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5" data-testid={`button-add-${type}`}>
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </Button>
      </div>

      <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ordem</TableHead>
              <TableHead>Rótulo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!listQ.isLoading && sorted.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Nenhum item cadastrado.</TableCell></TableRow>
            )}
            {sorted.map((row, idx) => (
              <TableRow key={row.id} data-testid={`row-${type}-${row.code}`}>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => move(row, "up")}>
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === sorted.length - 1} onClick={() => move(row, "down")}>
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(row)} className="cursor-pointer">
                    {row.isActive
                      ? <Badge variant="secondary" className="text-[10px]">Ativo</Badge>
                      : <Badge variant="outline" className="text-[10px] text-muted-foreground">Inativo</Badge>}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)} className="h-7 w-7" data-testid={`button-edit-${type}-${row.code}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(row)} className="h-7 w-7 text-red-400">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId != null ? "Editar item" : `Novo item — ${title}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rótulo *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={PLACEHOLDER_BY_TYPE[type]}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                data-testid={`input-label-${type}`}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} data-testid={`button-save-${type}`}>
              {editId != null ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConfigLists() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          Listas & Categorias
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure as listas paramétricas usadas em Oportunidades e Cotações. As alterações refletem em todos os selects do sistema.
        </p>
      </div>

      <ConfigSection
        type="origin_category"
        title="Categorias de origem"
        description="Origens de leads, oportunidades e cotações (de onde veio o contato)."
        icon={<Tag className="w-4 h-4 text-amber-400" />}
      />

      <ConfigSection
        type="loss_reason"
        title="Motivos de perda"
        description="Motivos disponíveis ao marcar uma oportunidade ou cotação como perdida."
        icon={<ListChecks className="w-4 h-4 text-rose-400" />}
      />

      <ConfigSection
        type="screen_category"
        title="Categorias de tela"
        description="Categorias do ponto de mídia (tela) — usadas no cadastro de telas dos locais."
        icon={<Monitor className="w-4 h-4 text-emerald-400" />}
      />
    </div>
  );
}
