import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Tag,
  Eye,
  Package,
  Sparkles,
  Calendar,
  FileText,
  Send,
  ArrowRight,
} from "lucide-react";
import {
  SEMANAS_OPTIONS,
  DESCONTOS_PRAZO,
  BV_PADRAO_AGENCIA,
  TIPO_LABELS,
  TIPO_ICONS,
  TIPO_COLORS,
  calcUnitPriceAdv,
  applyDiscountTierAdv,
  impressoesEstimadas,
  fmtBRL,
  fmtBRL4,
  fmtImpr,
} from "@/lib/campaign-builder-utils";

interface CartItem {
  product: any;
  volume: number;
  weeks: number;
  unitPrice: number;
  totalPrice: number;
}

interface CampaignBuilderProps {
  clientId: number;
  hasPartner: boolean;
  isPartner: boolean;
  products: any[];
  onClose: () => void;
  onSuccess?: () => void;
}

const STEPS = [
  { key: "produtos", label: "Produtos", icon: Package },
  { key: "configurar", label: "Configurar", icon: Tag },
  { key: "campanha", label: "Campanha", icon: FileText },
  { key: "confirmacao", label: "Confirmar", icon: CheckCircle2 },
];

function calcItemPrice(product: any, volume: number, weeks: number, hasPartner: boolean) {
  const tiers = product.tiers ?? [];
  const discountTiers = product.discountTiers ?? [];

  const irpj = parseFloat(product.irpj ?? "6") / 100;
  const comRestaurante = parseFloat(product.comRestaurante ?? "15") / 100;
  const comComercialProduto = parseFloat(product.comComercial ?? "10") / 100;
  const comParceiro = hasPartner ? BV_PADRAO_AGENCIA : 0;

  const sortedTiers = [...tiers].sort((a: any, b: any) => b.volumeMin - a.volumeMin);
  const tier = sortedTiers.find((t: any) => volume >= t.volumeMin) ?? tiers[0];

  if (!tier) return { unitPrice: 0, totalPrice: 0 };

  const unitPrice4sem = calcUnitPriceAdv({
    custoUnitario: parseFloat(tier.custoUnitario),
    frete: parseFloat(tier.frete),
    margem: parseFloat(tier.margem) / 100,
    artes: tier.artes ?? 1,
    volume,
    irpj, comRestaurante, comComercialProduto, comParceiro,
    pricingMode: product.pricingMode,
    precoBaseTier: parseFloat(tier.precoBase ?? "0"),
  });

  const nPer = weeks / 4;
  const precoBruto = unitPrice4sem * volume * nPer;
  const precoPosFaixa = applyDiscountTierAdv(precoBruto, discountTiers);
  const dsc = (DESCONTOS_PRAZO[weeks] ?? 0) / 100;
  const totalPrice = precoPosFaixa * (1 - dsc);
  const unitPrice = volume > 0 ? totalPrice / (volume * nPer) : 0;

  return { unitPrice, totalPrice };
}

