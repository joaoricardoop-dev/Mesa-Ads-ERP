import { Boxes, ImageIcon, FileText, Radio, Tag, Package, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SEMANAS_OPTIONS = [4, 8, 12, 16, 20, 24];

export const DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11,
};

export const BV_PADRAO_AGENCIA = 0.20;

export const TIPO_LABELS: Record<string, string> = {
  coaster: "Porta-Copos",
  display: "Display",
  cardapio: "Cardápio",
  totem: "Totem",
  adesivo: "Adesivo",
  porta_guardanapo: "Porta-Guardanapo",
  impressos: "Impresso",
  eletronicos: "Eletrônico",
  telas: "Tela",
  outro: "Outro",
};

export const TIPO_ICONS: Record<string, LucideIcon> = {
  coaster:          Boxes,
  display:          ImageIcon,
  cardapio:         FileText,
  totem:            Radio,
  adesivo:          Tag,
  porta_guardanapo: Package,
  impressos:        Package,
  eletronicos:      Sparkles,
  telas:            ImageIcon,
  outro:            Package,
};

export const TIPO_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string; hoverBorder: string }> = {
  coaster:          { bg: "bg-primary/10",    text: "text-primary",    border: "border-primary/20",    gradient: "from-primary/5 to-primary/10",       hoverBorder: "hover:border-primary/40" },
  display:          { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20", gradient: "from-violet-500/5 to-violet-500/10",  hoverBorder: "hover:border-violet-500/40" },
  cardapio:         { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   gradient: "from-blue-500/5 to-blue-500/10",      hoverBorder: "hover:border-blue-500/40" },
  totem:            { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", gradient: "from-orange-500/5 to-orange-500/10",  hoverBorder: "hover:border-orange-500/40" },
  adesivo:          { bg: "bg-pink-500/10",   text: "text-pink-400",   border: "border-pink-500/20",   gradient: "from-pink-500/5 to-pink-500/10",      hoverBorder: "hover:border-pink-500/40" },
  porta_guardanapo: { bg: "bg-teal-500/10",   text: "text-teal-400",   border: "border-teal-500/20",   gradient: "from-teal-500/5 to-teal-500/10",     hoverBorder: "hover:border-teal-500/40" },
  impressos:        { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/20",   gradient: "from-cyan-500/5 to-cyan-500/10",      hoverBorder: "hover:border-cyan-500/40" },
  eletronicos:      { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  gradient: "from-amber-500/5 to-amber-500/10",    hoverBorder: "hover:border-amber-500/40" },
  telas:            { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", gradient: "from-indigo-500/5 to-indigo-500/10",  hoverBorder: "hover:border-indigo-500/40" },
  outro:            { bg: "bg-zinc-500/10",   text: "text-zinc-400",   border: "border-zinc-500/20",   gradient: "from-zinc-500/5 to-zinc-500/10",      hoverBorder: "hover:border-zinc-500/40" },
};

export function fmtBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtBRL4(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function calcUnitPriceAdv(params: {
  custoUnitario: number; frete: number; margem: number; artes: number; volume: number;
  irpj: number; comRestaurante: number; comComercialProduto: number; comParceiro: number;
  pricingMode?: string; precoBaseTier?: number;
}) {
  const { custoUnitario, frete, margem, artes, volume, irpj, comRestaurante, comComercialProduto, comParceiro, pricingMode = "cost_based", precoBaseTier = 0 } = params;
  if (pricingMode === "price_based") {
    if (precoBaseTier <= 0) return 0;
    const den = 1 - comParceiro - irpj;
    const total = comParceiro > 0 && den > 0 ? precoBaseTier / den : precoBaseTier;
    return volume > 0 ? total / volume : 0;
  }
  const denominadorBase = 1 - margem - irpj - comRestaurante - comComercialProduto;
  const custoTotal = custoUnitario * artes * volume + frete;
  const precoBase = denominadorBase > 0 && custoTotal > 0 ? custoTotal / denominadorBase : 0;
  const den = 1 - comParceiro - irpj;
  const precoTotal = comParceiro > 0 && den > 0 ? precoBase / den : precoBase;
  return volume > 0 ? precoTotal / volume : 0;
}

export function applyDiscountTierAdv(price: number, discountTiers: any[]): number {
  if (!discountTiers || discountTiers.length === 0) return price;
  const tier = discountTiers.find((t: any) => price >= parseFloat(String(t.priceMin)) && price <= parseFloat(String(t.priceMax)));
  if (!tier) return price;
  return price * (1 - parseFloat(String(tier.discountPercent)) / 100);
}

export const USOS_POR_PORTA_COPO = 2;

export interface ProductImpressionParams {
  impressionFormulaType?: string | null;
  attentionFactor?: string | number | null;
  defaultPessoasPorMesa?: string | number | null;
  loopDurationSeconds?: string | number | null;
  frequenciaAparicoes?: string | number | null;
}

export interface LocationDataForImpression {
  seatCount?: number | null;
  tableCount?: number | null;
  monthlyCustomers?: number | null;
  avgStayMinutes?: number | null;
}

function parseNum(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const p = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(p) ? fallback : p;
}

export function calcImpressionesParaLocal(params: {
  product?: ProductImpressionParams | null;
  location?: LocationDataForImpression | null;
  qtdCoasters?: number;
  usosporCoaster?: number | null;
  daysPerMonth?: number;
}): number {
  const { product, location, qtdCoasters = 0, usosporCoaster, daysPerMonth = 26 } = params;
  const formula = product?.impressionFormulaType ?? "por_coaster";
  const atencao = parseNum(product?.attentionFactor, 1);
  const defaultPPM = parseNum(product?.defaultPessoasPorMesa, 3);

  if (formula === "por_coaster") {
    const usos = usosporCoaster != null ? parseNum(usosporCoaster) : USOS_POR_PORTA_COPO;
    let ppm = defaultPPM;
    if (location?.seatCount && location?.tableCount && location.tableCount > 0) {
      ppm = location.seatCount / location.tableCount;
    }
    return qtdCoasters * usos * ppm * atencao;
  }

  if (formula === "por_tela") {
    const monthly = location?.monthlyCustomers ?? 0;
    if (monthly <= 0) return 0;
    const clientesPorDia = monthly / (daysPerMonth || 26);
    const loopSec = parseNum(product?.loopDurationSeconds, 30);
    const avgStay = location?.avgStayMinutes ?? 0;
    const aparicoes = loopSec > 0 && avgStay > 0
      ? (avgStay * 60) / loopSec
      : parseNum(product?.frequenciaAparicoes, 1);
    return clientesPorDia * aparicoes * atencao * daysPerMonth;
  }

  const usos = usosporCoaster != null ? parseNum(usosporCoaster) : USOS_POR_PORTA_COPO;
  return qtdCoasters * usos;
}

export function impressoesEstimadas(volume: number, product?: ProductImpressionParams | null): number {
  if (!product || !product.impressionFormulaType || product.impressionFormulaType === "legacy") {
    return volume * USOS_POR_PORTA_COPO;
  }
  return calcImpressionesParaLocal({ product, qtdCoasters: volume });
}

export function fmtImpr(n: number) {
  if (n >= 1_000_000) return `≈${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `≈${(n / 1_000).toFixed(0).replace(".", ",")} mil`;
  return `≈${n}`;
}
