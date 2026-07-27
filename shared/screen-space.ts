// ─── Derivação do Espaço de Mídia a partir do inventário de telas (fonte única) ──
// Quando um local tem ≥1 tela ATIVA cadastrada no inventário (`telas`), os
// campos de "Espaço de Mídia (Telas)" do local (active_restaurants.screen*)
// deixam de ser editados manualmente e passam a ser DERIVADOS daqui. Esta é a
// ÚNICA origem dessa derivação — lida pelo form do local (painel read-only),
// pelo materializador server-side (que persiste os derivados nas colunas
// screen* do local) e por qualquer badge de pendência.
//
// Regras de agregação (1 tela = 1 circuito):
//   • screensCount            = nº de telas ativas
//   • operatingHours (grade)  = UNIÃO das grades das telas
//   • weeklyHours             = nº de células da união (1 célula = 1 hora)
//   • inserções/semana (tela) = (3600 ÷ loopDuration) × horas da grade da tela
//                               — o spot roda 1× por loop. Fallback: campo
//                               insertions_per_week da tela quando loop/grade
//                               não estão preenchidos (circuitos legados).
//   • insertionsPerHour       = Σ inserções/semana ÷ weeklyHours (união)
//   • custo/inserção (espaço) = média PONDERADA por inserções/semana
//   • impactos/inserção       = média PONDERADA por inserções/semana
//   • CPM                     = custo/inserção × 1000 ÷ impactos/inserção
//
// Pendências: cada tela informa o que falta para a derivação completa. O
// materializador grava NULL nos campos não deriváveis — nunca cai em silêncio
// nos valores manuais antigos.

import { parseOperatingHours } from "./screen-schedule";
import { parseCpmNumber } from "./cpm-pricing";

export interface TelaSpaceInput {
  id: number;
  nome?: string | null;
  status?: string | null;
  spotDuration?: number | null;
  loopDuration?: number | null;
  insertionsPerWeek?: number | null;
  costPerInsertion?: string | number | null;
  impactsPerInsertion?: string | number | null;
  /** JSON text ou array de chaves "dia-hora" (shared/screen-schedule). */
  screenOperatingHours?: unknown;
}

export interface TelaPendencia {
  telaId: number;
  nome: string;
  missing: string[];
}

export interface ScreenSpaceDerivation {
  /** Nº de telas ativas consideradas. */
  screensCount: number;
  /** União das grades de horário (chaves "dia-hora"). */
  operatingHours: string[];
  /** Horas/semana = nº de células da união. */
  weeklyHours: number;
  /** Σ inserções/semana de todas as telas (null se nenhuma derivável). */
  weeklyInsertions: number | null;
  /** Inserções/hora do espaço = Σ inserções/semana ÷ weeklyHours. */
  insertionsPerHour: number | null;
  /** Custo/inserção médio ponderado por inserções. */
  costPerInsertion: number | null;
  /** Impactos/inserção médio ponderado por inserções. */
  impactsPerInsertion: number | null;
  /** CPM = custo/inserção × 1000 ÷ impactos/inserção. */
  cpm: number | null;
  /** Pendências por tela (vazio = derivação completa). */
  pendencias: TelaPendencia[];
  /** true quando TODOS os campos derivados estão presentes. */
  isComplete: boolean;
}

/** Rótulos PT-BR das pendências por tela. */
export const TELA_PENDENCIA_LABELS = {
  insertions: "Inserções (loop + grade de horário, ou inserções/semana)",
  schedule: "Grade de horário",
  cost: "Custo/inserção",
  impacts: "Impactos/inserção",
} as const;

