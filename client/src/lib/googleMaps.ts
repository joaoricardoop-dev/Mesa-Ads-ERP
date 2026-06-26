/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google?: typeof google;
    _gmapsLoading?: Promise<void>;
    /** Flag global setada quando o Google rejeita a chave (auth error). */
    _gmapsAuthFailed?: boolean;
    /** Hook documentado que o Google Maps chama em falhas de autenticação. */
    gm_authFailure?: () => void;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/** Erro lançado quando a chave do Google Maps não está configurada. */
export class GoogleMapsKeyMissingError extends Error {
  constructor() {
    super(
      "VITE_GOOGLE_MAPS_API_KEY ausente — o mapa não pode ser carregado. " +
        "Configure o secret para habilitar pins, mapa e autocomplete de endereço.",
    );
    this.name = "GoogleMapsKeyMissingError";
  }
}

/**
 * Carrega o bootstrap do Google Maps JS uma única vez (fonte única do loader).
 * Inclui as libraries usadas no app: marker (mapa), places (autocomplete de
 * endereço), geocoding e geometry. Reaproveita o carregamento em voo.
 *
 * Comportamento quando a chave está ausente/inválida:
 * - **Ausente** (`VITE_GOOGLE_MAPS_API_KEY` vazio): rejeita imediatamente com
 *   `GoogleMapsKeyMissingError`, ANTES de injetar o script — os consumidores
 *   (`MapView`, `AddressAutocomplete`) capturam e degradam graciosamente. O
 *   script com `key=undefined` nunca é injetado.
 * - **Inválida** (chave presente mas rejeitada pelo Google): o script carrega
 *   normalmente (onload dispara), mas o Google sobrepõe seu próprio overlay de
 *   erro ("This page can't load Google Maps correctly") e chama
 *   `window.gm_authFailure`. Registramos esse hook para logar um erro claro e
 *   marcar `window._gmapsAuthFailed`, de modo que o problema fique greppável no
 *   console em vez de silencioso.
 */
export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window._gmapsLoading) return window._gmapsLoading;

  if (!API_KEY) {
    return Promise.reject(new GoogleMapsKeyMissingError());
  }

  // Hook oficial do Google para falhas de autenticação (chave inválida, sem
  // billing, referer não autorizado, etc.). Setado uma única vez.
  if (typeof window.gm_authFailure !== "function") {
    window.gm_authFailure = () => {
      window._gmapsAuthFailed = true;
      console.error(
        "Google Maps recusou a chave (gm_authFailure): verifique " +
          "VITE_GOOGLE_MAPS_API_KEY, billing e restrições de referer.",
      );
    };
  }

  window._gmapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return window._gmapsLoading;
}
