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
  Tv,
  Users,
  Eye,
  Repeat,
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
import { computeScreenDailyPricing, screenSetupStatus } from "@shared/cpm-pricing";
import { defaultInsertionsPerDay, computeScreenMetrics } from "@shared/screen-metrics";
import { useSystemPremissas } from "@/hooks/useSystemPremissas";
import type { QuotePremissas, PricingTier, DiscountTier } from "@/components/campaign-wizard/pricing";
import { formatCurrency } from "@/lib/format";
import {
  useMediaShopStore,
  cpmConfigForPricing,
  quoteQuantityItem,
  type MediaSelectedItem,
  type MediaCpmSnapshot,
  type MediaQuantityItem,
} from "./mediaShopStore";

type LocationRow = RouterOutputs["anunciantePortal"]["listAvailableLocations"][number];
type ProductRow = RouterOutputs["product"]["list"][number];

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

function telasSlot(loc: LocationRow) {
  return loc.productSlots.find((s) => s.productTipo === "telas") ?? null;
}

function locSetupStatus(loc: LocationRow) {
  return screenSetupStatus({
    cpm: loc.screenCpm.cpm,
    insertionsPerHour: loc.screenCpm.insertionsPerHour,
    impactsPerInsertion: loc.screenCpm.impactsPerInsertion,
    weeklyHours: loc.screenCpm.weeklyHours,
    lat: loc.lat,
    lng: loc.lng,
  });
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

  const pendingCount = useMemo(
    () => byCategory.filter((l) => !locSetupStatus(l).isComplete).length,
    [byCategory],
  );

  const filtered = useMemo(
    () => (onlyPending ? byCategory.filter((l) => !locSetupStatus(l).isComplete) : byCategory),
    [byCategory, onlyPending],
  );

  function buildItem(loc: LocationRow): MediaSelectedItem | null {
    const slot = telasSlot(loc);
    if (!slot) return null;
    const cpmSnap: MediaCpmSnapshot = {
      cpm: loc.screenCpm.cpm,
      insertionsPerHour: loc.screenCpm.insertionsPerHour,
      impactsPerInsertion: loc.screenCpm.impactsPerInsertion,
      weeklyHours: loc.screenCpm.weeklyHours,
    };
    const insDefault = defaultInsertionsPerDay({
      insertionsPerHour: loc.screenCpm.insertionsPerHour,
      weeklyHours: loc.screenCpm.weeklyHours,
      dailyLoops: loc.dailyLoops,
    });
    return {
      restaurantId: loc.restaurantId,
      restaurantName: loc.name,
      neighborhood: loc.neighborhood,
      categoria: loc.categoria ?? "restaurante",
      productId: slot.productId,
      productName: slot.productName,
      cycleWeeks: slot.cycleWeeks ?? 4,
      shareIndex: 1,
      screens: Math.max(1, loc.screensCount || 1),
      insertionsPerDayDefault: insDefault,
      insertionsPerDay: insDefault,
      monthlyCustomers: loc.monthlyCustomers ?? null,
      cpm: cpmSnap,
    };
  }

  function onToggleLoc(loc: LocationRow) {
    const item = buildItem(loc);
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
          locations={filtered}
          days={days}
          onAdd={onToggleLoc}
          isSelected={isSelected}
        />
      ) : view === "list" ? (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum local de mídia (telas) disponível para os filtros selecionados.
              </p>
            ) : (
              <div className="divide-y divide-border">
                <div className="hidden sm:grid grid-cols-[1fr_repeat(4,auto)_auto] gap-3 px-4 py-2 text-[10px] label-mono text-muted-foreground">
                  <span>Local</span>
                  <span className="text-right">Telas</span>
                  <span className="text-right">Exibições</span>
                  <span className="text-right">Alcance</span>
                  <span className="text-right">Valor</span>
                  <span />
                </div>
                {filtered.map((loc) => (
                  <LocationListRow
                    key={loc.restaurantId}
                    loc={loc}
                    days={days}
                    selected={isSelected(loc.restaurantId)}
                    onToggle={() => onToggleLoc(loc)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((loc) => (
            <LocationCard
              key={loc.restaurantId}
              loc={loc}
              days={days}
              selected={isSelected(loc.restaurantId)}
              onToggle={() => onToggleLoc(loc)}
            />
          ))}
          {filtered.length === 0 && (
            <Card className="sm:col-span-2 xl:col-span-3">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum local de mídia (telas) disponível para os filtros selecionados.
              </CardContent>
            </Card>
          )}
        </div>
      )}
      </>
      )}

      {/* Produtos por quantidade (não amarrados a local) */}
      <QuantityProductsSection days={days} audience={audience} />
    </div>
  );
}

function locationMetrics(loc: LocationRow, days: number) {
  const insPerDay = defaultInsertionsPerDay({
    insertionsPerHour: loc.screenCpm.insertionsPerHour,
    weeklyHours: loc.screenCpm.weeklyHours,
    dailyLoops: loc.dailyLoops,
  });
  const screens = Math.max(1, loc.screensCount || 1);
  const metrics = computeScreenMetrics({
    insertionsPerDay: insPerDay,
    impactsPerInsertion: loc.screenCpm.impactsPerInsertion,
    monthlyCustomers: loc.monthlyCustomers,
    days,
    screens,
  });
  const pricing = computeScreenDailyPricing(cpmConfigForPricing(loc.screenCpm), days);
  return { metrics, pricing, screens };
}

