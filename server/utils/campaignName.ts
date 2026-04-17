const MESES_PT_ABBR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function buildCampaignName(
  clientName: string | null | undefined,
  firstPhaseDate: string | Date | null | undefined,
): string {
  const safeClient = (clientName ?? "").trim() || "Cliente";

  let d: Date;
  if (!firstPhaseDate) {
    d = new Date();
  } else if (typeof firstPhaseDate === "string") {
    const iso = firstPhaseDate.length === 10 ? `${firstPhaseDate}T00:00:00` : firstPhaseDate;
    d = new Date(iso);
    if (isNaN(d.getTime())) d = new Date();
  } else {
    d = firstPhaseDate;
  }

  const mes = MESES_PT_ABBR[d.getMonth()];
  const ano = d.getFullYear();
  return `${safeClient} — Lote ${mes}/${ano}`;
}

export function isFormattedCampaignName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /— Lote (Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{4}\b/.test(name);
}
