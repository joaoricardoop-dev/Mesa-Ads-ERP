// Task #197 — Helper de sugestão de cronograma de pagamento.
// Compartilhado entre cotação e campanha. A sugestão padrão replica o
// comportamento histórico de `scheduleInvoicesForCampaign`:
// uma parcela por fase, vencimento = início + 15 dias.
// Quando não há fases (cotação ainda sem fase, ou single-shot), gera
// uma única parcela com o valor total.

export type BillingScheduleSuggestion = {
  sequence: number;
  amount: string; // decimal string com 2 casas
  dueDate: string; // YYYY-MM-DD
  notes: string | null;
};

export type PhaseLike = {
  sequence: number;
  label?: string | null;
  periodStart: string; // YYYY-MM-DD
};

export const DEFAULT_DUE_OFFSET_DAYS = 15;

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Formatador canônico de data ISO → "DD/MM/AAAA" (pt-BR).
 *
 * Fonte única para exibir qualquer data ISO (`YYYY-MM-DD` ou ISO completo) em
 * todas as telas (interna, pública, PDF). Ancora SEMPRE em UTC para que uma data
 * de 10 caracteres (`YYYY-MM-DD`) seja exibida VERBATIM, independentemente do
 * fuso horário do navegador — caso contrário `new Date("2026-06-25")` é meia-
 * noite UTC e, em UTC-3 (Brasil), regride para 24/06. Nunca desloca o dado.
 */
export function formatIsoDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Distribui um valor total em N parcelas em centavos sem perder precisão.
 * Aplica eventual sobra de centavos na última parcela.
 */
export function splitAmount(totalValue: number, parts: number): string[] {
  if (parts <= 0) return [];
  const cents = Math.round(totalValue * 100);
  const base = Math.floor(cents / parts);
  const out: number[] = Array(parts).fill(base);
  const remainder = cents - base * parts;
  if (remainder > 0) out[out.length - 1] += remainder;
  return out.map((c) => (c / 100).toFixed(2));
}

export function suggestBillingSchedule(args: {
  totalValue: number | string;
  periodStart?: string | null;
  phases?: PhaseLike[];
  dueOffsetDays?: number;
}): BillingScheduleSuggestion[] {
  const total = typeof args.totalValue === "string" ? parseFloat(args.totalValue) : args.totalValue;
  const dueOffset = args.dueOffsetDays ?? DEFAULT_DUE_OFFSET_DAYS;
  if (!isFinite(total) || total <= 0) return [];

  if (args.phases && args.phases.length > 0) {
    const phases = [...args.phases].sort((a, b) => a.sequence - b.sequence);
    const amounts = splitAmount(total, phases.length);
    return phases.map((p, i) => ({
      sequence: i + 1,
      amount: amounts[i],
      dueDate: addDaysIso(p.periodStart, dueOffset),
      notes: p.label ? `Batch ${p.sequence} — ${p.label}` : `Batch ${p.sequence}`,
    }));
  }

  const start = args.periodStart && args.periodStart.length >= 10 ? args.periodStart : todayIso();
  return [
    {
      sequence: 1,
      amount: total.toFixed(2),
      dueDate: addDaysIso(start, dueOffset),
      notes: "Parcela única",
    },
  ];
}

export function sumSchedule(items: { amount: string | number }[]): number {
  return items.reduce((s, it) => s + (typeof it.amount === "string" ? parseFloat(it.amount) : it.amount), 0);
}

/**
 * Validação visual: soma fechada em centavos.
 */
export function scheduleMatchesTotal(items: { amount: string | number }[], totalValue: number | string, toleranceCents = 1): boolean {
  const total = typeof totalValue === "string" ? parseFloat(totalValue) : totalValue;
  if (!isFinite(total)) return false;
  const diffCents = Math.abs(Math.round(sumSchedule(items) * 100) - Math.round(total * 100));
  return diffCents <= toleranceCents;
}
