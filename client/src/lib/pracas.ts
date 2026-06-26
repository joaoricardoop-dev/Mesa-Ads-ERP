/**
 * FONTE ÚNICA das praças (mercados) e seus centros geográficos para os mapas.
 *
 * As chaves batem com o campo `n` usado em leads/oportunidades
 * ("manaus" | "rio" | "ambas"). Aqui só tratamos as praças com geografia
 * própria; "ambas" não tem centro — nesses casos usa-se o fitBounds dos pinos.
 *
 * Quando uma nova praça entrar em operação, basta adicionar uma entrada aqui
 * (chave, label, center, zoom) e todas as telas de mapa passam a suportá-la,
 * sem números mágicos espalhados pelo código.
 */
export interface PracaGeo {
  /** Chave canônica (mesma do campo `n`). */
  key: string;
  /** Rótulo legível. */
  label: string;
  /** Centro do mapa para esta praça. */
  center: { lat: number; lng: number };
  /** Zoom inicial recomendado para esta praça. */
  zoom: number;
}

export const PRACAS_GEO: Record<string, PracaGeo> = {
  manaus: {
    key: "manaus",
    label: "Manaus",
    center: { lat: -3.119, lng: -60.0217 },
    zoom: 12,
  },
  rio: {
    key: "rio",
    label: "Rio de Janeiro",
    center: { lat: -22.9068, lng: -43.1729 },
    zoom: 12,
  },
};

/** Praça padrão enquanto não há seleção explícita. */
export const DEFAULT_PRACA = "manaus";

/** Centro padrão dos mapas (praça padrão). */
export const DEFAULT_MAP_CENTER = PRACAS_GEO[DEFAULT_PRACA].center;

/** Zoom padrão dos mapas (praça padrão). */
export const DEFAULT_MAP_ZOOM = PRACAS_GEO[DEFAULT_PRACA].zoom;

/** Resolve o centro/zoom de uma praça pela chave; cai no padrão se desconhecida. */
export function pracaCenter(key: string | null | undefined): PracaGeo {
  if (key && PRACAS_GEO[key]) return PRACAS_GEO[key];
  return PRACAS_GEO[DEFAULT_PRACA];
}
