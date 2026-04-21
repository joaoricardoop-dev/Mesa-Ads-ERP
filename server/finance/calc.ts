// ─────────────────────────────────────────────────────────────────────────────
// Finrefac fase 3 — Fórmulas centralizadas de cálculo financeiro.
//
// Todas as fórmulas usadas pelo `materializePayablesForInvoice` ficam aqui
// para serem testáveis isoladamente e reutilizadas em UI/relatórios.
// ─────────────────────────────────────────────────────────────────────────────

export const TAX_RATES = {
  // PIS/COFINS — não recolhidos pela empresa (regime atual). Mantido como 0
  // para que toda a estrutura de breakdown continue funcionando sem mudanças
  // no schema; basta voltar para 0.0365 caso o regime mude.
  pisCofins: 0,
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
  sellerCommission?: string | number | null;
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
//   - Caso contrário:
//       base = gross − impostos − comissão comercial   (regra de negócio)
//       repasse = base × (product.vipProviderCommissionPercent
//                         || vipProvider.repassePercent || 0)
//     Ou seja, primeiro paga IR/PIS/COFINS/ISS e a comissão do vendedor;
//     o repasse é calculado sobre o que sobra.
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
  const taxesTotal = calcTaxes(invoice, product).reduce((s, t) => s + t.amount, 0);
  const sellerRate = num(campaign.sellerCommission) / 100;
  const sellerComm = gross * sellerRate;
  const base = gross - taxesTotal - sellerComm;
  if (base <= 0) return 0;
  const rate = num(product.vipProviderCommissionPercent ?? vipProvider.repassePercent) / 100;
  return roundCents(base * rate);
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

// ─────────────────────────────────────────────────────────────────────────────
// Task #148 — calcPhaseFinancials: fonte única de DRE por batch.
//
// Estrutura contábil do DRE do batch:
//   Receita (Faturamento Bruto)
//     − Impostos (IRPJ + PIS/COFINS + ISS quando aplicável)
//     − Canal (Restaurante OU VIP, mutuamente exclusivos pelo tipo do produto)
//   = Base
//     − Frete (físico)
//     − Produção (físico)
//   = Base de Contribuição
//     − Comissão Vendedor (rateada por receita)
//   = Lucro Líquido
//
// IMPORTANTE — BV da Campanha NÃO é dedução do DRE:
//   BV é uma camada comercial cobrada do cliente em cima do faturamento
//   (acréscimo). Não afeta receita nem custo da empresa: o repasse ao
//   parceiro é um lançamento equilibrado (entrada do cliente + saída ao
//   parceiro de mesmo valor) que zera no DRE. Os campos `bvLiquido`,
//   `bvGrossUp` e `bvTotal` permanecem retornados como informação
//   comercial para a UI exibir em linha INFORMATIVA, fora do cálculo
//   do lucro.
//
// Invariante: Σ batches.lucroLiquido === Consolidado.lucroLiquido (até R$ 0,01).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_BV_GROSS_UP_RATE = 0.1417;

export interface PhaseItemLike {
  productTipo: string | null;
  quantity: number;
  unitPrice: string | number;
  totalPrice?: string | number | null;
  productionCost?: string | number;
  freightCost?: string | number;
  productIrpj?: string | number | null;
  vipProviderRepassePercent?: string | number | null;
  productVipProviderCommissionPercent?: string | number | null;
  vipProviderId?: number | null;
}

export interface PhaseOverrides {
  unitPriceOverride?: string | number | null;
  taxRateOverride?: string | number | null;
  restaurantCommissionOverride?: string | number | null;
  vipRepasseOverride?: string | number | null;
  bvPercentOverride?: string | number | null;
  grossUpRateOverride?: string | number | null;
  freightCostOverride?: string | number | null;
  batchCostOverride?: string | number | null;
}

export interface PhaseCampaignContext {
  isBonificada: boolean | null;
  restaurantCommission: string | number;
  sellerCommission: string | number | null;
  agencyBvPercent?: string | number | null;
  hasAgencyBv?: boolean | null;
  partnerCommissionPercent?: string | number | null; // partners.commissionPercent
  partnerGrossUpRate?: string | number | null;       // partners.grossUpRate
  globalBvGrossUpRate?: string | number | null;      // finance_settings('bv_gross_up_rate')
}

export type EffectiveSource = "override" | "inherited" | "default";

export interface EffectiveParam<T> { value: T; source: EffectiveSource; }

// effNumeric: para campos numéricos (taxa %, valor R$). Aceita override
// como number ou string (vindo do decimal do Postgres) e cai no base
// quando o override é null/undefined/string vazia.
function effNumeric(
  override: string | number | null | undefined,
  base: number,
): EffectiveParam<number> {
  if (override === null || override === undefined) {
    return { value: base, source: "inherited" };
  }
  if (typeof override === "string" && override.trim() === "") {
    return { value: base, source: "inherited" };
  }
  return { value: num(override, base), source: "override" };
}

export interface PhaseFinancials {
  // Tipo do canal escolhido por XOR
  canalTipo: "restaurante" | "vip" | "none";
  // Linhas em R$
  receita: number;
  impostos: number;
  canalValor: number;
  base: number;
  freightCost: number;
  productionCost: number;
  baseContribuicao: number;
  bvLiquido: number;
  bvGrossUp: number;
  bvTotal: number;
  sellerCommission: number;
  lucroLiquido: number;
  margemPct: number;
  // Parâmetros efetivos (com fonte) p/ UI mostrar badge override/herdado
  effective: {
    taxRate: EffectiveParam<number>;          // %
    restaurantCommission: EffectiveParam<number>; // %
    vipRepasse: EffectiveParam<number>;       // %
    bvPercent: EffectiveParam<number>;        // %
    grossUpRate: EffectiveParam<number>;      // % (sobre 1)
    freightCost: EffectiveParam<number>;      // R$
    productionCost: EffectiveParam<number>;   // R$
    sellerCommission: EffectiveParam<number>; // %
  };
  // Breakdown opcional p/ debug/UI clicável
  details: {
    taxesBreakdown: { irpj: number; pisCofins: number; iss: number };
    bvBase: number;
    sellerRate: number;
  };
}

export function calcPhaseFinancials(input: {
  items: PhaseItemLike[];
  campaign: PhaseCampaignContext;
  overrides: PhaseOverrides;
  // Para rateio de seller_commission: se passado, o cálculo retorna a fatia
  // proporcional do batch (receitaBatch / receitaCampanha). Default: full.
  campaignTotalRevenue?: number;
  // ISS: se a campanha aplica ISS retido fora da AP (default: 0%).
  issRatePercent?: number;
}): PhaseFinancials {
  const { items, campaign, overrides } = input;

  const isBonificada = !!campaign.isBonificada;

  // ── Receita: items × unitPrice (com override por batch) ─────────────────
  const upOverride = overrides.unitPriceOverride != null && overrides.unitPriceOverride !== ""
    ? num(overrides.unitPriceOverride) : null;
  const receita = items.reduce((s, it) => {
    if (it.totalPrice != null && upOverride == null) return s + num(it.totalPrice);
    const unit = upOverride != null ? upOverride : num(it.unitPrice);
    return s + (it.quantity * unit);
  }, 0);

  // ── Tipo do canal (XOR pelo tipo do PRIMEIRO item — assumimos batch
  // homogêneo por produto). Se misto, prevalece o que aparecer primeiro;
  // o materializer valida a consistência.
  const firstDigital = items.find((i) => i.productTipo === "telas" || i.productTipo === "janelas_digitais");
  const firstPhysical = items.find((i) => i.productTipo && i.productTipo !== "telas" && i.productTipo !== "janelas_digitais");
  const isDigital = !!firstDigital && !firstPhysical;
  const canalTipo: "restaurante" | "vip" | "none" = isBonificada
    ? "none"
    : (isDigital ? "vip" : (firstPhysical ? "restaurante" : "none"));

  // ── Impostos ────────────────────────────────────────────────────────────
  // Taxa efetiva = override do batch OU média ponderada de products.irpj.
  const irpjAvg = (() => {
    if (items.length === 0) return TAX_RATES.irpjDefault * 100;
    let totW = 0; let acc = 0;
    for (const it of items) {
      const w = it.totalPrice != null ? num(it.totalPrice) : it.quantity * num(it.unitPrice);
      const r = num(it.productIrpj, TAX_RATES.irpjDefault * 100);
      acc += r * w;
      totW += w;
    }
    return totW > 0 ? acc / totW : TAX_RATES.irpjDefault * 100;
  })();
  const irpjEff = effNumeric(overrides.taxRateOverride, irpjAvg);
  const irpjAmount = receita * (irpjEff.value / 100);
  const pisCofinsAmount = receita * TAX_RATES.pisCofins;
  const issAmount = receita * ((input.issRatePercent ?? 0) / 100);
  const impostos = roundCents(irpjAmount + pisCofinsAmount + issAmount);

  // ── Canal (XOR) ─────────────────────────────────────────────────────────
  const restCommBase = num(campaign.restaurantCommission);
  const restCommEff = effNumeric(overrides.restaurantCommissionOverride, restCommBase);

  // VIP rate base: media ponderada de productVipProviderCommissionPercent OU vipProviderRepassePercent
  const vipBase = (() => {
    if (!isDigital) return 0;
    let totW = 0; let acc = 0;
    for (const it of items) {
      if (!(it.productTipo === "telas" || it.productTipo === "janelas_digitais")) continue;
      const w = it.totalPrice != null ? num(it.totalPrice) : it.quantity * num(it.unitPrice);
      const rate = num(it.productVipProviderCommissionPercent ?? it.vipProviderRepassePercent ?? 0);
      acc += rate * w;
      totW += w;
    }
    return totW > 0 ? acc / totW : 0;
  })();
  const vipEff = effNumeric(overrides.vipRepasseOverride, vipBase);

  let canalValor = 0;
  if (isBonificada) {
    canalValor = 0;
  } else if (canalTipo === "restaurante") {
    canalValor = roundCents(receita * (restCommEff.value / 100));
  } else if (canalTipo === "vip") {
    // Repasse VIP: base = receita − impostos − sellerComm (consistente com calcVipRepasse)
    const sellerRateForVipBase = num(campaign.sellerCommission) / 100;
    const baseVip = receita - impostos - (receita * sellerRateForVipBase);
    canalValor = baseVip > 0 ? roundCents(baseVip * (vipEff.value / 100)) : 0;
  }

  const base = roundCents(receita - impostos - canalValor);

  // ── Custos físicos ──────────────────────────────────────────────────────
  const prodFromItems = canalTipo === "vip" || isBonificada
    ? 0
    : items.reduce((s, it) => s + num(it.productionCost ?? 0), 0);
  const prodEff = effNumeric(overrides.batchCostOverride, prodFromItems);
  const productionCost = canalTipo === "vip" || isBonificada ? 0 : roundCents(prodEff.value);
  const freightFromItems = canalTipo === "vip" || isBonificada
    ? 0
    : items.reduce((s, it) => s + num(it.freightCost ?? 0), 0);
  const freightEff = effNumeric(overrides.freightCostOverride, freightFromItems);
  const freightCost = roundCents(freightEff.value);

  const baseContribuicao = roundCents(base - freightCost - productionCost);

  // ── BV da Campanha (com gross-up) ───────────────────────────────────────
  const bvBaseRate = num(campaign.agencyBvPercent ?? campaign.partnerCommissionPercent ?? 0);
  const bvEff = effNumeric(overrides.bvPercentOverride, bvBaseRate);
  const bvActive = !isBonificada && (campaign.hasAgencyBv !== false) && bvEff.value > 0;

  const grossUpBase = num(
    campaign.partnerGrossUpRate ?? campaign.globalBvGrossUpRate ?? (DEFAULT_BV_GROSS_UP_RATE * 100),
  );
  const grossUpEff = effNumeric(overrides.grossUpRateOverride, grossUpBase);
  const grossUpRateDecimal = grossUpEff.value / 100;

  // Base do BV: receita − impostos − canal (após canal já descontado).
  const bvBase = receita - impostos - canalValor;
  let bvLiquido = 0;
  let bvTotal = 0;
  if (bvActive && bvBase > 0) {
    bvLiquido = roundCents(bvBase * (bvEff.value / 100));
    if (grossUpRateDecimal > 0 && grossUpRateDecimal < 1) {
      bvTotal = roundCents(bvLiquido / (1 - grossUpRateDecimal));
    } else {
      bvTotal = bvLiquido;
    }
  }
  const bvGrossUp = roundCents(bvTotal - bvLiquido);

  // ── Comissão Vendedor (rateada por receita) ─────────────────────────────
  const sellerRate = num(campaign.sellerCommission) / 100;
  const sellerEff: EffectiveParam<number> = { value: sellerRate * 100, source: "inherited" };
  const totalRevForRatio = input.campaignTotalRevenue && input.campaignTotalRevenue > 0
    ? input.campaignTotalRevenue
    : receita;
  const sellerCommissionTotal = isBonificada ? 0 : ((input.campaignTotalRevenue ?? receita) * sellerRate);
  const sellerCommission = totalRevForRatio > 0
    ? roundCents((receita / totalRevForRatio) * sellerCommissionTotal)
    : 0;

  // BV NÃO entra no lucro — é repasse comercial em cima do faturamento.
  const lucroLiquido = roundCents(baseContribuicao - sellerCommission);
  const margemPct = receita > 0 ? lucroLiquido / receita : 0;

  return {
    canalTipo,
    receita: roundCents(receita),
    impostos,
    canalValor,
    base,
    freightCost,
    productionCost,
    baseContribuicao,
    bvLiquido,
    bvGrossUp,
    bvTotal,
    sellerCommission,
    lucroLiquido,
    margemPct,
    effective: {
      taxRate: irpjEff,
      restaurantCommission: restCommEff,
      vipRepasse: vipEff,
      bvPercent: bvEff,
      grossUpRate: grossUpEff,
      freightCost: freightEff,
      productionCost: prodEff,
      sellerCommission: sellerEff,
    },
    details: {
      taxesBreakdown: { irpj: roundCents(irpjAmount), pisCofins: roundCents(pisCofinsAmount), iss: roundCents(issAmount) },
      bvBase: roundCents(bvBase),
      sellerRate,
    },
  };
}
