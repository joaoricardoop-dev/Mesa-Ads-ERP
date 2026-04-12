/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Search,
  X,
  Phone,
  Instagram,
  Star,
  Users,
  UtensilsCrossed,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";

declare global {
  interface Window {
    google?: typeof google;
    _gmapsLoading?: Promise<void>;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SAO_PAULO_CENTER = { lat: -23.5505, lng: -46.6333 };

declare global {
  interface Window {
    gm_authFailure?: () => void;
    _gmapsAuthFailed?: boolean;
  }
}

function loadMapScript(): Promise<void> {
  if (window._gmapsAuthFailed) {
    window._gmapsLoading = undefined;
    window._gmapsAuthFailed = false;
    delete window.google;
  }
  if (window.google?.maps) return Promise.resolve();
  if (window._gmapsLoading) return window._gmapsLoading;

  window._gmapsLoading = new Promise<void>((resolve, reject) => {
    window.gm_authFailure = () => {
      window._gmapsAuthFailed = true;
      window._gmapsLoading = undefined;
      reject(new Error(
        "Chave da API do Google Maps inválida ou sem permissão. " +
        "Verifique se a API 'Maps JavaScript API' está ativada no Google Cloud Console " +
        "e se as restrições de HTTP Referrer permitem o domínio atual."
      ));
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,geocoding`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      window._gmapsLoading = undefined;
      reject(new Error("Falha ao carregar o script do Google Maps. Verifique sua conexão ou a chave de API."));
    };
    document.head.appendChild(script);
  });
  return window._gmapsLoading;
}

const TIER_COLORS: Record<string, string> = {
  platinum: "#a78bfa",
  gold: "#fbbf24",
  silver: "#94a3b8",
  bronze: "#d97706",
};

const TIER_LABELS: Record<string, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

function buildMarkerSvg(color: string, active: boolean): string {
  const c = active ? color : "#6b7280";
  const glow = active ? `<circle cx="16" cy="16" r="14" fill="${c}" opacity="0.15"/>` : "";
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      ${glow}
      <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 28 12 28S28 21 28 12C28 5.373 22.627 0 16 0z" fill="${c}" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
      <circle cx="16" cy="12" r="6" fill="white" opacity="0.9"/>
    </svg>
  `;
}

type Restaurant = {
  id: number;
  name: string;
  address: string;
  neighborhood: string;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  googleMapsLink?: string | null;
  instagram?: string | null;
  whatsapp: string;
  contactName: string;
  socialClass?: string | null;
  tableCount: number;
  seatCount: number;
  monthlyCustomers: number;
  ratingScore?: string | null;
  ratingTier?: string | null;
  status: string;
  lat?: string | null;
  lng?: string | null;
};

export default function RestaurantsMap() {
  const [, navigate] = useLocation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [search, setSearch] = useState("");
  const [geocodingId, setGeocodingId] = useState<number | null>(null);
  const [geocodingAll, setGeocodingAll] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  const { data: restaurants = [], refetch } = trpc.activeRestaurant.list.useQuery();
  const saveCoordsMutation = trpc.activeRestaurant.saveCoordinates.useMutation({
    onSuccess: () => refetch(),
  });

  const filteredRestaurants = restaurants.filter((r: Restaurant) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.neighborhood.toLowerCase().includes(q) ||
      (r.city || "").toLowerCase().includes(q)
    );
  });

  const geocodeRestaurant = useCallback(async (r: Restaurant): Promise<{ lat: number; lng: number } | null> => {
    if (!geocoderRef.current) return null;
    const addressQuery = [r.address, r.neighborhood, r.city || "São Paulo", r.state || "SP", "Brasil"]
      .filter(Boolean)
      .join(", ");
    return new Promise((resolve) => {
      geocoderRef.current!.geocode({ address: addressQuery }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          resolve({ lat: loc.lat(), lng: loc.lng() });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  const placeMarker = useCallback((r: Restaurant, lat: number, lng: number) => {
    if (!mapRef.current) return;

    const existing = markersRef.current.get(r.id);
    if (existing) existing.map = null;

    const tier = r.ratingTier || "bronze";
    const color = TIER_COLORS[tier] || "#6b7280";
    const isActive = r.status === "active";

    const svgEl = document.createElement("div");
    svgEl.innerHTML = buildMarkerSvg(color, isActive);
    svgEl.style.cursor = "pointer";

    const marker = new window.google!.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: { lat, lng },
      title: r.name,
      content: svgEl,
    });

    marker.addListener("click", () => {
      setSelected(r);
      mapRef.current?.panTo({ lat, lng });
    });

    markersRef.current.set(r.id, marker);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await loadMapScript();
      } catch (err: any) {
        if (!cancelled) setMapError(err.message || "Erro ao carregar o Google Maps");
        return;
      }
      if (cancelled || !mapContainer.current) return;
      if (!mapRef.current) {
        mapRef.current = new window.google!.maps.Map(mapContainer.current, {
          zoom: 12,
          center: SAO_PAULO_CENTER,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: false,
          mapId: "mesa_ads_restaurants",
          styles: [
            { featureType: "all", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
            { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#aaaaaa" }] },
            { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#111111" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
            { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#333333" }] },
            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3d3d3d" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1117" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e1e1e" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2a1a" }] },
            { featureType: "transit", elementType: "geometry", stylers: [{ color: "#222222" }] },
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          ],
        });
        geocoderRef.current = new window.google!.maps.Geocoder();
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || restaurants.length === 0) return;

    const withCoords = restaurants.filter((r: Restaurant) => r.lat && r.lng);
    const withoutCoords = restaurants.filter((r: Restaurant) => !r.lat || !r.lng);

    withCoords.forEach((r: Restaurant) => {
      placeMarker(r, parseFloat(r.lat!), parseFloat(r.lng!));
    });

    if (withCoords.length > 0) {
      const bounds = new window.google!.maps.LatLngBounds();
      withCoords.forEach((r: Restaurant) => bounds.extend({ lat: parseFloat(r.lat!), lng: parseFloat(r.lng!) }));
      mapRef.current.fitBounds(bounds, { top: 60, right: 380, bottom: 60, left: 60 });
    }

    if (withoutCoords.length > 0) {
      toast.info(`${withoutCoords.length} restaurante(s) sem coordenadas. Clique em "Geocodificar Todos" para localizá-los.`);
    }
  }, [restaurants, placeMarker]);

  const handleGeocodeSingle = async (r: Restaurant) => {
    if (!geocoderRef.current) {
      toast.error("Mapa ainda carregando");
      return;
    }
    setGeocodingId(r.id);
    const coords = await geocodeRestaurant(r);
    setGeocodingId(null);
    if (coords) {
      await saveCoordsMutation.mutateAsync({ id: r.id, lat: coords.lat, lng: coords.lng });
      placeMarker(r, coords.lat, coords.lng);
      mapRef.current?.panTo(coords);
      toast.success(`${r.name} localizado no mapa`);
    } else {
      toast.error(`Não foi possível localizar: ${r.name}`);
    }
  };

  const handleGeocodeAll = async () => {
    const missing = restaurants.filter((r: Restaurant) => !r.lat || !r.lng);
    if (missing.length === 0) {
      toast.info("Todos os restaurantes já têm coordenadas");
      return;
    }
    if (!geocoderRef.current) {
      toast.error("Mapa ainda carregando");
      return;
    }
    setGeocodingAll(true);
    setGeocodingProgress(0);
    let done = 0;
    for (const r of missing) {
      const coords = await geocodeRestaurant(r);
      if (coords) {
        await saveCoordsMutation.mutateAsync({ id: r.id, lat: coords.lat, lng: coords.lng });
        placeMarker(r, coords.lat, coords.lng);
      }
      done++;
      setGeocodingProgress(Math.round((done / missing.length) * 100));
      await new Promise(res => setTimeout(res, 200));
    }
    setGeocodingAll(false);
    toast.success(`${done} restaurante(s) geocodificados`);
    refetch();
  };

  const withCoords = restaurants.filter((r: Restaurant) => r.lat && r.lng).length;
  const withoutCoords = restaurants.length - withCoords;
  const activeCount = restaurants.filter((r: Restaurant) => r.status === "active").length;

  const socialClass = selected?.socialClass
    ? (() => { try { return JSON.parse(selected.socialClass).join(", "); } catch { return selected.socialClass; } })()
    : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/20 bg-card/30 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/restaurantes")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-base font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Mapa de Locais
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeCount} ativos · {withCoords} no mapa · {withoutCoords} sem coordenadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {withoutCoords > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8"
              onClick={handleGeocodeAll}
              disabled={geocodingAll}
            >
              {geocodingAll ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {geocodingProgress}%</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Geocodificar Todos ({withoutCoords})</>
              )}
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => navigate("/restaurantes")}>
            <UtensilsCrossed className="w-3.5 h-3.5" /> Lista
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Map */}
        <div ref={mapContainer} className="flex-1 h-full" />
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
            <div className="max-w-md mx-4 p-6 rounded-xl border border-destructive/40 bg-card text-center space-y-4">
              <MapPin className="w-10 h-10 text-destructive mx-auto opacity-60" />
              <div>
                <p className="font-semibold text-foreground mb-1">Erro ao carregar o mapa</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{mapError}</p>
              </div>
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-left space-y-1">
                <p className="font-medium text-foreground">Como resolver:</p>
                <p>1. Acesse o <strong>Google Cloud Console</strong></p>
                <p>2. Ative a <strong>Maps JavaScript API</strong> e <strong>Geocoding API</strong></p>
                <p>3. Verifique as restrições da chave — adicione o domínio <strong>*.replit.dev</strong> e <strong>*.replit.app</strong></p>
                <p>4. Certifique-se que o faturamento está ativado</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setMapError(null); window._gmapsLoading = undefined; window._gmapsAuthFailed = false; }}
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        )}

        {/* Right panel */}
        <div className="w-80 h-full flex flex-col bg-card/95 border-l border-border/30 shrink-0 z-10">
          {/* Search */}
          <div className="p-3 border-b border-border/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar restaurante..."
                className="pl-8 h-8 text-xs bg-background"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Restaurant detail panel */}
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold leading-tight">{selected.name}</h2>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{selected.neighborhood}{selected.city ? `, ${selected.city}` : ""}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSelected(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${selected.status === "active" ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-muted-foreground"}`}>
                  {selected.status === "active" ? "Ativo" : "Inativo"}
                </Badge>
                {selected.ratingTier && (
                  <Badge variant="outline" className="text-[10px]" style={{ color: TIER_COLORS[selected.ratingTier], borderColor: `${TIER_COLORS[selected.ratingTier]}40`, backgroundColor: `${TIER_COLORS[selected.ratingTier]}15` }}>
                    {TIER_LABELS[selected.ratingTier]}
                  </Badge>
                )}
                {selected.ratingScore && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
                    <Star className="w-3 h-3" /> {parseFloat(selected.ratingScore).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Endereço</p>
                  <p className="text-xs mt-0.5">{selected.address}</p>
                  {selected.cep && <p className="text-[10px] text-muted-foreground">CEP {selected.cep}</p>}
                </div>

                {socialClass && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Classe Social</p>
                    <p className="text-xs mt-0.5">{socialClass}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 rounded p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Mesas</p>
                    <p className="text-sm font-bold font-mono">{selected.tableCount}</p>
                  </div>
                  <div className="bg-muted/30 rounded p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Assentos</p>
                    <p className="text-sm font-bold font-mono">{selected.seatCount}</p>
                  </div>
                  <div className="bg-muted/30 rounded p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Clientes/mês</p>
                    <p className="text-sm font-bold font-mono">{selected.monthlyCustomers >= 1000 ? `${(selected.monthlyCustomers / 1000).toFixed(1)}k` : selected.monthlyCustomers}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contato</p>
                  <p className="text-xs mt-0.5">{selected.contactName}</p>
                  {selected.whatsapp && (
                    <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline mt-0.5">
                      <Phone className="w-3 h-3" /> {selected.whatsapp}
                    </a>
                  )}
                  {selected.instagram && (
                    <a href={`https://instagram.com/${selected.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-pink-400 hover:underline mt-0.5">
                      <Instagram className="w-3 h-3" /> {selected.instagram}
                    </a>
                  )}
                </div>

                {!selected.lat || !selected.lng ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-xs h-8"
                    onClick={() => handleGeocodeSingle(selected)}
                    disabled={geocodingId === selected.id}
                  >
                    {geocodingId === selected.id ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Localizando...</>
                    ) : (
                      <><MapPin className="w-3.5 h-3.5" /> Localizar no Mapa</>
                    )}
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span className="font-mono">{parseFloat(selected.lat).toFixed(5)}, {parseFloat(selected.lng).toFixed(5)}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  {selected.googleMapsLink && (
                    <a href={selected.googleMapsLink} target="_blank" rel="noopener noreferrer"
                      className="flex-1">
                      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-8">
                        <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                      </Button>
                    </a>
                  )}
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-8"
                    onClick={() => navigate(`/restaurantes/perfil/${selected.id}`)}>
                    <ChevronRight className="w-3.5 h-3.5" /> Ver Perfil
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Restaurant list */
            <div className="flex-1 overflow-y-auto">
              {/* Legend */}
              <div className="px-3 py-2 border-b border-border/20 flex items-center gap-3 flex-wrap">
                {Object.entries(TIER_COLORS).map(([tier, color]) => (
                  <div key={tier} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-muted-foreground">{TIER_LABELS[tier]}</span>
                  </div>
                ))}
              </div>

              {filteredRestaurants.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <Search className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Nenhum resultado para "{search}"</p>
                </div>
              ) : (
                filteredRestaurants.map((r: Restaurant) => {
                  const tier = r.ratingTier || "bronze";
                  const color = TIER_COLORS[tier] || "#6b7280";
                  const hasCoords = !!(r.lat && r.lng);
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelected(r);
                        if (r.lat && r.lng && mapRef.current) {
                          mapRef.current.panTo({ lat: parseFloat(r.lat), lng: parseFloat(r.lng) });
                          mapRef.current.setZoom(16);
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 border-b border-border/10 hover:bg-muted/20 transition-colors flex items-center gap-2.5"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hasCoords ? color : "#374151" }} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${!hasCoords ? "text-muted-foreground" : ""}`}>{r.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.neighborhood}{r.city ? `, ${r.city}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!hasCoords && <MapPin className="w-3 h-3 text-muted-foreground/40" />}
                        {r.ratingScore && (
                          <span className="text-[10px] font-mono" style={{ color }}>
                            {parseFloat(r.ratingScore).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
