/**
 * FONTE ÚNICA de geocodificação no servidor (endereço → coordenadas).
 *
 * Usada exclusivamente para o BACKFILL de coordenadas de locais já cadastrados
 * sem lat/lng. O fluxo normal de cadastro grava as coordenadas escolhidas no
 * `AddressAutocomplete` (origem única no client) — este helper NÃO substitui
 * essa origem; ele apenas recupera, uma única vez, coordenadas faltantes a
 * partir do endereço já gravado.
 *
 * Reutiliza a mesma chave do Google Maps usada no client
 * (`VITE_GOOGLE_MAPS_API_KEY`), com a Geocoding API habilitada.
 */

const GEOCODE_KEY =
  process.env.VITE_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/**
 * FONTE ÚNICA da string de busca usada na geocodificação de um local. Tanto o
 * backfill manual quanto o hook automático de create/update montam o endereço
 * textual aqui — assim os dois caminhos geocodificam exatamente o mesmo query.
 */
export function buildGeocodeQuery(parts: {
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
}): string {
  return [parts.address, parts.neighborhood, parts.city, parts.state, parts.cep, "Brasil"]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: Array<{
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }>;
}

/**
 * Geocodifica um endereço textual em coordenadas. Retorna `null` quando o
 * Google não encontra resultado (ZERO_RESULTS) ou quando o endereço é vazio.
 * Lança erro em falhas de configuração/transporte (sem chave, HTTP != 200,
 * status de erro do Google) para que o chamador possa sinalizar com clareza.
 */
export async function geocodeAddress(
  address: string,
): Promise<GeocodeResult | null> {
  if (!GEOCODE_KEY) {
    throw new Error(
      "VITE_GOOGLE_MAPS_API_KEY ausente — geocodificação no servidor indisponível.",
    );
  }
  const query = address.trim();
  if (!query) return null;

  const url =
    "https://maps.googleapis.com/maps/api/geocode/json?" +
    `address=${encodeURIComponent(query)}&region=br&language=pt-BR&key=${GEOCODE_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as GoogleGeocodeResponse;

  if (data.status === "ZERO_RESULTS") return null;
  if (data.status !== "OK") {
    throw new Error(
      `Geocoding status ${data.status}` +
        (data.error_message ? `: ${data.error_message}` : ""),
    );
  }

  const first = data.results?.[0];
  if (!first) return null;

  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
  };
}
