export const LOSS_REASON_CODES = [
  "preco",
  "prazo",
  "concorrente",
  "sem_orcamento",
  "sem_decisao",
  "escopo_nao_atende",
  "sem_retorno",
  "outro",
] as const;

export type LossReasonCode = (typeof LOSS_REASON_CODES)[number];

export const LOSS_REASON_LABELS: Record<LossReasonCode, string> = {
  preco: "Preço",
  prazo: "Prazo",
  concorrente: "Perdemos para um concorrente",
  sem_orcamento: "Cliente sem orçamento",
  sem_decisao: "Cliente não decidiu / adiou",
  escopo_nao_atende: "Escopo não atende",
  sem_retorno: "Sem retorno do cliente",
  outro: "Outro",
};

export const LOSS_REASON_AUTO_EXPIRED: LossReasonCode = "sem_retorno";

export function isLossReasonCode(value: unknown): value is LossReasonCode {
  return typeof value === "string" && (LOSS_REASON_CODES as readonly string[]).includes(value);
}