function LocationListRow({
  loc,
  days,
  selected,
  onToggle,
}: {
  loc: LocationRow;
  days: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const { metrics, pricing, screens } = locationMetrics(loc, days);
  const setup = locSetupStatus(loc);
  return (
    <div
      data-testid={`local-card-${loc.restaurantId}`}
      className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(4,auto)_auto] items-center gap-x-3 gap-y-1 px-4 py-3"
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
      <span className="text-xs sm:text-sm sm:text-right flex items-center gap-1 sm:justify-end text-muted-foreground">
        <Tv className="h-3 w-3 sm:hidden" />
        {screens}
      </span>
      <span className="text-xs sm:text-sm sm:text-right flex items-center gap-1 sm:justify-end text-muted-foreground">
        <Eye className="h-3 w-3 sm:hidden" />
        {formatInt(metrics.exibicoes)}
      </span>
      <span className="text-xs sm:text-sm sm:text-right flex items-center gap-1 sm:justify-end text-muted-foreground">
        <Users className="h-3 w-3 sm:hidden" />
        {formatInt(metrics.alcance)}
      </span>
      <span className="text-sm font-semibold sm:text-right">
        {pricing ? formatCurrency(pricing.totalPrice) : "Sob consulta"}
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

function LocationCard({
  loc,
  days,
  selected,
  onToggle,
}: {
  loc: LocationRow;
  days: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const { metrics, pricing, screens } = locationMetrics(loc, days);
  const setup = locSetupStatus(loc);

  return (
    <Card
      data-testid={`local-card-${loc.restaurantId}`}
      className={selected ? "ring-2 ring-primary" : ""}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">{loc.name}</p>
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

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric icon={<Eye className="h-3 w-3" />} label="Exibições" value={formatInt(metrics.exibicoes)} />
          <Metric icon={<Users className="h-3 w-3" />} label="Alcance" value={formatInt(metrics.alcance)} />
          <Metric
            icon={<Repeat className="h-3 w-3" />}
            label="Frequência"
            value={metrics.frequencia > 0 ? metrics.frequencia.toFixed(1) : "—"}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Tv className="h-3.5 w-3.5" /> {screens} tela(s)
          </span>
          <span>{days} dia(s)</span>
        </div>

        <div className="flex items-end justify-between gap-2 pt-1 border-t border-border">
          <div>
            <p className="label-mono text-[10px] text-muted-foreground">Valor no período</p>
            <p className="font-display text-lg font-semibold">
              {pricing ? formatCurrency(pricing.totalPrice) : "Sob consulta"}
            </p>
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <span className="label-mono text-[9px]">{label}</span>
      </div>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

// ─── Seção de produtos por quantidade ────────────────────────────────────────
// Bolachas/impressos e demais formatos NÃO são presos a local: compra por qtd.
// Preço via helper canônico (quoteQuantityItem → quotePrice), sem recálculo.
function QuantityProductsSection({ days, audience }: { days: number; audience: CatalogAudience }) {
  const sys = useSystemPremissas();
  const quotePremissas: QuotePremissas = useMemo(
    () => ({ ...sys.premissas, bvAgencia: sys.bvAgencia }),
    [sys],
  );

  const { data: productsData, isLoading: productsLoading } = trpc.product.list.useQuery();
  const { data: bundle } = trpc.product.getPricingBundle.useQuery();

  const addQuantityItem = useMediaShopStore((s) => s.addQuantityItem);
  const quantityCountForProduct = useMediaShopStore((s) => s.quantityCountForProduct);

  // Produtos por quantidade = ativos e que NÃO são telas (telas vivem por local).
  // Para anunciante/parceiro, só os marcados como visíveis ao perfil — mesma
  // checagem que o backend faz no submit, evita oferecer item que seria rejeitado.
  const products = useMemo(
    () =>
      (productsData ?? []).filter((p) => {
        if (!p.isActive || p.tipo === "telas") return false;
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
  onAdd: (loc: LocationRow) => void;
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
      const { pricing } = locationMetrics(loc, days);
      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: loc.name,
      });
      marker.addListener("click", () => {
        const priceLabel = pricing ? formatCurrency(pricing.totalPrice) : "Sob consulta";
        // Construção via DOM + textContent (NUNCA HTML interpolado) — os campos
        // name/neighborhood vêm do banco e não podem ser tratados como markup.
        const container = document.createElement("div");
        container.style.fontFamily = "sans-serif";
        container.style.minWidth = "160px";

        const nameEl = document.createElement("strong");
        nameEl.textContent = loc.name;

        const hoodEl = document.createElement("span");
        hoodEl.style.color = "#666";
        hoodEl.style.fontSize = "12px";
        hoodEl.textContent = loc.neighborhood ?? "";

        const priceEl = document.createElement("span");
        priceEl.style.fontSize = "13px";
        priceEl.textContent = `${priceLabel} · ${days} dia(s)`;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.marginTop = "6px";
        btn.style.padding = "4px 8px";
        btn.style.borderRadius = "6px";
        btn.style.border = "none";
        btn.style.background = "#00c238";
        btn.style.color = "#fff";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "12px";
        btn.textContent = isSelected(loc.restaurantId) ? "Remover" : "Adicionar";
        btn.addEventListener("click", () => {
          onAdd(loc);
          infoRef.current!.close();
        });

        container.appendChild(nameEl);
        container.appendChild(document.createElement("br"));
        container.appendChild(hoodEl);
        container.appendChild(document.createElement("br"));
        container.appendChild(priceEl);
        container.appendChild(document.createElement("br"));
        container.appendChild(btn);

        infoRef.current!.setContent(container);
        infoRef.current!.open(map, marker);
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
    }
    if (withCoords.length > 0) map.fitBounds(bounds);
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
