/**
 * Gera uma string CSV a partir de cabeçalhos + linhas.
 * Prefixa BOM UTF-8 para que o Excel abra acentos corretamente e
 * escapa aspas/vírgulas/quebras de linha conforme RFC 4180.
 */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n");
}
