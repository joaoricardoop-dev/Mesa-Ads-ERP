/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { cn } from "@/lib/utils";

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: -23.5505, lng: -46.6333 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    await loadGoogleMaps();
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

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
