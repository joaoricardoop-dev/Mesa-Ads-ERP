import type { ParsedStatement, ParsedTransaction } from "./types";

// Parser de OFX (SGML/XML) que cobre os blocos <STMTTRN> dos principais
// bancos brasileiros (Itaú, Bradesco, Inter, BB, Santander). Faz parsing
// tolerante: aceita tags com/sem fechamento e ignora desconhecidas.

function extractTag(block: string, tag: string): string | null {
  // Aceita "<TAG>valor</TAG>" e "<TAG>valor" (formato SGML legado).
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function normalizeOfxDate(raw: string): string {
  // OFX: "20240315" ou "20240315120000[-3:BRT]" → "2024-03-15".
  const digits = raw.replace(/\[.*$/, "").trim();
  if (digits.length < 8) return raw;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function detectBank(content: string): string {
  const upper = content.toUpperCase();
  if (/(\bITAU\b|<ORG>ITAU)/.test(upper)) return "itau";
  if (/(\bBRADESCO\b|<ORG>BRADESCO)/.test(upper)) return "bradesco";
  if (/(\bINTER\b|<ORG>INTER|BANCO INTER)/.test(upper)) return "inter";
  if (/(BANCO DO BRASIL|<ORG>BB|\bBANCOBRASIL\b)/.test(upper)) return "bb";
  if (/(\bSANTANDER\b|<ORG>SANTANDER)/.test(upper)) return "santander";
  return "generico";
}

export function parseOfx(content: string): ParsedStatement {
  const bank = detectBank(content);
  const acct = extractTag(content, "ACCTID") ?? undefined;
  const branch = extractTag(content, "BRANCHID") ?? undefined;

  const transactions: ParsedTransaction[] = [];
  const blockRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = blockRe.exec(content)) !== null) {
    const block = match[1];
    const dt = extractTag(block, "DTPOSTED");
    const amt = extractTag(block, "TRNAMT");
    const memo = extractTag(block, "MEMO") ?? extractTag(block, "NAME") ?? "";
    const fitid = extractTag(block, "FITID") ?? `idx-${idx}`;
    if (!dt || !amt) {
      idx++;
      continue;
    }
    const numeric = Number(amt.replace(",", "."));
    if (!Number.isFinite(numeric)) {
      idx++;
      continue;
    }
    transactions.push({
      date: normalizeOfxDate(dt),
      amount: Math.abs(numeric).toFixed(2),
      type: numeric >= 0 ? "credit" : "debit",
      description: memo,
      externalId: fitid,
    });
    idx++;
  }

  return { bank, account: acct, agency: branch, transactions };
}
