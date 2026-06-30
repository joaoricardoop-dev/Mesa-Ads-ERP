import { useMemo, useRef, useState, useEffect } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  AlignJustify,
  LayoutGrid,
  Map as MapIcon,
  Plus,
  Check,
  Loader2,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MapView } from "@/components/Map";
import { daysInRangeInclusive } from "@shared/period";
import { computeCircuitTotal } from "@shared/cpm-pricing";
import { useSystemPremissas } from "@/hooks/useSystemPremissas";
import type { QuotePremissas, PricingTier, DiscountTier } from "@/components/campaign-wizard/pricing";
import { formatCurrency } from "@/lib/format";
import { TIPO_LABELS } from "@/lib/campaign-builder-utils";
import {
  SpacePhotoPlaceholder,
  buildSpacePhotoPlaceholderEl,
} from "./SpacePhoto";
import {
  useMediaShopStore,
  quoteQuantityItem,
  type MediaSelectedItem,
  type MediaQuantityItem,
} from "./mediaShopStore";

type LocationRow = RouterOutputs["anunciantePortal"]["listAvailableLocations"][number];
type CircuitRow = LocationRow["circuits"][number];
type ProductRow = RouterOutputs["product"]["list"][number];

/** Par (local, circuito) achatado — 1 linha do catálogo = 1 circuito DOOH. */
interface CircuitEntry {
  loc: LocationRow;
  circuit: CircuitRow;
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function telasSlot(loc: LocationRow) {
  return loc.productSlots.find((s) => s.productTipo === "telas") ?? null;
}

/** Preço do circuito no período (fonte única: computeCircuitTotal). `null` =
 *  circuito sem precificação (precisa configurar no cadastro de telas). */
function circuitPricing(circuit: CircuitRow, days: number) {
  return computeCircuitTotal(
    { insertionsPerWeek: circuit.insertionsPerWeek, costPerInsertion: circuit.costPerInsertion },
    days,
  );
}

/**
 * Status de configuração de um circuito DOOH (display-only). Pendente quando o
 * circuito não tem preço (faltam inserções/semana ou custo/inserção — fonte
 * única computeCircuitTotal) ou o local não tem coordenadas para o pin do mapa.
 */
function circuitSetupStatus(circuit: CircuitRow, loc: LocationRow) {
  const missing: string[] = [];
  if (!circuitPricing(circuit, 7)) missing.push("preço do circuito (inserções/semana e custo/inserção)");
  if (loc.lat == null || loc.lng == null) missing.push("coordenadas (mapa)");
  return { isComplete: missing.length === 0, missing };
}

function SetupPendingBadge({ missing, className }: { missing: string[]; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 ${className ?? ""}`}
        >
          <AlertTriangle className="h-3 w-3" />
          Config. pendente
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">
        <p className="text-xs font-medium">Falta configurar:</p>
        <p className="text-xs">{missing.join(" · ")}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Audiência do catálogo — define quais produtos por quantidade aparecem e se a
 * seção de telas é exibida. "internal" mostra tudo; anunciante/parceiro só veem
 * o que está marcado como visível para o respectivo perfil (mesma checagem que o
 * backend faz em createFromBuilder — evita mostrar produto que seria rejeitado).
 */
export type CatalogAudience = "internal" | "anunciante" | "parceiro";

export function InventoryCatalog({ audience = "internal" }: { audience?: CatalogAudience } = {}) {
  const { startDate, endDate, category, neighborhood } = useMediaShopStore();
  const setDates = useMediaShopStore((s) => s.setDates);
  const setCategory = useMediaShopStore((s) => s.setCategory);
  const setNeighborhood = useMediaShopStore((s) => s.setNeighborhood);
  const toggleItem = useMediaShopStore((s) => s.toggleItem);
  const isSelected = useMediaShopStore((s) => s.isSelected);
  // Preferência de view persistida por usuário (localStorage via mediaShopStore).
  // `null` = nunca escolheu → cai no default por audiência calculado abaixo.
  const savedView = useMediaShopStore((s) => s.catalogView);
  const setView = useMediaShopStore((s) => s.setCatalogView);

  const [onlyPending, setOnlyPending] = useState(false);

  const days = daysInRangeInclusive(startDate, endDate);

  const { data, isLoading } = trpc.anunciantePortal.listAvailableLocations.useQuery({
    startDate,
    endDate,
    neighborhood: neighborhood || undefined,
  });

  const locations = useMemo(() => (data ?? []) as LocationRow[], [data]);

  // Visibilidade da seção de telas por audiência. listAvailableLocations já filtra
  // por visibleToAdvertisers, mas o submit (createFromBuilder) checa
  // visibleToPartners para parceiros — então gatemos a seção pela flag do perfil
  // p/ não mostrar telas que o backend rejeitaria. Internal sempre vê.
  const { data: catalogProducts } = trpc.product.list.useQuery(undefined, {
    enabled: audience !== "internal",
  });
  const showTelas = useMemo(() => {
    if (audience === "internal") return true;
    const telas = (catalogProducts ?? []).filter((p) => p.tipo === "telas" && p.isActive);
    if (telas.length === 0) return true; // indeterminado: não esconde
    return telas.some((p) =>
      audience === "anunciante" ? p.visibleToAdvertisers : p.visibleToPartners,
    );
  }, [catalogProducts, audience]);

  // Locais de mídia = têm slot de telas (inventário por LOCAL). Produtos por
  // quantidade (bolachas/impressos) ficam na seção dedicada abaixo.
  const screenLocations = useMemo(
    () => locations.filter((l) => telasSlot(l) != null),
    [locations],
  );

  // Default por audiência aplicado SÓ enquanto não há preferência salva: anunciante/
  // parceiro abrem no Mapa quando há local com coordenadas (escolher por bairro vira
  // a primeira ação); internal mantém a Lista. Assim que o usuário troca a view, a
  // escolha persiste (savedView) e passa a vencer o default em toda visita.
  const audienceDefaultView = useMemo<"list" | "cards" | "map">(() => {
    if (audience === "internal") return "list";
    const hasCoords = screenLocations.some((l) => l.lat != null && l.lng != null);
    return hasCoords ? "map" : "list";
  }, [audience, screenLocations]);

  const view = savedView ?? audienceDefaultView;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of screenLocations) if (l.categoria) set.add(l.categoria);
    return Array.from(set).sort();
  }, [screenLocations]);

  const byCategory = useMemo(
    () => (category ? screenLocations.filter((l) => l.categoria === category) : screenLocations),
    [screenLocations, category],
  );

  // Achata locais → 1 entrada por circuito (a unidade de venda DOOH). Cada
  // circuito vira uma linha/card selecionável independente.
  const circuitEntries = useMemo<CircuitEntry[]>(
    () => byCategory.flatMap((loc) => loc.circuits.map((circuit) => ({ loc, circuit }))),
    [byCategory],
  );

  const pendingCount = useMemo(
    () => circuitEntries.filter((e) => !circuitSetupStatus(e.circuit, e.loc).isComplete).length,
    [circuitEntries],
  );

  const filtered = useMemo(
    () =>
      onlyPending
        ? circuitEntries.filter((e) => !circuitSetupStatus(e.circuit, e.loc).isComplete)
        : circuitEntries,
    [circuitEntries, onlyPending],
  );

  function buildCircuitItem(loc: LocationRow, circuit: CircuitRow): MediaSelectedItem | null {
    const slot = telasSlot(loc);
    if (!slot) return null;
    return {
      telaId: circuit.telaId,
      restaurantId: loc.restaurantId,
      restaurantName: loc.name,
      neighborhood: loc.neighborhood,
      circuitName: circuit.nome || `Circuito #${circuit.telaId}`,
      productId: slot.productId,
      productName: slot.productName,
      insertionsPerWeek: circuit.insertionsPerWeek ?? 0,
      costPerInsertion: circuit.costPerInsertion ?? 0,
    };
  }

