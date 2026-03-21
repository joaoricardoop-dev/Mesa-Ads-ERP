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
import { Trash2, Plus, Calculator, RotateCcw, ExternalLink, Building2, Mail, Phone, MapPin, Tag } from "lucide-react";
import { toast } from "sonner";
import { BudgetPricingDialog, type PricingDialogImportResult } from "../components/BudgetPricingDialog";
import { CoasterPricingDialog } from "../components/CoasterPricingDialog";
import {
  calcItemPrice,
  calcBudgetTotals,
  fmtBRL,
  fmtBRL4,
  DEFAULT_PREMISSAS,
  type GlobalBudgetParams,
  type ItemPricingInput,
  type ItemCalcResult,
  type ItemPremissas,
} from "../hooks/useBudgetCalculator";

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
  pricingMode: "cost_based" | "price_based";
  entryType: "tiers" | "fixed_quantities";
  tiers: BudgetPricingTier[];
  hasTiers: boolean;
  volumeIdx: number;
  freeVolume: number;
  freeManualCost: number;
  semanas: number;
  premissas: ItemPremissas;
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
    client.cep,
  ].filter(Boolean);

  return (
    <Card className="border border-border/40 bg-muted/20">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold leading-tight">{client.company || client.name}</p>
            {client.razaoSocial && client.razaoSocial !== client.company && (
              <p className="text-xs text-muted-foreground">{client.razaoSocial}</p>
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {client.cnpj && (
            <div className="flex items-center gap-1 col-span-2">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="font-mono">{client.cnpj}</span>
            </div>
          )}
          {client.contactEmail && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{client.contactEmail}</span>
            </div>
          )}
          {client.contactPhone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{client.contactPhone}</span>
            </div>
          )}
          {addressParts.length > 0 && (
            <div className="flex items-start gap-1 col-span-2">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
              <span>{addressParts.join(" · ")}</span>
            </div>
          )}
          {client.instagram && (
            <div className="flex items-center gap-1">
              <Tag className="h-3 w-3 shrink-0" />
              <span>{client.instagram}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── BudgetItemCard ───────────────────────────────────────────────────────────

interface BudgetItemCardProps {
  item: BudgetItemState;
  productsList: { id: number; name: string; tipo?: string | null; pricingMode?: string | null; entryType?: string | null; defaultSemanas?: number | null }[];
  globalParams: GlobalBudgetParams;
  onUpdate: (id: string, patch: Partial<BudgetItemState>) => void;
  onRemove: (id: string) => void;
  index: number;
}

function BudgetItemCard({ item, productsList, globalParams, onUpdate, onRemove, index }: BudgetItemCardProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const [pricingOpen, setPricingOpen] = useState(false);

  const selectedProduct = productsList.find((p) => p.id === item.productId);
  const isCoaster = selectedProduct?.tipo === "coaster";
  const isPriceBased = item.pricingMode === "price_based";
  const isFixedQty = item.entryType === "fixed_quantities";

  const { data: tiersRaw, isLoading: tiersLoading } = trpc.product.getTiers.useQuery(
    { productId: item.productId! },
    { enabled: item.productId !== null }
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

  const pricingInput = getItemPricingInput(item);
  const calc = pricingInput ? calcItemPrice(pricingInput) : null;

  const tierLabel = (tier: BudgetPricingTier) => {
    if (isFixedQty) {
      return `${tier.volumeMin.toLocaleString("pt-BR")} un.`;
    }
    if (tier.volumeMax && tier.volumeMax !== tier.volumeMin) {
      return `${tier.volumeMin.toLocaleString("pt-BR")} – ${tier.volumeMax.toLocaleString("pt-BR")} un.`;
    }
    return `${tier.volumeMin.toLocaleString("pt-BR")}+ un.`;
  };

  const handlePricingImport = useCallback((result: PricingDialogImportResult) => {
    const patch: Partial<BudgetItemState> = {
      semanas: result.semanas,
      premissas: result.premissas,
    };
    if (result.volumeIdx !== undefined) patch.volumeIdx = result.volumeIdx;
    if (result.freeVolume !== undefined) patch.freeVolume = result.freeVolume;
    if (result.freeManualCost !== undefined) patch.freeManualCost = result.freeManualCost;
    onUpdate(item.id, patch);
  }, [onUpdate, item.id]);

  const isBonificada = globalParams.isBonificada;

  return (
    <>
      <Card className="border border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Produto {index + 1}
            </span>
            <div className="flex items-center gap-1">
              {item.productId && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                  {item.semanas}sem · {(item.semanas / 4).toFixed(0)}p
                </Badge>
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

          <div>
            <Select
              value={item.productId ? String(item.productId) : ""}
              onValueChange={(v) => {
                const pid = Number(v);
                const prod = productsList.find((p) => p.id === pid);
                onUpdate(item.id, {
                  productId: pid,
                  productName: prod?.name ?? "",
                  pricingMode: (prod?.pricingMode as "cost_based" | "price_based") ?? "cost_based",
                  entryType: (prod?.entryType as "tiers" | "fixed_quantities") ?? "tiers",
                  tiers: [],
                  hasTiers: false,
                  volumeIdx: 0,
                  semanas: prod?.defaultSemanas ?? 12,
                });
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecionar produto..." />
              </SelectTrigger>
              <SelectContent>
                {productsList.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {item.productId && tiersLoading && (
            <p className="text-xs text-muted-foreground animate-pulse">Carregando entradas de preço...</p>
          )}

          {item.productId && !tiersLoading && item.hasTiers && item.tiers.length > 0 && (
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
                      {tierLabel(tier)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {item.productId && !tiersLoading && !item.hasTiers && !isPriceBased && (
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

          {/* Pricing result strip */}
          {calc && pricingInput && (
            <div className="bg-muted/40 rounded-md p-3 space-y-1.5 text-xs border border-border/30">
              {isPriceBased ? (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-muted-foreground">Quantidade</span>
                    <span className="text-right font-medium">{pricingInput.volume.toLocaleString("pt-BR")} un.</span>
                    <span className="text-muted-foreground">Preço Base (4sem)</span>
                    <span className="text-right font-mono font-semibold text-primary">{fmtBRL(pricingInput.precoBase ?? 0)}</span>
                    {calc.receitaLiquidaGPC !== undefined && (
                      <>
                        <span className="text-muted-foreground">Rec. Líquida GPC</span>
                        <span className="text-right font-mono text-emerald-600 dark:text-emerald-400">{fmtBRL(calc.receitaLiquidaGPC)}</span>
                      </>
                    )}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Total {item.semanas}sem</span>
                    <span className={isBonificada ? "line-through text-muted-foreground" : ""}>
                      {fmtBRL(calc.precoComDescDuracao)}
                    </span>
                  </div>
                  {calc.descPrazoPerc > 0 && !isBonificada && (
                    <div className="flex justify-between text-[10px] text-amber-600 dark:text-amber-400">
                      <span>Desc. prazo incluso ({(calc.descPrazoPerc * 100).toFixed(0)}%)</span>
                      <span>−{fmtBRL(calc.descPrazoVal)}</span>
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
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">Total {item.semanas}sem</span>
                    <span className={isBonificada ? "line-through text-muted-foreground" : ""}>
                      {fmtBRL(calc.precoComDescDuracao)}
                    </span>
                  </div>
                  {calc.descPrazoPerc > 0 && !isBonificada && (
                    <div className="flex justify-between text-[10px] text-amber-600 dark:text-amber-400">
                      <span>Desc. prazo incluso ({(calc.descPrazoPerc * 100).toFixed(0)}%)</span>
                      <span>−{fmtBRL(calc.descPrazoVal)}</span>
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

          {/* Abrir Precificador button — only for cost_based products */}
          {item.productId && !tiersLoading && !isPriceBased && (
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
        </CardContent>
      </Card>

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
  onGerarCotacao: () => void;
  isGenerating: boolean;
}

function BudgetSummaryPanel({ items, globalParams, clientName, onGerarCotacao, isGenerating }: BudgetSummaryPanelProps) {
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

  const totals = useMemo(
    () => calcBudgetTotals(itemCalcs.map((c) => c.calc) as ItemCalcResult[], globalParams),
    [itemCalcs, globalParams]
  );

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
                {itemCalcs.map(({ item, input, calc }) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight truncate">{item.productName}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {input.volume.toLocaleString("pt-BR")} un. · {item.semanas}sem
                        {calc.descPrazoPerc > 0 ? ` · −${(calc.descPrazoPerc * 100).toFixed(0)}%` : ""}
                      </p>
                    </div>
                    <span className={`text-right shrink-0 font-mono font-medium ${globalParams.isBonificada ? "line-through text-muted-foreground" : ""}`}>
                      {fmtBRL(calc.precoComDescDuracao)}
                    </span>
                  </div>
                ))}
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
              </div>

              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="font-mono">
                  {globalParams.isBonificada ? "R$ 0,00" : fmtBRL(totals.total)}
                </span>
              </div>
              {globalParams.isBonificada && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Campanha bonificada</p>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs">
              Adicione produtos para ver o resumo
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        className="w-full"
        disabled={!hasItems || isGenerating}
        onClick={onGerarCotacao}
        size="lg"
      >
        <Calculator className="h-4 w-4 mr-2" />
        {isGenerating ? "Gerando cotação..." : "Gerar Cotação"}
      </Button>
      {hasItems && (
        <p className="text-[11px] text-muted-foreground text-center leading-tight">
          Cria cotação com {itemCalcs.length} {itemCalcs.length === 1 ? "produto" : "produtos"} e preços calculados
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
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | "cartao">("boleto");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BudgetItemState[]>(() => [makeBlankItem()]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: clientsRaw = [] } = trpc.advertiser.list.useQuery();
  const clientsList = useMemo(() => clientsRaw as ClientInfo[], [clientsRaw]);

  const { data: leadsRaw } = trpc.lead.list.useQuery({ type: "anunciante" });
  const leadsList = useMemo(() => (leadsRaw as any[]) ?? [], [leadsRaw]);

  const { data: productsRaw } = trpc.product.list.useQuery();
  const productsList = useMemo(() => (productsRaw ?? []) as { id: number; name: string; defaultSemanas?: number | null; tipo?: string | null; pricingMode?: string | null; entryType?: string | null }[], [productsRaw]);

  const { data: partnersList = [] } = trpc.partner.list.useQuery();

  const createQuotation = trpc.quotation.create.useMutation();
  const addItem = trpc.quotation.addItem.useMutation();

  const globalParams: GlobalBudgetParams = useMemo(() => ({
    formaPagamento,
    descontoParceiro,
    isBonificada,
    descontoManualPercent: descontoManual,
  }), [formaPagamento, descontoParceiro, isBonificada, descontoManual]);

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
      const next = prev.filter((item) => item.id !== id);
      return next.length === 0 ? [makeBlankItem()] : next;
    });
  }, []);

  const addNewItem = useCallback(() => {
    setItems((prev) => [...prev, makeBlankItem()]);
  }, []);

  useEffect(() => {
    if (!leadId) return;
    const lead = leadsList.find((l: any) => l.id === leadId);
    if (lead?.partnerId) {
      setPartnerId(lead.partnerId);
      setDescontoParceiro(true);
    }
  }, [leadId, leadsList]);

  const clearAll = useCallback(() => {
    setClientId(null);
    setLeadId(null);
    setIsBonificada(false);
    setDescontoParceiro(false);
    setPartnerId(null);
    setDescontoManual(0);
    setFormaPagamento("boleto");
    setNotes("");
    setItems([makeBlankItem()]);
  }, []);

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

  const totals = useMemo(
    () => calcBudgetTotals(itemCalcs.map((c) => c.calc) as ItemCalcResult[], globalParams),
    [itemCalcs, globalParams]
  );

  const handleGerarCotacao = useCallback(async () => {
    if (!clientId && !leadId) {
      toast.error("Selecione um cliente ou lead antes de gerar a cotação");
      return;
    }
    if (itemCalcs.length === 0) {
      toast.error("Adicione pelo menos um produto com volume definido");
      return;
    }

    setIsGenerating(true);
    try {
      const totalVolume = itemCalcs.reduce((sum, c) => sum + c.input.volume, 0);
      const firstProductId = itemCalcs[0].item.productId!;
      const totalValue = isBonificada ? "0" : totals.total.toFixed(2);

      const quotation = await createQuotation.mutateAsync({
        clientId: clientId ?? undefined,
        leadId: leadId ?? undefined,
        coasterVolume: totalVolume,
        manualDiscountPercent: descontoManual > 0 ? String(descontoManual) : undefined,
        cycles: Math.round((itemCalcs[0]?.item.semanas ?? 12) / 4),
        totalValue,
        notes: notes || undefined,
        isBonificada,
        hasPartnerDiscount: descontoParceiro,
        productId: firstProductId,
        partnerId: descontoParceiro ? partnerId : null,
      });

      // discountRatio applies the global payment + partner discounts to each item proportionally
      const discountRatio = totals.subtotalPostDuration > 0 ? totals.total / totals.subtotalPostDuration : 1;

      for (const { item, input, calc } of itemCalcs) {
        let unitPriceFinal: string;
        if (isBonificada) {
          unitPriceFinal = "0";
        } else {
          // Full per-unit price: total for this item (with duration discount) × global ratio ÷ volume
          const itemTotal = calc.precoComDescDuracao * discountRatio;
          const unitPrice = input.volume > 0 ? itemTotal / input.volume : 0;
          unitPriceFinal = unitPrice.toFixed(4);
        }

        await addItem.mutateAsync({
          quotationId: quotation.id,
          productId: item.productId!,
          quantity: input.volume,
          unitPrice: unitPriceFinal,
          notes: `${item.productName} · ${item.semanas}sem`,
        });
      }

      toast.success("Cotação gerada com sucesso!");
      navigate(`/comercial/cotacoes/${quotation.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar cotação");
    } finally {
      setIsGenerating(false);
    }
  }, [clientId, leadId, itemCalcs, totals, descontoManual, notes, isBonificada, descontoParceiro, partnerId, createQuotation, addItem, navigate]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold">Novo Orçamento</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Montagem multiproduto com cálculo automático de preços</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>

      {/* ── Body: 2 colunas ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Coluna Esquerda (rolável) ── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5 border-r border-border/20">

          {/* ── Dados do Cliente ── */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados do Cliente</h2>
            <Card className="border border-border/40">
              <CardContent className="p-4 space-y-3">

                {/* Cliente / Lead */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Cliente (anunciante)</Label>
                    <Select
                      value={clientId ? String(clientId) : ""}
                      onValueChange={(v) => { setClientId(Number(v)); setLeadId(null); }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsList.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.company || c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Lead</Label>
                    <Select
                      value={leadId ? String(leadId) : ""}
                      onValueChange={(v) => { setLeadId(Number(v)); setClientId(null); }}
                      disabled={!!clientId}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={clientId ? "—" : "Selecionar lead..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {leadsList.map((l: any) => (
                          <SelectItem key={l.id} value={String(l.id)}>
                            {l.company || l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Qualificação do cliente */}
                {selectedClient && (
                  <ClientQualificationCard client={selectedClient} />
                )}

                {/* Configurações da proposta */}
                <div className="pt-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Desconto manual (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={descontoManual || ""}
                    onChange={(e) => setDescontoManual(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="h-9 text-sm"
                    placeholder="0"
                  />
                </div>

                {/* Switches */}
                <div className="flex items-center gap-6 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch id="bonificada" checked={isBonificada} onCheckedChange={setIsBonificada} />
                    <Label htmlFor="bonificada" className="text-sm cursor-pointer text-amber-600 dark:text-amber-400">
                      Bonificada
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="desc-parceiro" checked={descontoParceiro} onCheckedChange={setDescontoParceiro} />
                    <Label htmlFor="desc-parceiro" className="text-sm cursor-pointer text-green-600 dark:text-green-400">
                      Desc. Parceiro (−10%)
                    </Label>
                  </div>
                </div>

                {descontoParceiro && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Parceiro</Label>
                    <Select
                      value={partnerId ? String(partnerId) : ""}
                      onValueChange={(v) => setPartnerId(Number(v))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar parceiro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(partnersList as any[]).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* ── Parâmetros de Preço (globais) ── */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Parâmetros Globais
            </h2>
            <Card className="border border-border/40">
              <CardContent className="p-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Forma de pagamento</Label>
                  <ToggleGroup
                    type="single"
                    value={formaPagamento}
                    onValueChange={(v) => { if (v) setFormaPagamento(v as typeof formaPagamento); }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="pix" className="h-9 text-xs px-4">Pix (−5%)</ToggleGroupItem>
                    <ToggleGroupItem value="boleto" className="h-9 text-xs px-4">Boleto</ToggleGroupItem>
                    <ToggleGroupItem value="cartao" className="h-9 text-xs px-4">Cartão</ToggleGroupItem>
                  </ToggleGroup>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Duração e premissas são configuradas individualmente por produto no Precificador.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── Itens do Orçamento ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Itens do Orçamento
                {items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{items.length}</Badge>
                )}
              </h2>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <BudgetItemCard
                  key={item.id}
                  item={item}
                  productsList={productsList}
                  globalParams={globalParams}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  index={idx}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addNewItem}
                className="w-full border-dashed gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Produto
              </Button>
            </div>
          </section>

          {/* ── Observações ── */}
          <section>
            <Label className="text-xs text-muted-foreground mb-2 block">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais para o cliente..."
              className="text-sm min-h-[80px] resize-none"
            />
          </section>
        </div>

        {/* ── Coluna Direita (painel de resumo) ── */}
        <div className="w-80 xl:w-96 flex-shrink-0 overflow-y-auto p-6">
          <BudgetSummaryPanel
            items={items}
            globalParams={globalParams}
            clientName={clientName}
            onGerarCotacao={handleGerarCotacao}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
