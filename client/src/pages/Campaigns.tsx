import { useState, useMemo } from "react";
import AppNav from "@/components/AppNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Megaphone,
  Search,
  Store,
  Calendar,
  DollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CampaignForm {
  clientId: number | null;
  name: string;
  cpm: string;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "paused" | "completed";
  notes: string;
}

const emptyForm: CampaignForm = {
  clientId: null,
  name: "",
  cpm: "50.00",
  startDate: "",
  endDate: "",
  status: "draft",
  notes: "",
};

interface RestaurantSelection {
  restaurantId: number;
  coastersCount: number;
  usagePerDay: number;
  selected: boolean;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary border-primary/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export default function Campaigns() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRestaurantsDialogOpen, setIsRestaurantsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [managingCampaignId, setManagingCampaignId] = useState<number | null>(null);
  const [restaurantSelections, setRestaurantSelections] = useState<RestaurantSelection[]>([]);

  const utils = trpc.useUtils();
  const { data: campaignsList = [], isLoading } = trpc.campaign.list.useQuery();
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: restaurantsList = [] } = trpc.restaurant.list.useQuery();

  const { data: campaignRestaurants = [] } = trpc.campaign.getRestaurants.useQuery(
    { campaignId: managingCampaignId! },
    { enabled: managingCampaignId !== null }
  );

  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("Campanha criada com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Campanha atualizada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.campaign.delete.useMutation({
    onSuccess: () => {
      utils.campaign.list.invalidate();
      setDeleteId(null);
      toast.success("Campanha removida!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const setRestaurantsMutation = trpc.campaign.setRestaurants.useMutation({
    onSuccess: () => {
      utils.campaign.getRestaurants.invalidate();
      setIsRestaurantsDialogOpen(false);
      setManagingCampaignId(null);
      toast.success("Restaurantes da campanha atualizados!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error("Datas são obrigatórias");
      return;
    }

    const payload = {
      ...form,
      clientId: form.clientId!,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (c: (typeof campaignsList)[0]) => {
    setEditingId(c.id);
    setForm({
      clientId: c.clientId,
      name: c.name,
      cpm: String(c.cpm),
      startDate: c.startDate ? new Date(c.startDate).toISOString().split("T")[0] : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().split("T")[0] : "",
      status: c.status,
      notes: c.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const handleManageRestaurants = (campaignId: number) => {
    setManagingCampaignId(campaignId);

    // Build selections from existing restaurants
    const existing = campaignRestaurants || [];
    const selections: RestaurantSelection[] = restaurantsList
      .filter((r) => r.status === "active")
      .map((r) => {
        const linked = existing.find((cr) => cr.restaurantId === r.id);
        return {
          restaurantId: r.id,
          name: r.name,
          coastersCount: linked ? linked.coastersCount : r.coastersAllocated,
          usagePerDay: linked ? linked.usagePerDay : 5,
          selected: !!linked,
        };
      });

    setRestaurantSelections(selections);
    setIsRestaurantsDialogOpen(true);
  };

  const handleSaveRestaurants = () => {
    if (!managingCampaignId) return;
    const selected = restaurantSelections
      .filter((r) => r.selected)
      .map((r) => ({
        restaurantId: r.restaurantId,
        coastersCount: r.coastersCount,
        usagePerDay: r.usagePerDay,
      }));

    setRestaurantsMutation.mutate({
      campaignId: managingCampaignId,
      restaurants: selected,
    });
  };

  const toggleRestaurant = (restaurantId: number) => {
    setRestaurantSelections((prev) =>
      prev.map((r) =>
        r.restaurantId === restaurantId ? { ...r, selected: !r.selected } : r
      )
    );
  };

  const updateRestaurantField = (
    restaurantId: number,
    field: "coastersCount" | "usagePerDay",
    value: number
  ) => {
    setRestaurantSelections((prev) =>
      prev.map((r) =>
        r.restaurantId === restaurantId ? { ...r, [field]: value } : r
      )
    );
  };

  const filtered = campaignsList.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.clientName || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = campaignsList.filter((c) => c.status === "active").length;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Campanhas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e gerencie campanhas de mídia em coasters para seus clientes
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold font-mono">{campaignsList.length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Ativas</p>
          <p className="text-2xl font-bold font-mono text-primary">
            {activeCount}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Rascunho</p>
          <p className="text-2xl font-bold font-mono">
            {campaignsList.filter((c) => c.status === "draft").length}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Concluídas</p>
          <p className="text-2xl font-bold font-mono">
            {campaignsList.filter((c) => c.status === "completed").length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar campanha..."
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
                CAMPANHA
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                CLIENTE
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-right">
                CPM
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">
                PERÍODO
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-center">
                STATUS
              </TableHead>
              <TableHead className="text-xs text-muted-foreground font-medium text-center hidden md:table-cell">
                RESTAURANTES
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
                    ? "Nenhuma campanha encontrada"
                    : "Nenhuma campanha cadastrada. Clique em \"Nova Campanha\" para começar."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="border-border/20 hover:bg-card/80">
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {c.clientName || "—"}
                    {c.clientCompany && (
                      <span className="text-xs block text-muted-foreground/60">
                        {c.clientCompany}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-primary">
                    R$ {parseFloat(String(c.cpm)).toFixed(2)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {c.startDate
                        ? new Date(c.startDate).toLocaleDateString("pt-BR")
                        : "—"}{" "}
                      →{" "}
                      {c.endDate
                        ? new Date(c.endDate).toLocaleDateString("pt-BR")
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[c.status] || ""}
                    >
                      {STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => handleManageRestaurants(c.id)}
                    >
                      <Store className="w-3 h-3" />
                      Gerenciar
                    </Button>
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

      {/* Create/Edit Campaign Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Campanha" : "Nova Campanha"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome da Campanha *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Campanha Verão 2026"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Cliente *</Label>
                <Select
                  value={form.clientId ? String(form.clientId) : "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      clientId: v === "none" ? null : parseInt(v),
                    })
                  }
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione um cliente</SelectItem>
                    {clientsList
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                          {c.company ? ` (${c.company})` : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>CPM (R$)</Label>
                <Input
                  value={form.cpm}
                  onChange={(e) => setForm({ ...form, cpm: e.target.value })}
                  placeholder="50.00"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Data Fim *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    status: v as CampaignForm["status"],
                  })
                }
              >
                <SelectTrigger className="bg-background border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas sobre a campanha..."
                className="bg-background border-border/30"
              />
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
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Restaurants Dialog */}
      <Dialog
        open={isRestaurantsDialogOpen}
        onOpenChange={setIsRestaurantsDialogOpen}
      >
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Restaurantes da Campanha
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {restaurantSelections.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum restaurante ativo disponível. Cadastre restaurantes
                primeiro.
              </p>
            ) : (
              restaurantSelections.map((r) => (
                <div
                  key={r.restaurantId}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                    r.selected
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/20 bg-background/50"
                  }`}
                >
                  <Checkbox
                    checked={r.selected}
                    onCheckedChange={() => toggleRestaurant(r.restaurantId)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                  </div>
                  {r.selected && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">
                          Coasters:
                        </Label>
                        <Input
                          type="number"
                          value={r.coastersCount}
                          onChange={(e) =>
                            updateRestaurantField(
                              r.restaurantId,
                              "coastersCount",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 h-8 text-xs bg-background border-border/30"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">
                          Uso/dia:
                        </Label>
                        <Input
                          type="number"
                          value={r.usagePerDay}
                          onChange={(e) =>
                            updateRestaurantField(
                              r.restaurantId,
                              "usagePerDay",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-16 h-8 text-xs bg-background border-border/30"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-muted-foreground">
                {restaurantSelections.filter((r) => r.selected).length}{" "}
                restaurante(s) selecionado(s)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsRestaurantsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveRestaurants}
                  disabled={setRestaurantsMutation.isPending}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha e seus vínculos com
              restaurantes serão removidos.
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
