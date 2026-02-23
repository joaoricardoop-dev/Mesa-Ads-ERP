import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Factory,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Building2,
  Search,
  Package,
  TrendingDown,
  Eye,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type SupplierForm = {
  name: string;
  cnpj: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  city: string;
  state: string;
  status: "active" | "inactive";
};

type PriceItem = {
  quantity: number;
  unitPrice: string;
  totalPrice: string;
};

type BudgetForm = {
  supplierId: number | null;
  code: string;
  description: string;
  productSpec: string;
  validUntil: string;
  status: "active" | "expired" | "rejected";
  notes: string;
  items: PriceItem[];
};

const EMPTY_SUPPLIER: SupplierForm = {
  name: "",
  cnpj: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  address: "",
  city: "",
  state: "",
  status: "active",
};

const EMPTY_BUDGET: BudgetForm = {
  supplierId: null,
  code: "",
  description: "",
  productSpec: "",
  validUntil: "",
  status: "active",
  notes: "",
  items: [{ quantity: 1000, unitPrice: "0.000", totalPrice: "0.00" }],
};

const STATUS_COLORS: Record<string, string> = {
  active: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  inactive: "border-zinc-500/30 text-zinc-400 bg-zinc-500/10",
  expired: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  rejected: "border-red-500/30 text-red-400 bg-red-500/10",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  expired: "Expirado",
  rejected: "Rejeitado",
};

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function Production() {
  const [activeTab, setActiveTab] = useState("budgets");
  const [search, setSearch] = useState("");

  // Suppliers state
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(EMPTY_SUPPLIER);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<number | null>(null);

  // Budgets state
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetForm>(EMPTY_BUDGET);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [deleteBudgetTarget, setDeleteBudgetTarget] = useState<number | null>(null);
  const [viewBudgetId, setViewBudgetId] = useState<number | null>(null);

  // Queries
  const { data: suppliersList = [], isLoading: suppliersLoading } =
    trpc.supplier.list.useQuery();
  const { data: budgetsList = [], isLoading: budgetsLoading } =
    trpc.budget.list.useQuery();
  const { data: viewItems = [] } = trpc.budget.getItems.useQuery(
    { budgetId: viewBudgetId! },
    { enabled: viewBudgetId !== null }
  );

  const utils = trpc.useUtils();

  // Supplier mutations
  const createSupplierMut = trpc.supplier.create.useMutation({
    onSuccess: () => {
      utils.supplier.list.invalidate();
      setIsSupplierDialogOpen(false);
      toast.success("Fornecedor criado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateSupplierMut = trpc.supplier.update.useMutation({
    onSuccess: () => {
      utils.supplier.list.invalidate();
      setIsSupplierDialogOpen(false);
      toast.success("Fornecedor atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteSupplierMut = trpc.supplier.delete.useMutation({
    onSuccess: () => {
      utils.supplier.list.invalidate();
      utils.budget.list.invalidate();
      setDeleteSupplierTarget(null);
      toast.success("Fornecedor removido!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  // Budget mutations
  const createBudgetMut = trpc.budget.create.useMutation({
    onSuccess: () => {
      utils.budget.list.invalidate();
      setIsBudgetDialogOpen(false);
      toast.success("Orçamento criado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateBudgetMut = trpc.budget.update.useMutation({
    onSuccess: () => {
      utils.budget.list.invalidate();
      setIsBudgetDialogOpen(false);
      toast.success("Orçamento atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteBudgetMut = trpc.budget.delete.useMutation({
    onSuccess: () => {
      utils.budget.list.invalidate();
      setDeleteBudgetTarget(null);
      toast.success("Orçamento removido!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  // ─── Supplier handlers ───────────────────────────────────────────────────

  const handleNewSupplier = () => {
    setSupplierForm(EMPTY_SUPPLIER);
    setEditingSupplierId(null);
    setIsSupplierDialogOpen(true);
  };

  const handleEditSupplier = (s: (typeof suppliersList)[0]) => {
    setSupplierForm({
      name: s.name,
      cnpj: s.cnpj || "",
      contactName: s.contactName || "",
      contactPhone: s.contactPhone || "",
      contactEmail: s.contactEmail || "",
      address: s.address || "",
      city: s.city || "",
      state: s.state || "",
      status: s.status,
    });
    setEditingSupplierId(s.id);
    setIsSupplierDialogOpen(true);
  };

  const handleSubmitSupplier = () => {
    if (!supplierForm.name.trim()) {
      toast.error("Nome do fornecedor é obrigatório");
      return;
    }
    const payload = {
      ...supplierForm,
      cnpj: supplierForm.cnpj || undefined,
      contactName: supplierForm.contactName || undefined,
      contactPhone: supplierForm.contactPhone || undefined,
      contactEmail: supplierForm.contactEmail || undefined,
      address: supplierForm.address || undefined,
      city: supplierForm.city || undefined,
      state: supplierForm.state || undefined,
    };
    if (editingSupplierId) {
      updateSupplierMut.mutate({ id: editingSupplierId, ...payload });
    } else {
      createSupplierMut.mutate(payload);
    }
  };

  // ─── Budget handlers ─────────────────────────────────────────────────────

  const handleNewBudget = () => {
    setBudgetForm(EMPTY_BUDGET);
    setEditingBudgetId(null);
    setIsBudgetDialogOpen(true);
  };

  const handleEditBudget = async (b: (typeof budgetsList)[0]) => {
    // Fetch items for this budget
    const items = await utils.budget.getItems.fetch({ budgetId: b.id });
    setBudgetForm({
      supplierId: b.supplierId,
      code: b.code || "",
      description: b.description,
      productSpec: b.productSpec || "",
      validUntil: b.validUntil
        ? new Date(b.validUntil).toISOString().split("T")[0]
        : "",
      status: b.status,
      notes: b.notes || "",
      items: items.length > 0
        ? items.map((i) => ({
            quantity: i.quantity,
            unitPrice: String(i.unitPrice),
            totalPrice: String(i.totalPrice),
          }))
        : [{ quantity: 1000, unitPrice: "0.000", totalPrice: "0.00" }],
    });
    setEditingBudgetId(b.id);
    setIsBudgetDialogOpen(true);
  };

  const handleSubmitBudget = () => {
    if (!budgetForm.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!budgetForm.supplierId) {
      toast.error("Selecione um fornecedor");
      return;
    }
    const validItems = budgetForm.items.filter(
      (i) => i.quantity > 0 && parseFloat(i.unitPrice) > 0
    );
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item de preço válido");
      return;
    }

    const payload = {
      supplierId: budgetForm.supplierId,
      code: budgetForm.code || undefined,
      description: budgetForm.description,
      productSpec: budgetForm.productSpec || undefined,
      validUntil: budgetForm.validUntil || undefined,
      status: budgetForm.status,
      notes: budgetForm.notes || undefined,
      items: validItems,
    };

    if (editingBudgetId) {
      updateBudgetMut.mutate({ id: editingBudgetId, ...payload });
    } else {
      createBudgetMut.mutate(payload);
    }
  };

  const addPriceItem = () => {
    const lastItem = budgetForm.items[budgetForm.items.length - 1];
    const nextQty = lastItem ? lastItem.quantity + 1000 : 1000;
    setBudgetForm({
      ...budgetForm,
      items: [
        ...budgetForm.items,
        { quantity: nextQty, unitPrice: "0.000", totalPrice: "0.00" },
      ],
    });
  };

  const removePriceItem = (index: number) => {
    if (budgetForm.items.length <= 1) return;
    setBudgetForm({
      ...budgetForm,
      items: budgetForm.items.filter((_, i) => i !== index),
    });
  };

  const updatePriceItem = (
    index: number,
    field: keyof PriceItem,
    value: string | number
  ) => {
    const newItems = [...budgetForm.items];
    const item = { ...newItems[index] };

    if (field === "quantity") {
      item.quantity = typeof value === "number" ? value : parseInt(value) || 0;
      // Auto-calc total
      const unitP = parseFloat(item.unitPrice) || 0;
      item.totalPrice = (item.quantity * unitP).toFixed(2);
    } else if (field === "unitPrice") {
      item.unitPrice = String(value);
      // Auto-calc total
      const unitP = parseFloat(String(value)) || 0;
      item.totalPrice = (item.quantity * unitP).toFixed(2);
    } else if (field === "totalPrice") {
      item.totalPrice = String(value);
      // Auto-calc unit price
      if (item.quantity > 0) {
        const totalP = parseFloat(String(value)) || 0;
        item.unitPrice = (totalP / item.quantity).toFixed(3);
      }
    }

    newItems[index] = item;
    setBudgetForm({ ...budgetForm, items: newItems });
  };

  // ─── Filtered lists ──────────────────────────────────────────────────────

  const filteredSuppliers = suppliersList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase())) ||
      (s.cnpj && s.cnpj.includes(search))
  );

  const filteredBudgets = budgetsList.filter(
    (b) =>
      b.description.toLowerCase().includes(search.toLowerCase()) ||
      (b.code && b.code.toLowerCase().includes(search.toLowerCase())) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(search.toLowerCase()))
  );

  // ─── View budget ─────────────────────────────────────────────────────────

  const viewBudget = budgetsList.find((b) => b.id === viewBudgetId);

  // ─── Best price calculation ──────────────────────────────────────────────

  const getBestPrice = (qty: number) => {
    let bestUnit = Infinity;
    let bestBudget = "";
    for (const b of budgetsList) {
      if (b.status !== "active") continue;
      // We need to check items - but we only have list data
      // For now, just show from view items if available
    }
    return null;
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="w-6 h-6 text-primary" />
              Custos de Produção
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie fornecedores e orçamentos de produção dos coasters
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 w-64 bg-card border-border/30"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                FORNECEDORES
              </span>
              <Building2 className="w-4 h-4 text-primary/60" />
            </div>
            <p className="text-2xl font-bold font-mono">
              {suppliersList.filter((s) => s.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">ativos</p>
          </div>
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                ORÇAMENTOS
              </span>
              <FileText className="w-4 h-4 text-primary/60" />
            </div>
            <p className="text-2xl font-bold font-mono">
              {budgetsList.filter((b) => b.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">vigentes</p>
          </div>
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                MENOR CUSTO/UN
              </span>
              <TrendingDown className="w-4 h-4 text-emerald-400/60" />
            </div>
            <p className="text-2xl font-bold font-mono text-primary">
              {/* We'd need items to calculate this - show placeholder */}
              —
            </p>
            <p className="text-xs text-muted-foreground">melhor preço disponível</p>
          </div>
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                TOTAL ORÇAMENTOS
              </span>
              <Package className="w-4 h-4 text-primary/60" />
            </div>
            <p className="text-2xl font-bold font-mono">{budgetsList.length}</p>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-card border border-border/20">
              <TabsTrigger value="budgets" className="gap-1.5">
                <FileText className="w-4 h-4" />
                Orçamentos
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="gap-1.5">
                <Building2 className="w-4 h-4" />
                Fornecedores
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              {activeTab === "suppliers" && (
                <Button onClick={handleNewSupplier} size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Novo Fornecedor
                </Button>
              )}
              {activeTab === "budgets" && (
                <Button onClick={handleNewBudget} size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Novo Orçamento
                </Button>
              )}
            </div>
          </div>

          {/* ─── Budgets Tab ──────────────────────────────────────────────── */}
          <TabsContent value="budgets" className="mt-0">
            <div className="bg-card border border-border/20 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground font-medium">
                      CÓDIGO
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">
                      DESCRIÇÃO
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                      FORNECEDOR
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-center hidden lg:table-cell">
                      VALIDADE
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
                  {budgetsLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredBudgets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {search
                          ? "Nenhum orçamento encontrado"
                          : 'Nenhum orçamento cadastrado. Clique em "Novo Orçamento" para começar.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBudgets.map((b) => (
                      <TableRow
                        key={b.id}
                        className="border-border/20 hover:bg-card/80"
                      >
                        <TableCell className="font-mono text-sm text-primary">
                          {b.code || "—"}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{b.description}</p>
                          {b.productSpec && (
                            <p className="text-xs text-muted-foreground/60 truncate max-w-xs">
                              {b.productSpec}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {b.supplierName || "—"}
                          {b.supplierCity && b.supplierState && (
                            <span className="text-xs block text-muted-foreground/60">
                              {b.supplierCity}/{b.supplierState}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell text-sm text-muted-foreground">
                          {b.validUntil
                            ? new Date(b.validUntil).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={STATUS_COLORS[b.status] || ""}
                          >
                            {STATUS_LABELS[b.status] || b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setViewBudgetId(b.id)}
                              title="Ver preços"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditBudget(b)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteBudgetTarget(b.id)}
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
          </TabsContent>

          {/* ─── Suppliers Tab ────────────────────────────────────────────── */}
          <TabsContent value="suppliers" className="mt-0">
            <div className="bg-card border border-border/20 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground font-medium">
                      FORNECEDOR
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                      CNPJ
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">
                      CONTATO
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">
                      CIDADE/UF
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
                  {suppliersLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {search
                          ? "Nenhum fornecedor encontrado"
                          : 'Nenhum fornecedor cadastrado. Clique em "Novo Fornecedor" para começar.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <TableRow
                        key={s.id}
                        className="border-border/20 hover:bg-card/80"
                      >
                        <TableCell>
                          <p className="font-medium">{s.name}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm font-mono">
                          {s.cnpj || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <p className="text-muted-foreground">
                            {s.contactName || "—"}
                          </p>
                          {s.contactPhone && (
                            <p className="text-xs text-muted-foreground/60">
                              {s.contactPhone}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {s.city && s.state
                            ? `${s.city}/${s.state}`
                            : s.city || s.state || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={STATUS_COLORS[s.status] || ""}
                          >
                            {STATUS_LABELS[s.status] || s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditSupplier(s)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteSupplierTarget(s.id)}
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
          </TabsContent>
        </Tabs>

        {/* ─── Supplier Dialog ──────────────────────────────────────────────── */}
        <Dialog
          open={isSupplierDialogOpen}
          onOpenChange={setIsSupplierDialogOpen}
        >
          <DialogContent className="sm:max-w-lg bg-card border-border/30">
            <DialogHeader>
              <DialogTitle>
                {editingSupplierId ? "Editar Fornecedor" : "Novo Fornecedor"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input
                  value={supplierForm.name}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, name: e.target.value })
                  }
                  placeholder="Ex: Graftech Techsound"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={supplierForm.cnpj}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, cnpj: e.target.value })
                    }
                    placeholder="00.000.000/0001-00"
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={supplierForm.status}
                    onValueChange={(v) =>
                      setSupplierForm({
                        ...supplierForm,
                        status: v as "active" | "inactive",
                      })
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Contato</Label>
                  <Input
                    value={supplierForm.contactName}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        contactName: e.target.value,
                      })
                    }
                    placeholder="Nome do contato"
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input
                    value={supplierForm.contactPhone}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        contactPhone: e.target.value,
                      })
                    }
                    placeholder="(92) 99999-9999"
                    className="bg-background border-border/30"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  value={supplierForm.contactEmail}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      contactEmail: e.target.value,
                    })
                  }
                  placeholder="contato@fornecedor.com.br"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Endereço</Label>
                <Input
                  value={supplierForm.address}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      address: e.target.value,
                    })
                  }
                  placeholder="Rua, número"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Cidade</Label>
                  <Input
                    value={supplierForm.city}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        city: e.target.value,
                      })
                    }
                    placeholder="Manaus"
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>UF</Label>
                  <Select
                    value={supplierForm.state || "none"}
                    onValueChange={(v) =>
                      setSupplierForm({
                        ...supplierForm,
                        state: v === "none" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border/30">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione</SelectItem>
                      {STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsSupplierDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitSupplier}
                disabled={
                  createSupplierMut.isPending || updateSupplierMut.isPending
                }
              >
                {editingSupplierId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Budget Dialog ────────────────────────────────────────────────── */}
        <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBudgetId ? "Editar Orçamento" : "Novo Orçamento"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fornecedor *</Label>
                  <Select
                    value={
                      budgetForm.supplierId
                        ? String(budgetForm.supplierId)
                        : "none"
                    }
                    onValueChange={(v) =>
                      setBudgetForm({
                        ...budgetForm,
                        supplierId: v === "none" ? null : parseInt(v),
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border/30">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione um fornecedor</SelectItem>
                      {suppliersList
                        .filter((s) => s.status === "active")
                        .map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Código do Orçamento</Label>
                  <Input
                    value={budgetForm.code}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, code: e.target.value })
                    }
                    placeholder="Ex: 038075"
                    className="bg-background border-border/30"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Descrição do Produto *</Label>
                <Input
                  value={budgetForm.description}
                  onChange={(e) =>
                    setBudgetForm({
                      ...budgetForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Ex: Bolacha Para Copo (TAM. 8,5X8,5CM)"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Especificações Técnicas</Label>
                <Input
                  value={budgetForm.productSpec}
                  onChange={(e) =>
                    setBudgetForm({
                      ...budgetForm,
                      productSpec: e.target.value,
                    })
                  }
                  placeholder="Ex: 4x0 cores, Reciclado 240g, Laminação Fosca..."
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={budgetForm.validUntil}
                    onChange={(e) =>
                      setBudgetForm({
                        ...budgetForm,
                        validUntil: e.target.value,
                      })
                    }
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={budgetForm.status}
                    onValueChange={(v) =>
                      setBudgetForm({
                        ...budgetForm,
                        status: v as BudgetForm["status"],
                      })
                    }
                  >
                    <SelectTrigger className="bg-background border-border/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="expired">Expirado</SelectItem>
                      <SelectItem value="rejected">Rejeitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Price Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-primary font-semibold">
                    Tabela de Preços por Quantidade
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPriceItem}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar Faixa
                  </Button>
                </div>
                <div className="border border-border/20 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/20 hover:bg-transparent">
                        <TableHead className="text-xs font-medium">
                          QUANTIDADE
                        </TableHead>
                        <TableHead className="text-xs font-medium text-right">
                          PREÇO UNIT. (R$)
                        </TableHead>
                        <TableHead className="text-xs font-medium text-right">
                          TOTAL (R$)
                        </TableHead>
                        <TableHead className="text-xs font-medium w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetForm.items.map((item, idx) => (
                        <TableRow
                          key={idx}
                          className="border-border/20"
                        >
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updatePriceItem(
                                  idx,
                                  "quantity",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-28 h-8 text-sm bg-background border-border/30 font-mono"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.001"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updatePriceItem(idx, "unitPrice", e.target.value)
                              }
                              className="w-28 h-8 text-sm bg-background border-border/30 font-mono ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.totalPrice}
                              onChange={(e) =>
                                updatePriceItem(idx, "totalPrice", e.target.value)
                              }
                              className="w-32 h-8 text-sm bg-background border-border/30 font-mono ml-auto"
                            />
                          </TableCell>
                          <TableCell>
                            {budgetForm.items.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removePriceItem(idx)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Observações</Label>
                <Input
                  value={budgetForm.notes}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, notes: e.target.value })
                  }
                  placeholder="Notas adicionais..."
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBudgetDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitBudget}
                disabled={
                  createBudgetMut.isPending || updateBudgetMut.isPending
                }
              >
                {editingBudgetId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── View Budget Items Dialog ─────────────────────────────────────── */}
        <Dialog
          open={viewBudgetId !== null}
          onOpenChange={() => setViewBudgetId(null)}
        >
          <DialogContent className="sm:max-w-xl bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Tabela de Preços
              </DialogTitle>
            </DialogHeader>
            {viewBudget && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="font-medium text-sm">{viewBudget.description}</p>
                  {viewBudget.productSpec && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {viewBudget.productSpec}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>
                      Fornecedor: <strong>{viewBudget.supplierName}</strong>
                    </span>
                    {viewBudget.code && (
                      <span>
                        Código: <strong>{viewBudget.code}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <div className="border border-border/20 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/20 hover:bg-transparent">
                        <TableHead className="text-xs font-medium">
                          QUANTIDADE
                        </TableHead>
                        <TableHead className="text-xs font-medium text-right">
                          PREÇO UNITÁRIO
                        </TableHead>
                        <TableHead className="text-xs font-medium text-right">
                          VALOR TOTAL
                        </TableHead>
                        <TableHead className="text-xs font-medium text-right">
                          CUSTO/1000
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center py-4 text-muted-foreground"
                          >
                            Nenhum item de preço cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        viewItems.map((item) => (
                          <TableRow
                            key={item.id}
                            className="border-border/20"
                          >
                            <TableCell className="font-mono font-medium">
                              {item.quantity.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-primary">
                              R$ {parseFloat(String(item.unitPrice)).toFixed(3)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              R${" "}
                              {parseFloat(String(item.totalPrice)).toLocaleString(
                                "pt-BR",
                                { minimumFractionDigits: 2 }
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              R${" "}
                              {(
                                (parseFloat(String(item.unitPrice)) * 1000)
                              ).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewBudgetId(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Delete Supplier Confirmation ──────────────────────────────────── */}
        <AlertDialog
          open={deleteSupplierTarget !== null}
          onOpenChange={() => setDeleteSupplierTarget(null)}
        >
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O fornecedor e todos os seus
                orçamentos serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() =>
                  deleteSupplierTarget &&
                  deleteSupplierMut.mutate({ id: deleteSupplierTarget })
                }
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ─── Delete Budget Confirmation ────────────────────────────────────── */}
        <AlertDialog
          open={deleteBudgetTarget !== null}
          onOpenChange={() => setDeleteBudgetTarget(null)}
        >
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover orçamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O orçamento e todos os seus
                itens de preço serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() =>
                  deleteBudgetTarget &&
                  deleteBudgetMut.mutate({ id: deleteBudgetTarget })
                }
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