function positive(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Inserções/semana de UMA tela (fonte única): derivada de loop + grade quando
 * ambos existem ((3600 ÷ loop) × horas), senão o campo insertions_per_week.
 * Retorna null quando nenhuma das duas origens está disponível.
 */
export function telaWeeklyInsertions(tela: TelaSpaceInput): number | null {
  const hours = parseOperatingHours(tela.screenOperatingHours).length;
  if (positive(tela.loopDuration) && hours > 0) {
    return (3600 / tela.loopDuration!) * hours;
  }
  if (positive(tela.insertionsPerWeek)) return tela.insertionsPerWeek!;
  return null;
}

/** Pendências de UMA tela para a derivação do espaço. */
export function telaSpacePendencias(tela: TelaSpaceInput): string[] {
  const missing: string[] = [];
  if (telaWeeklyInsertions(tela) == null) missing.push(TELA_PENDENCIA_LABELS.insertions);
  if (parseOperatingHours(tela.screenOperatingHours).length === 0) {
    missing.push(TELA_PENDENCIA_LABELS.schedule);
  }
  if (!positive(parseCpmNumber(tela.costPerInsertion) ?? null)) {
    missing.push(TELA_PENDENCIA_LABELS.cost);
  }
  if (!positive(parseCpmNumber(tela.impactsPerInsertion) ?? null)) {
    missing.push(TELA_PENDENCIA_LABELS.impacts);
  }
  return missing;
}

/**
 * Deriva os campos do Espaço de Mídia do local a partir das telas ATIVAS do
 * inventário. Telas inativas são ignoradas. Retorna null quando não há telas
 * ativas — nesse caso o local segue no modo manual (campos editáveis).
 */
export function deriveScreenSpace(
  telasList: TelaSpaceInput[] | null | undefined,
): ScreenSpaceDerivation | null {
  const active = (telasList ?? []).filter((t) => (t.status ?? "active") === "active");
  if (active.length === 0) return null;

  // União das grades (ordenada dia→hora para saída determinística).
  const union = new Set<string>();
  for (const t of active) {
    for (const key of parseOperatingHours(t.screenOperatingHours)) union.add(key);
  }
  const operatingHours = Array.from(union).sort((a, b) => {
    const [da, ha] = a.split("-").map(Number);
    const [db, hb] = b.split("-").map(Number);
    return da - db || ha - hb;
  });
  const weeklyHours = operatingHours.length;

  let totalInsertions = 0;
  let costWeighted = 0;
  let costWeight = 0;
  let impactsWeighted = 0;
  let impactsWeight = 0;
  let anyInsertions = false;

  const pendencias: TelaPendencia[] = [];
  active.forEach((t, i) => {
    const missing = telaSpacePendencias(t);
    if (missing.length > 0) {
      pendencias.push({ telaId: t.id, nome: t.nome?.trim() || `Tela #${t.id ?? i + 1}`, missing });
    }
    const weekly = telaWeeklyInsertions(t);
    if (weekly != null) {
      anyInsertions = true;
      totalInsertions += weekly;
      const cost = parseCpmNumber(t.costPerInsertion);
      if (positive(cost ?? null)) {
        costWeighted += cost! * weekly;
        costWeight += weekly;
      }
      const impacts = parseCpmNumber(t.impactsPerInsertion);
      if (positive(impacts ?? null)) {
        impactsWeighted += impacts! * weekly;
        impactsWeight += weekly;
      }
    }
  });

  // Só consideramos custo/impactos deriváveis quando TODAS as telas com
  // inserções contribuem — média parcial esconderia telas sem configuração.
  const allHaveCost = active.every((t) => positive(parseCpmNumber(t.costPerInsertion) ?? null));
  const allHaveImpacts = active.every((t) => positive(parseCpmNumber(t.impactsPerInsertion) ?? null));
  const allHaveInsertions = active.every((t) => telaWeeklyInsertions(t) != null);

  const weeklyInsertions = anyInsertions && allHaveInsertions ? totalInsertions : null;
  const insertionsPerHour =
    weeklyInsertions != null && weeklyHours > 0 ? weeklyInsertions / weeklyHours : null;
  const costPerInsertion =
    allHaveCost && allHaveInsertions && costWeight > 0 ? costWeighted / costWeight : null;
  const impactsPerInsertion =
    allHaveImpacts && allHaveInsertions && impactsWeight > 0 ? impactsWeighted / impactsWeight : null;
  const cpm =
    costPerInsertion != null && positive(impactsPerInsertion)
      ? (costPerInsertion * 1000) / impactsPerInsertion!
      : null;

  return {
    screensCount: active.length,
    operatingHours,
    weeklyHours,
    weeklyInsertions,
    insertionsPerHour,
    costPerInsertion,
    impactsPerInsertion,
    cpm,
    pendencias,
    isComplete:
      pendencias.length === 0 &&
      weeklyHours > 0 &&
      insertionsPerHour != null &&
      costPerInsertion != null &&
      impactsPerInsertion != null &&
      cpm != null,
  };
}
