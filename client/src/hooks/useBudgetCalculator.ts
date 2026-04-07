// ─── Constants ────────────────────────────────────────────────────────────────

export const SEMANAS_OPTIONS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];

export const DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11, 28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
};

export const DEFAULT_PREMISSAS = {
  irpj: 6,
  comissaoRestaurante: 15,
  comissaoComercial: 10,
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ItemPremissas {
  irpj: number;
  comissaoRestaurante: number;
  comissaoComercial: number;
}

export interface ItemPricingInput {
  volume: number;
  custoUnitario: number;
  frete: number;
  margem: number;
  artes: number;
  semanas: number;
  premissas: ItemPremissas;
  precoBase?: number;
  discountPriceTiers?: DiscountPriceTier[];
}

/** Parâmetros globais que se aplicam ao orçamento inteiro */
export interface GlobalBudgetParams {
  formaPagamento: "pix" | "boleto" | "cartao";
  descontoParceiro: boolean;
  isBonificada: boolean;
  descontoManualPercent: number;
  /** BV da agência/parceiro em % (0–99.9). Gross-up sobre o total. */
  agencyBVPercent?: number;
  /** IRPJ ponderado pelos itens, em decimal (ex: 0.06). Usado no gross-up do BV. */
  agencyBVWeightedIrpj?: number;
}

export interface DiscountPriceTier {
  priceMin: number;
  priceMax: number;
  discountPercent: number;
}

export interface ItemCalcResult {
  denominador: number;
  custoTotal4sem: number;
  precoTotalBase4sem: number;
  precoUnit4sem: number;
  nPeriodos: number;
  custoPorUnidade: number;
  precoSemDesconto: number;
  descFaixaPrecoPerc: number;
  descFaixaPrecoVal: number;
  descPrazoPerc: number;
  descPrazoVal: number;
  precoComDescDuracao: number;
  semanas: number;
  isPriceBased: boolean;
  receitaMensal?: number;
}

export interface BudgetTotals {
  subtotalPostDuration: number;
  ajPagPerc: number;
  ajPagamentoVal: number;
  descParceiroPerc: number;
  descParceiroVal: number;
  descManualPerc: number;
  descManualVal: number;
  total: number;
  agencyBVVal: number;
  totalFinal: number;
}

// ─── Calculation ───────────────────────────────────────────────────────────────

function applyDiscountPriceTier(price: number, tiers?: DiscountPriceTier[]): { perc: number; val: number } {
  if (!tiers || tiers.length === 0) return { perc: 0, val: 0 };
  const tier = tiers.find(t => price >= t.priceMin && price <= t.priceMax);
  if (!tier) return { perc: 0, val: 0 };
  const perc = tier.discountPercent / 100;
  return { perc, val: price * perc };
}

export function calcItemPrice(input: ItemPricingInput): ItemCalcResult {
  const { volume, custoUnitario, frete, margem, artes, semanas, premissas, precoBase, discountPriceTiers } = input;
  const irpj = premissas.irpj / 100;
  const comRest = premissas.comissaoRestaurante / 100;
  const comCom = premissas.comissaoComercial / 100;

  const isPriceBased = precoBase !== undefined && precoBase > 0;

  if (isPriceBased) {
    const nPeriodos = semanas / 4;
    const precoSemDesconto = precoBase * nPeriodos;
    // Faixa discount applied on gross bruto amount (before prazo)
    const { perc: descFaixaPrecoPerc, val: descFaixaPrecoVal } = applyDiscountPriceTier(precoSemDesconto, discountPriceTiers);
    const precoPosFaixa = precoSemDesconto - descFaixaPrecoVal;
    const descPrazoPerc = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
    const descPrazoVal = precoPosFaixa * descPrazoPerc;
    const precoComDescDuracao = precoPosFaixa - descPrazoVal;
    const precoUnit4sem = volume > 0 ? precoBase / volume : 0;
    const receitaMensal = nPeriodos > 0 ? precoComDescDuracao / nPeriodos : 0;

    return {
      denominador: 1 - irpj - comRest,
      custoTotal4sem: 0,
      precoTotalBase4sem: precoBase,
      precoUnit4sem,
      nPeriodos,
      custoPorUnidade: 0,
      precoSemDesconto,
      descFaixaPrecoPerc,
      descFaixaPrecoVal,
      descPrazoPerc,
      descPrazoVal,
      precoComDescDuracao,
      semanas,
      isPriceBased: true,
      receitaMensal,
    };
  }

  const denominador = 1 - margem - irpj - comRest - comCom;
  const custoTotal4sem = custoUnitario * artes * volume + frete;
  const precoTotalBase4sem = denominador > 0 && custoTotal4sem > 0
    ? custoTotal4sem / denominador
    : 0;
  const precoUnit4sem = volume > 0 ? precoTotalBase4sem / volume : 0;

  const nPeriodos = semanas / 4;
  const precoSemDesconto = precoTotalBase4sem * nPeriodos;

  // Faixa discount applied on gross bruto amount (before prazo)
  const { perc: descFaixaPrecoPerc, val: descFaixaPrecoVal } = applyDiscountPriceTier(precoSemDesconto, discountPriceTiers);
  const precoPosFaixa = precoSemDesconto - descFaixaPrecoVal;
  const descPrazoPerc = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
  const descPrazoVal = precoPosFaixa * descPrazoPerc;
  const precoComDescDuracao = precoPosFaixa - descPrazoVal;
  const custoPorUnidade = volume > 0 ? custoTotal4sem / volume : 0;

  return {
    denominador,
    custoTotal4sem,
    precoTotalBase4sem,
    precoUnit4sem,
    nPeriodos,
    custoPorUnidade,
    precoSemDesconto,
    descFaixaPrecoPerc,
    descFaixaPrecoVal,
    descPrazoPerc,
    descPrazoVal,
    precoComDescDuracao,
    semanas,
    isPriceBased: false,
  };
}

export function calcBudgetTotals(
  itemCalcs: ItemCalcResult[],
  params: GlobalBudgetParams
): BudgetTotals {
  const { formaPagamento, descontoParceiro, isBonificada, descontoManualPercent, agencyBVPercent = 0, agencyBVWeightedIrpj = 0 } = params;

  if (isBonificada) {
    return { subtotalPostDuration: 0, ajPagPerc: 0, ajPagamentoVal: 0, descParceiroPerc: 0, descParceiroVal: 0, descManualPerc: 0, descManualVal: 0, total: 0, agencyBVVal: 0, totalFinal: 0 };
  }

  const subtotalPostDuration = itemCalcs.reduce((sum, c) => sum + c.precoComDescDuracao, 0);
  const ajPagPerc = formaPagamento === "pix" ? -0.05 : 0;
  const ajPagamentoVal = subtotalPostDuration * ajPagPerc;
  const aposAjPag = subtotalPostDuration + ajPagamentoVal;
  const descParceiroPerc = descontoParceiro ? 0.10 : 0;
  const descParceiroVal = aposAjPag * descParceiroPerc;
  const aposDescParceiro = aposAjPag - descParceiroVal;
  const descManualPerc = Math.min(Math.max(descontoManualPercent, 0), 100) / 100;
  const descManualVal = aposDescParceiro * descManualPerc;
  const total = aposDescParceiro - descManualVal;

  // Gross-up de BV: totalFinal = total / (1 − bv − irpj)
  const bv = Math.min(Math.max(agencyBVPercent, 0), 99.9) / 100;
  const irpj = Math.min(Math.max(agencyBVWeightedIrpj, 0), 0.999);
  const den = 1 - bv - irpj;
  const agencyBVVal = (bv > 0 && den > 0) ? total / den - total : 0;
  const totalFinal = total + agencyBVVal;

  return { subtotalPostDuration, ajPagPerc, ajPagamentoVal, descParceiroPerc, descParceiroVal, descManualPerc, descManualVal, total, agencyBVVal, totalFinal };
}

// ─── Formatting ────────────────────────────────────────────────────────────────

export function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtBRL4(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
