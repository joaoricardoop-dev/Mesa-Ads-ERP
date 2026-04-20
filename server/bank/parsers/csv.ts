import { createHash } from "node:crypto";
import type { ParsedStatement, ParsedTransaction } from "./types";

// Parser de CSV de extratos bancários BR.
//
// Suporta os formatos padrão de Itaú, Bradesco, Inter, Banco do Brasil e
// Santander. Detecta automaticamente delimitador (`;` ou `,`) e cabeçalho.
//
// Estratégia: lê o cabeçalho (primeira linha não vazia), mapeia colunas
// "Data", "Histórico"/"Descrição", "Valor"/"Crédito"/"Débito" e gera as
// transações. Se não houver cabeçalho reconhecido, faz fallback assumindo
// o layout `data;descricao;valor` (CSV genérico).

function detectBankFromContent(text: string): string {
  const upper = text.slice(0, 2000).toUpperCase();
  if (upper.includes("ITAU") || upper.includes("ITAÚ")) return "itau";
  if (upper.includes("BRADESCO")) return "bradesco";
  if (upper.includes("INTER")) return "inter";
  if (upper.includes("BANCO DO BRASIL") || upper.includes("BANCOBRASIL")) return "bb";
  if (upper.includes("SANTANDER")) return "santander";
  return "generico";
}

function detectDelimiter(line: string): string {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  // dd/mm/yyyy ou dd/mm/yy
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const [, d, m, y] = br;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/[R$]/gi, "");
  if (!s) return null;
  // Formato BR: "1.234,56" → "1234.56". Se contém vírgula, ela é decimal.
  let normalized = s;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function findCol(headers: string[], names: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  for (const n of names) {
    const target = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const i = lower.findIndex((h) => h === target || h.includes(target));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseCsv(content: string, hintBank?: string): ParsedStatement {
  const bank = hintBank || detectBankFromContent(content);

  // Remove BOM e quebra em linhas não vazias.
  const clean = content.replace(/^\uFEFF/, "");
  const rawLines = clean.split(/\r?\n/).map((l) => l).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return { bank, transactions: [] };

  // Procura a primeira linha que pareça um cabeçalho reconhecível (tem
  // termos como "data"/"date" e ≥ 3 colunas). Se nenhuma encontrada, assume
  // que NÃO há cabeçalho — todas as linhas são dados (formato genérico).
  let delim = detectDelimiter(rawLines[0]);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawLines.length, 10); i++) {
    delim = detectDelimiter(rawLines[i]);
    const cells = splitCsvLine(rawLines[i], delim);
    if (cells.length >= 3 && /data|date/i.test(cells.join(" "))) {
      headerIdx = i;
      break;
    }
  }

  const hasHeader = headerIdx >= 0;
  const headers = hasHeader ? splitCsvLine(rawLines[headerIdx], delim) : [];
  const dateCol = hasHeader ? findCol(headers, ["data", "data lancamento", "data lançamento", "date"]) : -1;
  const descCol = hasHeader ? findCol(headers, ["historico", "histórico", "descricao", "descrição", "lancamento", "lançamento", "memo"]) : -1;
  const valCol = hasHeader ? findCol(headers, ["valor", "amount"]) : -1;
  const credCol = hasHeader ? findCol(headers, ["credito", "crédito", "credit"]) : -1;
  const debCol = hasHeader ? findCol(headers, ["debito", "débito", "debit"]) : -1;
  const docCol = hasHeader ? findCol(headers, ["documento", "doc", "fitid", "id"]) : -1;

  // Sem cabeçalho: processa TODAS as linhas como dados. Com cabeçalho:
  // pula a linha do header.
  const dataLines = hasHeader ? rawLines.slice(headerIdx + 1) : rawLines;
  const transactions: ParsedTransaction[] = [];

  // Fallback: cabeçalho não reconhecido. Assume data;descricao;valor.
  const useFallback = !hasHeader || dateCol < 0 || (valCol < 0 && credCol < 0 && debCol < 0);

  for (const line of dataLines) {
    const cells = splitCsvLine(line, delim);
    if (cells.length < 2) continue;

    const dateRaw = useFallback ? cells[0] : cells[dateCol];
    const date = normalizeDate(dateRaw || "");
    if (!date) continue;

    let description: string;
    let signedAmount: number | null;

    if (useFallback) {
      description = cells[1] ?? "";
      signedAmount = parseAmount(cells[2] ?? "");
    } else {
      description = descCol >= 0 ? (cells[descCol] ?? "") : "";
      if (valCol >= 0) {
        signedAmount = parseAmount(cells[valCol] ?? "");
      } else {
        const cred = credCol >= 0 ? parseAmount(cells[credCol] ?? "") : null;
        const deb = debCol >= 0 ? parseAmount(cells[debCol] ?? "") : null;
        if (cred && cred !== 0) signedAmount = Math.abs(cred);
        else if (deb && deb !== 0) signedAmount = -Math.abs(deb);
        else signedAmount = null;
      }
    }

    if (signedAmount === null || signedAmount === 0) continue;

    const externalDoc = docCol >= 0 ? (cells[docCol] ?? "").trim() : "";
    const hashSrc = `${date}|${signedAmount.toFixed(2)}|${description}|${externalDoc}`;
    const externalId = externalDoc || createHash("sha1").update(hashSrc).digest("hex").slice(0, 24);

    transactions.push({
      date,
      amount: Math.abs(signedAmount).toFixed(2),
      type: signedAmount >= 0 ? "credit" : "debit",
      description: description.trim(),
      externalId,
    });
  }

  return { bank, transactions };
}
