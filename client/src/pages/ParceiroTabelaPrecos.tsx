import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Package, Percent, Save, ChevronDown, ChevronRight, Receipt } from "lucide-react";

const SEMANAS_OPTIONS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];

const DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11, 28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
};

function fmtBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtBRL4(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function calcUnitPrice(params: {
  custoUnitario: number;
  frete: number;
  margem: number;
  artes: number;
  volume: number;
  irpj: number;
  comRestaurante: number;
  comComercialProduto: number;
  comParceiro: number;
  billingMode?: "bruto" | "liquido";
  pricingMode?: "cost_based" | "price_based";
  precoBaseTier?: number;
}) {
  const { custoUnitario, frete, margem, artes, volume, irpj, comRestaurante, comComercialProduto, comParceiro, billingMode = "bruto", pricingMode = "cost_based", precoBaseTier = 0 } = params;

  if (pricingMode === "price_based") {
    if (precoBaseTier <= 0) return 0;
    const grossUpDen = 1 - comParceiro - irpj;
    const precoTotal = billingMode === "bruto" && grossUpDen > 0
      ? precoBaseTier / grossUpDen
      : precoBaseTier;
    return volume > 0 ? precoTotal / volume : 0;
  }

  const denominadorBase = 1 - margem - irpj - comRestaurante - comComercialProduto;
  const custoTotal = custoUnitario * artes * volume + frete;
  const precoBase = denominadorBase > 0 && custoTotal > 0 ? custoTotal / denominadorBase : 0;
  const grossUpDen = 1 - comParceiro - irpj;
  const precoTotal = billingMode === "bruto" && grossUpDen > 0
    ? precoBase / grossUpDen
    : precoBase;
  return volume > 0 ? precoTotal / volume : 0;
}

function getPricingTierForVolume(tiers: any[], volume: number) {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.volumeMin - b.volumeMin);
  let match = sorted[0];
  for (const tier of sorted) {
    if (volume >= tier.volumeMin) match = tier;
    else break;
  }
  return match;
}

interface ProductTableProps {
  product: any;
  commissionPercent: number;
  billingMode: "bruto" | "liquido";
}

interface DiscountTierEntry {
  priceMin: string | number;
  priceMax: string | number;
  discountPercent: string | number;
}

function applyDiscountTier(price: number, discountTiers: DiscountTierEntry[]): number {
  if (!discountTiers || discountTiers.length === 0) return price;
  const tier = discountTiers.find((t) => price >= parseFloat(String(t.priceMin)) && price <= parseFloat(String(t.priceMax)));
  if (!tier) return price;
  return price * (1 - parseFloat(String(tier.discountPercent)) / 100);
}

