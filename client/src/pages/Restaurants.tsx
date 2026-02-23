import { useState } from "react";
import AppNav from "@/components/AppNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  MapPin,
  Phone,
  User,
  Search,
} from "lucide-react";

interface RestaurantForm {
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  contactName: string;
  contactPhone: string;
  coastersAllocated: number;
  commissionPercent: string;
  status: "active" | "inactive";
}

const emptyForm: RestaurantForm = {
  name: "",
  address: "",
  neighborhood: "",
  city: "",
  contactName: "",
  contactPhone: "",
  coastersAllocated: 500,
  commissionPercent: "20.00",
  status: "active",
};

export default function Restaurants() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RestaurantForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: restaurants = [], isLoading } = trpc.restaurant.list.useQuery();

  const createMutation = trpc.restaurant.create.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("Restaurante cadastrado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.restaurant.update.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Restaurante atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.restaurant.delete.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      setDeleteId(null);
      toast.success("Restaurante removido!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (r: (typeof restaurants)[0]) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      address: r.address || "",
      neighborhood: r.neighborhood || "",
      city: r.city || "",
      contactName: r.contactName || "",
      contactPhone: r.contactPhone || "",
      coastersAllocated: r.coastersAllocated,
      commissionPercent: String(r.commissionPercent),
      status: r.status,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.neighborhood || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = restaurants.filter((r) => r.status === "active").length;
  const totalCoasters = restaurants.reduce(
    (sum, r) => sum + r.coastersAllocated,
    0
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Restaurantes Parceiros
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os restaurantes que recebem coasters e comissão da Mesa Ads
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Restaurante
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold font-mono">{restaurants.length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold font-mono text-primary">
            {activeCount}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Coasters Alocados</p>
          <p className="text-2xl font-bold font-mono">
            {totalCoasters.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Comissão Média</p>
          <p className="text-2xl font-bold font-mono">
            {restaurants.length > 0
              ? (
                  restaurants.reduce(
                    (sum, r) => sum + parseFloat(String(r.commissionPercent)),
                    0
                  ) / restaurants.length
                ).toFixed(1)
              : "0"}
            %
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar restaurante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border/30"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-xs text-muted-foreground font-medium">
                RESTAURANTE
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                LOCALIZAÇÃO
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">
                CONTATO
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-right">
                COASTERS
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-right">
                COMISSÃO
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-center">
                STATUS
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-right">
                AÇÕES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {search
                    ? "Nenhum restaurante encontrado"
                    : "Nenhum restaurante cadastrado. Clique em \"Novo Restaurante\" para começar."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="border-border/20 hover:bg-card/80">
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {r.neighborhood || r.city || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {r.contactName || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.coastersAllocated.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-primary">
                    {parseFloat(String(r.commissionPercent)).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={r.status === "active" ? "default" : "secondary"}
                      className={
                        r.status === "active"
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {r.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(r)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Restaurante" : "Novo Restaurante"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do restaurante"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Bairro</Label>
                <Input
                  value={form.neighborhood}
                  onChange={(e) =>
                    setForm({ ...form, neighborhood: e.target.value })
                  }
                  placeholder="Bairro"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Cidade"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Endereço completo"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contato</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                  placeholder="Nome do contato"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm({ ...form, contactPhone: e.target.value })
                  }
                  placeholder="(11) 99999-9999"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Coasters</Label>
                <Input
                  type="number"
                  value={form.coastersAllocated}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      coastersAllocated: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Comissão %</Label>
                <Input
                  value={form.commissionPercent}
                  onChange={(e) =>
                    setForm({ ...form, commissionPercent: e.target.value })
                  }
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as "active" | "inactive" })
                  }
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover restaurante?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O restaurante será removido de
              todas as campanhas associadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
