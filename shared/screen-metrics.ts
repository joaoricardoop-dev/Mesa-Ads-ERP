// ─── Métricas de tela (DOOH) — fonte única ──────────────────────────────────
// Projeção de performance de telas (exibições / alcance / frequência) vive AQUI.
// É a única origem dessas derivações — lida pelo card do inventário, pelo painel
// "performance projetada" do plano de mídia e por qualquer relatório de tela.
//
// Regra de negócio crítica: as inserções/dia por tela vêm POR PADRÃO do cadastro
// (não há constante fixa). A origem canônica é a configuração do local:
//   inserções/dia = inserções/hora × (horas de operação por semana ÷ 7)
// com fallback para `dailyLoops` (cadastro direto da tela) quando o CPM não está
// configurado. O valor pode ser sobrescrito POR ITEM no plano de mídia sem
// alterar o cadastro — quem sobrescreve passa o número editado a `computeScreenMetrics`.

export interface ScreenRegistration {
  /** Inserções por hora de operação (cadastro CPM do local). */
  insertionsPerHour?: number | null;
  /** Horas de operação por semana (cadastro CPM do local). */
  weeklyHours?: number | null;
  /** Loops/inserções por dia (cadastro direto da tela) — fallback. */
  dailyLoops?: number | null;
}

function positive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Inserções/dia PADRÃO derivadas do cadastro. Origem canônica única — qualquer
 * tela/painel que precise do default DEVE chamar esta função (nunca recalcular
 * nem usar uma constante).
 *
 * Prioridade determinística:
 *   1. CPM do local: inserções/hora × (horas/semana ÷ 7)
 *   2. `dailyLoops` da tela (fallback quando o CPM não está completo)
 *   3. 0 quando não há dado de cadastro (a UI deve sinalizar "não configurado")
 */
export function defaultInsertionsPerDay(reg: ScreenRegistration | null | undefined): number {
  if (!reg) return 0;
  if (positive(reg.insertionsPerHour) && positive(reg.weeklyHours)) {
    return (reg.insertionsPerHour * reg.weeklyHours) / 7;
  }
  if (positive(reg.dailyLoops)) return reg.dailyLoops;
  return 0;
}

export interface ScreenMetricsInput {
  /** Inserções/dia por tela — default do cadastro OU override por item. */
  insertionsPerDay: number;
  /** Impactos (pessoas) por inserção (cadastro CPM). Default 1 quando ausente. */
  impactsPerInsertion?: number | null;
  /** Clientes/mês do local — base de alcance. */
  monthlyCustomers?: number | null;
  /** Dias do período (cobrados). */
  days: number;
  /** Número de telas ativas no local. */
  screens: number;
}

export interface ScreenMetrics {
  screens: number;
  insertionsPerDay: number;
  /** Exibições (impressões) totais no período = inserções/dia × dias × telas × impactos/inserção. */
  exibicoes: number;
  /** Alcance estimado (pessoas únicas) no período ≈ clientes/mês × dias ÷ 30. */
  alcance: number;
  /** Frequência média = exibições ÷ alcance. */
  frequencia: number;
}

/**
 * Projeta as métricas de tela para um período. Determinística e pura — única
 * origem dos números mostrados no card e no painel de performance.
 */
export function computeScreenMetrics(input: ScreenMetricsInput): ScreenMetrics {
  const screens = Math.max(0, Math.floor(input.screens || 0));
  const insertionsPerDay = Math.max(0, input.insertionsPerDay || 0);
  const days = Math.max(0, Math.floor(input.days || 0));
  const impacts = positive(input.impactsPerInsertion) ? input.impactsPerInsertion : 1;

  const exibicoes = Math.round(insertionsPerDay * days * screens * impacts);
  const alcance = Math.round((input.monthlyCustomers ?? 0) * (days / 30));
  const frequencia = alcance > 0 ? exibicoes / alcance : 0;

  return { screens, insertionsPerDay, exibicoes, alcance, frequencia };
}
