// ─── Horário de funcionamento das telas (fonte única) ───────────────────────
// Grade de operação da tela: 7 dias × 24 faixas de 1 hora. A seleção define
// QUANTAS horas/semana a tela opera — e essa contagem é a ÚNICA origem de
// `screenWeeklyHours` (consumido por computeCpmPricing). Telas: dom=0 … sáb=6.
//
// Representação canônica: array de chaves "dia-hora" (ex.: "2-11" = Ter, 11-12h).
// weeklyHours = nº de células selecionadas (cada célula = 1 hora de operação).

export const OPERATING_DAYS: ReadonlyArray<{ key: number; label: string }> = [
  { key: 0, label: "Dom" },
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
  { key: 6, label: "Sáb" },
];

/** Faixas horárias: 0..23, cada uma representa o slot HH–(HH+1)h. */
export const OPERATING_HOURS: ReadonlyArray<number> = Array.from({ length: 24 }, (_, h) => h);

/** Chave canônica de uma célula da grade (dia 0..6, hora 0..23). */
export function operatingCellKey(day: number, hour: number): string {
  return `${day}-${hour}`;
}

/** Rótulo da faixa horária, ex.: 0 → "00-01h", 23 → "23-24h". */
export function operatingHourLabel(hour: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hour)}-${pad(hour + 1)}h`;
}

/**
 * Normaliza o valor armazenado (JSON text | array | null) para string[] de
 * chaves "dia-hora". Tolerante a dados inválidos — nunca lança.
 */
export function parseOperatingHours(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((k): k is string => typeof k === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Conversor ÚNICO grade → horas/semana. weeklyHours = nº de células
 * selecionadas (cada célula = 1 hora). Esta é a única origem de
 * `screenWeeklyHours` quando a grade está preenchida.
 */
export function countOperatingHours(raw: unknown): number {
  return parseOperatingHours(raw).length;
}
