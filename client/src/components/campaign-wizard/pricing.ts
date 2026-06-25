import {
  calcUnitPriceAdv,
  applyDiscountTierAdv,
  DESCONTOS_PRAZO,
} from "@/lib/campaign-builder-utils";
import { computeCpmPricing, type ScreenCpmConfig } from "@shared/cpm-pricing";

export interface ProductLite {
  id: number;
  name: string;
  pricingMode: string | null;
  tipo?: string | null;
}

/** Premissas globais (system_config): IRPJ/comissões em %, BV em decimal. */
export interface QuotePremissas {
  irpj: number;
  comissaoRestaurante: number;
  comissaoComercial: number;
  bvAgencia: number;
}

export interface PricingTier {
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

export interface DiscountTier {
  id: number;
  productId: number;
  priceMin: string;
  priceMax: string;
  discountPercent: string;
}

export interface PriceQuote {
  unitPrice: number;
  totalPrice: number;
  baseTotal: number;
  prazoDiscountPct: number;
  volumeDiscountPct: number;
}

export function quotePrice(params: {
  product: ProductLite;
  tiers: PricingTier[];
  discountTiers: DiscountTier[];
  volume: number;
  weeks: number;
  hasPartner: boolean;
  premissas: QuotePremissas;
  cpmConfig?: Partial<ScreenCpmConfig> | null;
}): PriceQuote {
  const { product, tiers, discountTiers, volume, weeks, hasPartner, premissas, cpmConfig } = params;

  // ── Telas: precificação EXCLUSIVA por CPM (fonte única: shared/cpm-pricing.ts).
  // O motor de markup/tiers não se aplica a telas. Sem CPM configurado no local,
  // a tela não tem preço (retorna zero — exige configuração).
  if (product.tipo === "telas") {
    const cpm = computeCpmPricing(cpmConfig);
    if (!cpm) {
      return { unitPrice: 0, totalPrice: 0, baseTotal: 0, prazoDiscountPct: 0, volumeDiscountPct: 0 };
    }
    const totalPrice = cpm.weeklyRevenue * weeks;
    const unitPrice = volume > 0 ? totalPrice / volume : totalPrice;
    return { unitPrice, totalPrice, baseTotal: totalPrice, prazoDiscountPct: 0, volumeDiscountPct: 0 };
  }
  const sorted = [...tiers].sort((a, b) => a.volumeMin - b.volumeMin);
  const tier =
    sorted.find((t) => volume >= t.volumeMin && (t.volumeMax == null || volume <= t.volumeMax)) ||
    sorted[sorted.length - 1];

  if (!tier) {
    return { unitPrice: 0, totalPrice: 0, baseTotal: 0, prazoDiscountPct: 0, volumeDiscountPct: 0 };
  }

  // Premissas globais (system_config) — fonte única, não mais as colunas legadas do produto.
  const irpj = premissas.irpj / 100;
  const comRestaurante = premissas.comissaoRestaurante / 100;
  const comComercial = premissas.comissaoComercial / 100;
  // BV de agência/parceiro é sempre embutido no preço público (espelha o backend).
  void hasPartner;
  const comParceiro = premissas.bvAgencia;

  let unitPrice = calcUnitPriceAdv({
    custoUnitario: parseFloat(tier.custoUnitario),
    frete: parseFloat(tier.frete),
    margem: parseFloat(tier.margem),
    artes: tier.artes ?? 1,
    volume,
    irpj,
    comRestaurante,
    comComercialProduto: comComercial,
    comParceiro,
    pricingMode: product.pricingMode ?? "cost_based",
    precoBaseTier: parseFloat(tier.precoBase ?? "0"),
  });

  const baseTotal = unitPrice * volume;
  const tierForVolume = discountTiers
    .filter((d) => d.productId === product.id)
    .find(
      (d) =>
        baseTotal >= parseFloat(d.priceMin) && baseTotal <= parseFloat(d.priceMax),
    );
  const volumeDiscountPct = tierForVolume ? parseFloat(tierForVolume.discountPercent) : 0;
  const discountedTotal = applyDiscountTierAdv(
    baseTotal,
    discountTiers.filter((d) => d.productId === product.id),
  );

  const prazoDiscountPct = DESCONTOS_PRAZO[weeks] ?? 0;
  const finalTotal = discountedTotal * (1 - prazoDiscountPct / 100);
  const finalUnit = volume > 0 ? finalTotal / volume : 0;

  return {
    unitPrice: finalUnit,
    totalPrice: finalTotal,
    baseTotal,
    prazoDiscountPct,
    volumeDiscountPct,
  };
}
