// Tipos compartilhados pelos parsers de extrato bancário (OFX/CSV).

export interface ParsedTransaction {
  /** Data da transação no formato YYYY-MM-DD. */
  date: string;
  /** Valor sempre POSITIVO em BRL com 2 casas (string para preservar precisão decimal). */
  amount: string;
  /** 'credit' = entrada (recebimento), 'debit' = saída (pagamento). */
  type: "credit" | "debit";
  /** Descrição/histórico bruto da linha. */
  description: string;
  /** FITID do OFX ou hash determinístico da linha do CSV. Usado para deduplicar. */
  externalId: string;
}

export interface ParsedStatement {
  /** Banco identificado pelo parser ('itau', 'bradesco', 'inter', 'bb', 'santander', 'generico'). */
  bank: string;
  /** Conta detectada (quando disponível no arquivo). */
  account?: string;
  agency?: string;
  transactions: ParsedTransaction[];
}

export type ParserKind = "ofx" | "csv";
