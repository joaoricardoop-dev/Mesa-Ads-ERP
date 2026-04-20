// ─────────────────────────────────────────────────────────────────────────────
// Finrefac fase 3 — Fórmulas centralizadas de cálculo financeiro.
//
// Todas as fórmulas usadas pelo `materializePayablesForInvoice` ficam aqui
// para serem testáveis isoladamente e reutilizadas em UI/relatórios.
// ─────────────────────────────────────────────────────────────────────────────

export const TAX_RATES = {
  // PIS 0,65% + COFINS 3,00% = 3,65% (regime presumido). Pode virar produto-específico no futuro.
  pisCofins: 0.0365,
  // IRPJ default quando produto não define (6% padrão histórico).
  irpjDefault: 0.06,
} as const;

export interface InvoiceLike {
  id: number;
  invoiceNumber?: string | null;
  campaignId: number | null;
  amount: string | number;
  issRate?: string | number | null;
  issRetained?: boolean | null;
  issueDate: string;
  paymentDate?: string | null;
}

export interface CampaignLike {
  id: number;
  isBonificada: boolean | null;
  restaurantCommission: string | number;
  productId: number | null;
  partnerId?: number | null;
  hasAgencyBv?: boolean | null;
  agencyBvPercent?: string | number | null;
  quotationId?: number | null;
  clientId: number;
}

export interface ProductLike {
  tipo: string | null;
  vipProviderId: number | null;
  vipProviderCommissionPercent?: string | number | null;
  irpj?: string | number | null;
}

export interface VipProviderLike {
  id: number;
  status: string;
  repassePercent: string | number;
  name: string;
}

export interface PartnerLike {
  id: number;
  name: string;
  commissionPercent: string | number;
}

export type TaxKind = "irpj" | "iss" | "pis_cofins";

export function num(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isDigitalProduct(product: ProductLike | null): boolean {
  if (!product) return false;
  return product.tipo === "telas" || product.tipo === "janelas_digitais";
}

export function competenceMonthFor(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function lastDayOfMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Impostos (gerados ao emitir fatura)
//   - IRPJ: alíquota do produto (default 6%) sobre o bruto.
//   - ISS:  só vira obrigação NOSSA quando NÃO é retido pelo tomador.
//           Se issRetained=true, o tomador recolhe direto, não criamos AP.
//   - PIS/COFINS: 3,65% sobre bruto (presumido).
// ─────────────────────────────────────────────────────────────────────────────
export function calcTaxes(
  invoice: InvoiceLike,
  product: ProductLike | null,
): Array<{ kind: TaxKind; amount: number; ratePercent: number; description: string }> {
  const gross = num(invoice.amount);
  if (gross <= 0) return [];

  const irpjRate = num(product?.irpj, TAX_RATES.irpjDefault * 100) / 100;
  const irpjAmount = gross * irpjRate;

  const issRate = num(invoice.issRate) / 100;
  const issRetained = !!invoice.issRetained;
  const issAmount = issRetained || issRate <= 0 ? 0 : gross * issRate;

  const pisCofinsRate = TAX_RATES.pisCofins;
  const pisCofinsAmount = gross * pisCofinsRate;

  const out: Array<{ kind: TaxKind; amount: number; ratePercent: number; description: string }> = [];
  if (irpjAmount > 0) {
    out.push({
      kind: "irpj",
      amount: roundCents(irpjAmount),
      ratePercent: irpjRate * 100,
      description: `IRPJ (${(irpjRate * 100).toFixed(2)}%)`,
    });
  }
  if (issAmount > 0) {
    out.push({
      kind: "iss",
      amount: roundCents(issAmount),
      ratePercent: issRate * 100,
      description: `ISS (${(issRate * 100).toFixed(2)}%)`,
    });
  }
  if (pisCofinsAmount > 0) {
    out.push({
      kind: "pis_cofins",
      amount: roundCents(pisCofinsAmount),
      ratePercent: pisCofinsRate * 100,
      description: `PIS/COFINS (${(pisCofinsRate * 100).toFixed(2)}%)`,
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Comissão Restaurante
//   - Bonificada → 0
//   - Produto digital (telas/janelas_digitais) → 0 (não tem bolacha = não tem
//     restaurante físico recebendo comissão; regra "tela vs bolacha")
//   - Caso contrário: gross × restaurantCommission%
// ─────────────────────────────────────────────────────────────────────────────
export function calcRestaurantCommission(
  invoice: InvoiceLike,
  campaign: CampaignLike,
  product: ProductLike | null,
): number {
  if (campaign.isBonificada) return 0;
  if (isDigitalProduct(product)) return 0;
  const gross = num(invoice.amount);
  const rate = num(campaign.restaurantCommission) / 100;
  return roundCents(gross * rate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Repasse Sala VIP (apenas produtos digitais)
//   - Bonificada → 0
//   - Não-digital → 0
//   - Provider inativo/inexistente → 0
//   - Caso contrário: gross × (product.vipProviderCommissionPercent
//                              || vipProvider.repassePercent || 0)
// ─────────────────────────────────────────────────────────────────────────────
export function calcVipRepasse(
  invoice: InvoiceLike,
  campaign: CampaignLike,
  product: ProductLike | null,
  vipProvider: VipProviderLike | null,
): number {
  if (campaign.isBonificada) return 0;
  if (!product || !isDigitalProduct(product)) return 0;
  if (!vipProvider || vipProvider.status !== "active") return 0;
  const gross = num(invoice.amount);
  const rate = num(product.vipProviderCommissionPercent ?? vipProvider.repassePercent) / 100;
  return roundCents(gross * rate);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comissão Parceiro (BV)
//   Base = gross − impostos − comissão restaurante.
//   Taxa = campaign.agencyBvPercent (se hasAgencyBv true e definido)
//          fallback: partner.commissionPercent.
//   Se hasAgencyBv=false → 0.
// ─────────────────────────────────────────────────────────────────────────────
export function calcPartnerCommission(
  invoice: InvoiceLike,
  campaign: CampaignLike,
  product: ProductLike | null,
  partner: PartnerLike | null,
): { amount: number; ratePercent: number } {
  if (!partner) return { amount: 0, ratePercent: 0 };
  if (campaign.hasAgencyBv === false) return { amount: 0, ratePercent: 0 };

  const campRate = num(campaign.agencyBvPercent, NaN);
  const ratePercent = Number.isFinite(campRate) ? campRate : num(partner.commissionPercent);
  if (ratePercent <= 0) return { amount: 0, ratePercent };

  const gross = num(invoice.amount);
  const taxesTotal = calcTaxes(invoice, product).reduce((s, t) => s + t.amount, 0);
  const restComm = calcRestaurantCommission(invoice, campaign, product);
  const base = gross - taxesTotal - restComm;
  if (base <= 0) return { amount: 0, ratePercent };
  return { amount: roundCents(base * (ratePercent / 100)), ratePercent };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

// dueDate >= createdAt para satisfazer chk_accounts_payable_due_after_created
// quando createdBySystem=true. Se o alvo é passado, usamos hoje.
export function safeDueDate(target?: string | null): string {
  const today = new Date().toISOString().split("T")[0];
  if (!target) return today;
  return target > today ? target : today;
}
