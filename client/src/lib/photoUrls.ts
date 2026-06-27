/**
 * Fonte ÚNICA (client) de parsing das fotos do espaço. `active_restaurants.photoUrls`
 * é um text JSON com array de URLs (ou já um array). Toda tela que precise ler as
 * fotos de um espaço deve importar daqui — não recriar o parser localmente.
 */
export function parsePhotoUrls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string");
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}