export function CampaignBuilder({ clientId, hasPartner, isPartner, products, onClose, onSuccess }: CampaignBuilderProps) {
  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [briefing, setBriefing] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const source = isPartner ? "self_service_parceiro" : "self_service_anunciante";

  const createMutation = trpc.quotation.createFromBuilder.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Proposta enviada com sucesso! Nossa equipe entrará em contato em breve.");
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao enviar proposta. Tente novamente.");
    },
  });

  const totalValue = useMemo(() => cart.reduce((s, i) => s + i.totalPrice, 0), [cart]);

  function addToCart(product: any) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev;
      const volumes = (product.tiers ?? []).map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b);
      const defaultVol = product.defaultQtyPerLocation ?? volumes[0] ?? 500;
      const defaultWeeks = 4;
      const { unitPrice, totalPrice } = calcItemPrice(product, defaultVol, defaultWeeks, hasPartner);
      return [...prev, { product, volume: defaultVol, weeks: defaultWeeks, unitPrice, totalPrice }];
    });
  }

  function removeFromCart(productId: number) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  function updateCartItem(productId: number, volume: number, weeks: number) {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const { unitPrice, totalPrice } = calcItemPrice(item.product, volume, weeks, hasPartner);
      return { ...item, volume, weeks, unitPrice, totalPrice };
    }));
  }

  function handleSubmit() {
    if (!campaignName.trim()) {
      toast.error("Informe o nome da campanha");
      return;
    }
    createMutation.mutate({
      clientId,
      source,
      campaignName: campaignName.trim(),
      startDate: startDate || undefined,
      briefing: briefing || undefined,
      items: cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        volume: i.volume,
        weeks: i.weeks,
      })),
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Proposta Enviada!</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Nossa equipe comercial recebeu sua proposta e entrará em contato para confirmar os detalhes e próximos passos.
          </p>
        </div>
        <Button onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = idx === step;
            const isDone = idx < step;
            return (
              <div key={s.key} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "text-muted-foreground"
                }`}>
                  {isDone ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
            <ShoppingCart className="w-3.5 h-3.5" />
            {cart.length} produto{cart.length !== 1 ? "s" : ""}
            <span className="font-semibold text-foreground">{fmtBRL(totalValue)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 0 && (
          <StepProdutos
            products={products}
            cart={cart}
            hasPartner={hasPartner}
            onAdd={addToCart}
            onRemove={removeFromCart}
          />
        )}
        {step === 1 && (
          <StepConfigurar
            cart={cart}
            hasPartner={hasPartner}
            onUpdate={updateCartItem}
            onRemove={removeFromCart}
          />
        )}
        {step === 2 && (
          <StepCampanha
            campaignName={campaignName}
            startDate={startDate}
            briefing={briefing}
            onCampaignName={setCampaignName}
            onStartDate={setStartDate}
            onBriefing={setBriefing}
          />
        )}
        {step === 3 && (
          <StepConfirmacao
            cart={cart}
            campaignName={campaignName}
            startDate={startDate}
            briefing={briefing}
            hasPartner={hasPartner}
            totalValue={totalValue}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t bg-background/80 backdrop-blur-sm shrink-0">
        <Button
          variant="outline"
          onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
          className="gap-1.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {step === 0 ? "Cancelar" : "Voltar"}
        </Button>

        {step < 3 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && cart.length === 0}
            className="gap-1.5"
          >
            {step === 0 && cart.length === 0 ? "Selecione produtos" : "Continuar"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !campaignName.trim()}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {createMutation.isPending ? (
              <>Enviando...</>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Enviar Proposta
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepProdutos({ products, cart, hasPartner, onAdd, onRemove }: {
  products: any[]; cart: CartItem[]; hasPartner: boolean;
  onAdd: (p: any) => void; onRemove: (id: number) => void;
}) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Selecione os Produtos</h2>
        <p className="text-sm text-muted-foreground">Escolha os produtos que deseja incluir na sua campanha.</p>
      </div>

      {hasPartner && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <Tag className="w-3.5 h-3.5 shrink-0" />
          Preços com comissão de agência incluída (+{(BV_PADRAO_AGENCIA * 100).toFixed(0)}% BV)
        </div>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground opacity-40" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">Nenhum produto disponível no momento</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ainda não há produtos configurados para o seu perfil. Entre em contato com nossa equipe comercial para saber mais.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((product: any) => {
            const inCart = cart.some(i => i.product.id === product.id);
            const TipoIcon = TIPO_ICONS[product.tipo] ?? Package;
            const colors = TIPO_COLORS[product.tipo] ?? TIPO_COLORS.outro;
            const volumes = (product.tiers ?? []).map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b);
            const defaultVol = product.defaultQtyPerLocation ?? volumes[0] ?? 500;
            const impressoes = impressoesEstimadas(defaultVol, product);
            const tiers = product.tiers ?? [];
            const discountTiers = product.discountTiers ?? [];
            const smallestVol = volumes[0];
            const smallestTier = tiers.find((t: any) => t.volumeMin === smallestVol);
            const irpj = parseFloat(product.irpj ?? "6") / 100;
            const comRestaurante = parseFloat(product.comRestaurante ?? "15") / 100;
            const comComercialProduto = parseFloat(product.comComercial ?? "10") / 100;
            const comParceiro = hasPartner ? BV_PADRAO_AGENCIA : 0;
            let minPrice: number | null = null;
            if (smallestTier && smallestVol != null) {
              const unitPrice = calcUnitPriceAdv({
                custoUnitario: parseFloat(smallestTier.custoUnitario),
                frete: parseFloat(smallestTier.frete),
                margem: parseFloat(smallestTier.margem) / 100,
                artes: smallestTier.artes ?? 1,
                volume: smallestVol,
                irpj, comRestaurante, comComercialProduto, comParceiro,
                pricingMode: product.pricingMode,
                precoBaseTier: parseFloat(smallestTier.precoBase ?? "0"),
              });
              const precoBruto = unitPrice * smallestVol * 1;
              minPrice = applyDiscountTierAdv(precoBruto, discountTiers);
            }

            return (
              <div
                key={product.id}
                className={`bg-card border rounded-2xl overflow-hidden transition-all duration-200 flex flex-col ${
                  inCart
                    ? `${colors.border} shadow-lg ring-1 ring-inset ${colors.border}`
                    : `border-border/30 ${colors.hoverBorder} hover:shadow-md`
                }`}
              >
                <div className={`bg-gradient-to-br ${colors.gradient} border-b border-border/20 px-5 py-6 flex flex-col items-center gap-3`}>
                  <div className={`w-14 h-14 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center shadow`}>
                    <TipoIcon className={`w-7 h-7 ${colors.text}`} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-sm leading-tight">{product.name}</h3>
                    <span className={`text-[10px] font-medium mt-1 inline-block px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                      {TIPO_LABELS[product.tipo] ?? product.tipo}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3 flex flex-col gap-2.5 flex-1">
                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-sky-400 bg-sky-500/8 border border-sky-500/15 rounded-lg px-2.5 py-1.5">
                    <Eye className="w-3 h-3 shrink-0" />
                    <span>{defaultVol.toLocaleString("pt-BR")} un. → {fmtImpr(impressoes)} impressões/mês</span>
                  </div>
                  {minPrice != null && minPrice > 0 && (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-muted-foreground">a partir de</span>
                      <span className="text-base font-bold">{fmtBRL(minPrice)}</span>
                      <span className="text-[10px] text-muted-foreground">/mês</span>
                    </div>
                  )}
                  <div className="mt-auto pt-2 border-t border-border/20">
                    {inCart ? (
                      <button
                        onClick={() => onRemove(product.id)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs rounded-lg px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        No carrinho — remover
                      </button>
                    ) : (
                      <button
                        onClick={() => onAdd(product)}
                        className={`w-full flex items-center justify-center gap-1.5 text-xs rounded-lg px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar ao carrinho
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepConfigurar({ cart, hasPartner, onUpdate, onRemove }: {
  cart: CartItem[]; hasPartner: boolean;
  onUpdate: (id: number, vol: number, weeks: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold mb-1">Configure os Volumes e Prazos</h2>
        <p className="text-sm text-muted-foreground">Ajuste o volume e a duração de cada produto no seu carrinho.</p>
      </div>

      {cart.map((item) => {
        const TipoIcon = TIPO_ICONS[item.product.tipo] ?? Package;
        const colors = TIPO_COLORS[item.product.tipo] ?? TIPO_COLORS.outro;
        const volumes = (item.product.tiers ?? []).map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b);
        const impressoes = impressoesEstimadas(item.volume, item.product);

        return (
          <div key={item.product.id} className={`bg-card border ${colors.border} rounded-2xl overflow-hidden`}>
            <div className={`flex items-center gap-3 px-5 py-4 bg-gradient-to-r ${colors.gradient} border-b border-border/20`}>
              <div className={`p-2 rounded-xl ${colors.bg} border ${colors.border}`}>
                <TipoIcon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{item.product.name}</p>
                <p className={`text-[10px] ${colors.text}`}>{TIPO_LABELS[item.product.tipo] ?? item.product.tipo}</p>
              </div>
              <button
                onClick={() => onRemove(item.product.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-muted-foreground transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <Label className="text-xs mb-2 block">Volume ({item.product.unitLabelPlural ?? "unidades"})</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {volumes.map((v: number) => (
                    <button
                      key={v}
                      onClick={() => onUpdate(item.product.id, v, item.weeks)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                        item.volume === v
                          ? `${colors.bg} ${colors.text} ${colors.border}`
                          : "border-border/30 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {v.toLocaleString("pt-BR")}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-sky-400 mt-1.5 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {fmtImpr(impressoes)} impressões estimadas/mês
                </p>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Duração da campanha</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SEMANAS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => onUpdate(item.product.id, item.volume, s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors relative ${
                        item.weeks === s
                          ? `${colors.bg} ${colors.text} ${colors.border}`
                          : "border-border/30 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {s} sem.
                      {(DESCONTOS_PRAZO[s] ?? 0) > 0 && (
                        <span className="ml-1 text-emerald-400 text-[9px]">-{DESCONTOS_PRAZO[s]}%</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/10">
                <div>
                  <p className="text-xs text-muted-foreground">Preço unitário</p>
                  <p className="text-sm font-mono font-semibold">{fmtBRL4(item.unitPrice)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total da campanha</p>
                  <p className="text-lg font-bold">{fmtBRL(item.totalPrice)}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepCampanha({ campaignName, startDate, briefing, onCampaignName, onStartDate, onBriefing }: {
  campaignName: string; startDate: string; briefing: string;
  onCampaignName: (v: string) => void; onStartDate: (v: string) => void; onBriefing: (v: string) => void;
}) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Dados da Campanha</h2>
        <p className="text-sm text-muted-foreground">Informe as informações básicas da sua campanha.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaignName">Nome da Campanha <span className="text-red-400">*</span></Label>
        <Input
          id="campaignName"
          value={campaignName}
          onChange={e => onCampaignName(e.target.value)}
          placeholder="Ex.: Campanha Verão 2026"
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate" className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Data de Início (aproximada)
        </Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={e => onStartDate(e.target.value)}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">Opcional — nossa equipe confirmará a data exata.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="briefing" className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Briefing / Observações
        </Label>
        <Textarea
          id="briefing"
          value={briefing}
          onChange={e => onBriefing(e.target.value)}
          placeholder="Descreva o objetivo da campanha, público-alvo, regiões de interesse, referências de arte, ou qualquer outra informação relevante..."
          rows={5}
          className="text-sm resize-none"
        />
        <p className="text-xs text-muted-foreground">Quanto mais detalhes, melhor podemos ajustar a proposta para você.</p>
      </div>
    </div>
  );
}

function StepConfirmacao({ cart, campaignName, startDate, briefing, hasPartner, totalValue }: {
  cart: CartItem[]; campaignName: string; startDate: string; briefing: string;
  hasPartner: boolean; totalValue: number;
}) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Confirmar e Enviar</h2>
        <p className="text-sm text-muted-foreground">Revise sua proposta antes de enviar para a equipe comercial.</p>
      </div>

      <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/20 bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campanha</p>
        </div>
        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{campaignName}</p>
          </div>
          {startDate && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Início: {new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
          {briefing && (
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 leading-relaxed">{briefing}</p>
          )}
          {hasPartner && (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
              <Tag className="w-3 h-3" />
              Inclui comissão de agência ({(BV_PADRAO_AGENCIA * 100).toFixed(0)}% BV)
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border/20 bg-muted/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produtos selecionados</p>
        </div>
        <div className="divide-y divide-border/10">
          {cart.map(item => {
            const TipoIcon = TIPO_ICONS[item.product.tipo] ?? Package;
            const colors = TIPO_COLORS[item.product.tipo] ?? TIPO_COLORS.outro;
            return (
              <div key={item.product.id} className="flex items-center gap-4 px-5 py-3">
                <div className={`p-1.5 rounded-lg ${colors.bg} shrink-0`}>
                  <TipoIcon className={`w-3.5 h-3.5 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.volume.toLocaleString("pt-BR")} {item.product.unitLabelPlural ?? "un."} × {item.weeks} semanas
                    {(DESCONTOS_PRAZO[item.weeks] ?? 0) > 0 && (
                      <span className="text-emerald-400 ml-1">(-{DESCONTOS_PRAZO[item.weeks]}% prazo)</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{fmtBRL(item.totalPrice)}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtBRL4(item.unitPrice)}/un.</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-border/20 bg-muted/20 flex items-center justify-between">
          <p className="text-sm font-semibold">Total estimado</p>
          <p className="text-xl font-bold">{fmtBRL(totalValue)}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-blue-300 mb-0.5">O que acontece depois?</p>
          <p>Nossa equipe comercial receberá sua proposta e entrará em contato em até 1 dia útil para confirmar disponibilidade, ajustar detalhes e enviar a cotação formal.</p>
        </div>
      </div>
    </div>
  );
}
