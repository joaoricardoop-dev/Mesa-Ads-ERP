/// <reference types="@types/google.maps" />

import { useCallback, useEffect, useRef } from "react";
import { MapView } from "@/components/Map";
import { cn } from "@/lib/utils";

interface LocationPinMapProps {
  /** Latitude da posição a marcar. Null/undefined => mapa não é exibido. */
  lat: number | null | undefined;
  /** Longitude da posição a marcar. Null/undefined => mapa não é exibido. */
  lng: number | null | undefined;
  /** Classe aplicada ao container do mapa (ex.: altura). */
  className?: string;
  "data-testid"?: string;
}

/**
 * Mini-mapa somente-leitura que mostra um pino na posição informada. Reutiliza
 * o `MapView` (mesmo loader de script do Google Maps) e nada mais — não há
 * autocomplete nem edição aqui. Quando não há coordenadas, nada é renderizado.
 */
export function LocationPinMap({
  lat,
  lng,
  className,
  "data-testid": testId,
}: LocationPinMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const placeMarker = useCallback((latitude: number, longitude: number) => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const pos = { lat: latitude, lng: longitude };
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
      });
    } else {
      markerRef.current.position = pos;
    }
    map.panTo(pos);
  }, []);

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (lat != null && lng != null) {
        placeMarker(lat, lng);
        map.setZoom(16);
      }
    },
    [lat, lng, placeMarker],
  );

  // Atualiza o pino sempre que as coordenadas mudam (nova sugestão escolhida).
  useEffect(() => {
    if (lat != null && lng != null) {
      placeMarker(lat, lng);
      mapRef.current?.setZoom(16);
    }
  }, [lat, lng, placeMarker]);

  if (lat == null || lng == null) return null;

  return (
    <div
      className={cn("rounded-lg overflow-hidden border border-border/30", className)}
      data-testid={testId}
    >
      <MapView
        className="h-[200px]"
        initialCenter={{ lat, lng }}
        initialZoom={16}
        onMapReady={handleMapReady}
      />
    </div>
  );
}
