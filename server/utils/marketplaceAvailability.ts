// Helpers para o Marketplace v2 — cálculo de disponibilidade de shares por
// (produto, local) cruzando productLocations com a ocupação real proveniente
// de campaignItems + campaignPhases. Mantido como função pura para facilitar
// testes unitários sem mockar drizzle.

export type ProductLocationRow = {
  productId: number;
  restaurantId: number;
  maxShares: number;
  cycleWeeks: number;
};

export type OccupationRow = {
  productId: number;
  restaurantId: number;
  // ISO date strings (YYYY-MM-DD) — a fase ocupa o slot durante este intervalo.
  phaseStart: string;
  phaseEnd: string;
  // Cada item ocupa 1 slot. shareIndex é informativo (qual slot) mas não
  // altera o cálculo: ocupação = nº de items cuja fase intersecta o período.
  // Status da fase e da campanha — usados para descartar registros que não
  // devem reservar inventário (cancelada, arquivada, etc.).
  phaseStatus?: string | null;
  campaignStatus?: string | null;
};

// Status que NÃO ocupam slot no marketplace (defesa em camadas: SQL filtra
// igual, mas mantemos aqui pra cobrir testes e legados).
export const NON_OCCUPYING_PHASE_STATUSES: ReadonlySet<string> = new Set(["cancelada"]);
export const NON_OCCUPYING_CAMPAIGN_STATUSES: ReadonlySet<string> = new Set([
  "archived",
  "inativa",
]);

export type AvailabilityCell = {
  productId: number;
  restaurantId: number;
  maxShares: number;
  cycleWeeks: number;
  occupiedShares: number;
  availableShares: number;
};

function makeKey(productId: number, restaurantId: number): string {
  return `${productId}:${restaurantId}`;
}

// Retorna true se [aStart, aEnd] e [bStart, bEnd] se intersectam.
// Datas em string ISO (YYYY-MM-DD) podem ser comparadas lexicograficamente.
export function periodsOverlap(
  aStart: string,
  aEnd: string,
  bStart?: string,
  bEnd?: string,
): boolean {
  if (!bStart && !bEnd) return true;
  const start = bStart ?? "0000-01-01";
  const end = bEnd ?? "9999-12-31";
  return aStart <= end && aEnd >= start;
}

// Calcula slots livres por (produto, local) no intervalo informado.
// Quando startDate/endDate são omitidos, considera todas as ocupações.
export function computeShareAvailability(
  locations: ProductLocationRow[],
  occupations: OccupationRow[],
  startDate?: string,
  endDate?: string,
): Map<string, AvailabilityCell> {
  const result = new Map<string, AvailabilityCell>();

  for (const loc of locations) {
    result.set(makeKey(loc.productId, loc.restaurantId), {
      productId: loc.productId,
      restaurantId: loc.restaurantId,
      maxShares: loc.maxShares,
      cycleWeeks: loc.cycleWeeks,
      occupiedShares: 0,
      availableShares: loc.maxShares,
    });
  }

  for (const occ of occupations) {
    if (occ.phaseStatus && NON_OCCUPYING_PHASE_STATUSES.has(occ.phaseStatus)) continue;
    if (occ.campaignStatus && NON_OCCUPYING_CAMPAIGN_STATUSES.has(occ.campaignStatus)) continue;
    if (!periodsOverlap(occ.phaseStart, occ.phaseEnd, startDate, endDate)) continue;
    const key = makeKey(occ.productId, occ.restaurantId);
    const cell = result.get(key);
    if (!cell) continue; // ocupação de produto não mais ofertado neste local
    cell.occupiedShares += 1;
    cell.availableShares = Math.max(0, cell.maxShares - cell.occupiedShares);
  }

  return result;
}

// Faz parsing tolerante do campo activeRestaurants.excludedCategories, que
// historicamente já foi gravado como JSON, CSV ou separado por "||".
export function parseExcludedCategories(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter((s) => s.length > 0);
    }
  } catch {
    // segue pros separadores legados
  }
  if (trimmed.includes("||")) {
    return trimmed.split("||").map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

// Verifica se a categoria do anunciante colide com algum item da lista de
// categorias excluídas pelo restaurante (case-insensitive).
export function hasCategoryConflict(
  excludedCategories: string[],
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  const norm = category.trim().toLowerCase();
  if (!norm) return false;
  return excludedCategories.some((c) => c.toLowerCase() === norm);
}
