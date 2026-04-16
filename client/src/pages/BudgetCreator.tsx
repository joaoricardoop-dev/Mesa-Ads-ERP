import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import {
  Trash2,
  Calculator,
  RotateCcw,
  ExternalLink,
  Building2,
  Mail,
  Phone,
  MapPin,
  Tag,
  PackagePlus,
  Pencil,
  ChevronDown,
  ChevronUp,
  Package,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { BudgetPricingDialog, type PricingDialogImportResult } from "../components/BudgetPricingDialog";
import { CoasterPricingDialog } from "../components/CoasterPricingDialog";
import { CustomProductDialog, type CustomProductValues } from "../components/CustomProductDialog";
import {
  calcItemPrice,
  calcBudgetTotals,
  fmtBRL,
  fmtBRL4,
  DEFAULT_PREMISSAS,
  calcTelaImpressions,
  TELAS_INSERCOES,
  type GlobalBudgetParams,
  type ItemPricingInput,
  type ItemCalcResult,
  type ItemPremissas,
  type DiscountPriceTier,
} from "../hooks/useBudgetCalculator";
import {
  TIPO_LABELS,
  TIPO_ICONS,
  TIPO_COLORS,
} from "../lib/campaign-builder-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetPricingTier {
  id: number;
  productId: number;
  volumeMin: number;
  volumeMax: number | null;
  custoUnitario: string;
  frete: string;
  margem: string;
  artes: number | null;
  precoBase: string | null;
}

