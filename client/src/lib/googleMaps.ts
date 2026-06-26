/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google?: typeof google;
    _gmapsLoading?: Promise<void>;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/**
 * Carrega o bootstrap do Google Maps JS uma única vez (fonte única do loader).
 * Inclui as libraries usadas no app: marker (mapa), places (autocomplete de
 * endereço), geocoding e geometry. Reaproveita o carregamento em voo.
 */
export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window._gmapsLoading) return window._gmapsLoading;

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
