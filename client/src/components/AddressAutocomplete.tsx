/// <reference types="@types/google.maps" />

import { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Search, Loader2, MapPin } from "lucide-react";

export interface ParsedAddress {
  /** Logradouro (rua/avenida) */
  street: string;
  /** Número */
  number: string;
  /** Bairro */
  neighborhood: string;
  /** Cidade / município */
  city: string;
  /** UF (sigla de 2 letras) */
  state: string;
  /** CEP */
  cep: string;
  lat: number | null;
  lng: number | null;
  /** Endereço formatado completo retornado pelo Google */
  formattedAddress: string;
}

/**
 * FONTE ÚNICA de parsing dos `address_components` do Google. Nenhuma tela
 * reimplementa esse parsing — todas consomem `ParsedAddress` deste módulo.
 */
export function parseGoogleAddressComponents(
  components: google.maps.places.AddressComponent[] | undefined | null,
  location?: google.maps.LatLng | null,
  formattedAddress?: string,
): ParsedAddress {
  const get = (type: string, short = false): string => {
    const c = components?.find((comp) => comp.types.includes(type));
    if (!c) return "";
    return (short ? c.shortText : c.longText) ?? "";
  };

  const neighborhood =
    get("sublocality_level_1") || get("sublocality") || get("neighborhood");
  const city =
    get("administrative_area_level_2") ||
    get("locality") ||
    get("administrative_area_level_3");

  return {
    street: get("route"),
    number: get("street_number"),
    neighborhood,
    city,
    state: get("administrative_area_level_1", true),
    cep: get("postal_code"),
    lat: location ? location.lat() : null,
    lng: location ? location.lng() : null,
    formattedAddress: formattedAddress ?? "",
  };
}

interface AddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  /** Classe do wrapper externo */
  className?: string;
  /** Classe do <input> de busca */
  inputClassName?: string;
  /** Classe do <Label> */
  labelClassName?: string;
  disabled?: boolean;
  /** Chamado ao escolher uma sugestão, com os campos já parseados */
  onSelect: (address: ParsedAddress) => void;
  "data-testid"?: string;
}

export function AddressAutocomplete({
  label,
  placeholder = "Buscar endereço...",
  className,
  inputClassName,
  labelClassName,
  disabled,
  onSelect,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const libRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const ensureLib = useCallback(async () => {
    if (libRef.current) return libRef.current;
    await loadGoogleMaps();
    const lib = (await window.google!.maps.importLibrary("places")) as google.maps.PlacesLibrary;
    libRef.current = lib;
    return lib;
  }, []);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!input.trim()) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      try {
        setLoading(true);
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await ensureLib();
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ["br"],
            language: "pt-BR",
            region: "br",
          });
        const preds = (results ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => p != null);
        setSuggestions(preds);
        setOpen(preds.length > 0);
        setActiveIdx(-1);
      } catch (err) {
        console.error("Falha no autocomplete de endereço", err);
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [ensureLib],
  );

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  }

  const handlePick = useCallback(
    async (pred: google.maps.places.PlacePrediction) => {
      try {
        setLoading(true);
        const place = pred.toPlace();
        await place.fetchFields({
          fields: ["addressComponents", "location", "formattedAddress"],
        });
        const parsed = parseGoogleAddressComponents(
          place.addressComponents,
          place.location,
          place.formattedAddress ?? undefined,
        );
        onSelect(parsed);
        setQuery(parsed.formattedAddress || pred.text?.text || "");
      } catch (err) {
        console.error("Falha ao obter detalhes do endereço", err);
      } finally {
        setOpen(false);
        setSuggestions([]);
        setActiveIdx(-1);
        // Encerra a sessão de billing; a próxima digitação abre uma nova.
        sessionTokenRef.current = null;
        setLoading(false);
      }
    },
    [onSelect],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        e.preventDefault();
        void handlePick(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && <Label className={cn("mb-1.5 block", labelClassName)}>{label}</Label>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-9 pr-9", inputClassName)}
          autoComplete="off"
          data-testid={testId}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          data-testid="address-autocomplete-list"
        >
          {suggestions.map((pred, idx) => {
            const main = pred.mainText?.text ?? pred.text?.text ?? "";
            const secondary = pred.secondaryText?.text ?? "";
            return (
              <li key={pred.placeId ?? idx}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void handlePick(pred);
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors",
                    idx === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                  data-testid={`address-suggestion-${idx}`}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{main}</span>
                    {secondary && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