function ProductTable({ product, commissionPercent, billingMode }: ProductTableProps) {
  const [expanded, setExpanded] = useState(true);
  const tiers = product.tiers ?? [];
  const discountTiers = product.discountTiers ?? [];

  const irpj = parseFloat(product.irpj ?? "6") / 100;
  const comRestaurante = parseFloat(product.comRestaurante ?? "15") / 100;
  const comComercialProduto = parseFloat(product.comComercial ?? "10") / 100;
  const comParceiro = commissionPercent / 100;

  const volumes = useMemo(
    () => tiers.map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b),
    [tiers]
  );

  if (tiers.length === 0) {
    return (
      <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4">
          <Package className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{product.name}</span>
          <Badge variant="outline" className="text-xs text-muted-foreground">Sem faixas configuradas</Badge>
        </div>
      </div>
    );
  }

  const smallestVol = volumes[0];
  const smallestTier = tiers.find((t: any) => t.volumeMin === smallestVol);
  const pricingMode = product.pricingMode ?? "cost_based";
  const baseUnitPrice = smallestTier
    ? calcUnitPrice({
        custoUnitario: parseFloat(smallestTier.custoUnitario),
        frete: parseFloat(smallestTier.frete),
        margem: parseFloat(smallestTier.margem) / 100,
        artes: smallestTier.artes ?? 1,
        volume: smallestVol,
        irpj,
        comRestaurante,
        comComercialProduto,
        comParceiro,
        billingMode,
        pricingMode,
        precoBaseTier: parseFloat(smallestTier.precoBase ?? "0"),
      })
    : 0;

  return (
    <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Package className="w-4 h-4 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">{product.name}</span>
        <span className="text-xs text-muted-foreground hidden sm:block">{product.unitLabelPlural}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-border/20 bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Volume</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Preço/un (sem desc.)</th>
                {SEMANAS_OPTIONS.slice(0, 7).map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                    {s} sem.
                    {DESCONTOS_PRAZO[s] ? (
                      <span className="block text-emerald-400 font-normal">-{DESCONTOS_PRAZO[s]}%</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volumes.map((vol: number) => {
                const tier = tiers.find((t: any) => t.volumeMin === vol);
                if (!tier) return null;
                const unitPrice4sem = calcUnitPrice({
                  custoUnitario: parseFloat(tier.custoUnitario),
                  frete: parseFloat(tier.frete),
                  margem: parseFloat(tier.margem) / 100,
                  artes: tier.artes ?? 1,
                  volume: vol,
                  irpj,
                  comRestaurante,
                  comComercialProduto,
                  comParceiro,
                  billingMode,
                  pricingMode,
                  precoBaseTier: parseFloat(tier.precoBase ?? "0"),
                });
                const discountVol = baseUnitPrice > 0 && vol > smallestVol ? (1 - unitPrice4sem / baseUnitPrice) : 0;

                return (
                  <tr key={vol} className="border-t border-border/10 hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium">
                      {vol.toLocaleString("pt-BR")} {product.unitLabelPlural}
                      {discountVol > 0 && (
                        <span className="ml-1.5 text-emerald-400 text-[10px]">-{(discountVol * 100).toFixed(0)}% vol.</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtBRL4(unitPrice4sem)}</td>
                    {SEMANAS_OPTIONS.slice(0, 7).map((s) => {
                      const nPer = s / 4;
                      const precoBruto = unitPrice4sem * vol * nPer;
                      const precoPosFaixa = applyDiscountTier(precoBruto, discountTiers);
                      const dsc = (DESCONTOS_PRAZO[s] ?? 0) / 100;
                      const precoTotal = precoPosFaixa * (1 - dsc);
                      const precoUnit = vol > 0 ? precoTotal / (vol * nPer) : 0;
                      return (
                        <td key={s} className="px-3 py-2.5 text-right font-mono">
                          <span className="font-semibold">{fmtBRL4(precoUnit)}</span>
                          <br />
                          <span className="text-muted-foreground text-[10px]">{fmtBRL(precoTotal)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ParceiroTabelaPrecos() {
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data, isLoading, refetch } = trpc.parceiroPortal.getPriceTable.useQuery({ adminPartnerId });
  const updateCommissionMutation = trpc.parceiroPortal.updateCommission.useMutation({
    onSuccess: (res) => {
      toast.success(`Comissão atualizada para ${res.commissionPercent}%`);
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
  const updateBillingModeMutation = trpc.parceiroPortal.updateBillingMode.useMutation({
    onSuccess: (res) => {
      toast.success(`Modo de faturamento atualizado para ${res.billingMode === "bruto" ? "Bruto" : "Líquido"}`);
      refetch();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const [localCommission, setLocalCommission] = useState<number | null>(null);
  const commissionPercent = localCommission ?? (data?.commissionPercent ?? 10);
  const hasUnsaved = localCommission !== null && localCommission !== data?.commissionPercent;
  const billingMode: "bruto" | "liquido" = data?.billingMode ?? "bruto";

  const handleSaveCommission = () => {
    if (localCommission === null) return;
    updateCommissionMutation.mutate({ commissionPercent: localCommission });
  };

  const handleToggleBillingMode = () => {
    const newMode = billingMode === "bruto" ? "liquido" : "bruto";
    updateBillingModeMutation.mutate({ billingMode: newMode });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="h-8 bg-muted/30 rounded animate-pulse w-48" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-48 bg-card border border-border/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const products = data?.products ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Tabela de Preços</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preços calculados com sua comissão comercial aplicada
          </p>
        </div>
      </div>

      <div className="bg-card border border-border/30 rounded-xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Minha Comissão Comercial</span>
              <Badge
                variant="outline"
                className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-mono text-xs"
              >
                {commissionPercent}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Ajuste sua comissão entre 0% e 20%. Ao salvar, os preços são recalculados e o valor é salvo no seu perfil.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-8">0%</span>
              <Slider
                min={0}
                max={20}
                step={0.5}
                value={[commissionPercent]}
                onValueChange={([v]) => setLocalCommission(v)}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-8">20%</span>
            </div>
          </div>
          <div className="flex items-end gap-2 self-end">
            {hasUnsaved && (
              <Button
                size="sm"
                onClick={handleSaveCommission}
                disabled={updateCommissionMutation.isPending}
                className="gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar comissão
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border/30 rounded-xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Modo de Faturamento</span>
              <Badge
                variant="outline"
                className={`font-mono text-xs ${billingMode === "bruto" ? "text-blue-400 border-blue-500/30 bg-blue-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}
              >
                {billingMode === "bruto" ? "Bruto" : "Líquido"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {billingMode === "bruto"
                ? "Faturamento Bruto: O cliente paga o valor total (incluindo sua comissão) para a Mesa Ads, que repassa sua comissão."
                : "Faturamento Líquido: O cliente paga à Mesa Ads o valor sem comissão. Sua comissão é cobrada em fatura separada direto ao cliente."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={billingMode === "bruto" ? "default" : "outline"}
                className={`gap-1.5 text-xs ${billingMode === "bruto" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                onClick={() => billingMode !== "bruto" && handleToggleBillingMode()}
                disabled={updateBillingModeMutation.isPending}
              >
                Bruto
              </Button>
              <Button
                size="sm"
                variant={billingMode === "liquido" ? "default" : "outline"}
                className={`gap-1.5 text-xs ${billingMode === "liquido" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                onClick={() => billingMode !== "liquido" && handleToggleBillingMode()}
                disabled={updateBillingModeMutation.isPending}
              >
                Líquido
              </Button>
            </div>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-card border border-border/30 rounded-xl p-10 text-center text-muted-foreground text-sm">
          Nenhum produto disponível para visualização ainda.
          <br />
          <span className="text-xs">O administrador pode habilitar produtos na área de configurações.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product: any) => (
            <ProductTable
              key={product.id}
              product={product}
              commissionPercent={commissionPercent}
              billingMode={billingMode}
            />
          ))}
        </div>
      )}

      <div className="bg-card border border-border/30 rounded-xl p-5">
        <div className="flex items-start gap-2 mb-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <h3 className="text-sm font-semibold">Como os preços são calculados</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          O preço unitário é calculado de forma que os custos e todas as comissões/impostos sejam cobertos. A fórmula é:
        </p>
        <div className="bg-muted/20 rounded-lg p-3 font-mono text-xs space-y-1">
          <p><span className="text-muted-foreground">Custo total</span> = Custo GPC × Artes × Volume + Frete</p>
          <p><span className="text-muted-foreground">Denominador base</span> = 1 − Margem − IRPJ − Com. Local − Com. Interna</p>
          <p><span className="text-muted-foreground">Preço base (4 sem.)</span> = Custo total ÷ Denominador base</p>
          {billingMode === "bruto" ? (
            <p><span className="text-muted-foreground">Preço total (4 sem.)</span> = Preço base ÷ (1 − <span className="text-emerald-400">Sua Com. ({commissionPercent}%)</span> − IRPJ)</p>
          ) : (
            <p><span className="text-muted-foreground">Preço total (4 sem.)</span> = Preço base <span className="text-amber-400">(sem gross-up — comissão faturada separadamente)</span></p>
          )}
          <p><span className="text-muted-foreground">Preço unitário</span> = Preço total ÷ Volume</p>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <span>IRPJ: 6% (por produto)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
            <span>Com. Local: 15% (por produto)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span>Com. Interna: 10% (por produto)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>Sua com.: <strong>{commissionPercent}%</strong> (gross-up parceiro)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
            <span>Margem Mesa Ads: variável (por produto)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
            <span>Desc. prazo: até 25% (52 semanas)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
