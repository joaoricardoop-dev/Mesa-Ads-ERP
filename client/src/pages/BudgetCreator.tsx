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
import { Trash2, Plus, Calculator } from "lucide-react";
import { toast } from "sonner";
import {
  SEMANAS_OPTIONS,
  DESCONTOS_PRAZO,
  calcItemPrice,
  calcBudgetTotals,
  fmtBRL,
  fmtBRL4,
  type GlobalBudgetParams,
  type ItemPricingInput,
  type ItemCalcResult,
} from "../hooks/useBudgetCalculator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricingTier {
  id: number;
  productId: number;
  volumeMin: number;
  volumeMax: number | null;
  custoUnitario: string;
  frete: string;
  margem: string;
  artes: number | null;
}

interface BudgetItemState {
  id: string;
  productId: number | null;
  productName: string;
  tiers: PricingTier[];
  hasTiers: boolean;
  volumeIdx: number;
  freeVolume: number;
  freeManualCost: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItemId() {
  return Math.random().toString(36).slice(2);
}

function makeBlankItem(): BudgetItemState {
  return {
    id: makeItemId(),
    productId: null,
    productName: "",
    tiers: [],
    hasTiers: false,
    volumeIdx: 0,
    freeVolume: 100,
    freeManualCost: 0,
  };
}

function getItemPricingInput(item: BudgetItemState): ItemPricingInput | null {
  if (!item.productId) return null;
  if (item.hasTiers) {
    const tier = item.tiers[item.volumeIdx];
    if (!tier) return null;
    return {
      volume: tier.volumeMin,
      custoUnitario: parseFloat(tier.custoUnitario),
      frete: parseFloat(tier.frete),
      margem: parseFloat(tier.margem) / 100,
      artes: tier.artes ?? 1,
    };
  }
  return {
    volume: item.freeVolume,
    custoUnitario: item.freeManualCost,
    frete: 0,
    margem: 0.5,
    artes: 1,
  };
}

// ─── BudgetItemCard ───────────────────────────────────────────────────────────

interface BudgetItemCardProps {
  item: BudgetItemState;
  productsList: { id: number; name: string }[];
  params: GlobalBudgetParams;
  onUpdate: (id: string, patch: Partial<BudgetItemState>) => void;
  onRemove: (id: string) => void;
  index: number;
}

function BudgetItemCard({ item, productsList, params, onUpdate, onRemove, index }: BudgetItemCardProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const { data: tiersRaw, isLoading: tiersLoading } = trpc.product.getTiers.useQuery(
    { productId: item.productId! },
    { enabled: item.productId !== null }
  );

  useEffect(() => {
    if (tiersRaw !== undefined && item.productId !== null) {
      onUpdateRef.current(item.id, {
        tiers: tiersRaw as PricingTier[],
        hasTiers: tiersRaw.length > 0,
        volumeIdx: 0,
      });
    }
  }, [tiersRaw, item.id, item.productId]);

  const pricingInput = getItemPricingInput(item);
  const calc = pricingInput ? calcItemPrice(pricingInput, params) : null;

  const isBonificada = params.isBonificada;

  const tierLabel = (tier: PricingTier) => {
    const max = tier.volumeMax ? `–${tier.volumeMax.toLocaleString("pt-BR")}` : "+";
    return `${tier.volumeMin.toLocaleString("pt-BR")}${max}`;
  };

  return (
    <Card className="border border-neutral-700 bg-neutral-800/50">
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-neutral-300">
          Item {index + 1}
          {item.productName && (
            <span className="ml-2 text-neutral-400 font-normal">— {item.productName}</span>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-neutral-500 hover:text-red-400"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <Label className="text-xs text-neutral-400 mb-1 block">Produto</Label>
          <Select
            value={item.productId ? String(item.productId) : ""}
            onValueChange={(v) => {
              const pid = Number(v);
              const prod = productsList.find((p) => p.id === pid);
              onUpdate(item.id, {
                productId: pid,
                productName: prod?.name ?? "",
                tiers: [],
                hasTiers: false,
                volumeIdx: 0,
              });
            }}
          >
            <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
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
          <p className="text-xs text-neutral-500">Carregando faixas...</p>
        )}

        {item.productId && !tiersLoading && item.hasTiers && item.tiers.length > 0 && (
          <div>
            <Label className="text-xs text-neutral-400 mb-1 block">Volume</Label>
            <Select
              value={String(item.volumeIdx)}
              onValueChange={(v) => onUpdate(item.id, { volumeIdx: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {item.tiers.map((tier, idx) => (
                  <SelectItem key={tier.id} value={String(idx)}>
                    {tierLabel(tier)} unid.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {item.productId && !tiersLoading && !item.hasTiers && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-neutral-400 mb-1 block">Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={item.freeVolume || ""}
                onChange={(e) => onUpdate(item.id, { freeVolume: parseInt(e.target.value) || 1 })}
                className="h-8 text-sm bg-neutral-900 border-neutral-600"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400 mb-1 block">Custo unit. (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={item.freeManualCost || ""}
                onChange={(e) => onUpdate(item.id, { freeManualCost: parseFloat(e.target.value) || 0 })}
                className="h-8 text-sm bg-neutral-900 border-neutral-600"
              />
            </div>
          </div>
        )}

        {calc && pricingInput && (
          <div className="bg-neutral-900/60 rounded-md p-3 space-y-1 text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-neutral-400">
              <span>Volume</span>
              <span className="text-right text-neutral-200">
                {pricingInput.volume.toLocaleString("pt-BR")} un.
              </span>
              <span>Custo/un.</span>
              <span className="text-right text-neutral-200">{fmtBRL4(pricingInput.custoUnitario)}</span>
              {pricingInput.frete > 0 && (
                <>
                  <span>Frete total</span>
                  <span className="text-right text-neutral-200">{fmtBRL(pricingInput.frete)}</span>
                </>
              )}
              <span>Preço unit. base</span>
              <span className="text-right font-medium text-blue-300">
                {fmtBRL4(calc.precoUnit4sem)}
              </span>
            </div>
            <Separator className="my-1.5 bg-neutral-700" />
            <div className="flex justify-between font-medium text-neutral-200">
              <span>Subtotal ({params.semanas}sem)</span>
              <span className={isBonificada ? "line-through text-neutral-500" : ""}>
                {fmtBRL(calc.precoSemDesconto)}
              </span>
            </div>
            {isBonificada && <div className="text-right text-green-400 font-semibold text-[11px]">Bonificada — R$ 0,00</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── BudgetSummaryPanel ───────────────────────────────────────────────────────

interface BudgetSummaryPanelProps {
  items: BudgetItemState[];
  params: GlobalBudgetParams;
  clientName: string;
  onGerarCotacao: () => void;
  isGenerating: boolean;
}

function BudgetSummaryPanel({ items, params, clientName, onGerarCotacao, isGenerating }: BudgetSummaryPanelProps) {
  const itemCalcs: (ItemCalcResult & { item: BudgetItemState; input: ItemPricingInput })[] = useMemo(() => {
    return items
      .filter((item) => item.productId !== null)
      .flatMap((item) => {
        const input = getItemPricingInput(item);
        if (!input || input.volume <= 0) return [];
        const calc = calcItemPrice(input, params);
        return [{ ...calc, item, input }];
      });
  }, [items, params]);

  const totals = useMemo(
    () => calcBudgetTotals(itemCalcs as ItemCalcResult[], params),
    [itemCalcs, params]
  );

  const hasItems = itemCalcs.length > 0;

  return (
    <div className="space-y-4">
      <Card className="border border-neutral-700 bg-neutral-800/50 sticky top-4">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-neutral-200">Resumo do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3 text-sm">
          {clientName && (
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Cliente</span>
              <span className="text-neutral-200 font-medium">{clientName}</span>
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Duração</span>
            <span className="text-neutral-200">{params.semanas} semanas ({totals.nPeriodos} períodos)</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-neutral-400">Pagamento</span>
            <span className="text-neutral-200">
              {params.formaPagamento === "pix" ? "Pix (−5%)" : params.formaPagamento === "boleto" ? "Boleto" : "Cartão"}
            </span>
          </div>

          {hasItems && (
            <>
              <Separator className="bg-neutral-700" />
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Itens</p>
                {itemCalcs.map(({ item, input, precoSemDesconto }) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <p className="text-neutral-200 font-medium leading-tight">{item.productName}</p>
                      <p className="text-neutral-500 text-[11px]">
                        {input.volume.toLocaleString("pt-BR")} × {fmtBRL4(input.volume > 0 ? (precoSemDesconto / (input.volume * totals.nPeriodos)) : 0)}
                      </p>
                    </div>
                    <span className={`text-right shrink-0 ${params.isBonificada ? "line-through text-neutral-500" : "text-neutral-300"}`}>
                      {fmtBRL(precoSemDesconto)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="bg-neutral-700" />
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span>{fmtBRL(totals.subtotal)}</span>
                </div>
                {totals.descPrazoVal > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Desc. prazo ({DESCONTOS_PRAZO[params.semanas] ?? 0}%)</span>
                    <span>−{fmtBRL(totals.descPrazoVal)}</span>
                  </div>
                )}
                {totals.ajPagamentoVal !== 0 && (
                  <div className="flex justify-between text-blue-400">
                    <span>Aj. pagamento (Pix −5%)</span>
                    <span>{fmtBRL(totals.ajPagamentoVal)}</span>
                  </div>
                )}
                {totals.descParceiroVal > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Desc. parceiro (10%)</span>
                    <span>−{fmtBRL(totals.descParceiroVal)}</span>
                  </div>
                )}
              </div>

              <Separator className="bg-neutral-700" />
              <div className="space-y-1">
                <div className="flex justify-between font-bold text-base">
                  <span className="text-neutral-100">Total</span>
                  <span className="text-white">
                    {params.isBonificada ? "R$ 0,00 (Bonificada)" : fmtBRL(totals.total)}
                  </span>
                </div>
                {!params.isBonificada && totals.mensal > 0 && (
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Mensal</span>
                    <span>{fmtBRL(totals.mensal)}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {!hasItems && (
            <div className="py-6 text-center text-neutral-500 text-xs">
              Adicione produtos para ver o resumo
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-neutral-700 bg-neutral-800/50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-neutral-200">Ações</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <Button
            className="w-full"
            disabled={!hasItems || isGenerating}
            onClick={onGerarCotacao}
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isGenerating ? "Gerando..." : "Gerar Cotação"}
          </Button>
          <p className="text-[11px] text-neutral-500 text-center">
            Cria cotação com todos os itens e preços calculados
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── BudgetCreator Page ───────────────────────────────────────────────────────

const DEFAULT_PREMISSAS = { irpj: 6, comissaoRestaurante: 15, comissaoComercial: 10 };

export default function BudgetCreator() {
  const [, navigate] = useLocation();

  const [clientId, setClientId] = useState<number | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [campaignType, setCampaignType] = useState("padrao");
  const [networkProfile, setNetworkProfile] = useState("");
  const [regions, setRegions] = useState("");
  const [cycles, setCycles] = useState(1);
  const [isBonificada, setIsBonificada] = useState(false);
  const [descontoParceiro, setDescontoParceiro] = useState(false);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [semanas, setSemanas] = useState(12);
  const [formaPagamento, setFormaPagamento] = useState<"pix" | "boleto" | "cartao">("boleto");
  const [premissas, setPremissas] = useState(DEFAULT_PREMISSAS);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BudgetItemState[]>([makeBlankItem()]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: leadsRaw } = trpc.lead.list.useQuery({ type: "anunciante" });
  const leadsList = useMemo(() => (leadsRaw as any[]) ?? [], [leadsRaw]);
  const { data: productsRaw } = trpc.product.list.useQuery();
  const productsList = useMemo(() => (productsRaw ?? []) as { id: number; name: string }[], [productsRaw]);
  const { data: partnersList = [] } = trpc.partner.list.useQuery();

  const createQuotation = trpc.quotation.create.useMutation();
  const addItem = trpc.quotation.addItem.useMutation();

  const globalParams: GlobalBudgetParams = useMemo(() => ({
    semanas,
    formaPagamento,
    irpj: premissas.irpj,
    comissaoRestaurante: premissas.comissaoRestaurante,
    comissaoComercial: premissas.comissaoComercial,
    descontoParceiro,
    isBonificada,
  }), [semanas, formaPagamento, premissas, descontoParceiro, isBonificada]);

  const updateItem = useCallback((id: string, patch: Partial<BudgetItemState>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addNewItem = useCallback(() => {
    setItems((prev) => [...prev, makeBlankItem()]);
  }, []);

  const clearAll = useCallback(() => {
    setClientId(null);
    setLeadId(null);
    setIsBonificada(false);
    setDescontoParceiro(false);
    setPartnerId(null);
    setSemanas(12);
    setFormaPagamento("boleto");
    setPremissas(DEFAULT_PREMISSAS);
    setNotes("");
    setItems([makeBlankItem()]);
  }, []);

  const clientName = useMemo(() => {
    if (clientId) {
      const c = (clientsList as any[]).find((c: any) => c.id === clientId);
      return c?.name || c?.company || "";
    }
    if (leadId) {
      const l = leadsList.find((l: any) => l.id === leadId);
      return l?.company || l?.name || "";
    }
    return "";
  }, [clientId, clientsList, leadId, leadsList]);

  const itemCalcs = useMemo(() => {
    return items
      .filter((item) => item.productId !== null)
      .flatMap((item) => {
        const input = getItemPricingInput(item);
        if (!input || input.volume <= 0) return [];
        const calc = calcItemPrice(input, globalParams);
        return [{ item, input, calc }];
      });
  }, [items, globalParams]);

  const totals = useMemo(
    () => calcBudgetTotals(itemCalcs.map((c) => c.calc), globalParams),
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
        campaignType,
        coasterVolume: totalVolume,
        networkProfile: networkProfile || undefined,
        regions: regions || undefined,
        cycles,
        totalValue,
        notes: notes || undefined,
        isBonificada,
        hasPartnerDiscount: descontoParceiro,
        productId: firstProductId,
        partnerId: descontoParceiro ? partnerId : null,
      });

      for (const { item, input, calc } of itemCalcs) {
        const unitPriceFinal = isBonificada
          ? "0"
          : (calc.precoUnit4sem * (totals.total / (totals.subtotal || 1))).toFixed(4);

        await addItem.mutateAsync({
          quotationId: quotation.id,
          productId: item.productId!,
          quantity: input.volume,
          unitPrice: unitPriceFinal,
          notes: item.productName,
        });
      }

      toast.success("Cotação gerada com sucesso!");
      navigate(`/comercial/cotacoes/${quotation.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar cotação");
    } finally {
      setIsGenerating(false);
    }
  }, [clientId, leadId, itemCalcs, totals, campaignType, networkProfile, regions, cycles, notes, isBonificada, descontoParceiro, partnerId, createQuotation, addItem, navigate]);

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Novo Orçamento</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Montagem multiproduto com cálculo automático de preços</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearAll} className="text-neutral-400 border-neutral-700">
          Limpar Tudo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Coluna Esquerda ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Dados do Cliente */}
          <Card className="border border-neutral-700 bg-neutral-800/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-neutral-200">Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Cliente</Label>
                  <Select
                    value={clientId ? String(clientId) : ""}
                    onValueChange={(v) => { setClientId(Number(v)); setLeadId(null); }}
                  >
                    <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
                      <SelectValue placeholder="Selecionar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientsList as any[]).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name || c.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Lead</Label>
                  <Select
                    value={leadId ? String(leadId) : ""}
                    onValueChange={(v) => { setLeadId(Number(v)); setClientId(null); }}
                    disabled={!!clientId}
                  >
                    <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
                      <SelectValue placeholder={clientId ? "(desativado)" : "Selecionar lead..."} />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Tipo de campanha</Label>
                  <Select value={campaignType} onValueChange={setCampaignType}>
                    <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Padrão</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="exclusivo">Exclusivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Perfil de rede</Label>
                  <Input
                    value={networkProfile}
                    onChange={(e) => setNetworkProfile(e.target.value)}
                    className="h-8 text-sm bg-neutral-900 border-neutral-600"
                    placeholder="ex: premium"
                  />
                </div>
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Ciclos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={cycles}
                    onChange={(e) => setCycles(parseInt(e.target.value) || 1)}
                    className="h-8 text-sm bg-neutral-900 border-neutral-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="bonificada"
                    checked={isBonificada}
                    onCheckedChange={setIsBonificada}
                  />
                  <Label htmlFor="bonificada" className="text-sm cursor-pointer text-yellow-400">
                    Bonificada
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="desc-parceiro"
                    checked={descontoParceiro}
                    onCheckedChange={setDescontoParceiro}
                  />
                  <Label htmlFor="desc-parceiro" className="text-sm cursor-pointer text-green-400">
                    Desc. Parceiro (−10%)
                  </Label>
                </div>
              </div>

              {descontoParceiro && (
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Parceiro</Label>
                  <Select
                    value={partnerId ? String(partnerId) : ""}
                    onValueChange={(v) => setPartnerId(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
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

          {/* Parâmetros de Preço */}
          <Card className="border border-neutral-700 bg-neutral-800/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-neutral-200">Parâmetros de Preço</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Duração (semanas)</Label>
                  <Select
                    value={String(semanas)}
                    onValueChange={(v) => setSemanas(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm bg-neutral-900 border-neutral-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEMANAS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s} sem. — {s / 4} {s / 4 === 1 ? "período" : "períodos"}
                          {DESCONTOS_PRAZO[s] ? ` (−${DESCONTOS_PRAZO[s]}%)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-neutral-400 mb-1 block">Forma de pagamento</Label>
                  <ToggleGroup
                    type="single"
                    value={formaPagamento}
                    onValueChange={(v) => { if (v) setFormaPagamento(v as typeof formaPagamento); }}
                    className="justify-start h-8"
                  >
                    <ToggleGroupItem value="pix" className="h-8 text-xs px-3">Pix</ToggleGroupItem>
                    <ToggleGroupItem value="boleto" className="h-8 text-xs px-3">Boleto</ToggleGroupItem>
                    <ToggleGroupItem value="cartao" className="h-8 text-xs px-3">Cartão</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-1.5">Premissas (editáveis)</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "IRPJ %", key: "irpj" as const },
                    { label: "Com. Rest. %", key: "comissaoRestaurante" as const },
                    { label: "Com. Com. %", key: "comissaoComercial" as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <Label className="text-[11px] text-neutral-400 mb-1 block">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={premissas[key]}
                        onChange={(e) =>
                          setPremissas((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))
                        }
                        className="h-8 text-sm bg-neutral-900 border-neutral-600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itens do Orçamento */}
          <Card className="border border-neutral-700 bg-neutral-800/50">
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-neutral-200">
                Itens do Orçamento
                {items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">{items.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {items.map((item, idx) => (
                <BudgetItemCard
                  key={item.id}
                  item={item}
                  productsList={productsList}
                  params={globalParams}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  index={idx}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addNewItem}
                className="w-full border-dashed border-neutral-600 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar Produto
              </Button>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card className="border border-neutral-700 bg-neutral-800/50">
            <CardContent className="px-4 py-4">
              <Label className="text-xs text-neutral-400 mb-1 block">Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais para o cliente..."
                className="text-sm bg-neutral-900 border-neutral-600 min-h-[80px]"
              />
            </CardContent>
          </Card>
        </div>

        {/* ── Coluna Direita ───────────────────────────────────── */}
        <div className="lg:col-span-2">
          <BudgetSummaryPanel
            items={items}
            params={globalParams}
            clientName={clientName}
            onGerarCotacao={handleGerarCotacao}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
}
