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
}

/** Parâmetros globais que se aplicam ao orçamento inteiro */
export interface GlobalBudgetParams {
  formaPagamento: "pix" | "boleto" | "cartao";
  descontoParceiro: boolean;
  isBonificada: boolean;
  descontoManualPercent: number;
}

export interface ItemCalcResult {
  denominador: number;
  custoTotal4sem: number;
  precoTotalBase4sem: number;
  precoUnit4sem: number;
  nPeriodos: number;
  custoPorUnidade: number;
  precoSemDesconto: number;
  descPrazoPerc: number;
  descPrazoVal: number;
  precoComDescDuracao: number;
  semanas: number;
  isPriceBased: boolean;
  receitaLiquidaGPC?: number;
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
}

// ─── Calculation ───────────────────────────────────────────────────────────────

export function calcItemPrice(input: ItemPricingInput): ItemCalcResult {
  const { volume, custoUnitario, frete, margem, artes, semanas, premissas, precoBase } = input;
  const irpj = premissas.irpj / 100;
  const comRest = premissas.comissaoRestaurante / 100;
  const comCom = premissas.comissaoComercial / 100;

  const isPriceBased = precoBase !== undefined && precoBase > 0;

  if (isPriceBased) {
    const nPeriodos = semanas / 4;
    const precoSemDesconto = precoBase * nPeriodos;
    const descPrazoPerc = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
    const descPrazoVal = precoSemDesconto * descPrazoPerc;
    const precoComDescDuracao = precoSemDesconto - descPrazoVal;
    const precoUnit4sem = volume > 0 ? precoBase / volume : 0;
    const receitaLiquidaGPC = precoBase * (1 - irpj - comRest - comCom);

    return {
      denominador: 1 - irpj - comRest,
      custoTotal4sem: 0,
      precoTotalBase4sem: precoBase,
      precoUnit4sem,
      nPeriodos,
      custoPorUnidade: 0,
      precoSemDesconto,
      descPrazoPerc,
      descPrazoVal,
      precoComDescDuracao,
      semanas,
      isPriceBased: true,
      receitaLiquidaGPC,
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

  const descPrazoPerc = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
  const descPrazoVal = precoSemDesconto * descPrazoPerc;
  const precoComDescDuracao = precoSemDesconto - descPrazoVal;
  const custoPorUnidade = volume > 0 ? custoTotal4sem / volume : 0;

  return {
    denominador,
    custoTotal4sem,
    precoTotalBase4sem,
    precoUnit4sem,
    nPeriodos,
    custoPorUnidade,
    precoSemDesconto,
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
  const { formaPagamento, descontoParceiro, isBonificada, descontoManualPercent } = params;

  if (isBonificada) {
    return { subtotalPostDuration: 0, ajPagPerc: 0, ajPagamentoVal: 0, descParceiroPerc: 0, descParceiroVal: 0, descManualPerc: 0, descManualVal: 0, total: 0 };
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

  return { subtotalPostDuration, ajPagPerc, ajPagamentoVal, descParceiroPerc, descParceiroVal, descManualPerc, descManualVal, total };
}

// ─── Formatting ────────────────────────────────────────────────────────────────

export function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtBRL4(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
