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

// ─── Precificação diária de telas (deriva da fonte CPM) ──────────────────────
// Telas deixam de ser cobradas por ciclo: o preço passa a ser DIÁRIA × nº de
// dias, com piso de 1 semana (7 dias). A diária NÃO é um novo dado — é derivada
// da MESMA configuração CPM (receita semanal ÷ 7), preservando o CPM como única
// origem da economia da tela.

import { SCREEN_MIN_DAYS, billedScreenDays } from "./period";

export interface ScreenDailyResult {
  /** Receita semanal CPM (fonte). */
  weeklyRevenue: number;
  /** Diária = receita semanal ÷ 7. */
  dailyRate: number;
  /** Dias efetivamente cobrados (respeita o piso de 7 dias). */
  billedDays: number;
  /** Total = diária × dias cobrados. */
  totalPrice: number;
}

/**
 * Calcula o preço diário de uma tela para `days` dias selecionados.
 * - `dailyRate` deriva do CPM (receita semanal ÷ 7) — fonte única.
 * - `billedDays` aplica o piso de {@link SCREEN_MIN_DAYS} (1 semana).
 * Retorna `null` quando a tela não tem CPM configurado (sem preço).
 */
export function computeScreenDailyPricing(
  config: Partial<ScreenCpmConfig> | null | undefined,
  days: number,
): ScreenDailyResult | null {
  const cpm = computeCpmPricing(config);
  if (!cpm) return null;
  const dailyRate = cpm.weeklyRevenue / SCREEN_MIN_DAYS; // 7 dias = 1 semana
  const billedDays = billedScreenDays(days);
  return {
    weeklyRevenue: cpm.weeklyRevenue,
    dailyRate,
    billedDays,
    totalPrice: dailyRate * billedDays,
  };
}

/** Helper: converte uma string/decimal vinda do banco em número ou undefined. */
export function parseCpmNumber(v: string | number | null | undefined): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

// ─── Status de configuração da tela (fonte única) ────────────────────────────
// Uma tela só mostra preço e audiência reais quando (a) a config CPM está
// completa (mesmos campos exigidos por computeCpmPricing) e (b) tem coordenadas
// (lat/lng) para o pin do mapa. Este helper é a ÚNICA origem da regra "tela
// configurada vs. pendente" — usado pelas telas admin (Locais Ativos, Telas) e
// pelo catálogo do Orçamento para sinalizar lacunas aos administradores.

/** Rótulos PT-BR dos campos CPM, na ordem de exibição. */
export const SCREEN_CPM_FIELD_LABELS: Record<keyof ScreenCpmConfig, string> = {
  cpm: "CPM",
  insertionsPerHour: "Inserções/hora",
  impactsPerInsertion: "Impactos/inserção",
  weeklyHours: "Horas/semana",
};

export interface ScreenSetupInput {
  cpm?: string | number | null;
  insertionsPerHour?: string | number | null;
  impactsPerInsertion?: string | number | null;
  weeklyHours?: string | number | null;
  lat?: string | number | null;
  lng?: string | number | null;
}

export interface ScreenSetupStatus {
  /** Todos os 4 campos CPM positivos e finitos (tela tem preço). */
  cpmComplete: boolean;
  /** lat/lng presentes e finitos (e não 0,0) — tela tem pin no mapa. */
  hasCoordinates: boolean;
  /** CPM completo E coordenadas presentes. */
  isComplete: boolean;
  /** Rótulos dos campos CPM ausentes/zerados. */
  missingCpmFields: string[];
  /** Coordenadas ausentes. */
  missingCoordinates: boolean;
  /** Todos os rótulos faltantes (CPM + coordenadas), para tooltip/resumo. */
  missing: string[];
}

/**
 * Avalia o que falta para uma tela ficar totalmente configurada.
 * Aceita valores numéricos ou strings (vindas do banco) e normaliza.
 */
export function screenSetupStatus(input: ScreenSetupInput | null | undefined): ScreenSetupStatus {
  const cpm = parseCpmNumber(input?.cpm);
  const insertionsPerHour = parseCpmNumber(input?.insertionsPerHour);
  const impactsPerInsertion = parseCpmNumber(input?.impactsPerInsertion);
  const weeklyHours = parseCpmNumber(input?.weeklyHours);

  const missingCpmFields: string[] = [];
  if (!isPositiveFinite(cpm)) missingCpmFields.push(SCREEN_CPM_FIELD_LABELS.cpm);
  if (!isPositiveFinite(insertionsPerHour)) missingCpmFields.push(SCREEN_CPM_FIELD_LABELS.insertionsPerHour);
  if (!isPositiveFinite(impactsPerInsertion)) missingCpmFields.push(SCREEN_CPM_FIELD_LABELS.impactsPerInsertion);
  if (!isPositiveFinite(weeklyHours)) missingCpmFields.push(SCREEN_CPM_FIELD_LABELS.weeklyHours);
  const cpmComplete = missingCpmFields.length === 0;

  const lat = parseCpmNumber(input?.lat);
  const lng = parseCpmNumber(input?.lng);
  const hasCoordinates =
    typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
  const missingCoordinates = !hasCoordinates;

  const missing = [...missingCpmFields];
  if (missingCoordinates) missing.push("Coordenadas (mapa)");

  return {
    cpmComplete,
    hasCoordinates,
    isComplete: cpmComplete && hasCoordinates,
    missingCpmFields,
    missingCoordinates,
    missing,
  };
}