interface BudgetItemState {
  id: string;
  productId: number | null;
  productName: string;
  productTipo?: string | null;
  pricingMode: "cost_based" | "price_based";
  entryType: "tiers" | "fixed_quantities";
  tiers: BudgetPricingTier[];
  hasTiers: boolean;
  volumeIdx: number;
  freeVolume: number;
  freeManualCost: number;
  semanas: number;
  premissas: ItemPremissas;
  isCustomProduct?: boolean;
  customValues?: CustomProductValues;
  discountPriceTiers?: DiscountPriceTier[];
  isBonificada?: boolean;
  spotSeconds?: 15 | 30 | null;
  monthlyCustomers?: number;
  daysPerMonth?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItemId() {
  return Math.random().toString(36).slice(2);
}

function makeBlankItem(defaultSemanas = 12, defaultPremissas = DEFAULT_PREMISSAS): BudgetItemState {
  return {
    id: makeItemId(),
    productId: null,
    productName: "",
    pricingMode: "cost_based",
    entryType: "tiers",
    tiers: [],
    hasTiers: false,
    volumeIdx: 0,
    freeVolume: 100,
    freeManualCost: 0,
    semanas: defaultSemanas,
    premissas: { ...defaultPremissas },
  };
}

function getItemPricingInput(item: BudgetItemState): ItemPricingInput | null {
  if (!item.productId) return null;

  if (item.pricingMode === "price_based") {
    if (!item.hasTiers || item.tiers.length === 0) return null;
    const tier = item.tiers[item.volumeIdx];
    if (!tier) return null;
    const precoBase = parseFloat(tier.precoBase ?? "0") || 0;
    return {
      volume: tier.volumeMin,
      custoUnitario: 0,
      frete: 0,
      margem: 0,
      artes: 1,
      semanas: item.semanas,
      premissas: item.premissas,
      precoBase,
      discountPriceTiers: item.discountPriceTiers,
    };
  }

  if (item.hasTiers) {
    const tier = item.tiers[item.volumeIdx];
    if (!tier) return null;
    return {
      volume: tier.volumeMin,
      custoUnitario: parseFloat(tier.custoUnitario),
      frete: parseFloat(tier.frete),
      margem: parseFloat(tier.margem) / 100,
      artes: tier.artes ?? 1,
      semanas: item.semanas,
      premissas: item.premissas,
      discountPriceTiers: item.discountPriceTiers,
    };
  }
  return {
    volume: item.freeVolume,
    custoUnitario: item.freeManualCost,
    frete: 0,
    margem: 0.5,
    artes: 1,
    semanas: item.semanas,
    premissas: item.premissas,
    discountPriceTiers: item.discountPriceTiers,
  };
}

// ─── Client Qualification Card ────────────────────────────────────────────────

interface ClientInfo {
  id: number;
  name: string;
  company?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  instagram?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  segment?: string | null;
  status?: string;
}

function ClientQualificationCard({ client }: { client: ClientInfo }) {
  const addressParts = [
    client.address && client.addressNumber
      ? `${client.address}, ${client.addressNumber}`
      : client.address,
    client.neighborhood,
    client.city && client.state ? `${client.city}/${client.state}` : client.city,
  ].filter(Boolean);

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{client.company || client.name}</p>
          {client.razaoSocial && client.razaoSocial !== client.company && (
            <p className="text-[11px] text-muted-foreground truncate">{client.razaoSocial}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {client.status === "active" && (
            <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Ativo
            </Badge>
          )}
          {client.segment && (
            <Badge variant="outline" className="text-[9px] px-1.5 h-4">
              {client.segment}
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        {client.cnpj && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="font-mono">{client.cnpj}</span>
          </div>
        )}
        {client.contactEmail && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{client.contactEmail}</span>
          </div>
        )}
        {client.contactPhone && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{client.contactPhone}</span>
          </div>
        )}
        {addressParts.length > 0 && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="leading-tight">{addressParts.join(" · ")}</span>
          </div>
        )}
        {client.instagram && (
          <div className="flex items-center gap-1.5">
            <Tag className="h-3 w-3 shrink-0" />
            <span>{client.instagram}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Product Catalog Section ───────────────────────────────────────────────────

interface ProductCatalogSectionProps {
  products: { id: number; name: string; tipo?: string | null; description?: string | null; [key: string]: any }[];
  itemCounts: Record<number, number>;
  onAdd: (product: { id: number; name: string; tipo?: string | null; [key: string]: any }) => void;
  onAddCustom: () => void;
}

function ProductCatalogSection({ products, itemCounts, onAdd, onAddCustom }: ProductCatalogSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Catálogo de Produtos</span>
          <span className="text-xs text-muted-foreground">— clique para adicionar ao orçamento</span>
        </div>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronUp className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {!collapsed && (
        <div className="p-4">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {products.map((product) => {
              const tipo = product.tipo ?? "outro";
              const TipoIcon = TIPO_ICONS[tipo] ?? Package;
              const colors = TIPO_COLORS[tipo] ?? TIPO_COLORS.outro;
              const count = itemCounts[product.id] ?? 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onAdd(product)}
                  className={`bg-card border rounded-2xl overflow-hidden transition-all duration-200 flex flex-col text-left group hover:shadow-md ${colors.hoverBorder} ${count > 0 ? `${colors.border} ring-1 ring-inset ${colors.border}` : "border-border/30"}`}
                >
                  <div className={`bg-gradient-to-br ${colors.gradient} px-4 py-4 flex items-center gap-3 border-b border-border/20`}>
                    <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
                      <TipoIcon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-tight truncate">{product.name}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text} mt-0.5 inline-block`}>
                        {TIPO_LABELS[tipo] ?? tipo}
                      </span>
                    </div>
                    {count > 0 && (
                      <div className={`shrink-0 w-6 h-6 rounded-full ${colors.bg} border ${colors.border} flex items-center justify-center`}>
                        <span className={`text-[10px] font-bold ${colors.text}`}>{count}</span>
                      </div>
                    )}
                  </div>
                  {product.description && (
                    <div className="px-4 py-2.5">
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{product.description}</p>
                    </div>
                  )}
                  <div className={`px-4 py-2 mt-auto border-t border-border/20 flex items-center gap-1.5 text-[11px] font-medium ${count > 0 ? colors.text : "text-muted-foreground group-hover:" + colors.text}`}>
                    <CheckCircle2 className={`w-3 h-3 ${count > 0 ? colors.text : "opacity-0 group-hover:opacity-100 transition-opacity"}`} />
                    {count > 0 ? `${count}× no orçamento — adicionar mais` : "Adicionar ao orçamento"}
                  </div>
                </button>
              );
            })}

            {/* Custom product card */}
            <button
              type="button"
              onClick={onAddCustom}
              className="bg-card border border-dashed border-violet-500/30 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col text-left group hover:border-violet-500/60 hover:shadow-md hover:bg-violet-500/5"
            >
              <div className="px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <PackagePlus className="w-5 h-5 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight text-violet-300">Produto Personalizado</p>
                  <span className="text-[10px] text-violet-400/70">Projeto Sob Medida</span>
                </div>
              </div>
              <div className="px-4 py-2 mt-auto border-t border-violet-500/20 text-[11px] font-medium text-violet-400/70 group-hover:text-violet-400">
                Adicionar item sob medida
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BudgetItemCard ───────────────────────────────────────────────────────────

interface BudgetItemCardProps {
  item: BudgetItemState;
  globalParams: GlobalBudgetParams;
  onUpdate: (id: string, patch: Partial<BudgetItemState>) => void;
  onRemove: (id: string) => void;
  onAddTelasDual?: (itemId: string, baseItem: Partial<BudgetItemState>) => void;
  index: number;
  defaultDaysPerMonth?: number;
}

const SEMANAS_OPTIONS = [4, 8, 12, 16, 20, 24];

function BudgetItemCard({ item, globalParams, onUpdate, onRemove, onAddTelasDual, index, defaultDaysPerMonth = 26 }: BudgetItemCardProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const [pricingOpen, setPricingOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  const tipo = item.productTipo ?? "outro";
  const TipoIcon = TIPO_ICONS[tipo] ?? Package;
  const colors = TIPO_COLORS[tipo] ?? TIPO_COLORS.outro;

  const isPriceBased = item.pricingMode === "price_based";
  const isFixedQty = item.entryType === "fixed_quantities";
  const isDisplayBatch = tipo === "telas" || tipo === "display";
  const isTelas = tipo === "telas";

  const telaImpressions = useMemo(() => {
    if (!isTelas || !item.spotSeconds) return null;
    const mc = item.monthlyCustomers ?? 0;
    const dp = item.daysPerMonth ?? defaultDaysPerMonth;
    if (mc <= 0) return null;
    return calcTelaImpressions(item.spotSeconds, mc, dp);
  }, [isTelas, item.spotSeconds, item.monthlyCustomers, item.daysPerMonth, defaultDaysPerMonth]);

  const { data: tiersRaw, isLoading: tiersLoading } = trpc.product.getTiers.useQuery(
    { productId: item.productId! },
    { enabled: item.productId !== null && !item.isCustomProduct }
  );

  const { data: discountTiersRaw } = trpc.product.listDiscountTiers.useQuery(
    { productId: item.productId! },
    { enabled: item.productId !== null && !item.isCustomProduct }
  );

  useEffect(() => {
    if (tiersRaw !== undefined && item.productId !== null) {
      onUpdateRef.current(item.id, {
        tiers: tiersRaw as BudgetPricingTier[],
        hasTiers: tiersRaw.length > 0,
        volumeIdx: 0,
      });
    }
  }, [tiersRaw, item.id, item.productId]);

  useEffect(() => {
    if (discountTiersRaw !== undefined && item.productId !== null) {
      onUpdateRef.current(item.id, {
        discountPriceTiers: discountTiersRaw.map((t) => ({
          priceMin: parseFloat(String(t.priceMin)),
          priceMax: parseFloat(String(t.priceMax)),
          discountPercent: parseFloat(String(t.discountPercent)),
        })),
      });
    }
  }, [discountTiersRaw, item.id, item.productId]);

  const pricingInput = getItemPricingInput(item);
  const calc = pricingInput ? calcItemPrice(pricingInput) : null;

  const tierLabel = (tier: BudgetPricingTier) => {
    if (isFixedQty) return `${(tier.volumeMin / 1000).toFixed(0)}k`;
    return `${(tier.volumeMin / 1000).toFixed(0)}k+`;
  };

  const tierLabelFull = (tier: BudgetPricingTier) => {
    if (isFixedQty) return `${tier.volumeMin.toLocaleString("pt-BR")} un.`;
    if (tier.volumeMax && tier.volumeMax !== tier.volumeMin)
      return `${tier.volumeMin.toLocaleString("pt-BR")} – ${tier.volumeMax.toLocaleString("pt-BR")} un.`;
    return `${tier.volumeMin.toLocaleString("pt-BR")}+ un.`;
  };

  const handlePricingImport = useCallback((result: PricingDialogImportResult) => {
    const patch: Partial<BudgetItemState> = { semanas: result.semanas, premissas: result.premissas };
    if (result.volumeIdx !== undefined) patch.volumeIdx = result.volumeIdx;
    if (result.freeVolume !== undefined) patch.freeVolume = result.freeVolume;
    if (result.freeManualCost !== undefined) patch.freeManualCost = result.freeManualCost;
    onUpdate(item.id, patch);
  }, [onUpdate, item.id]);

  const isBonificada = globalParams.isBonificada || !!item.isBonificada;
  const usePillTiers = item.hasTiers && item.tiers.length > 0 && item.tiers.length <= 8;
  const isCoaster = tipo === "coaster";

  return (
    <>
      <div className={`bg-card border ${colors.border} rounded-2xl overflow-hidden`}>
        {/* ── Card Header ── */}
        <div className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${colors.gradient} border-b border-border/20`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${colors.bg} border ${colors.border} shrink-0`}>
            {item.isCustomProduct
              ? <PackagePlus className="w-4 h-4 text-violet-400" />
              : <TipoIcon className={`w-4 h-4 ${colors.text}`} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {item.isCustomProduct
                ? (item.customValues?.customProductName || "Produto Personalizado")
                : (item.productName || "Produto")}
            </p>
            <p className={`text-[10px] font-medium ${item.isCustomProduct ? "text-violet-400" : colors.text}`}>
              {item.isCustomProduct ? "Projeto Sob Medida" : (TIPO_LABELS[tipo] ?? tipo)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.productId && !item.isCustomProduct && (
              <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-mono ${colors.text} border-current`}>
                {isDisplayBatch ? `${item.semanas / 4}bt` : `${item.semanas}sem`}
              </Badge>
            )}
            {isTelas && item.spotSeconds && (
              <Badge className={`text-[10px] h-5 px-1.5 font-bold ${
                item.spotSeconds === 30
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                  : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800"
              }`}>
                Spot {item.spotSeconds}s
              </Badge>
            )}
            {item.isBonificada && !globalParams.isBonificada && (
              <Badge className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                Bonif.
              </Badge>
            )}
            {item.isCustomProduct && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-violet-400 hover:text-violet-300"
                onClick={() => setCustomDialogOpen(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* ── Card Body ── */}
        <div className="p-4 space-y-3">
          {/* Custom product summary */}
          {item.isCustomProduct && item.customValues && (
            <div className="bg-violet-50/60 dark:bg-violet-950/10 rounded-xl p-3 space-y-1.5 text-xs border border-violet-200/60 dark:border-violet-800/30">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span className="text-muted-foreground">Custo do Projeto</span>
                <span className="text-right font-mono">{fmtBRL(parseFloat(item.customValues.customProjectCost) || 0)}</span>
                {item.customValues.customPricingMode === "margin" ? (
                  <>
                    <span className="text-muted-foreground">Margem</span>
                    <span className="text-right font-mono">{item.customValues.customMarginPercent}%</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">Preço Final</span>
                    <span className="text-right font-mono">{fmtBRL(parseFloat(item.customValues.customFinalPrice) || 0)}</span>
                  </>
                )}
                <span className="text-muted-foreground">Com. Local</span>
                <span className="text-right font-mono">{item.customValues.customRestaurantCommission}%</span>
                <span className="text-muted-foreground">Com. Parceiro</span>
                <span className="text-right font-mono">{item.customValues.customPartnerCommission}%</span>
                <span className="text-muted-foreground">Com. Vendedor</span>
                <span className="text-right font-mono">{item.customValues.customSellerCommission}%</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span className="text-muted-foreground">Valor Total</span>
                <span className="text-violet-700 dark:text-violet-300">
                  {fmtBRL(item.customValues.calculatedFinalPrice)}
                </span>
              </div>
            </div>
          )}

          {/* Loading tiers */}
          {!item.isCustomProduct && item.productId && tiersLoading && (
            <p className="text-xs text-muted-foreground animate-pulse">Carregando faixas de preço...</p>
          )}

          {/* Volume tier pills */}
          {!item.isCustomProduct && item.productId && !tiersLoading && usePillTiers && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {isFixedQty ? "Quantidade" : "Volume"}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {item.tiers.map((tier, idx) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onUpdate(item.id, { volumeIdx: idx })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      item.volumeIdx === idx
                        ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                        : "bg-background text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                    }`}
                    title={tierLabelFull(tier)}
                  >
                    {tierLabel(tier)}
                  </button>
                ))}
              </div>
              {item.tiers[item.volumeIdx] && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {tierLabelFull(item.tiers[item.volumeIdx])}
                </p>
              )}
            </div>
          )}

          {/* Volume dropdown for many tiers */}
          {!item.isCustomProduct && item.productId && !tiersLoading && item.hasTiers && item.tiers.length > 8 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                {isFixedQty ? "Quantidade" : "Faixa de volume"}
              </Label>
              <Select
                value={String(item.volumeIdx)}
                onValueChange={(v) => onUpdate(item.id, { volumeIdx: Number(v) })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {item.tiers.map((tier, idx) => (
                    <SelectItem key={tier.id} value={String(idx)}>
                      {tierLabelFull(tier)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Free quantity entry */}
          {!item.isCustomProduct && item.productId && !tiersLoading && !item.hasTiers && !isPriceBased && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.freeVolume || ""}
                  onChange={(e) => onUpdate(item.id, { freeVolume: parseInt(e.target.value) || 1 })}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Custo unit. (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.0001}
                  value={item.freeManualCost || ""}
                  onChange={(e) => onUpdate(item.id, { freeManualCost: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          {/* Telas: Clientes/mês, dias/mês */}
          {isTelas && item.spotSeconds && !item.isCustomProduct && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Clientes/mês</Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.monthlyCustomers ?? ""}
                    onChange={(e) => onUpdate(item.id, { monthlyCustomers: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                    placeholder="Ex: 3000"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Dias/mês</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={item.daysPerMonth ?? defaultDaysPerMonth}
                    onChange={(e) => onUpdate(item.id, { daysPerMonth: parseInt(e.target.value) || 26 })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              {telaImpressions !== null && (
                <div className={`rounded-lg px-3 py-2 text-xs border ${
                  item.spotSeconds === 30
                    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 text-blue-800 dark:text-blue-300"
                    : "bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800/40 text-violet-800 dark:text-violet-300"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Inserções/dia: {TELAS_INSERCOES[item.spotSeconds]}</span>
                    <span className="font-bold font-mono">{Math.round(telaImpressions).toLocaleString("pt-BR")} impressões/mês</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Duration */}
          {!item.isCustomProduct && item.productId && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                {isDisplayBatch ? "Duração (batches)" : "Duração"}
              </Label>
              {isDisplayBatch ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdate(item.id, { semanas: Math.max(4, item.semanas - 4) })}
                    className="h-7 w-7 rounded-lg border border-border/50 flex items-center justify-center text-sm font-medium bg-background hover:bg-muted transition-colors"
                  >−</button>
                  <span className="min-w-[70px] text-center text-sm font-semibold tabular-nums">
                    {item.semanas / 4} {item.semanas / 4 === 1 ? "batch" : "batches"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdate(item.id, { semanas: item.semanas + 4 })}
                    className="h-7 w-7 rounded-lg border border-border/50 flex items-center justify-center text-sm font-medium bg-background hover:bg-muted transition-colors"
                  >+</button>
                </div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {SEMANAS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onUpdate(item.id, { semanas: s })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                        item.semanas === s
                          ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm`
                          : "bg-background text-muted-foreground border-border/50 hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {s}sem
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-item bonification toggle */}
          {!item.isCustomProduct && item.productId && !globalParams.isBonificada && (
            <div className="flex items-center justify-between py-1">
              <Label className="text-xs text-muted-foreground cursor-pointer" htmlFor={`bonif-${item.id}`}>
                Bonificar este item
              </Label>
              <Switch
                id={`bonif-${item.id}`}
                checked={!!item.isBonificada}
                onCheckedChange={(v) => onUpdate(item.id, { isBonificada: v })}
              />
            </div>
          )}

          {/* Pricing result strip */}
          {!item.isCustomProduct && calc && pricingInput && (
            <div className={`bg-muted/40 rounded-xl p-3 space-y-1.5 text-xs border border-border/30`}>
              {isPriceBased ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-muted-foreground">Quantidade</span>
                    <span className="text-right font-medium">{pricingInput.volume.toLocaleString("pt-BR")} un.</span>
                    <span className="text-muted-foreground">Preço Base (4sem)</span>
                    <span className="text-right font-mono font-semibold text-primary">{fmtBRL(pricingInput.precoBase ?? 0)}</span>
                    {calc.receitaMensal !== undefined && (
                      <>
                        <span className="text-muted-foreground">Receita Mensal</span>
                        <span className="text-right font-mono text-blue-600 dark:text-blue-400">{fmtBRL(calc.receitaMensal)}</span>
                        <span className="text-muted-foreground">Desconto Total</span>
                        <span className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {calc.precoSemDesconto > 0 ? `-${(((calc.precoSemDesconto - calc.precoComDescDuracao) / calc.precoSemDesconto) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Total {item.semanas}sem</span>
                    <span className={isBonificada ? "line-through text-muted-foreground" : ""}>{fmtBRL(calc.precoComDescDuracao)}</span>
                  </div>
                  {calc.descPrazoPerc > 0 && !isBonificada && (
                    <div className="flex justify-between text-[10px] text-amber-600 dark:text-amber-400">
                      <span>Desc. prazo incluso ({(calc.descPrazoPerc * 100).toFixed(0)}%)</span>
                      <span>−{fmtBRL(calc.descPrazoVal)}</span>
                    </div>
                  )}
                  {calc.descFaixaPrecoPerc > 0 && !isBonificada && (
                    <div className="flex justify-between text-[10px] text-violet-600 dark:text-violet-400">
                      <span>Desc. faixa de preço ({(calc.descFaixaPrecoPerc * 100).toFixed(0)}%)</span>
                      <span>−{fmtBRL(calc.descFaixaPrecoVal)}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="text-right font-medium">{pricingInput.volume.toLocaleString("pt-BR")} un.</span>
                    <span className="text-muted-foreground">Custo/un.</span>
                    <span className="text-right font-mono">{fmtBRL4(pricingInput.custoUnitario)}</span>
                    <span className="text-muted-foreground">Preço/un. base</span>
                    <span className="text-right font-mono font-semibold text-primary">{fmtBRL4(calc.precoUnit4sem)}</span>
                    <span className="text-muted-foreground">Margem bruta</span>
                    <span className={`text-right font-mono font-semibold ${
                      pricingInput.margem >= 0.30 ? "text-emerald-600 dark:text-emerald-400" :
                      pricingInput.margem >= 0.15 ? "text-amber-600 dark:text-amber-400" :
                      "text-red-600 dark:text-red-400"
                    }`}>
                      {(pricingInput.margem * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Total {item.semanas}sem</span>
                    <span className={isBonificada ? "line-through text-muted-foreground" : ""}>{fmtBRL(calc.precoComDescDuracao)}</span>
                  </div>
                  {calc.descPrazoPerc > 0 && !isBonificada && (
                    <div className="flex justify-between text-[10px] text-amber-600 dark:text-amber-400">
                      <span>Desc. prazo incluso ({(calc.descPrazoPerc * 100).toFixed(0)}%)</span>
                      <span>−{fmtBRL(calc.descPrazoVal)}</span>
                    </div>
                  )}
                  {calc.descFaixaPrecoPerc > 0 && !isBonificada && (
                    <div className="flex justify-between text-[10px] text-violet-600 dark:text-violet-400">
                      <span>Desc. faixa de preço ({(calc.descFaixaPrecoPerc * 100).toFixed(0)}%)</span>
                      <span>−{fmtBRL(calc.descFaixaPrecoVal)}</span>
                    </div>
                  )}
                </>
              )}
              {isBonificada && (
                <div className="text-right text-green-600 dark:text-green-400 font-semibold text-[11px]">
                  Bonificada — R$ 0,00
                </div>
              )}
            </div>
          )}

          {/* Abrir Precificador button */}
          {!item.isCustomProduct && item.productId && !tiersLoading && !isPriceBased && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => setPricingOpen(true)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Precificador
            </Button>
          )}
        </div>
      </div>

      {pricingOpen && isCoaster && item.tiers.length > 0 && (
        <CoasterPricingDialog
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          productName={item.productName}
          tiers={item.tiers as Parameters<typeof CoasterPricingDialog>[0]["tiers"]}
          initialVolumeIdx={item.volumeIdx}
          initialSemanas={item.semanas}
          initialPremissas={item.premissas}
          onImport={handlePricingImport}
        />
      )}

      <CustomProductDialog
        open={customDialogOpen}
        onOpenChange={(open) => {
          if (!open && !item.customValues) onUpdate(item.id, { isCustomProduct: false });
          setCustomDialogOpen(open);
        }}
        initialValues={item.customValues}
        onConfirm={(values) => {
          onUpdate(item.id, {
            isCustomProduct: true,
            customValues: values,
            productName: values.customProductName,
            productId: null,
          });
          setCustomDialogOpen(false);
        }}
      />

      {pricingOpen && !isCoaster && (
        <BudgetPricingDialog
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          productName={item.productName}
          tiers={item.tiers}
          hasTiers={item.hasTiers}
          initialVolumeIdx={item.volumeIdx}
          initialFreeVolume={item.freeVolume}
          initialFreeManualCost={item.freeManualCost}
          initialSemanas={item.semanas}
          initialPremissas={item.premissas}
          onImport={handlePricingImport}
        />
      )}
    </>
  );
}

// ─── BudgetSummaryPanel ───────────────────────────────────────────────────────

interface BudgetSummaryPanelProps {
  items: BudgetItemState[];
  globalParams: GlobalBudgetParams;
  clientName: string;
  hasPartner: boolean;
  onGerarCotacao: () => void;
  isGenerating: boolean;
}

function BudgetSummaryPanel({ items, globalParams, clientName, hasPartner, onGerarCotacao, isGenerating }: BudgetSummaryPanelProps) {
  const itemCalcs = useMemo(() => {
    return items
      .filter((item) => item.productId !== null)
      .flatMap((item) => {
        const input = getItemPricingInput(item);
        if (!input || input.volume <= 0) return [];
        const calc = calcItemPrice(input);
        return [{ item, input, calc }];
      });
  }, [items]);

  const calcsForTotals = useMemo(() => {
    return itemCalcs.map(({ item, calc }) => {
      if (item.isBonificada) {
        return { ...calc, precoComDescDuracao: 0, precoSemDesconto: 0, descPrazoVal: 0, descFaixaPrecoVal: 0, descPrazoPerc: 0, descFaixaPrecoPerc: 0 } as ItemCalcResult;
      }
      return calc as ItemCalcResult;
    });
  }, [itemCalcs]);

  const totals = useMemo(() => calcBudgetTotals(calcsForTotals, globalParams), [calcsForTotals, globalParams]);
  const hasItems = itemCalcs.length > 0;

  return (
    <div className="space-y-3">
      <Card className="border border-border/40">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Resumo do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3 text-sm">
          {clientName && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium truncate max-w-[55%] text-right">{clientName}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Pagamento</span>
            <span>
              {globalParams.formaPagamento === "pix" ? "Pix (−5%)" : globalParams.formaPagamento === "boleto" ? "Boleto" : "Cartão"}
            </span>
          </div>

          {hasItems ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Itens</p>
                {(() => {
                  const bvScale = !globalParams.isBonificada && (globalParams.agencyBVPercent ?? 0) > 0 && totals.total > 0
                    ? totals.totalFinal / totals.total : 1;
                  return itemCalcs.map(({ item, input, calc }) => {
                    const itemBonif = globalParams.isBonificada || !!item.isBonificada;
                    const displayPrice = itemBonif ? 0 : calc.precoComDescDuracao * bvScale;
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium leading-tight truncate">{item.productName}</p>
                          <p className="text-muted-foreground text-[11px]">
                            {input.volume.toLocaleString("pt-BR")} un. · {item.semanas}sem
                            {calc.descPrazoPerc > 0 ? ` · −${(calc.descPrazoPerc * 100).toFixed(0)}%` : ""}
                            {calc.descFaixaPrecoPerc > 0 ? ` · faixa −${(calc.descFaixaPrecoPerc * 100).toFixed(0)}%` : ""}
                            {!itemBonif && bvScale > 1 ? ` · BV +${((globalParams.agencyBVPercent ?? 0)).toFixed(1)}%` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {itemBonif ? (
                            <span className="text-green-600 dark:text-green-400 font-semibold font-mono">R$ 0,00</span>
                          ) : (
                            <span className="font-mono font-medium">{fmtBRL(displayPrice)}</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <Separator />
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal (pós desc. prazo)</span>
                  <span className="font-mono">{fmtBRL(totals.subtotalPostDuration)}</span>
                </div>
                {totals.ajPagamentoVal !== 0 && (
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>Aj. Pix (−5%)</span>
                    <span className="font-mono">{fmtBRL(totals.ajPagamentoVal)}</span>
                  </div>
                )}
                {totals.descParceiroVal > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Desc. parceiro (−10%)</span>
                    <span className="font-mono">−{fmtBRL(totals.descParceiroVal)}</span>
                  </div>
                )}
                {totals.descManualVal > 0 && (
                  <div className="flex justify-between text-orange-600 dark:text-orange-400">
                    <span>Desc. manual (−{(totals.descManualPerc * 100).toFixed(1)}%)</span>
                    <span className="font-mono">−{fmtBRL(totals.descManualVal)}</span>
                  </div>
                )}
                {totals.agencyBVVal > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>
                      BV embutido ({(globalParams.agencyBVPercent ?? 0).toFixed(1)}%)
                      {hasPartner ? " → pago à agência" : " → margem Mesa Ads"}
                    </span>
                    <span className="font-mono">+{fmtBRL(totals.agencyBVVal)}</span>
                  </div>
                )}
              </div>

              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="font-mono text-primary">
                  {globalParams.isBonificada ? "R$ 0,00" : fmtBRL(totals.totalFinal)}
                </span>
              </div>
              {globalParams.isBonificada && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Campanha bonificada</p>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs">
              Adicione produtos ao orçamento para ver o resumo
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full" disabled={!hasItems || isGenerating} onClick={onGerarCotacao} size="lg">
        <Calculator className="h-4 w-4 mr-2" />
        {isGenerating ? "Gerando..." : "Gerar Cotação"}
      </Button>
      {hasItems && (
        <p className="text-[11px] text-muted-foreground text-center leading-tight">
          {itemCalcs.length} {itemCalcs.length === 1 ? "produto" : "produtos"} · preços calculados
        </p>
      )}
    </div>
  );
}

// ─── BudgetCreator Page ───────────────────────────────────────────────────────

export default function BudgetCreator() {
  const [, navigate] = useLocation();

  const [clientId, setClientId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [isBonificada, setIsBonificada] = useState(false);
  const [descontoParceiro, setDescontoParceiro] = useState(false);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [descontoManual, setDescontoManual] = useState(0);
  const [agencyCommissionPercent, setAgencyCommissionPercent] = useState("20");
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | "cartao">("boleto");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BudgetItemState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  const { data: clientsData } = trpc.advertiser.list.useQuery();
  const clientsList = useMemo(() => (clientsData?.items ?? []) as ClientInfo[], [clientsData]);

  const { data: leadsRaw } = trpc.lead.list.useQuery({ type: "anunciante" });
  const leadsList = useMemo(() => (leadsRaw as any[]) ?? [], [leadsRaw]);

  const { data: productsRaw } = trpc.product.list.useQuery();
  const productsList = useMemo(() => (productsRaw ?? []) as {
    id: number; name: string; description?: string | null; defaultSemanas?: number | null;
    tipo?: string | null; temDistribuicaoPorLocal?: boolean | null;
    pricingMode?: string | null; entryType?: string | null;
    irpj?: string | null; comRestaurante?: string | null; comComercial?: string | null;
  }[], [productsRaw]);

  const { data: partnersList = [] } = trpc.partner.list.useQuery();
  const { data: restaurantsList = [] } = trpc.activeRestaurant.list.useQuery();

  const networkAvgMonthlyCustomers = useMemo(() => {
    const withData = restaurantsList.filter((r: any) => r.monthlyCustomers && r.monthlyCustomers > 0);
    if (withData.length === 0) return 3000;
    return Math.round(withData.reduce((sum: number, r: any) => sum + r.monthlyCustomers, 0) / withData.length);
  }, [restaurantsList]);

  const createQuotation = trpc.quotation.create.useMutation();
  const addItem = trpc.quotation.addItem.useMutation();

  const agencyBVPercent = useMemo(() => {
    const v = parseFloat(agencyCommissionPercent);
    return isNaN(v) ? 0 : Math.min(Math.max(v, 0), 99.9);
  }, [agencyCommissionPercent]);

  const selectedClient = useMemo(() => {
    if (!clientId) return null;
    return clientsList.find((c) => c.id === clientId) ?? null;
  }, [clientId, clientsList]);

  const clientName = useMemo(() => {
    if (selectedClient) return selectedClient.company || selectedClient.name;
    if (leadId) {
      const l = leadsList.find((l: any) => l.id === leadId);
      return l?.company || l?.name || "";
    }
    return "";
  }, [selectedClient, leadId, leadsList]);

  const updateItem = useCallback((id: string, patch: Partial<BudgetItemState>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      const next = prev.filter((item) => item.id !== id);
      if (target?.productName) toast(`"${target.productName}" removido do orçamento`);
      else toast("Produto removido do orçamento");
      return next;
    });
  }, []);

  const addFromCatalog = useCallback((product: typeof productsList[number]) => {
    const prodPremissas: ItemPremissas = {
      irpj: parseFloat(product.irpj ?? "") || DEFAULT_PREMISSAS.irpj,
      comissaoRestaurante: parseFloat(product.comRestaurante ?? "") || DEFAULT_PREMISSAS.comissaoRestaurante,
      comissaoComercial: parseFloat(product.comComercial ?? "") || DEFAULT_PREMISSAS.comissaoComercial,
    };
    const newItem: BudgetItemState = {
      id: makeItemId(),
      productId: product.id,
      productName: product.name,
      productTipo: product.tipo,
      pricingMode: (product.pricingMode as "cost_based" | "price_based") ?? "cost_based",
      entryType: (product.entryType as "tiers" | "fixed_quantities") ?? "tiers",
      tiers: [],
      hasTiers: false,
      volumeIdx: 0,
      freeVolume: 100,
      freeManualCost: 0,
      semanas: product.defaultSemanas ?? 12,
      premissas: prodPremissas,
    };

    if (product.tipo === "telas") {
      const item30: BudgetItemState = {
        ...newItem,
        id: makeItemId(),
        productName: `${product.name} — Spot 30s`,
        spotSeconds: 30,
        monthlyCustomers: networkAvgMonthlyCustomers,
      };
      const item15: BudgetItemState = {
        ...newItem,
        id: makeItemId(),
        productName: `${product.name} — Spot 15s`,
        spotSeconds: 15,
        monthlyCustomers: networkAvgMonthlyCustomers,
      };
      setItems((prev) => [...prev, item30, item15]);
      toast.success(`"${product.name}" adicionado como Spot 30s e Spot 15s`);
    } else {
      setItems((prev) => [...prev, newItem]);
      toast.success(`"${product.name}" adicionado ao orçamento`);
    }
  }, [networkAvgMonthlyCustomers]);

  const addTelasDual = useCallback((itemId: string, baseItemPatch: Partial<BudgetItemState>) => {
    setItems((prev) => {
      const idx = prev.findIndex((item) => item.id === itemId);
      if (idx === -1) return prev;
      const defaultMC = prev[idx].monthlyCustomers ?? networkAvgMonthlyCustomers;
      const item30: BudgetItemState = { ...prev[idx], ...baseItemPatch, id: makeItemId(), productName: `${baseItemPatch.productName ?? prev[idx].productName} — Spot 30s`, spotSeconds: 30, monthlyCustomers: defaultMC };
      const item15: BudgetItemState = { ...prev[idx], ...baseItemPatch, id: makeItemId(), productName: `${baseItemPatch.productName ?? prev[idx].productName} — Spot 15s`, spotSeconds: 15, monthlyCustomers: defaultMC };
      const next = [...prev];
      next.splice(idx, 1, item30, item15);
      toast.success(`"${baseItemPatch.productName}" adicionado como Spot 30s e Spot 15s`);
      return next;
    });
  }, [networkAvgMonthlyCustomers]);

  // Count how many times each product is in the items list
  const itemCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const item of items) {
      if (item.productId != null) counts[item.productId] = (counts[item.productId] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  useEffect(() => {
    if (!leadId) return;
    const lead = leadsList.find((l: any) => l.id === leadId);
    if (lead?.partnerId) { setPartnerId(lead.partnerId); setDescontoParceiro(true); }
  }, [leadId, leadsList]);

  const clearAll = useCallback(() => {
    setClientId(null); setLeadId(null); setIsBonificada(false);
    setDescontoParceiro(false); setPartnerId(null); setDescontoManual(0);
    setAgencyCommissionPercent(""); setFormaPagamento("boleto"); setNotes(""); setItems([]);
  }, []);

  const itemCalcs = useMemo(() => {
    return items
      .filter((item) => item.productId !== null && !item.isCustomProduct)
      .flatMap((item) => {
        const input = getItemPricingInput(item);
        if (!input || input.volume <= 0) return [];
        const calc = calcItemPrice(input);
        return [{ item, input, calc }];
      });
  }, [items]);

  const agencyBVWeightedIrpj = useMemo(() => {
    const valid = itemCalcs.filter(c => c.calc.precoComDescDuracao > 0);
    const totalPrice = valid.reduce((s, c) => s + c.calc.precoComDescDuracao, 0);
    if (totalPrice <= 0) return DEFAULT_PREMISSAS.irpj / 100;
    return valid.reduce((s, c) => s + c.calc.precoComDescDuracao * (c.item.premissas.irpj / 100), 0) / totalPrice;
  }, [itemCalcs]);

  const globalParams: GlobalBudgetParams = useMemo(() => ({
    formaPagamento, descontoParceiro, isBonificada,
    descontoManualPercent: descontoManual, agencyBVPercent, agencyBVWeightedIrpj,
  }), [formaPagamento, descontoParceiro, isBonificada, descontoManual, agencyBVPercent, agencyBVWeightedIrpj]);

  const customItems = useMemo(() => items.filter((item) => item.isCustomProduct && item.customValues), [items]);
  const totals = useMemo(() => {
    const calcsForTotals = itemCalcs.map(({ item, calc }) => {
      if (item.isBonificada) return { ...calc, precoComDescDuracao: 0, precoSemDesconto: 0, descPrazoVal: 0, descFaixaPrecoVal: 0, descPrazoPerc: 0, descFaixaPrecoPerc: 0 } as ItemCalcResult;
      return calc as ItemCalcResult;
    });
    return calcBudgetTotals(calcsForTotals, globalParams);
  }, [itemCalcs, globalParams]);

  const customTotalValue = useMemo(() => customItems.reduce((sum, item) => sum + (item.customValues?.calculatedFinalPrice ?? 0), 0), [customItems]);

  const handleGerarCotacao = useCallback(async () => {
    if (!clientId && !leadId) { toast.error("Selecione um cliente ou lead antes de gerar a cotação"); return; }
    const hasCustom = customItems.length > 0;
    const hasRegular = itemCalcs.length > 0;
    if (!hasCustom && !hasRegular) { toast.error("Adicione pelo menos um produto com volume definido"); return; }
    if (hasCustom && hasRegular) { toast.error("Não é possível combinar produto personalizado com produtos do catálogo na mesma cotação. Crie cotações separadas."); return; }
    if (customItems.length > 1) { toast.error("Apenas um produto personalizado por cotação é permitido."); return; }

    setIsGenerating(true);
    try {
      if (hasCustom) {
        const cv = customItems[0].customValues!;
        const quotation = await createQuotation.mutateAsync({
          clientId: clientId ?? undefined, leadId: leadId ?? undefined,
          coasterVolume: 0, totalValue: isBonificada ? "0" : cv.calculatedFinalPrice.toFixed(2),
          notes: notes || undefined, isBonificada, hasPartnerDiscount: descontoParceiro,
          partnerId: (descontoParceiro || agencyBVPercent > 0) ? partnerId : null,
          isCustomProduct: true, customProductName: cv.customProductName,
          customProjectCost: cv.customProjectCost, customPricingMode: cv.customPricingMode,
          customMarginPercent: cv.customPricingMode === "margin" ? cv.customMarginPercent : undefined,
          customFinalPrice: cv.customPricingMode === "fixed_price" ? cv.customFinalPrice : undefined,
          customRestaurantCommission: cv.customRestaurantCommission,
          customPartnerCommission: cv.customPartnerCommission,
          customSellerCommission: cv.customSellerCommission,
          agencyCommissionPercent: agencyCommissionPercent || null,
        });
        toast.success("Cotação gerada com sucesso!");
        navigate(`/comercial/cotacoes/${quotation.id}`);
      } else {
        const totalVolume = itemCalcs.reduce((sum, c) => sum + c.input.volume, 0);
        const firstProductId = itemCalcs[0].item.productId!;
        const regularTotal = isBonificada ? 0 : totals.totalFinal;
        const totalValue = (regularTotal + customTotalValue).toFixed(2);

        const quotation = await createQuotation.mutateAsync({
          clientId: clientId ?? undefined, leadId: leadId ?? undefined,
          coasterVolume: totalVolume,
          manualDiscountPercent: descontoManual > 0 ? String(descontoManual) : undefined,
          cycles: Math.round((itemCalcs[0]?.item.semanas ?? 12) / 4),
          totalValue: isBonificada ? "0" : totalValue,
          notes: notes || undefined, isBonificada, hasPartnerDiscount: descontoParceiro,
          productId: firstProductId,
          partnerId: (descontoParceiro || agencyBVPercent > 0) ? partnerId : null,
          agencyCommissionPercent: agencyCommissionPercent || null,
        });

        const discountRatio = totals.subtotalPostDuration > 0 ? totals.total / totals.subtotalPostDuration : 1;

        for (const { item, input, calc } of itemCalcs) {
          const isItemBonif = isBonificada || !!item.isBonificada;
          const itemTotal = calc.precoComDescDuracao * discountRatio;
          const unitPrice = input.volume > 0 ? itemTotal / input.volume : 0;
          const telasMeta = item.spotSeconds
            ? ` · Spot${item.spotSeconds}s · ${TELAS_INSERCOES[item.spotSeconds]}ins/dia · ${item.monthlyCustomers ?? 0}cli/mês` : "";
          await addItem.mutateAsync({
            quotationId: quotation.id, productId: item.productId!,
            quantity: input.volume, unitPrice: unitPrice.toFixed(4),
            notes: `${item.productName} · ${item.semanas}sem${telasMeta}`,
            bonificada: isItemBonif,
          });
        }
        toast.success("Cotação gerada com sucesso!");
        navigate(`/comercial/cotacoes/${quotation.id}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar cotação");
    } finally {
      setIsGenerating(false);
    }
  }, [clientId, leadId, itemCalcs, customItems, customTotalValue, totals, descontoManual, notes, isBonificada, descontoParceiro, partnerId, createQuotation, addItem, navigate, agencyBVPercent, agencyCommissionPercent]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border/30 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Novo Orçamento</h1>
          <p className="text-xs text-muted-foreground">Montagem multiproduto com cálculo automático de preços</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>

      {/* ── Body: 3 colunas ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Coluna Esquerda — Configurações ── */}
        <div className="w-64 xl:w-72 flex-shrink-0 overflow-y-auto border-r border-border/20 bg-muted/10">
          <div className="p-4 space-y-5">

            {/* ── Cliente / Lead ── */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cliente</h2>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Anunciante</Label>
                  <Select value={clientId ? String(clientId) : ""} onValueChange={(v) => { setClientId(Number(v)); setLeadId(null); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                    <SelectContent>
                      {clientsList.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.company || c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {!clientId && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Lead</Label>
                    <Select value={leadId ? String(leadId) : ""} onValueChange={(v) => { setLeadId(Number(v)); setClientId(null); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar lead..." /></SelectTrigger>
                      <SelectContent>
                        {leadsList.map((l: any) => (<SelectItem key={l.id} value={String(l.id)}>{l.company || l.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {selectedClient && <ClientQualificationCard client={selectedClient} />}
            </section>

            <Separator />

            {/* ── Parâmetros ── */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Parâmetros</h2>
              <div className="space-y-2.5">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Forma de pagamento</Label>
                  <ToggleGroup type="single" value={formaPagamento} onValueChange={(v) => { if (v) setFormaPagamento(v as typeof formaPagamento); }} className="justify-start gap-1">
                    <ToggleGroupItem value="pix" className="h-7 text-[11px] px-2.5 flex-1">Pix −5%</ToggleGroupItem>
                    <ToggleGroupItem value="boleto" className="h-7 text-[11px] px-2.5 flex-1">Boleto</ToggleGroupItem>
                    <ToggleGroupItem value="cartao" className="h-7 text-[11px] px-2.5 flex-1">Cartão</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Desc. manual (%)</Label>
                    <Input type="number" min={0} max={20} step={0.5} value={descontoManual || ""} onChange={(e) => setDescontoManual(Math.min(20, Math.max(0, parseFloat(e.target.value) || 0)))} className="h-8 text-xs" placeholder="0" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Comissão de Agência — BV (%)</Label>
                    <Input type="number" min={0} max={99.9} step={0.5} value={agencyCommissionPercent} onChange={(e) => setAgencyCommissionPercent(e.target.value)} className="h-8 text-xs" placeholder="20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bonificada" className="text-xs cursor-pointer text-amber-600 dark:text-amber-400">Bonificada</Label>
                    <Switch id="bonificada" checked={isBonificada} onCheckedChange={setIsBonificada} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="desc-parceiro" className="text-xs cursor-pointer text-green-600 dark:text-green-400">Desc. Parceiro (−10%)</Label>
                    <Switch id="desc-parceiro" checked={descontoParceiro} onCheckedChange={setDescontoParceiro} />
                  </div>
                </div>
                {(descontoParceiro || agencyBVPercent > 0) && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Parceiro / Agência</Label>
                    <Select value={partnerId ? String(partnerId) : ""} onValueChange={(v) => setPartnerId(Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar parceiro..." /></SelectTrigger>
                      <SelectContent>
                        {(partnersList as any[]).map((p: any) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* ── Observações ── */}
            <section className="space-y-2">
              <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Observações</h2>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações adicionais para o cliente..." className="text-xs min-h-[72px] resize-none" />
            </section>
          </div>
        </div>

        {/* ── Coluna Central — Catálogo + Itens ── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Product catalog */}
            <ProductCatalogSection
              products={productsList}
              itemCounts={itemCounts}
              onAdd={addFromCatalog}
              onAddCustom={() => setCustomDialogOpen(true)}
            />

            {/* Items list */}
            {items.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Itens do Orçamento</h2>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
                </div>
                {items.map((item, idx) => (
                  <BudgetItemCard
                    key={item.id}
                    item={item}
                    globalParams={globalParams}
                    onUpdate={updateItem}
                    onRemove={removeItem}
                    onAddTelasDual={addTelasDual}
                    index={idx}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 opacity-20" />
                <p className="text-sm">Selecione produtos no catálogo acima para começar</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Coluna Direita — Resumo ── */}
        <div className="w-72 xl:w-80 flex-shrink-0 overflow-y-auto border-l border-border/20 p-5">
          <BudgetSummaryPanel
            items={items}
            globalParams={globalParams}
            clientName={clientName}
            hasPartner={!!partnerId}
            onGerarCotacao={handleGerarCotacao}
            isGenerating={isGenerating}
          />
        </div>
      </div>

      {/* Global custom product dialog (from catalog) */}
      <CustomProductDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        onConfirm={(values) => {
          const newItem: BudgetItemState = {
            id: makeItemId(),
            productId: null,
            productName: values.customProductName,
            pricingMode: "cost_based",
            entryType: "tiers",
            tiers: [],
            hasTiers: false,
            volumeIdx: 0,
            freeVolume: 100,
            freeManualCost: 0,
            semanas: 12,
            premissas: { ...DEFAULT_PREMISSAS },
            isCustomProduct: true,
            customValues: values,
          };
          setItems((prev) => [...prev, newItem]);
          setCustomDialogOpen(false);
          toast.success(`"${values.customProductName}" adicionado ao orçamento`);
        }}
      />
    </div>
  );
}
