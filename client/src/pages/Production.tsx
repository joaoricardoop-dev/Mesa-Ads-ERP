import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { generatePriceTablePDF } from "@/lib/generate-price-table-pdf";

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
  Layers,
  Palette,
  Ruler,
  Printer,
  CreditCard,
  Clock,
  Copy,
  Download,
} from "lucide-react";

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
  numModels: number;
  qtyPerModel: number;
};

type BudgetForm = {
  supplierId: number | null;
  code: string;
  description: string;
  productSpec: string;
  material: string;
  format: string;
  productSize: string;
  printType: string;
  colors: string;
  layoutType: string;
  paymentTerms: string;
  productionLeadDays: string;
  validUntil: string;
  status: "active" | "expired" | "rejected";
  notes: string;
  singleModelItems: PriceItem[];
  multiModelItems: PriceItem[];
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
  material: "Papelão Liner Extra Absorvente 850g, 1.6mm",
  format: "Redondo",
  productSize: "90mm diâmetro",
  printType: "Off-Set (frente e verso)",
  colors: "4x4",
  layoutType: "unico",
  paymentTerms: "15 dias",
  productionLeadDays: "12 a 15 dias úteis",
  validUntil: "",
  status: "active",
  notes: "",
  singleModelItems: [{ quantity: 1000, unitPrice: "0.0000", totalPrice: "0.00", numModels: 1, qtyPerModel: 1000 }],
  multiModelItems: [],
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

const GPC_PRESETS = {
  singleModel: [
    { quantity: 1000, unitPrice: "0.4190", totalPrice: "419.00", numModels: 1, qtyPerModel: 1000 },
    { quantity: 2000, unitPrice: "0.3495", totalPrice: "699.00", numModels: 1, qtyPerModel: 2000 },
    { quantity: 3000, unitPrice: "0.3330", totalPrice: "999.00", numModels: 1, qtyPerModel: 3000 },
    { quantity: 4000, unitPrice: "0.3248", totalPrice: "1299.00", numModels: 1, qtyPerModel: 4000 },
    { quantity: 5000, unitPrice: "0.2998", totalPrice: "1499.00", numModels: 1, qtyPerModel: 5000 },
    { quantity: 10000, unitPrice: "0.2700", totalPrice: "2700.00", numModels: 1, qtyPerModel: 10000 },
    { quantity: 20000, unitPrice: "0.2600", totalPrice: "5200.00", numModels: 1, qtyPerModel: 20000 },
  ],
  multiModel: [
    { quantity: 10000, unitPrice: "0.4190", totalPrice: "4190.00", numModels: 10, qtyPerModel: 1000 },
    { quantity: 10000, unitPrice: "0.3495", totalPrice: "3495.00", numModels: 5, qtyPerModel: 2000 },
    { quantity: 10000, unitPrice: "0.2998", totalPrice: "2998.00", numModels: 2, qtyPerModel: 5000 },
    { quantity: 20000, unitPrice: "0.4100", totalPrice: "8200.00", numModels: 20, qtyPerModel: 1000 },
    { quantity: 20000, unitPrice: "0.3400", totalPrice: "6800.00", numModels: 10, qtyPerModel: 2000 },
    { quantity: 20000, unitPrice: "0.2900", totalPrice: "5800.00", numModels: 4, qtyPerModel: 5000 },
  ],
};

export default function Production() {
  const [activeTab, setActiveTab] = useState("budgets");
  const [search, setSearch] = useState("");

  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(EMPTY_SUPPLIER);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<number | null>(null);

  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState<BudgetForm>(EMPTY_BUDGET);
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [deleteBudgetTarget, setDeleteBudgetTarget] = useState<number | null>(null);
  const [viewBudgetId, setViewBudgetId] = useState<number | null>(null);
  const [budgetPriceTab, setBudgetPriceTab] = useState("single");

  const { data: suppliersList = [], isLoading: suppliersLoading } =
    trpc.supplier.list.useQuery();
  const { data: budgetsList = [], isLoading: budgetsLoading } =
    trpc.budget.list.useQuery();
  const { data: viewItems = [] } = trpc.budget.getItems.useQuery(
    { budgetId: viewBudgetId! },
    { enabled: viewBudgetId !== null }
  );

  const utils = trpc.useUtils();

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

  const handleNewBudget = () => {
    setBudgetForm(EMPTY_BUDGET);
    setEditingBudgetId(null);
    setBudgetPriceTab("single");
    setIsBudgetDialogOpen(true);
  };

  const handleEditBudget = async (b: (typeof budgetsList)[0]) => {
    const items = await utils.budget.getItems.fetch({ budgetId: b.id });
    const singleItems = items.filter((i: any) => !i.numModels || i.numModels === 1);
    const multiItems = items.filter((i: any) => i.numModels && i.numModels > 1);

    setBudgetForm({
      supplierId: b.supplierId,
      code: b.code || "",
      description: b.description,
      productSpec: b.productSpec || "",
      material: b.material || "",
      format: b.format || "",
      productSize: b.productSize || "",
      printType: b.printType || "",
      colors: b.colors || "",
      layoutType: b.layoutType || "unico",
      paymentTerms: b.paymentTerms || "",
      productionLeadDays: b.productionLeadDays || "",
      validUntil: b.validUntil
        ? new Date(b.validUntil).toISOString().split("T")[0]
        : "",
      status: b.status,
      notes: b.notes || "",
      singleModelItems: singleItems.length > 0
        ? singleItems.map((i: any) => ({
            quantity: i.quantity,
            unitPrice: String(i.unitPrice),
            totalPrice: String(i.totalPrice),
            numModels: 1,
            qtyPerModel: i.quantity,
          }))
        : [{ quantity: 1000, unitPrice: "0.0000", totalPrice: "0.00", numModels: 1, qtyPerModel: 1000 }],
      multiModelItems: multiItems.map((i: any) => ({
        quantity: i.quantity,
        unitPrice: String(i.unitPrice),
        totalPrice: String(i.totalPrice),
        numModels: i.numModels || 1,
        qtyPerModel: i.qtyPerModel || i.quantity,
      })),
    });
    setEditingBudgetId(b.id);
    setBudgetPriceTab("single");
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

    const allItems = [
      ...budgetForm.singleModelItems.filter((i) => i.quantity > 0 && parseFloat(i.unitPrice) > 0),
      ...budgetForm.multiModelItems.filter((i) => i.quantity > 0 && parseFloat(i.unitPrice) > 0),
    ];

    if (allItems.length === 0) {
      toast.error("Adicione pelo menos um item de preço válido");
      return;
    }

    const payload = {
      supplierId: budgetForm.supplierId,
      code: budgetForm.code || undefined,
      description: budgetForm.description,
      productSpec: budgetForm.productSpec || undefined,
      material: budgetForm.material || undefined,
      format: budgetForm.format || undefined,
      productSize: budgetForm.productSize || undefined,
      printType: budgetForm.printType || undefined,
      colors: budgetForm.colors || undefined,
      layoutType: budgetForm.layoutType || undefined,
      paymentTerms: budgetForm.paymentTerms || undefined,
      productionLeadDays: budgetForm.productionLeadDays || undefined,
      validUntil: budgetForm.validUntil || undefined,
      status: budgetForm.status,
      notes: budgetForm.notes || undefined,
      items: allItems,
    };

    if (editingBudgetId) {
      updateBudgetMut.mutate({ id: editingBudgetId, ...payload });
    } else {
      createBudgetMut.mutate(payload);
    }
  };

  const loadGpcPresets = () => {
    setBudgetForm({
      ...budgetForm,
      description: "Bolachas de Chopp Personalizadas",
      material: "Papelão Liner Extra Absorvente 850g, 1.6mm - Super Resistentes",
      format: "Redondo ou Quadrado com cantos arredondados",
      productSize: "90mm diâmetro | 9x9cm",
      printType: "Off-Set (frente e verso)",
      colors: "4x4 (frente e verso)",
      layoutType: "ambos",
      paymentTerms: "Faturamento: 15 dias",
      productionLeadDays: "12 a 15 dias úteis",
      singleModelItems: GPC_PRESETS.singleModel,
      multiModelItems: GPC_PRESETS.multiModel,
    });
    toast.success("Tabela GPC carregada!");
  };

  const addPriceItem = (type: "single" | "multi") => {
    const key = type === "single" ? "singleModelItems" : "multiModelItems";
    const items = budgetForm[key];
    const lastItem = items[items.length - 1];

    const newItem: PriceItem = type === "single"
      ? {
          quantity: lastItem ? lastItem.quantity + 1000 : 1000,
          unitPrice: "0.0000",
          totalPrice: "0.00",
          numModels: 1,
          qtyPerModel: lastItem ? lastItem.quantity + 1000 : 1000,
        }
      : {
          quantity: 10000,
          unitPrice: "0.0000",
          totalPrice: "0.00",
          numModels: 10,
          qtyPerModel: 1000,
        };

    setBudgetForm({
      ...budgetForm,
      [key]: [...items, newItem],
    });
  };

  const removePriceItem = (type: "single" | "multi", index: number) => {
    const key = type === "single" ? "singleModelItems" : "multiModelItems";
    const items = budgetForm[key];
    if (type === "single" && items.length <= 1) return;
    setBudgetForm({
      ...budgetForm,
      [key]: items.filter((_, i) => i !== index),
    });
  };

  const updatePriceItem = (
    type: "single" | "multi",
    index: number,
    field: keyof PriceItem,
    value: string | number
  ) => {
    const key = type === "single" ? "singleModelItems" : "multiModelItems";
    const newItems = [...budgetForm[key]];
    const item = { ...newItems[index] };

    if (field === "quantity") {
      item.quantity = typeof value === "number" ? value : parseInt(String(value)) || 0;
      if (type === "single") {
        item.qtyPerModel = item.quantity;
      } else if (item.numModels > 0) {
        item.qtyPerModel = Math.floor(item.quantity / item.numModels);
      }
      const unitP = parseFloat(item.unitPrice) || 0;
      item.totalPrice = (item.quantity * unitP).toFixed(2);
    } else if (field === "unitPrice") {
      item.unitPrice = String(value);
      const unitP = parseFloat(String(value)) || 0;
      item.totalPrice = (item.quantity * unitP).toFixed(2);
    } else if (field === "totalPrice") {
      item.totalPrice = String(value);
      if (item.quantity > 0) {
        const totalP = parseFloat(String(value)) || 0;
        item.unitPrice = (totalP / item.quantity).toFixed(4);
      }
    } else if (field === "numModels") {
      item.numModels = typeof value === "number" ? value : parseInt(value) || 1;
      if (item.numModels > 0 && item.quantity > 0) {
        item.qtyPerModel = Math.floor(item.quantity / item.numModels);
      }
    } else if (field === "qtyPerModel") {
      item.qtyPerModel = typeof value === "number" ? value : parseInt(value) || 0;
      if (item.qtyPerModel > 0) {
        item.numModels = Math.floor(item.quantity / item.qtyPerModel);
      }
    }

    newItems[index] = item;
    setBudgetForm({ ...budgetForm, [key]: newItems });
  };

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

  const viewBudget = budgetsList.find((b) => b.id === viewBudgetId);
  const viewSingleItems = viewItems.filter((i: any) => !i.numModels || i.numModels === 1);
  const viewMultiItems = viewItems.filter((i: any) => i.numModels && i.numModels > 1);
  const [viewPriceTab, setViewPriceTab] = useState("single");

  return (
    <PageContainer
      title="Produção"
      description="Gestão de fornecedores e orçamentos de produção"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { generatePriceTablePDF(0.06); toast.success("PDF gerado!"); }}
          >
            <Download className="w-3.5 h-3.5" />
            Tabela de Preços
          </Button>
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
      }
    >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">FORNECEDORES</span>
              <Building2 className="w-4 h-4 text-primary/60" />
            </div>
            <p className="text-2xl font-bold font-mono">
              {suppliersList.filter((s) => s.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">ativos</p>
          </div>
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">ORÇAMENTOS</span>
              <FileText className="w-4 h-4 text-primary/60" />
            </div>
            <p className="text-2xl font-bold font-mono">
              {budgetsList.filter((b) => b.status === "active").length}
            </p>
            <p className="text-xs text-muted-foreground">vigentes</p>
          </div>
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">MENOR CUSTO/UN</span>
              <TrendingDown className="w-4 h-4 text-emerald-400/60" />
            </div>
            <p className="text-2xl font-bold font-mono text-primary">—</p>
            <p className="text-xs text-muted-foreground">melhor preço disponível</p>
          </div>
          <div className="bg-card border border-border/20 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">TOTAL ORÇAMENTOS</span>
              <Package className="w-4 h-4 text-primary/60" />
            </div>
            <p className="text-2xl font-bold font-mono">{budgetsList.length}</p>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </div>
        </div>

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

          <TabsContent value="budgets" className="mt-0">
            <div className="bg-card border border-border/20 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground font-medium">CÓDIGO</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">DESCRIÇÃO</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">FORNECEDOR</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">MATERIAL</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-center hidden lg:table-cell">VALIDADE</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-center">STATUS</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredBudgets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {search
                          ? "Nenhum orçamento encontrado"
                          : 'Nenhum orçamento cadastrado. Clique em "Novo Orçamento" para começar.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBudgets.map((b) => (
                      <TableRow key={b.id} className="border-border/20 hover:bg-card/80">
                        <TableCell className="font-mono text-sm text-primary">
                          {b.code || "—"}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{b.description}</p>
                          {b.format && (
                            <p className="text-xs text-muted-foreground/60">
                              {b.format} {b.colors ? `• ${b.colors}` : ""}
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
                        <TableCell className="hidden lg:table-cell text-muted-foreground text-xs max-w-[200px] truncate">
                          {b.material || "—"}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell text-sm text-muted-foreground">
                          {b.validUntil
                            ? new Date(b.validUntil).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={STATUS_COLORS[b.status] || ""}>
                            {STATUS_LABELS[b.status] || b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewBudgetId(b.id); setViewPriceTab("single"); }} title="Ver preços">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditBudget(b)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteBudgetTarget(b.id)}>
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

          <TabsContent value="suppliers" className="mt-0">
            <div className="bg-card border border-border/20 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground font-medium">FORNECEDOR</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">CNPJ</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden lg:table-cell">CONTATO</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium hidden md:table-cell">CIDADE/UF</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-center">STATUS</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {search ? "Nenhum fornecedor encontrado" : 'Nenhum fornecedor cadastrado. Clique em "Novo Fornecedor" para começar.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <TableRow key={s.id} className="border-border/20 hover:bg-card/80">
                        <TableCell><p className="font-medium">{s.name}</p></TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm font-mono">{s.cnpj || "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <p className="text-muted-foreground">{s.contactName || "—"}</p>
                          {s.contactPhone && <p className="text-xs text-muted-foreground/60">{s.contactPhone}</p>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {s.city && s.state ? `${s.city}/${s.state}` : s.city || s.state || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={STATUS_COLORS[s.status] || ""}>{STATUS_LABELS[s.status] || s.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSupplier(s)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteSupplierTarget(s.id)}>
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

        {/* Supplier Dialog */}
        <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
          <DialogContent className="sm:max-w-lg bg-card border-border/30">
            <DialogHeader>
              <DialogTitle>{editingSupplierId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="Ex: Porta Copos Personalizados" className="bg-background border-border/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>CNPJ</Label>
                  <Input value={supplierForm.cnpj} onChange={(e) => setSupplierForm({ ...supplierForm, cnpj: e.target.value })} placeholder="00.000.000/0001-00" className="bg-background border-border/30" />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={supplierForm.status} onValueChange={(v) => setSupplierForm({ ...supplierForm, status: v as "active" | "inactive" })}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
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
                  <Input value={supplierForm.contactName} onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })} placeholder="Nome do contato" className="bg-background border-border/30" />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone</Label>
                  <Input value={supplierForm.contactPhone} onChange={(e) => setSupplierForm({ ...supplierForm, contactPhone: e.target.value })} placeholder="(11) 99999-0000" className="bg-background border-border/30" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input value={supplierForm.contactEmail} onChange={(e) => setSupplierForm({ ...supplierForm, contactEmail: e.target.value })} placeholder="contato@fornecedor.com.br" className="bg-background border-border/30" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2 col-span-1">
                  <Label>Endereço</Label>
                  <Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} placeholder="Rua..." className="bg-background border-border/30" />
                </div>
                <div className="grid gap-2">
                  <Label>Cidade</Label>
                  <Input value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} placeholder="São Paulo" className="bg-background border-border/30" />
                </div>
                <div className="grid gap-2">
                  <Label>UF</Label>
                  <Select value={supplierForm.state || "none"} onValueChange={(v) => setSupplierForm({ ...supplierForm, state: v === "none" ? "" : v })}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSupplierDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmitSupplier} disabled={createSupplierMut.isPending || updateSupplierMut.isPending}>
                {editingSupplierId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Budget Dialog */}
        <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
          <DialogContent className="sm:max-w-4xl bg-card border-border/30 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {editingBudgetId ? "Editar Orçamento" : "Novo Orçamento de Produção"}
                </DialogTitle>
                {!editingBudgetId && (
                  <Button variant="outline" size="sm" onClick={loadGpcPresets} className="gap-1.5 text-xs">
                    <Copy className="w-3 h-3" />
                    Carregar Tabela GPC
                  </Button>
                )}
              </div>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fornecedor *</Label>
                  <Select
                    value={budgetForm.supplierId ? String(budgetForm.supplierId) : ""}
                    onValueChange={(v) => setBudgetForm({ ...budgetForm, supplierId: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {suppliersList.filter((s) => s.status === "active").map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Código / Proposta</Label>
                  <Input value={budgetForm.code} onChange={(e) => setBudgetForm({ ...budgetForm, code: e.target.value })} placeholder="Ex: 279/2026" className="bg-background border-border/30" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Descrição *</Label>
                <Input value={budgetForm.description} onChange={(e) => setBudgetForm({ ...budgetForm, description: e.target.value })} placeholder="Ex: Bolachas de Chopp Personalizadas" className="bg-background border-border/30" />
              </div>

              <div className="border border-primary/20 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Factory className="w-4 h-4" />
                  Especificação Técnica
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Layers className="w-3 h-3 text-muted-foreground" />
                      Material
                    </Label>
                    <Input value={budgetForm.material} onChange={(e) => setBudgetForm({ ...budgetForm, material: e.target.value })} placeholder="Papelão Liner Extra Absorvente 850g, 1.6mm" className="bg-background border-border/30 text-sm" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Ruler className="w-3 h-3 text-muted-foreground" />
                      Formato
                    </Label>
                    <Select value={budgetForm.format || "custom"} onValueChange={(v) => setBudgetForm({ ...budgetForm, format: v === "custom" ? "" : v })}>
                      <SelectTrigger className="bg-background border-border/30 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Redondo">Redondo</SelectItem>
                        <SelectItem value="Quadrado com cantos arredondados">Quadrado com cantos arredondados</SelectItem>
                        <SelectItem value="Redondo ou Quadrado com cantos arredondados">Redondo ou Quadrado</SelectItem>
                        <SelectItem value="custom">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Ruler className="w-3 h-3 text-muted-foreground" />
                      Tamanho
                    </Label>
                    <Input value={budgetForm.productSize} onChange={(e) => setBudgetForm({ ...budgetForm, productSize: e.target.value })} placeholder="90mm diâmetro | 9x9cm" className="bg-background border-border/30 text-sm" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Printer className="w-3 h-3 text-muted-foreground" />
                      Impressão
                    </Label>
                    <Select value={budgetForm.printType || "custom"} onValueChange={(v) => setBudgetForm({ ...budgetForm, printType: v === "custom" ? "" : v })}>
                      <SelectTrigger className="bg-background border-border/30 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Off-Set (frente e verso)">Off-Set (frente e verso)</SelectItem>
                        <SelectItem value="Off-Set (frente)">Off-Set (frente)</SelectItem>
                        <SelectItem value="Digital (frente e verso)">Digital (frente e verso)</SelectItem>
                        <SelectItem value="Digital (frente)">Digital (frente)</SelectItem>
                        <SelectItem value="custom">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Palette className="w-3 h-3 text-muted-foreground" />
                      Cores
                    </Label>
                    <Select value={budgetForm.colors || "custom"} onValueChange={(v) => setBudgetForm({ ...budgetForm, colors: v === "custom" ? "" : v })}>
                      <SelectTrigger className="bg-background border-border/30 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4x4 (frente e verso)">4x4 (frente e verso)</SelectItem>
                        <SelectItem value="4x1">4x1</SelectItem>
                        <SelectItem value="4x0">4x0</SelectItem>
                        <SelectItem value="1x1">1x1</SelectItem>
                        <SelectItem value="custom">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs">Layout</Label>
                    <Select value={budgetForm.layoutType} onValueChange={(v) => setBudgetForm({ ...budgetForm, layoutType: v })}>
                      <SelectTrigger className="bg-background border-border/30 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unico">1 face fixa + 1 personalizada</SelectItem>
                        <SelectItem value="ambas">2 faces personalizadas</SelectItem>
                        <SelectItem value="fixa">2 faces fixas</SelectItem>
                        <SelectItem value="ambos">Modelo único + Múltiplos modelos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Especificação adicional</Label>
                    <Input value={budgetForm.productSpec} onChange={(e) => setBudgetForm({ ...budgetForm, productSpec: e.target.value })} placeholder="Duram até 5X mais, etc." className="bg-background border-border/30 text-sm" />
                  </div>
                </div>
              </div>

              <div className="border border-border/20 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Condições Comerciais
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <CreditCard className="w-3 h-3 text-muted-foreground" />
                      Pagamento
                    </Label>
                    <Input value={budgetForm.paymentTerms} onChange={(e) => setBudgetForm({ ...budgetForm, paymentTerms: e.target.value })} placeholder="Faturamento: 15 dias" className="bg-background border-border/30 text-sm" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      Prazo de Produção
                    </Label>
                    <Input value={budgetForm.productionLeadDays} onChange={(e) => setBudgetForm({ ...budgetForm, productionLeadDays: e.target.value })} placeholder="12 a 15 dias úteis" className="bg-background border-border/30 text-sm" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Validade da Proposta</Label>
                    <Input type="date" value={budgetForm.validUntil} onChange={(e) => setBudgetForm({ ...budgetForm, validUntil: e.target.value })} className="bg-background border-border/30 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs">Status</Label>
                    <Select value={budgetForm.status} onValueChange={(v) => setBudgetForm({ ...budgetForm, status: v as BudgetForm["status"] })}>
                      <SelectTrigger className="bg-background border-border/30 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="expired">Expirado</SelectItem>
                        <SelectItem value="rejected">Rejeitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Observações</Label>
                    <Input value={budgetForm.notes} onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })} placeholder="Notas adicionais..." className="bg-background border-border/30 text-sm" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Tabs value={budgetPriceTab} onValueChange={setBudgetPriceTab}>
                  <div className="flex items-center justify-between">
                    <TabsList className="bg-background border border-border/20">
                      <TabsTrigger value="single" className="gap-1.5 text-xs">
                        Modelo Único
                      </TabsTrigger>
                      <TabsTrigger value="multi" className="gap-1.5 text-xs">
                        Múltiplos Modelos
                      </TabsTrigger>
                    </TabsList>
                    <Button type="button" variant="outline" size="sm" onClick={() => addPriceItem(budgetPriceTab as "single" | "multi")} className="gap-1 text-xs">
                      <Plus className="w-3 h-3" />
                      Adicionar Faixa
                    </Button>
                  </div>

                  <TabsContent value="single" className="mt-3">
                    <div className="border border-border/20 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/20 hover:bg-transparent">
                            <TableHead className="text-xs font-medium">QUANTIDADE</TableHead>
                            <TableHead className="text-xs font-medium text-right">PREÇO UNIT. (R$)</TableHead>
                            <TableHead className="text-xs font-medium text-right">TOTAL (R$)</TableHead>
                            <TableHead className="text-xs font-medium text-right">CUSTO/1000</TableHead>
                            <TableHead className="text-xs font-medium w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {budgetForm.singleModelItems.map((item, idx) => (
                            <TableRow key={idx} className="border-border/20">
                              <TableCell>
                                <Input type="number" value={item.quantity} onChange={(e) => updatePriceItem("single", idx, "quantity", parseInt(e.target.value) || 0)} className="w-24 h-8 text-sm bg-background border-border/30 font-mono" />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input type="number" step="0.0001" value={item.unitPrice} onChange={(e) => updatePriceItem("single", idx, "unitPrice", e.target.value)} className="w-28 h-8 text-sm bg-background border-border/30 font-mono ml-auto" />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input type="number" step="0.01" value={item.totalPrice} onChange={(e) => updatePriceItem("single", idx, "totalPrice", e.target.value)} className="w-32 h-8 text-sm bg-background border-border/30 font-mono ml-auto" />
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                R$ {((parseFloat(item.unitPrice) || 0) * 1000).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                {budgetForm.singleModelItems.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removePriceItem("single", idx)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="multi" className="mt-3">
                    <p className="text-xs text-muted-foreground mb-3">
                      Para pedidos com múltiplos modelos (artes diferentes). O preço unitário depende da quantidade por modelo.
                    </p>
                    <div className="border border-border/20 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/20 hover:bg-transparent">
                            <TableHead className="text-xs font-medium">QTD TOTAL</TableHead>
                            <TableHead className="text-xs font-medium text-center">Nº MODELOS</TableHead>
                            <TableHead className="text-xs font-medium text-center">QTD/MODELO</TableHead>
                            <TableHead className="text-xs font-medium text-right">PREÇO UNIT.</TableHead>
                            <TableHead className="text-xs font-medium text-right">TOTAL (R$)</TableHead>
                            <TableHead className="text-xs font-medium w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {budgetForm.multiModelItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-4 text-muted-foreground text-sm">
                                Nenhuma faixa de múltiplos modelos. Clique em "Adicionar Faixa".
                              </TableCell>
                            </TableRow>
                          ) : (
                            budgetForm.multiModelItems.map((item, idx) => (
                              <TableRow key={idx} className="border-border/20">
                                <TableCell>
                                  <Input type="number" value={item.quantity} onChange={(e) => updatePriceItem("multi", idx, "quantity", parseInt(e.target.value) || 0)} className="w-24 h-8 text-sm bg-background border-border/30 font-mono" />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Input type="number" value={item.numModels} onChange={(e) => updatePriceItem("multi", idx, "numModels", parseInt(e.target.value) || 1)} className="w-20 h-8 text-sm bg-background border-border/30 font-mono mx-auto" />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Input type="number" value={item.qtyPerModel} onChange={(e) => updatePriceItem("multi", idx, "qtyPerModel", parseInt(e.target.value) || 0)} className="w-24 h-8 text-sm bg-background border-border/30 font-mono mx-auto" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" step="0.0001" value={item.unitPrice} onChange={(e) => updatePriceItem("multi", idx, "unitPrice", e.target.value)} className="w-28 h-8 text-sm bg-background border-border/30 font-mono ml-auto" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" step="0.01" value={item.totalPrice} onChange={(e) => updatePriceItem("multi", idx, "totalPrice", e.target.value)} className="w-32 h-8 text-sm bg-background border-border/30 font-mono ml-auto" />
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removePriceItem("multi", idx)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBudgetDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmitBudget} disabled={createBudgetMut.isPending || updateBudgetMut.isPending}>
                {editingBudgetId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Budget Items Dialog */}
        <Dialog open={viewBudgetId !== null} onOpenChange={() => setViewBudgetId(null)}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Detalhes do Orçamento
              </DialogTitle>
            </DialogHeader>
            {viewBudget && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="font-medium text-sm">{viewBudget.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Fornecedor: <strong>{viewBudget.supplierName}</strong></span>
                    {viewBudget.code && <span>Proposta: <strong>{viewBudget.code}</strong></span>}
                  </div>
                </div>

                {(viewBudget.material || viewBudget.format || viewBudget.printType) && (
                  <div className="bg-background/50 border border-border/20 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wider">Especificação Técnica</h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      {viewBudget.material && (
                        <div className="flex gap-2"><span className="text-muted-foreground">Material:</span><span>{viewBudget.material}</span></div>
                      )}
                      {viewBudget.format && (
                        <div className="flex gap-2"><span className="text-muted-foreground">Formato:</span><span>{viewBudget.format}</span></div>
                      )}
                      {viewBudget.productSize && (
                        <div className="flex gap-2"><span className="text-muted-foreground">Tamanho:</span><span>{viewBudget.productSize}</span></div>
                      )}
                      {viewBudget.printType && (
                        <div className="flex gap-2"><span className="text-muted-foreground">Impressão:</span><span>{viewBudget.printType}</span></div>
                      )}
                      {viewBudget.colors && (
                        <div className="flex gap-2"><span className="text-muted-foreground">Cores:</span><span>{viewBudget.colors}</span></div>
                      )}
                      {viewBudget.layoutType && (
                        <div className="flex gap-2"><span className="text-muted-foreground">Layout:</span><span>{viewBudget.layoutType}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {(viewBudget.paymentTerms || viewBudget.productionLeadDays) && (
                  <div className="flex gap-4 text-sm">
                    {viewBudget.paymentTerms && (
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Pagamento:</span>
                        <span>{viewBudget.paymentTerms}</span>
                      </div>
                    )}
                    {viewBudget.productionLeadDays && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Prazo:</span>
                        <span>{viewBudget.productionLeadDays}</span>
                      </div>
                    )}
                  </div>
                )}

                <Tabs value={viewPriceTab} onValueChange={setViewPriceTab}>
                  <TabsList className="bg-background border border-border/20">
                    <TabsTrigger value="single" className="text-xs gap-1.5">
                      Modelo Único
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{viewSingleItems.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="multi" className="text-xs gap-1.5">
                      Múltiplos Modelos
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{viewMultiItems.length}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="mt-3">
                    <div className="border border-border/20 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/20 hover:bg-transparent">
                            <TableHead className="text-xs font-medium">QUANTIDADE</TableHead>
                            <TableHead className="text-xs font-medium text-right">PREÇO UNITÁRIO</TableHead>
                            <TableHead className="text-xs font-medium text-right">VALOR TOTAL</TableHead>
                            <TableHead className="text-xs font-medium text-right">CUSTO/1000</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewSingleItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Nenhum item</TableCell>
                            </TableRow>
                          ) : (
                            viewSingleItems.map((item: any) => (
                              <TableRow key={item.id} className="border-border/20">
                                <TableCell className="font-mono font-medium">{item.quantity.toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="text-right font-mono text-primary">R$ {parseFloat(String(item.unitPrice)).toFixed(4)}</TableCell>
                                <TableCell className="text-right font-mono">R$ {parseFloat(String(item.totalPrice)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">R$ {(parseFloat(String(item.unitPrice)) * 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="multi" className="mt-3">
                    <div className="border border-border/20 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/20 hover:bg-transparent">
                            <TableHead className="text-xs font-medium">QTD TOTAL</TableHead>
                            <TableHead className="text-xs font-medium text-center">Nº MODELOS</TableHead>
                            <TableHead className="text-xs font-medium text-center">QTD/MODELO</TableHead>
                            <TableHead className="text-xs font-medium text-right">PREÇO UNIT.</TableHead>
                            <TableHead className="text-xs font-medium text-right">VALOR TOTAL</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewMultiItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum item</TableCell>
                            </TableRow>
                          ) : (
                            viewMultiItems.map((item: any) => (
                              <TableRow key={item.id} className="border-border/20">
                                <TableCell className="font-mono font-medium">{item.quantity.toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="text-center font-mono">{item.numModels}</TableCell>
                                <TableCell className="text-center font-mono">{(item.qtyPerModel || 0).toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="text-right font-mono text-primary">R$ {parseFloat(String(item.unitPrice)).toFixed(4)}</TableCell>
                                <TableCell className="text-right font-mono">R$ {parseFloat(String(item.totalPrice)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewBudgetId(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Supplier Confirmation */}
        <AlertDialog open={deleteSupplierTarget !== null} onOpenChange={() => setDeleteSupplierTarget(null)}>
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O fornecedor e todos os seus orçamentos serão removidos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteSupplierTarget && deleteSupplierMut.mutate({ id: deleteSupplierTarget })}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Budget Confirmation */}
        <AlertDialog open={deleteBudgetTarget !== null} onOpenChange={() => setDeleteBudgetTarget(null)}>
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover orçamento?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. O orçamento e todos os seus itens de preço serão removidos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteBudgetTarget && deleteBudgetMut.mutate({ id: deleteBudgetTarget })}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </PageContainer>
  );
}
