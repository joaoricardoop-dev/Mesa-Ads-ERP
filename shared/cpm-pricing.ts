// ─── Precificação de telas por CPM (fonte única) ─────────────────────────────
// Toda a matemática de preço de telas (DOOH) vive AQUI. Telas-de-mídia são
// precificadas exclusivamente por CPM (custo por mil impactos), por local.
// Esta é a única origem do cálculo — lida por: editor do local (preview),
// motor da cotação (quotePrice) e qualquer relatório/PDF de tela.
//
// Fórmula (modo simples, "por espaço"):
//   preço por inserção  = CPM / 1000 × impactos por inserção
//   inserções por semana = inserções por hora × horas de operação por semana
//   receita por semana   = preço por inserção × inserções por semana
//
// Exemplo: CPM 29,90 · 10 ins/h · 33,04 impactos/ins · 65 h/sem
//   → 650 inserções/sem · R$ 0,99/ins · ~R$ 642,13/sem

export interface ScreenCpmConfig {
  /** CPM em reais (R$ por 1000 impactos). */
  cpm: number;
  /** Inserções por hora de operação. */
  insertionsPerHour: number;
  /** Impactos (pessoas alcançadas) por inserção. */
  impactsPerInsertion: number;
  /** Horas de operação por semana. */
  weeklyHours: number;
}

export interface ScreenCpmResult {
  pricePerInsertion: number;
  weeklyInsertions: number;
  weeklyRevenue: number;
}

function isPositiveFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Calcula a precificação CPM de uma tela. Retorna `null` quando qualquer
 * insumo está ausente ou não-positivo — nesse caso a tela NÃO tem preço e
 * exige configuração (regra de negócio: telas só são precificadas por CPM).
 */
export function computeCpmPricing(
  config: Partial<ScreenCpmConfig> | null | undefined,
): ScreenCpmResult | null {
  if (!config) return null;
  const { cpm, insertionsPerHour, impactsPerInsertion, weeklyHours } = config;
  if (
    !isPositiveFinite(cpm) ||
    !isPositiveFinite(insertionsPerHour) ||
    !isPositiveFinite(impactsPerInsertion) ||
    !isPositiveFinite(weeklyHours)
  ) {
    return null;
  }
  const pricePerInsertion = (cpm / 1000) * impactsPerInsertion;
  const weeklyInsertions = insertionsPerHour * weeklyHours;
  const weeklyRevenue = pricePerInsertion * weeklyInsertions;
  return { pricePerInsertion, weeklyInsertions, weeklyRevenue };
}

/** Helper: converte uma string/decimal vinda do banco em número ou undefined. */
export function parseCpmNumber(v: string | number | null | undefined): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}