  function onToggleCircuit(loc: LocationRow, circuit: CircuitRow) {
    const item = buildCircuitItem(loc, circuit);
    if (item) toggleItem(item);
  }

  return (
    <div className="space-y-4">
      {showTelas && (
      <>
      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="label-mono text-[11px]">Início</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setDates(e.target.value, endDate)}
              data-testid="filter-start"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-mono text-[11px]">Fim</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setDates(startDate, e.target.value)}
              data-testid="filter-end"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="label-mono text-[11px]">Categoria</Label>
            <Select
              value={category ?? "all"}
              onValueChange={(v) => setCategory(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="label-mono text-[11px]">Bairro</Label>
            <Input
              placeholder="Filtrar bairro"
              value={neighborhood ?? ""}
              onChange={(e) => setNeighborhood(e.target.value || null)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Header + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Carregando inventário…"
              : `${filtered.length} local(is) de telas · período de ${days} dia(s)`}
          </p>
          {!isLoading && pendingCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant={onlyPending ? "secondary" : "outline"}
              className="h-7 gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400"
              onClick={() => setOnlyPending((v) => !v)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {onlyPending ? "Mostrar todos" : `${pendingCount} sem configuração`}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="h-7 gap-1.5"
            onClick={() => setView("list")}
          >
            <AlignJustify className="h-3.5 w-3.5" /> Lista
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "cards" ? "secondary" : "ghost"}
            className="h-7 gap-1.5"
            onClick={() => setView("cards")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "map" ? "secondary" : "ghost"}
            className="h-7 gap-1.5"
            onClick={() => setView("map")}
          >
            <MapIcon className="h-3.5 w-3.5" /> Mapa
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : view === "map" ? (
        <CatalogMap
          locations={byCategory}
          days={days}
          onAdd={onToggleCircuit}
          isSelected={isSelected}
        />
      ) : view === "list" ? (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum circuito de mídia (telas) disponível para os filtros selecionados.
              </p>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 text-[10px] label-mono text-muted-foreground">
                  <span>Local</span>
                  <span>Circuito</span>
                  <span className="text-right">Semanas</span>
                  <span className="text-right">Custo/semana</span>
                  <span />
                </div>
                {filtered.map((e) => (
                  <CircuitListRow
                    key={e.circuit.telaId}
                    loc={e.loc}
                    circuit={e.circuit}
                    days={days}
                    selected={isSelected(e.circuit.telaId)}
                    onToggle={() => onToggleCircuit(e.loc, e.circuit)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <CircuitCard
              key={e.circuit.telaId}
              loc={e.loc}
              circuit={e.circuit}
              days={days}
              selected={isSelected(e.circuit.telaId)}
              onToggle={() => onToggleCircuit(e.loc, e.circuit)}
            />
          ))}
          {filtered.length === 0 && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum circuito de mídia (telas) disponível para os filtros selecionados.
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </>
      )}

      {/* Produtos por quantidade (não amarrados a local) */}
      <QuantityProductsSection days={days} audience={audience} locations={locations} />
    </div>
  );
}

function CircuitListRow({
  loc,
  circuit,
  days,
  selected,
  onToggle,
}: {
  loc: LocationRow;
  circuit: CircuitRow;
  days: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const pricing = circuitPricing(circuit, days);
  const setup = circuitSetupStatus(circuit, loc);
  return (
    <div
      data-testid={`circuito-card-${circuit.telaId}`}
      className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-x-3 gap-y-1 px-4 py-3"
    >
      <div className="col-span-2 sm:col-span-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm truncate">{loc.name}</p>
          {!setup.isComplete && <SetupPendingBadge missing={setup.missing} className="text-[9px] py-0 shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {loc.neighborhood || loc.city || "—"}
          {loc.categoria && (
            <Badge variant="outline" className="ml-1 capitalize text-[9px] py-0">
              {loc.categoria}
            </Badge>
          )}
        </p>
      </div>
      <div className="col-span-2 sm:col-span-1 min-w-0">
        <p className="text-sm truncate">{circuit.nome || `Circuito #${circuit.telaId}`}</p>
        {pricing && (
          <p className="text-[11px] text-muted-foreground">
            {formatInt(pricing.insertionsPerWeek)} inserções/sem · {formatCurrency(pricing.costPerInsertion)}/inserção
          </p>
        )}
      </div>
      <span className="text-xs sm:text-sm sm:text-right flex items-center gap-1 sm:justify-end text-muted-foreground">
        {pricing ? `${pricing.weeks} sem` : "—"}
      </span>
      <span className="text-sm font-semibold sm:text-right whitespace-nowrap">
        {pricing ? formatCurrency(pricing.weeklyCost) : "Sob consulta"}
      </span>
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant={selected ? "secondary" : "default"}
          className="h-8 gap-1.5"
          onClick={onToggle}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{selected ? "Adicionado" : "Adicionar"}</span>
        </Button>
      </div>
    </div>
  );
}

function CircuitCard({
  loc,
  circuit,
  days,
  selected,
  onToggle,
}: {
  loc: LocationRow;
  circuit: CircuitRow;
  days: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const pricing = circuitPricing(circuit, days);
  const setup = circuitSetupStatus(circuit, loc);

  const coverPhoto = loc.photoUrls?.[0] ?? null;

  return (
    <Card
      data-testid={`circuito-card-${circuit.telaId}`}
      className={`overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
    >
      {coverPhoto ? (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={coverPhoto}
            alt={loc.name}
            className="w-full h-full object-cover"
            data-testid={`local-photo-${loc.restaurantId}`}
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
        </div>
      ) : (
        <SpacePhotoPlaceholder
          className="aspect-video w-full overflow-hidden border-b border-border"
          testId={`local-photo-placeholder-${loc.restaurantId}`}
        />
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{loc.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {circuit.nome || `Circuito #${circuit.telaId}`}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {loc.neighborhood || loc.city || "—"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {loc.categoria && (
              <Badge variant="outline" className="capitalize text-[10px]">
                {loc.categoria}
              </Badge>
            )}
            {!setup.isComplete && <SetupPendingBadge missing={setup.missing} className="text-[10px]" />}
          </div>
        </div>

        {pricing && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {formatInt(pricing.insertionsPerWeek)} inserções/sem · {formatCurrency(pricing.costPerInsertion)}/inserção
            </span>
            <span>
              {pricing.weeks} sem · {days} dia(s)
            </span>
          </div>
        )}

        <div className="flex items-end justify-between gap-2 pt-1 border-t border-border">
          <div>
            <p className="label-mono text-[10px] text-muted-foreground">Custo/semana</p>
            <p className="font-display text-lg font-semibold">
              {pricing ? formatCurrency(pricing.weeklyCost) : "Sob consulta"}
            </p>
            {pricing && (
              <p className="text-[11px] text-muted-foreground">
                Total {formatCurrency(pricing.totalPrice)}
              </p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant={selected ? "secondary" : "default"}
            className="gap-1.5"
            onClick={onToggle}
          >
            {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {selected ? "Adicionado" : "Adicionar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Seção de produtos por quantidade ────────────────────────────────────────
// Bolachas/impressos e demais formatos NÃO são presos a local: compra por qtd.
// Preço via helper canônico (quoteQuantityItem → quotePrice), sem recálculo.
function QuantityProductsSection({
  days,
  audience,
  locations,
}: {
  days: number;
  audience: CatalogAudience;
  locations: LocationRow[];
}) {
  const sys = useSystemPremissas();
  const quotePremissas: QuotePremissas = useMemo(
    () => ({ ...sys.premissas, bvAgencia: sys.bvAgencia }),
    [sys],
  );

  const { data: productsData, isLoading: productsLoading } = trpc.product.list.useQuery();
  const { data: bundle } = trpc.product.getPricingBundle.useQuery();

  const addQuantityItem = useMediaShopStore((s) => s.addQuantityItem);
  const quantityCountForProduct = useMediaShopStore((s) => s.quantityCountForProduct);

  // Produtos por quantidade = ativos, não-telas e que NÃO são precificados por
  // CPM do local (pricingMode='cpm' vive por local, não por quantidade — evita
  // exibir/cobrar um preço por quantidade enganoso para produtos CPM).
  // Para anunciante/parceiro, só os marcados como visíveis ao perfil — mesma
  // checagem que o backend faz no submit, evita oferecer item que seria rejeitado.
  const products = useMemo(
    () =>
      (productsData ?? []).filter((p) => {
        if (!p.isActive || p.tipo === "telas" || p.pricingMode === "cpm") return false;
        if (audience === "anunciante") return p.visibleToAdvertisers;
        if (audience === "parceiro") return p.visibleToPartners;
        return true;
      }),
    [productsData, audience],
  );

  const tiersByProduct = useMemo(() => {
    const map = new Map<number, PricingTier[]>();
    for (const t of bundle?.tiers ?? []) {
      const arr = map.get(t.productId) ?? [];
      arr.push({
        id: t.id,
        productId: t.productId,
        volumeMin: t.volumeMin,
        volumeMax: t.volumeMax,
        custoUnitario: t.custoUnitario,
        frete: t.frete,
        margem: t.margem,
        artes: t.artes,
        precoBase: t.precoBase,
      });
      map.set(t.productId, arr);
    }
    return map;
  }, [bundle]);

  const discountByProduct = useMemo(() => {
    const map = new Map<number, DiscountTier[]>();
    for (const d of bundle?.discountTiers ?? []) {
      const arr = map.get(d.productId) ?? [];
      arr.push({
        id: d.id,
        productId: d.productId,
        priceMin: d.priceMin,
        priceMax: d.priceMax,
        discountPercent: d.discountPercent,
      });
      map.set(d.productId, arr);
    }
    return map;
  }, [bundle]);

  // Restaurantes que recebem bolacha = têm slot de produto tipo "coaster" em
  // productSlots (fonte única: listAvailableLocations / Config > Produtos).
  // Reaproveita os dados já carregados — não cria query/fonte paralela. Apenas
  // informativo (onde a bolacha pode ser distribuída); a contratação segue por
  // quantidade solta, sem qtd por restaurante.
  const hasCoasterProduct = useMemo(
    () => products.some((p) => p.tipo === "coaster"),
    [products],
  );
  const coasterRestaurants = useMemo(
    () =>
      hasCoasterProduct
        ? locations
            .filter((l) => l.productSlots.some((s) => s.productTipo === "coaster"))
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        : [],
    [locations, hasCoasterProduct],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" /> Produtos por quantidade
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Bolachas, impressos e outros formatos. Comprados por quantidade e distribuídos
          depois — sem vínculo com um local específico.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {productsLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum produto por quantidade cadastrado.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {products.map((p) => (
              <QuantityProductRow
                key={p.id}
                product={p}
                tiers={tiersByProduct.get(p.id) ?? []}
                discountTiers={discountByProduct.get(p.id) ?? []}
                days={days}
                premissas={quotePremissas}
                lineCount={quantityCountForProduct(p.id)}
                onAdd={(quantity) =>
                  addQuantityItem({
                    productId: p.id,
                    productName: p.name,
                    tipo: p.tipo,
                    pricingMode: p.pricingMode,
                    unitLabel: p.unitLabel || "unidade",
                    quantity,
                    tiers: tiersByProduct.get(p.id) ?? [],
                    discountTiers: discountByProduct.get(p.id) ?? [],
                  })
                }
              />
            ))}
          </div>
        )}

        {coasterRestaurants.length > 0 && (
          <div className="border-t border-border p-4" data-testid="coaster-restaurants">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-medium">Restaurantes disponíveis para bolacha</p>
              <Badge variant="secondary" className="text-[10px] py-0">
                {coasterRestaurants.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Onde a bolacha pode ser distribuída. A contratação segue por quantidade —
              a distribuição é definida depois.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {coasterRestaurants.map((r) => (
                <Badge
                  key={r.restaurantId}
                  variant="outline"
                  className="font-normal"
                  data-testid={`coaster-restaurant-${r.restaurantId}`}
                >
                  {r.name}
                  {r.neighborhood && (
                    <span className="ml-1 text-muted-foreground">· {r.neighborhood}</span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuantityProductRow({
  product,
  tiers,
  discountTiers,
  days,
  premissas,
  lineCount,
  onAdd,
}: {
  product: ProductRow;
  tiers: PricingTier[];
  discountTiers: DiscountTier[];
  days: number;
  premissas: QuotePremissas;
  lineCount: number;
  onAdd: (quantity: number) => void;
}) {
  const seedQty = tiers[0]?.volumeMin && tiers[0].volumeMin > 0 ? tiers[0].volumeMin : 1000;
  const [qty, setQty] = useState<number>(seedQty);

  const quote = useMemo(
    () =>
      quoteQuantityItem(
        {
          productId: product.id,
          productName: product.name,
          pricingMode: product.pricingMode,
          tipo: product.tipo,
          tiers,
          discountTiers,
          quantity: qty,
        },
        days,
        premissas,
      ),
    [product, tiers, discountTiers, qty, days, premissas],
  );

  const hasPrice = tiers.length > 0 && quote.totalPrice > 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="col-span-2 sm:col-span-1 min-w-0">
        <p className="font-medium text-sm truncate">{product.name}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {(product.tipo || "produto").replace(/_/g, " ")} · {product.unitLabel || "unidade"}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={1}
          className="h-8 w-24"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          aria-label={`Quantidade de ${product.name}`}
        />
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {product.unitLabel || "un."}
        </span>
      </div>
      <span className="text-sm font-semibold sm:text-right whitespace-nowrap">
        {hasPrice ? formatCurrency(quote.totalPrice) : "Sob consulta"}
      </span>
      <div className="flex items-center justify-end gap-1.5">
        {lineCount > 0 && (
          <span className="label-mono text-[10px] text-primary whitespace-nowrap">
            {lineCount}× no plano
          </span>
        )}
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          disabled={!hasPrice}
          onClick={() => onAdd(qty)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>
    </div>
  );
}

function CatalogMap({
  locations,
  days,
  onAdd,
  isSelected,
}: {
  locations: LocationRow[];
  days: number;
  onAdd: (loc: LocationRow, circuit: CircuitRow) => void;
  isSelected: (id: number) => boolean;
}) {
  // `map` precisa ser estado (não ref): o MapView carrega o Google Maps de forma
  // assíncrona e só então dispara onMapReady. Se guardássemos apenas numa ref, o
  // efeito que cria os markers rodaria uma única vez (antes do mapa existir) e
  // nunca mais — nenhum pin apareceria. Como estado, a prontidão do mapa entra
  // nas deps e o efeito re-roda para plotar os markers.
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const withCoords = useMemo(
    () => locations.filter((l) => l.lat != null && l.lng != null),
    [locations],
  );

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (!infoRef.current) infoRef.current = new google.maps.InfoWindow();

    const bounds = new google.maps.LatLngBounds();
    for (const loc of withCoords) {
      const pos = { lat: loc.lat as number, lng: loc.lng as number };
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: loc.name,
      });
      marker.addListener("click", () => {
        // Construção via DOM + textContent (NUNCA HTML interpolado) — os campos
        // name/neighborhood vêm do banco e não podem ser tratados como markup.
        const container = document.createElement("div");
        container.style.fontFamily = "sans-serif";
        container.style.minWidth = "200px";

        // Foto do espaço (ou placeholder "Foto em breve" — fonte única SpacePhoto)
        // no topo do popup, para não colapsar/parecer vazio quando não há foto.
        const coverPhoto = loc.photoUrls?.[0] ?? null;
        const photoEl = coverPhoto
          ? (() => {
              const wrap = document.createElement("div");
              wrap.className = "w-full overflow-hidden rounded-md bg-muted";
              wrap.style.aspectRatio = "16 / 9";
              const img = document.createElement("img");
              img.src = coverPhoto;
              img.alt = loc.name;
              img.className = "w-full h-full object-cover";
              wrap.appendChild(img);
              return wrap;
            })()
          : buildSpacePhotoPlaceholderEl(
              "aspect-video w-full overflow-hidden rounded-md",
              `map-photo-placeholder-${loc.restaurantId}`,
            );
        photoEl.style.marginBottom = "6px";
        container.appendChild(photoEl);

        const nameEl = document.createElement("strong");
        nameEl.textContent = loc.name;

        const hoodEl = document.createElement("span");
        hoodEl.style.color = "#666";
        hoodEl.style.fontSize = "12px";
        hoodEl.textContent = loc.neighborhood ?? "";

        container.appendChild(nameEl);
        container.appendChild(document.createElement("br"));
        container.appendChild(hoodEl);

        // Uma linha por circuito do local, com custo/semana e botão add/remove.
        if (loc.circuits.length === 0) {
          const emptyEl = document.createElement("p");
          emptyEl.style.fontSize = "12px";
          emptyEl.style.color = "#888";
          emptyEl.style.marginTop = "6px";
          emptyEl.textContent = "Nenhum circuito cadastrado.";
          container.appendChild(emptyEl);
        } else {
          for (const circuit of loc.circuits) {
            const pricing = circuitPricing(circuit, days);
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.justifyContent = "space-between";
            row.style.gap = "8px";
            row.style.marginTop = "6px";
            row.style.paddingTop = "6px";
            row.style.borderTop = "1px solid #eee";

            const info = document.createElement("div");
            const cName = document.createElement("span");
            cName.style.fontSize = "12px";
            cName.style.fontWeight = "600";
            cName.textContent = circuit.nome || `Circuito #${circuit.telaId}`;
            const cPrice = document.createElement("span");
            cPrice.style.fontSize = "11px";
            cPrice.style.color = "#666";
            cPrice.textContent = pricing
              ? ` · ${formatCurrency(pricing.weeklyCost)}/sem · ${pricing.weeks} sem`
              : " · Sob consulta";
            info.appendChild(cName);
            info.appendChild(cPrice);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.style.padding = "4px 8px";
            btn.style.borderRadius = "6px";
            btn.style.border = "none";
            btn.style.background = "#00c238";
            btn.style.color = "#fff";
            btn.style.cursor = "pointer";
            btn.style.fontSize = "11px";
            btn.style.whiteSpace = "nowrap";
            btn.textContent = isSelected(circuit.telaId) ? "Remover" : "Adicionar";
            btn.addEventListener("click", () => {
              onAdd(loc, circuit);
              infoRef.current!.close();
            });

            row.appendChild(info);
            row.appendChild(btn);
            container.appendChild(row);
          }
        }

        infoRef.current!.setContent(container);
        infoRef.current!.open(map, marker);
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    }
    if (withCoords.length > 0) map.fitBounds(bounds);

    // Hook de teste APENAS em dev: expõe os títulos dos markers reais e permite
    // disparar o click via o event system do SDK do Google. O smoke test com a
    // chave real (e2e/builder-locais-real-maps.spec.ts) usa isso em vez de
    // adivinhar o DOM interno do Google Maps (que é instável entre versões).
    // Em build de produção `import.meta.env.DEV` é `false`, então o bloco é
    // eliminado pelo tree-shaking do Vite e nada disso vai pro bundle final.
    if (import.meta.env.DEV) {
      const handles = markersRef.current;
      (
        window as unknown as {
          __catalogMapTest?: {
            markerTitles: string[];
            clickMarker: (title: string) => boolean;
          };
        }
      ).__catalogMapTest = {
        markerTitles: handles.map((m) => m.getTitle?.() ?? ""),
        clickMarker: (title: string) => {
          const target = handles.find((m) => m.getTitle?.() === title);
          if (!target) return false;
          google.maps.event.trigger(target, "click");
          return true;
        },
      };
    }
  }, [map, withCoords, days, onAdd, isSelected]);

  return (
    <Card data-testid="catalog-map">
      <CardContent className="p-0 overflow-hidden rounded-lg">
        <MapView
          className="h-[560px]"
          onMapReady={(m) => {
            setMap(m);
          }}
        />
        {withCoords.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">
            Nenhum local com coordenadas cadastradas para exibir no mapa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
