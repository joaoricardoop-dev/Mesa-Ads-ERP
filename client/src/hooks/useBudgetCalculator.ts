export const SEMANAS_OPTIONS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];

export const DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9,
  24: 11, 28: 13, 32: 15, 36: 17, 40: 19,
  44: 21, 48: 23, 52: 25,
};

export interface GlobalBudgetParams {
  semanas: number;
  formaPagamento: "pix" | "boleto" | "cartao";
  irpj: number;
  comissaoRestaurante: number;
  comissaoComercial: number;
  descontoParceiro: boolean;
  isBonificada: boolean;
}

export interface ItemPricingInput {
  volume: number;
  custoUnitario: number;
  frete: number;
  margem: number;
  artes: number;
}

export interface ItemCalcResult {
  denominador: number;
  custoTotal4sem: number;
  precoTotalBase4sem: number;
  precoUnit4sem: number;
  precoSemDesconto: number;
  nPeriodos: number;
  custoPorUnidade: number;
}

export interface BudgetTotals {
  nPeriodos: number;
  subtotal: number;
  descPrazoPerc: number;
  descPrazoVal: number;
  ajPagPerc: number;
  ajPagamentoVal: number;
  descParceiroPerc: number;
  descParceiroVal: number;
  total: number;
  mensal: number;
}

export function calcItemPrice(item: ItemPricingInput, params: Pick<GlobalBudgetParams, "semanas" | "irpj" | "comissaoRestaurante" | "comissaoComercial">): ItemCalcResult {
  const irpj = params.irpj / 100;
  const comRest = params.comissaoRestaurante / 100;
  const comCom = params.comissaoComercial / 100;

  const denominador = 1 - item.margem - irpj - comRest - comCom;
  const custoTotal4sem = item.custoUnitario * item.artes * item.volume + item.frete;
  const precoTotalBase4sem = denominador > 0 ? custoTotal4sem / denominador : 0;
  const precoUnit4sem = item.volume > 0 ? precoTotalBase4sem / item.volume : 0;
  const nPeriodos = params.semanas / 4;
  const precoSemDesconto = precoTotalBase4sem * nPeriodos;
  const custoPorUnidade = item.volume > 0 ? custoTotal4sem / item.volume : 0;

  return { denominador, custoTotal4sem, precoTotalBase4sem, precoUnit4sem, precoSemDesconto, nPeriodos, custoPorUnidade };
}

export function calcBudgetTotals(itemCalcs: ItemCalcResult[], params: GlobalBudgetParams): BudgetTotals {
  const { semanas, formaPagamento, descontoParceiro, isBonificada } = params;
  const nPeriodos = semanas / 4;

  if (isBonificada) {
    return { nPeriodos, subtotal: 0, descPrazoPerc: 0, descPrazoVal: 0, ajPagPerc: 0, ajPagamentoVal: 0, descParceiroPerc: 0, descParceiroVal: 0, total: 0, mensal: 0 };
  }

  const subtotal = itemCalcs.reduce((sum, c) => sum + c.precoSemDesconto, 0);
  const descPrazoPerc = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
  const descPrazoVal = subtotal * descPrazoPerc;
  const aposDescPrazo = subtotal - descPrazoVal;

  const ajPagPerc = formaPagamento === "pix" ? -0.05 : formaPagamento === "cartao" ? 0 : 0;
  const ajPagamentoVal = aposDescPrazo * ajPagPerc;
  const aposAjPag = aposDescPrazo + ajPagamentoVal;

  const descParceiroPerc = descontoParceiro ? 0.10 : 0;
  const descParceiroVal = aposAjPag * descParceiroPerc;
  const total = aposAjPag - descParceiroVal;
  const mensal = nPeriodos > 0 ? total / nPeriodos : 0;

  return { nPeriodos, subtotal, descPrazoPerc, descPrazoVal, ajPagPerc, ajPagamentoVal, descParceiroPerc, descParceiroVal, total, mensal };
}

export function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtBRL4(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
