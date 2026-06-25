// ─── Período de campanha: datas livres ↔ ciclos de 4 semanas (fonte única) ────
// Toda derivação "datas escolhidas → ciclos/semanas/dias" vive AQUI. O usuário
// escolhe início/fim livres num calendário; por baixo, o estoque (disponibilidade)
// e o DRE continuam raciocinando em ciclos de 4 semanas. Esta é a única origem
// dessa conversão — lida pelo construtor (wizard), pelo backend (createFromBuilder)
// e por qualquer relatório que precise mapear datas em ciclos.
//
// Convenção de contagem: DIAS INCLUSIVOS. Um ciclo tem 28 dias e vai de
// `start` até `start+27` (mesma convenção do calendário de batches em
// server/batchRouter.ts). Logo: 7 dias = 1 semana, 28 dias = 1 ciclo.

/** Semanas por ciclo (1 ciclo = 4 semanas). Fonte única. */
export const CYCLE_WEEKS = 4;
/** Dias por ciclo (4 semanas × 7). Fonte única do tamanho do ciclo. */
export const CYCLE_DAYS = CYCLE_WEEKS * 7; // 28
/** Piso de cobrança de telas: mínimo de 1 semana (7 dias). */
export const SCREEN_MIN_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Converte "YYYY-MM-DD" em timestamp UTC à meia-noite (sem off-by-one de fuso). */
function parseIsoDateUtc(iso: string): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

/**
 * Número de dias INCLUSIVOS entre `start` e `end` (ambos "YYYY-MM-DD").
 * Ex.: 2026-07-01 → 2026-07-07 = 7 dias; 2026-07-01 → 2026-07-28 = 28 dias.
 * Retorna 0 quando alguma data é inválida ou `end` é anterior a `start`.
 */
export function daysInRangeInclusive(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const s = parseIsoDateUtc(start);
  const e = parseIsoDateUtc(end);
  if (s == null || e == null) return 0;
  const diff = Math.round((e - s) / MS_PER_DAY) + 1;
  return diff > 0 ? diff : 0;
}

/** Ciclos de 4 semanas necessários para cobrir `days` (arredonda PRA CIMA, mín. 1). */
export function cyclesForDays(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 1;
  return Math.max(1, Math.ceil(days / CYCLE_DAYS));
}

/** Semanas correspondentes a `cycles` ciclos cheios. */
export function weeksForCycles(cycles: number): number {
  const c = Number.isFinite(cycles) && cycles > 0 ? Math.floor(cycles) : 1;
  return c * CYCLE_WEEKS;
}

/** Dias efetivamente cobrados de uma tela, respeitando o piso de 7 dias. */
export function billedScreenDays(days: number): number {
  const d = Number.isFinite(days) ? Math.round(days) : 0;
  return Math.max(SCREEN_MIN_DAYS, d > 0 ? d : 0);
}

export interface DerivedPeriod {
  /** Dias inclusivos selecionados no calendário. */
  days: number;
  /** Ciclos de 4 semanas que o período cobre (arredondado pra cima). */
  cycles: number;
  /** Semanas cheias (cycles × 4) — usado por produtos físicos por ciclo. */
  weeks: number;
}

/**
 * Deriva o período canônico (dias/ciclos/semanas) a partir de datas livres.
 * Produtos físicos por ciclo usam `weeks`/`cycles` (período arredondado para
 * ciclos cheios); telas usam `days` (precificação diária, ver cpm-pricing).
 */
export function derivePeriod(start: string | null | undefined, end: string | null | undefined): DerivedPeriod {
  const days = daysInRangeInclusive(start, end);
  const cycles = cyclesForDays(days);
  return { days, cycles, weeks: weeksForCycles(cycles) };
}
