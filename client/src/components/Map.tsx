/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/pracas";
import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_MAP_ZOOM,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState(false);

  const init = usePersistFn(async () => {
    try {
      await loadGoogleMaps();
    } catch (err) {
      console.error("Falha ao carregar o Google Maps", err);
      setLoadError(true);
      return;
    }
    if (!mapContainer.current || map.current) return;
    map.current = new window.google!.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: false,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: false,
      mapId: "mesa_ads_map",
      styles: [
        { featureType: "all", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
        { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#999999" }] },
        { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
        { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#333333" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] },
        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e1e1e" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2a1a" }] },
        { featureType: "transit", elementType: "geometry", stylers: [{ color: "#222222" }] },
      ],
    });
    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  if (loadError) {
    return (
      <div
        data-testid="map-load-error"
        className={cn(
          "w-full h-[500px] flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Mapa indisponível — não foi possível carregar o Google Maps. Verifique a
        chave de API (VITE_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
