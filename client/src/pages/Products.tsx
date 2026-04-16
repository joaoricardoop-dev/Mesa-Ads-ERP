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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Package, Users, Tag, Megaphone, ImageIcon, X, Upload, MapPin } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import { SEMANAS_OPTIONS } from "@/hooks/useBudgetCalculator";
import { cn } from "@/lib/utils";

type TipoProduct = "impressos" | "eletronicos" | "telas";
type ImpressionFormulaType = "por_coaster" | "por_tela" | "por_visitante" | "por_evento" | "manual";
type DistributionType = "rede" | "local_especifico";

const impressionFormulaLabels: Record<ImpressionFormulaType, string> = {
  por_coaster: "Por Coaster",
  por_tela: "Por Tela",
  por_visitante: "Por Visitante",
  por_evento: "Por Evento",
  manual: "Manual",
};

const distributionTypeLabels: Record<DistributionType, string> = {
  rede: "Rede (geral)",
  local_especifico: "Local Específico",
};

const tipoLabels: Record<TipoProduct, string> = {
  impressos: "Impressos",
  eletronicos: "Eletrônicos",
  telas: "Telas",
};

const tipoColors: Record<TipoProduct, string> = {
  impressos: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  eletronicos: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  telas: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

interface TierForm {
  volumeMin: string;
  volumeMax: string;
  custoUnitario: string;
  frete: string;
  margem: string;
  artes: string;
  precoBase: string;
}

const emptyTier: TierForm = { volumeMin: "", volumeMax: "", custoUnitario: "", frete: "", margem: "50.00", artes: "1", precoBase: "" };

interface DiscountTierForm {
  priceMin: string;
  priceMax: string;
  discountPercent: string;
}

interface DiscountPriceTierRow {
  id: number;
  productId: number;
  priceMin: string;
  priceMax: string;
  discountPercent: string;
}

const emptyDiscountTier: DiscountTierForm = { priceMin: "", priceMax: "", discountPercent: "" };

type PricingMode = "cost_based" | "price_based";
type EntryType = "tiers" | "fixed_quantities";
type WorkflowTemplate = "fisico" | "eletronico_cliente_envia" | "ativacao_evento";

interface ProductListItem {
  id: number;
  name: string;
  tipo?: string | null;
  pricingMode?: PricingMode | null;
  entryType?: EntryType | null;
  irpj?: string | null;
  comRestaurante?: string | null;
  comComercial?: string | null;
  defaultSemanas?: number | null;
  isActive?: boolean | null;
  description?: string | null;
  unitLabel?: string | null;
  unitLabelPlural?: string | null;
  defaultQtyPerLocation?: number | null;
  temDistribuicaoPorLocal?: boolean | null;
  impressionFormulaType?: string | null;
  attentionFactor?: string | null;
  frequencyParam?: string | null;
  defaultPessoasPorMesa?: string | null;
  loopDurationSeconds?: number | null;
  frequenciaAparicoes?: string | null;
  distributionType?: string | null;
}

interface ProductForm {
  name: string;
  description: string;
  tipo: TipoProduct;
  temDistribuicaoPorLocal: boolean;
  imagemUrl: string;
  unitLabel: string;
  unitLabelPlural: string;
  defaultQtyPerLocation: string;
  defaultSemanas: string;
  irpj: string;
  comRestaurante: string;
  comComercial: string;
  pricingMode: PricingMode;
  entryType: EntryType;
  workflowTemplate: WorkflowTemplate | "";
  isActive: boolean;
  impressionFormulaType: ImpressionFormulaType;
  attentionFactor: string;
  frequencyParam: string;
  defaultPessoasPorMesa: string;
  loopDurationSeconds: string;
  frequenciaAparicoes: string;
  distributionType: DistributionType;
  locationIds: number[];
}

const emptyProduct: ProductForm = {
  name: "",
  description: "",
  tipo: "impressos",
  temDistribuicaoPorLocal: true,
  imagemUrl: "",
  unitLabel: "unidade",
  unitLabelPlural: "unidades",
  defaultQtyPerLocation: "500",
  defaultSemanas: "12",
  irpj: "6.00",
  comRestaurante: "15.00",
  comComercial: "10.00",
  pricingMode: "cost_based",
  entryType: "tiers",
  workflowTemplate: "",
  isActive: true,
  impressionFormulaType: "por_coaster",
  attentionFactor: "1.00",
  frequencyParam: "1.00",
  defaultPessoasPorMesa: "3.00",
  loopDurationSeconds: "30",
  frequenciaAparicoes: "1.00",
  distributionType: "rede",
  locationIds: [],
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
  const [tiersProduct, setTiersProduct] = useState<ProductListItem | null>(null);
  const [tiersForm, setTiersForm] = useState<TierForm[]>([]);
  const [discountTiersDialogOpen, setDiscountTiersDialogOpen] = useState(false);
  const [discountTiersProductId, setDiscountTiersProductId] = useState<number | null>(null);
  const [discountTiersProduct, setDiscountTiersProduct] = useState<ProductListItem | null>(null);
  const [discountTiersForm, setDiscountTiersForm] = useState<DiscountTierForm[]>([]);
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
    onSuccess: () => { utils.product.listTiers.invalidate(); setTiersDialogOpen(false); toast.success("Entradas de preço atualizadas"); },
    onError: (e) => toast.error(e.message),
  });

  const upsertDiscountTiersMutation = trpc.product.upsertDiscountTiers.useMutation({
    onSuccess: () => { utils.product.listDiscountTiers.invalidate(); setDiscountTiersDialogOpen(false); toast.success("Descontos por faixa atualizados"); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  }

  async function openEdit(p: any) {
    setEditingId(p.id);
    let locationIds: number[] = [];
    try {
      const locs = await utils.product.getLocations.fetch({ productId: p.id });
      locationIds = locs.map((l: { restaurantId: number }) => l.restaurantId);
    } catch (err) {
      console.error("[Products] Failed to load location IDs:", err);
      toast.error("Erro ao carregar locais vinculados ao produto");
      return;
    }
    setForm({
      name: p.name,
      description: p.description || "",
      tipo: (p.tipo as TipoProduct) || "impressos",
      temDistribuicaoPorLocal: p.temDistribuicaoPorLocal ?? true,
      imagemUrl: p.imagemUrl || "",
      unitLabel: p.unitLabel,
      unitLabelPlural: p.unitLabelPlural,
      defaultQtyPerLocation: String(p.defaultQtyPerLocation || 500),
      defaultSemanas: String(p.defaultSemanas || 12),
      irpj: p.irpj || "6.00",
      comRestaurante: p.comRestaurante || "15.00",
      comComercial: p.comComercial || "10.00",
      pricingMode: (p.pricingMode as PricingMode) || "cost_based",
      entryType: (p.entryType as EntryType) || "tiers",
      workflowTemplate: (p.workflowTemplate as WorkflowTemplate) || "",
      isActive: p.isActive,
      impressionFormulaType: (p.impressionFormulaType as ImpressionFormulaType) || "por_coaster",
      attentionFactor: p.attentionFactor || "1.00",
      frequencyParam: p.frequencyParam || "1.00",
      defaultPessoasPorMesa: p.defaultPessoasPorMesa || "3.00",
      loopDurationSeconds: p.loopDurationSeconds != null ? String(p.loopDurationSeconds) : "30",
      frequenciaAparicoes: p.frequenciaAparicoes || "1.00",
      distributionType: (p.distributionType as DistributionType) || "rede",
      locationIds,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = {
      name: form.name,
      description: form.description || undefined,
      tipo: form.tipo,
      temDistribuicaoPorLocal: form.temDistribuicaoPorLocal,
      imagemUrl: form.imagemUrl.trim() !== "" ? form.imagemUrl : null,
      unitLabel: form.unitLabel,
      unitLabelPlural: form.unitLabelPlural,
      defaultQtyPerLocation: parseInt(form.defaultQtyPerLocation) || 500,
      defaultSemanas: parseInt(form.defaultSemanas) || 12,
      irpj: form.irpj,
      comRestaurante: form.comRestaurante,
      comComercial: form.comComercial,
      pricingMode: form.pricingMode,
      entryType: form.entryType,
      workflowTemplate: (form.workflowTemplate as WorkflowTemplate) || null,
      isActive: form.isActive,
      impressionFormulaType: form.impressionFormulaType,
      attentionFactor: form.attentionFactor,
      frequencyParam: form.frequencyParam,
      defaultPessoasPorMesa: form.defaultPessoasPorMesa,
      loopDurationSeconds: parseInt(form.loopDurationSeconds) || 30,
      frequenciaAparicoes: form.frequenciaAparicoes,
      distributionType: form.distributionType,
      locationIds: form.distributionType === "local_especifico" ? form.locationIds : [],
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function openTiersEditor(product: ProductListItem) {
    setTiersProductId(product.id);
    setTiersProduct(product);
    setTiersDialogOpen(true);
  }

  function openDiscountTiersEditor(product: ProductListItem) {
    setDiscountTiersProductId(product.id);
    setDiscountTiersProduct(product);
    setDiscountTiersDialogOpen(true);
  }

  function handleSaveDiscountTiers() {
    if (!discountTiersProductId) return;
    const tiers = discountTiersForm
      .filter(t => t.priceMin.trim() !== "" && t.priceMax.trim() !== "" && t.discountPercent.trim() !== "")
      .map(t => ({
        priceMin: t.priceMin,
        priceMax: t.priceMax,
        discountPercent: t.discountPercent,
      }));
    upsertDiscountTiersMutation.mutate({ productId: discountTiersProductId, tiers });
  }

  function addDiscountTierRow() {
    setDiscountTiersForm(prev => [...prev, { ...emptyDiscountTier }]);
  }

  function removeDiscountTierRow(idx: number) {
    setDiscountTiersForm(prev => prev.filter((_, i) => i !== idx));
  }

  function updateDiscountTierRow(idx: number, field: keyof DiscountTierForm, val: string) {
    setDiscountTiersForm(prev => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  }

  function handleSaveTiers() {
    if (!tiersProductId || !tiersProduct) return;
    const isPriceBased = tiersProduct.pricingMode === "price_based";
    const isFixedQty = tiersProduct.entryType === "fixed_quantities";
    const tiers = tiersForm
      .filter(t => t.volumeMin.trim() !== "")
      .map(t => ({
        volumeMin: parseInt(t.volumeMin),
        volumeMax: isFixedQty ? parseInt(t.volumeMin) : (t.volumeMax.trim() === "" ? null : parseInt(t.volumeMax)),
        custoUnitario: isPriceBased ? "0.0000" : t.custoUnitario,
        frete: isPriceBased ? "0.00" : t.frete,
        margem: isPriceBased ? "0.00" : t.margem,
        artes: isPriceBased ? 1 : (parseInt(t.artes) || 1),
        precoBase: isPriceBased ? (t.precoBase.trim() || null) : null,
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
                <TableHead>Tipo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Qtd Padrão/Ponto</TableHead>
                <TableHead>IRPJ</TableHead>
                <TableHead>Com. Rest.</TableHead>
                <TableHead>Com. Com.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parceiros</TableHead>
                <TableHead>Anunciantes</TableHead>
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
                  onEditTiers={() => openTiersEditor(p)}
                  onEditDiscountTiers={() => openDiscountTiersEditor(p)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Product dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Foto do Produto</Label>
              <div className="mt-1.5 flex items-start gap-3">
                {form.imagemUrl ? (
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border/30 shrink-0">
                    <img src={form.imagemUrl} alt="Foto do produto" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, imagemUrl: "" })}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-lg border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 bg-muted/20 shrink-0">
                    <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground/50">Sem foto</span>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880}
                    onGetUploadParameters={async (file) => {
                      const res = await fetch("/api/uploads/request-url", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                      });
                      const data = await res.json();
                      return { method: "PUT" as const, url: data.uploadURL };
                    }}
                    onComplete={(result) => {
                      const file = result.successful?.[0];
                      if (file) {
                        const uploadedUrl =
                          (file as { uploadURL?: string }).uploadURL ||
                          file.response?.uploadURL ||
                          "";
                        const objectPath = uploadedUrl ? new URL(uploadedUrl).pathname.split("?")[0] : "";
                        const servingUrl = objectPath ? `/objects${objectPath}` : "";
                        if (servingUrl) {
                          setForm(prev => ({ ...prev, imagemUrl: servingUrl }));
                          toast.success("Foto carregada");
                        }
                      }
                    }}
                    buttonClassName="h-8 text-xs gap-1.5 bg-transparent border border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/20"
                  >
                    <Upload className="w-3.5 h-3.5" /> {form.imagemUrl ? "Trocar foto" : "Enviar foto"}
                  </ObjectUploader>
                  <p className="text-[10px] text-muted-foreground">Máx. 5 MB. Recomendado: 800×600 px.</p>
                </div>
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Bolacha de Chopp" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as TipoProduct })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(tipoLabels) as [TipoProduct, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.temDistribuicaoPorLocal} onCheckedChange={v => setForm({ ...form, temDistribuicaoPorLocal: v })} />
              <Label className="text-sm">Distribuição por local</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Qtd padrão por ponto de venda</Label>
                <Input type="number" value={form.defaultQtyPerLocation} onChange={e => setForm({ ...form, defaultQtyPerLocation: e.target.value })} />
              </div>
              <div>
                <Label>Semanas padrão</Label>
                <Select value={form.defaultSemanas} onValueChange={v => setForm({ ...form, defaultSemanas: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMANAS_OPTIONS.map(weeks => (
                      <SelectItem key={weeks} value={String(weeks)}>{weeks} semanas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>IRPJ (%)</Label>
                <Input value={form.irpj} onChange={e => setForm({ ...form, irpj: e.target.value })} />
              </div>
              <div>
                <Label>Com. Local (%)</Label>
                <Input value={form.comRestaurante} onChange={e => setForm({ ...form, comRestaurante: e.target.value })} />
              </div>
              <div>
                <Label>Com. Comercial (%)</Label>
                <Input value={form.comComercial} onChange={e => setForm({ ...form, comComercial: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Modo de Precificação</Label>
                <Select value={form.pricingMode} onValueChange={v => setForm({ ...form, pricingMode: v as PricingMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cost_based">Baseado em Custo</SelectItem>
                    <SelectItem value="price_based">Baseado em Preço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Entrada</Label>
                <Select value={form.entryType} onValueChange={v => setForm({ ...form, entryType: v as EntryType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiers">Faixas de Volume</SelectItem>
                    <SelectItem value="fixed_quantities">Quantidades Fixas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">Cálculo de Impressões</h3>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "por_coaster", label: "Por Coaster", desc: "Impressões por unidade física distribuída nos locais" },
                  { value: "por_tela", label: "Por Tela", desc: "Impressões por tempo de exibição em tela digital" },
                  { value: "manual", label: "Simples", desc: "Contagem direta sem fórmula automática" },
                ] as const).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, impressionFormulaType: value as ImpressionFormulaType })}
                    className={cn(
                      "text-left rounded-md border p-2 text-xs transition-colors",
                      form.impressionFormulaType === value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground"
                    )}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="opacity-70 mt-0.5 leading-tight">{desc}</div>
                  </button>
                ))}
              </div>

              {form.impressionFormulaType === "por_coaster" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Pessoas por Mesa</Label>
                      <p className="text-xs text-muted-foreground mb-1">Padrão quando o local não tem dados de assentos</p>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={form.defaultPessoasPorMesa}
                        onChange={e => setForm({ ...form, defaultPessoasPorMesa: e.target.value })}
                        placeholder="3.00"
                      />
                    </div>
                    <div>
                      <Label>Multiplicador</Label>
                      <p className="text-xs text-muted-foreground mb-1">Ajuste de atenção (1 = sem ajuste)</p>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.attentionFactor}
                        onChange={e => setForm({ ...form, attentionFactor: e.target.value })}
                        placeholder="1.00"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted rounded px-2 py-1.5">
                    Fórmula: <code className="font-mono">qtd × usos × pessoas/mesa × multiplicador</code>
                  </p>
                </>
              )}

              {form.impressionFormulaType === "por_tela" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Duração do Loop</Label>
                      <p className="text-xs text-muted-foreground mb-1">Segundos para um ciclo completo na tela</p>
                      <div className="relative">
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={form.loopDurationSeconds}
                          onChange={e => setForm({ ...form, loopDurationSeconds: e.target.value })}
                          placeholder="30"
                          className="pr-8"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">s</span>
                      </div>
                    </div>
                    <div>
                      <Label>Aparições por Visita</Label>
                      <p className="text-xs text-muted-foreground mb-1">Fallback quando o local não tem permanência média</p>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={form.frequenciaAparicoes}
                        onChange={e => setForm({ ...form, frequenciaAparicoes: e.target.value })}
                        placeholder="1.00"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Multiplicador</Label>
                    <p className="text-xs text-muted-foreground mb-1">Ajuste de atenção (1 = sem ajuste)</p>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-[160px]"
                      value={form.attentionFactor}
                      onChange={e => setForm({ ...form, attentionFactor: e.target.value })}
                      placeholder="1.00"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted rounded px-2 py-1.5">
                    Fórmula: <code className="font-mono">clientes/dia × aparições/visita × multiplicador × dias/mês</code>
                  </p>
                </>
              )}

              {form.impressionFormulaType !== "por_coaster" && form.impressionFormulaType !== "por_tela" && (
                <>
                  <div>
                    <Label>Multiplicador</Label>
                    <p className="text-xs text-muted-foreground mb-1">Ajuste sobre a contagem base (1 = sem ajuste)</p>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="max-w-[160px]"
                      value={form.attentionFactor}
                      onChange={e => setForm({ ...form, attentionFactor: e.target.value })}
                      placeholder="1.00"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted rounded px-2 py-1.5">
                    Fórmula: <code className="font-mono">qtd × usos</code>
                  </p>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Tipo de Distribuição</Label>
                <Select value={form.distributionType} onValueChange={v => setForm({ ...form, distributionType: v as DistributionType, locationIds: [] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(distributionTypeLabels) as [DistributionType, string][]).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.distributionType === "local_especifico" && (
                <LocationSelector
                  selectedIds={form.locationIds}
                  onChange={ids => setForm({ ...form, locationIds: ids })}
                />
              )}
            </div>

            <div>
              <Label>Template de Workflow</Label>
              <Select value={form.workflowTemplate || "none"} onValueChange={v => setForm({ ...form, workflowTemplate: v === "none" ? "" : v as WorkflowTemplate })}>
                <SelectTrigger><SelectValue placeholder="Selecionar template..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem template (fluxo padrão)</SelectItem>
                  <SelectItem value="fisico">Físico (briefing → design → aprovação → produção → distribuição → veiculação → concluída)</SelectItem>
                  <SelectItem value="eletronico_cliente_envia">Eletrônico/Cliente envia (briefing → aprovação de material → material recebido → veiculação → concluída)</SelectItem>
                  <SelectItem value="ativacao_evento">Ativação/Evento (briefing → planejamento → execução → concluída)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} />
              <Label className="text-sm">Produto ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Salvar" : "Criar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })}
              disabled={deleteMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TiersDialog
        open={tiersDialogOpen}
        onOpenChange={setTiersDialogOpen}
        productId={tiersProductId}
        product={tiersProduct}
        tiers={tiersForm}
        setTiers={setTiersForm}
        onSave={handleSaveTiers}
        onAddRow={addTierRow}
        onRemoveRow={removeTierRow}
        onUpdateRow={updateTierRow}
        saving={upsertTiersMutation.isPending}
      />

      <DiscountTiersDialog
        open={discountTiersDialogOpen}
        onOpenChange={setDiscountTiersDialogOpen}
        productId={discountTiersProductId}
        productName={discountTiersProduct?.name ?? ""}
        tiers={discountTiersForm}
        setTiers={setDiscountTiersForm}
        onSave={handleSaveDiscountTiers}
        onAddRow={addDiscountTierRow}
        onRemoveRow={removeDiscountTierRow}
        onUpdateRow={updateDiscountTierRow}
        saving={upsertDiscountTiersMutation.isPending}
      />
    </div>
  );
}

function ProductRow({ product: p, expanded, onToggle, onEdit, onDelete, onEditTiers, onEditDiscountTiers }: {
  product: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditTiers: () => void;
  onEditDiscountTiers: () => void;
}) {
  const { data: tiers = [] } = trpc.product.listTiers.useQuery(
    { productId: p.id },
    { enabled: expanded }
  );
  const { data: discountTiers = [] as DiscountPriceTierRow[] } = trpc.product.listDiscountTiers.useQuery(
    { productId: p.id },
    { enabled: expanded }
  );
  const utils = trpc.useUtils();
  const setVisibilityMutation = trpc.product.setPartnerVisibility.useMutation({
    onSuccess: () => {
      utils.product.list.invalidate();
      utils.product.listForPartners.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const setAdvertiserVisibilityMutation = trpc.product.setAdvertiserVisibility.useMutation({
    onSuccess: () => utils.product.list.invalidate(),
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const tipoLabel = tipoLabels[p.tipo as TipoProduct] ?? p.tipo ?? "—";
  const tipoColor = tipoColors[p.tipo as TipoProduct] ?? "bg-muted text-muted-foreground border-border";

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">{p.name}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${tipoColor}`}>
            {tipoLabel}
          </Badge>
        </TableCell>
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
        <TableCell onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Switch
              checked={!!p.visibleToPartners}
              onCheckedChange={(checked) =>
                setVisibilityMutation.mutate({ productId: p.id, visibleToPartners: checked })
              }
              disabled={setVisibilityMutation.isPending}
              aria-label="Visível para parceiros"
            />
            {p.visibleToPartners && (
              <Users className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
        </TableCell>
        <TableCell onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Switch
              checked={!!p.visibleToAdvertisers}
              onCheckedChange={(checked) =>
                setAdvertiserVisibilityMutation.mutate({ productId: p.id, visibleToAdvertisers: checked })
              }
              disabled={setAdvertiserVisibilityMutation.isPending}
              aria-label="Visível para anunciantes"
            />
            {p.visibleToAdvertisers && (
              <Megaphone className="w-3.5 h-3.5 text-blue-400" />
            )}
          </div>
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
          <TableCell colSpan={11} className="bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Entradas de Precificação ({tiers.length})</h3>
                <Badge variant="outline" className="text-[10px]">{p.entryType === "fixed_quantities" ? "Quantidades Exatas" : "Faixas de Volume"}</Badge>
                <Badge variant="outline" className="text-[10px]">{p.pricingMode === "price_based" ? "Baseado em Preço" : "Baseado em Custo"}</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={onEditTiers}>
                <Pencil className="h-3 w-3 mr-1" /> Editar Entradas
              </Button>
            </div>
            {tiers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma entrada cadastrada</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{p.entryType === "fixed_quantities" ? "Quantidade" : "Volume Mín"}</TableHead>
                      {p.entryType !== "fixed_quantities" && <TableHead>Volume Máx</TableHead>}
                      {p.pricingMode === "price_based" ? (
                        <TableHead>Preço Base</TableHead>
                      ) : (
                        <>
                          <TableHead>Custo Unit.</TableHead>
                          <TableHead>Frete</TableHead>
                          <TableHead>Margem</TableHead>
                          <TableHead>Artes</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tiers.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.volumeMin.toLocaleString("pt-BR")}</TableCell>
                        {p.entryType !== "fixed_quantities" && (
                          <TableCell>{t.volumeMax ? t.volumeMax.toLocaleString("pt-BR") : "—"}</TableCell>
                        )}
                        {p.pricingMode === "price_based" ? (
                          <TableCell className="font-mono">R$ {Number(t.precoBase || 0).toFixed(2)}</TableCell>
                        ) : (
                          <>
                            <TableCell className="font-mono">R$ {Number(t.custoUnitario).toFixed(4)}</TableCell>
                            <TableCell className="font-mono">R$ {Number(t.frete).toFixed(2)}</TableCell>
                            <TableCell>{t.margem}%</TableCell>
                            <TableCell>{t.artes}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-violet-500" />
                  <h3 className="text-sm font-semibold">Descontos por Faixa de Preço ({discountTiers.length})</h3>
                </div>
                <Button size="sm" variant="outline" onClick={onEditDiscountTiers}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar Descontos
                </Button>
              </div>
              {discountTiers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum desconto por faixa configurado</p>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preço Mín (R$)</TableHead>
                        <TableHead>Preço Máx (R$)</TableHead>
                        <TableHead>Desconto (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discountTiers.map((t: DiscountPriceTierRow) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono">R$ {Number(t.priceMin).toFixed(2)}</TableCell>
                          <TableCell className="font-mono">R$ {Number(t.priceMax).toFixed(2)}</TableCell>
                          <TableCell className="text-violet-600 dark:text-violet-400">{t.discountPercent}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            {p.description && (
              <p className="text-xs text-muted-foreground mt-3">{p.description}</p>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function LocationSelector({ selectedIds, onChange }: { selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const { data: restaurants = [], isLoading } = trpc.activeRestaurant.list.useQuery();
  const [search, setSearch] = useState("");

  const filtered = (restaurants as any[]).filter((r: any) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.neighborhood?.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        Locais Vinculados ({selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""})
      </Label>
      <Input
        placeholder="Buscar local..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="border rounded-md max-h-48 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground p-3">Carregando locais...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">Nenhum local encontrado</p>
        ) : (
          <div className="divide-y">
            {filtered.map((r: any) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggle(r.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent/30 transition-colors ${selectedIds.includes(r.id) ? "bg-primary/5" : ""}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedIds.includes(r.id) ? "bg-primary border-primary" : "border-border"}`}>
                  {selectedIds.includes(r.id) && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  {r.neighborhood && <p className="text-xs text-muted-foreground truncate">{r.neighborhood}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TiersDialog({ open, onOpenChange, productId, product, tiers, setTiers, onSave, onAddRow, onRemoveRow, onUpdateRow, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: number | null;
  product: any | null;
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
      precoBase: t.precoBase !== null && t.precoBase !== undefined ? String(t.precoBase) : "",
    })));
  }, [open, existingTiers, productId, setTiers]);

  const inputCls = "h-8 text-xs font-mono px-2";
  const isPriceBased = product?.pricingMode === "price_based";
  const isFixedQty = product?.entryType === "fixed_quantities";

  const addLabel = isFixedQty ? "Adicionar Quantidade" : "Adicionar Faixa";
  const emptyLabel = isFixedQty
    ? `Nenhuma entrada. Clique em "${addLabel}" para começar.`
    : `Nenhuma faixa. Clique em "${addLabel}" para começar.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entradas de Preço</DialogTitle>
        </DialogHeader>
        {product && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{isFixedQty ? "Quantidades Exatas" : "Faixas de Volume"}</Badge>
            <Badge variant="outline">{isPriceBased ? "Baseado em Preço" : "Baseado em Custo"}</Badge>
          </div>
        )}
        <div className="space-y-3">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{emptyLabel}</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">{isFixedQty ? "Quantidade" : "Vol. Mín"}</TableHead>
                    {!isFixedQty && <TableHead className="w-24">Vol. Máx</TableHead>}
                    {isPriceBased ? (
                      <TableHead className="w-32">Preço Base (R$)</TableHead>
                    ) : (
                      <>
                        <TableHead className="w-28">Custo Unit. (R$)</TableHead>
                        <TableHead className="w-24">Frete (R$)</TableHead>
                        <TableHead className="w-20">Margem (%)</TableHead>
                        <TableHead className="w-16">Artes</TableHead>
                      </>
                    )}
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((t, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Input className={inputCls} value={t.volumeMin} onChange={e => onUpdateRow(idx, "volumeMin", e.target.value)} /></TableCell>
                      {!isFixedQty && (
                        <TableCell><Input className={inputCls} value={t.volumeMax} onChange={e => onUpdateRow(idx, "volumeMax", e.target.value)} placeholder="∞" /></TableCell>
                      )}
                      {isPriceBased ? (
                        <TableCell><Input className={inputCls} value={t.precoBase} onChange={e => onUpdateRow(idx, "precoBase", e.target.value)} placeholder="0.00" /></TableCell>
                      ) : (
                        <>
                          <TableCell><Input className={inputCls} value={t.custoUnitario} onChange={e => onUpdateRow(idx, "custoUnitario", e.target.value)} /></TableCell>
                          <TableCell><Input className={inputCls} value={t.frete} onChange={e => onUpdateRow(idx, "frete", e.target.value)} /></TableCell>
                          <TableCell><Input className={inputCls} value={t.margem} onChange={e => onUpdateRow(idx, "margem", e.target.value)} /></TableCell>
                          <TableCell><Input className={inputCls} value={t.artes} onChange={e => onUpdateRow(idx, "artes", e.target.value)} /></TableCell>
                        </>
                      )}
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
            <Plus className="h-3 w-3 mr-1" /> {addLabel}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Entradas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscountTiersDialog({ open, onOpenChange, productId, productName, tiers, setTiers, onSave, onAddRow, onRemoveRow, onUpdateRow, saving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: number | null;
  productName: string;
  tiers: DiscountTierForm[];
  setTiers: (t: DiscountTierForm[]) => void;
  onSave: () => void;
  onAddRow: () => void;
  onRemoveRow: (i: number) => void;
  onUpdateRow: (i: number, field: keyof DiscountTierForm, val: string) => void;
  saving: boolean;
}) {
  const { data: existingTiers } = trpc.product.listDiscountTiers.useQuery(
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
    setTiers(existingTiers.map((t: DiscountPriceTierRow) => ({
      priceMin: String(t.priceMin),
      priceMax: String(t.priceMax),
      discountPercent: String(t.discountPercent),
    })));
  }, [open, existingTiers, productId, setTiers]);

  const inputCls = "h-8 text-xs font-mono px-2";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Descontos por Faixa de Preço{productName ? ` — ${productName}` : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Quando o preço bruto total do item (antes dos descontos) cair em uma faixa configurada, o desconto correspondente é aplicado automaticamente, antes do desconto por prazo.
        </p>
        <div className="space-y-3">
          {tiers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma faixa de desconto. Clique em "Adicionar Faixa" para começar.
            </p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Preço Mín (R$)</TableHead>
                    <TableHead className="w-36">Preço Máx (R$)</TableHead>
                    <TableHead className="w-32">Desconto (%)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((t, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Input className={inputCls} type="number" min="0" step="0.01" value={t.priceMin} onChange={e => onUpdateRow(idx, "priceMin", e.target.value)} placeholder="0.00" /></TableCell>
                      <TableCell><Input className={inputCls} type="number" min="0" step="0.01" value={t.priceMax} onChange={e => onUpdateRow(idx, "priceMax", e.target.value)} placeholder="0.00" /></TableCell>
                      <TableCell><Input className={inputCls} type="number" min="0" max="100" step="0.01" value={t.discountPercent} onChange={e => onUpdateRow(idx, "discountPercent", e.target.value)} placeholder="0.00" /></TableCell>
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
            {saving ? "Salvando..." : "Salvar Descontos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
