export const QUOTATION_AUTO_EXPIRE_DAYS = 30;
export const QUOTATION_PRE_EXPIRE_WARNING_DAYS = 5;
export const QUOTATION_DEFAULT_VALIDITY_DAYS = 30;

export const QUOTATION_AGE_WARNING_DAYS = 14;
export const QUOTATION_AGE_DANGER_DAYS = 21;

// Status considerados "ativos no funil" para auto-expiração e risk badges.
// `rascunho` é intencionalmente excluído: drafts não devem expirar nem mostrar
// risco — só cotações já enviadas/em negociação envelhecem.
export const QUOTATION_OPEN_STATUSES = ["enviada", "ativa"] as const;
export type QuotationOpenStatus = (typeof QUOTATION_OPEN_STATUSES)[number];

export function isOpenQuotationStatus(status: string | null | undefined): boolean {
  return !!status && (QUOTATION_OPEN_STATUSES as readonly string[]).includes(status);
}

export function ageRiskLevel(ageDays: number, status: string | null | undefined): "danger" | "warning" | "ok" {
  if (!isOpenQuotationStatus(status)) return "ok";
  if (ageDays > QUOTATION_AGE_DANGER_DAYS) return "danger";
  if (ageDays > QUOTATION_AGE_WARNING_DAYS) return "warning";
  return "ok";
}

export function addDaysISO(baseISO: string | Date, days: number): string {
  const d = typeof baseISO === "string" ? new Date(baseISO) : new Date(baseISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
