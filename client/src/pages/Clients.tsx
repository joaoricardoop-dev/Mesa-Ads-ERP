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
  Building2,
  Mail,
  Phone,
  Search,
  Tag,
} from "lucide-react";

interface ClientForm {
  name: string;
  company: string;
  contactEmail: string;
  contactPhone: string;
  segment: string;
  status: "active" | "inactive";
}

const emptyForm: ClientForm = {
  name: "",
  company: "",
  contactEmail: "",
  contactPhone: "",
  segment: "",
  status: "active",
};

const SEGMENTS = [
  "Alimentação",
  "Bebidas",
  "Tecnologia",
  "Saúde",
  "Beleza",
  "Moda",
  "Entretenimento",
  "Finanças",
  "Educação",
  "Varejo",
  "Automotivo",
  "Turismo",
  "Outro",
];

export default function Clients() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: clientsList = [], isLoading } = trpc.advertiser.list.useQuery();

  const createMutation = trpc.advertiser.create.useMutation({
    onSuccess: () => {
      utils.advertiser.list.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("Cliente cadastrado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.advertiser.update.useMutation({
    onSuccess: () => {
      utils.advertiser.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Cliente atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.advertiser.delete.useMutation({
    onSuccess: () => {
      utils.advertiser.list.invalidate();
      setDeleteId(null);
      toast.success("Cliente removido!");
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

  const handleEdit = (c: (typeof clientsList)[0]) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      company: c.company || "",
      contactEmail: c.contactEmail || "",
      contactPhone: c.contactPhone || "",
      segment: c.segment || "",
      status: c.status,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const filtered = clientsList.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.segment || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = clientsList.filter((c) => c.status === "active").length;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Clientes (Anunciantes)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os anunciantes que compram mídia da Mesa Ads
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Clientes</p>
          <p className="text-2xl font-bold font-mono">{clientsList.length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold font-mono text-primary">
            {activeCount}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Segmentos</p>
          <p className="text-2xl font-bold font-mono">
            {new Set(clientsList.map((c) => c.segment).filter(Boolean)).size}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
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
                CLIENTE
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                EMPRESA
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">
                CONTATO
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                SEGMENTO
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
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {search
                    ? "Nenhum cliente encontrado"
                    : "Nenhum cliente cadastrado. Clique em \"Novo Cliente\" para começar."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="border-border/20 hover:bg-card/80">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {c.company || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    <div className="flex flex-col gap-0.5">
                      {c.contactEmail && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {c.contactEmail}
                        </div>
                      )}
                      {c.contactPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {c.contactPhone}
                        </div>
                      )}
                      {!c.contactEmail && !c.contactPhone && "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.segment ? (
                      <Badge
                        variant="outline"
                        className="border-border/40 text-xs"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {c.segment}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={c.status === "active" ? "default" : "secondary"}
                      className={
                        c.status === "active"
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {c.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(c)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
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
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome do Contato *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do contato principal"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Nome da empresa"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                  placeholder="email@empresa.com"
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Segmento</Label>
                <Select
                  value={form.segment || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, segment: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente será removido
              permanentemente.
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
