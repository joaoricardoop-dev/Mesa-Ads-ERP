import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Building2,
  Megaphone,
  FileText,
  Receipt,
  Phone,
  Mail,
  Instagram,
  MapPin,
  Pencil,
  CircleDot,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Play,
  Radio,
  Archive,
  FileSignature,
  Download,
  ArrowLeft,
  ChevronRight,
  Calendar,
  Boxes,
  ImageIcon,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  Tag,
  Eye,
  ChevronDown,
  Info,
  LayoutDashboard,
  ShoppingCart,
  FileBarChart2,
  Target,
} from "lucide-react";
import { generateReportPdf } from "@/lib/generate-report-pdf";
import { generateQuotationSignPdf } from "@/lib/generate-quotation-pdf";
import { generateMediaKitPdf } from "@/lib/generate-mediakit-pdf";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import {
  SEMANAS_OPTIONS,
  DESCONTOS_PRAZO,
  BV_PADRAO_AGENCIA,
  TIPO_LABELS,
  TIPO_ICONS,
  TIPO_COLORS,
  calcUnitPriceAdv,
  applyDiscountTierAdv,
  impressoesEstimadas,
  fmtBRL,
  fmtBRL4,
  fmtImpr,
  USOS_POR_PORTA_COPO,
} from "@/lib/campaign-builder-utils";

// ─── Product Price Detail Sheet ───────────────────────────────────────────────

function ProductPriceSheet({ product, hasPartner, open, onClose }: {
  product: any; hasPartner: boolean; open: boolean; onClose: () => void;
}) {
  const tiers = product.tiers ?? [];
  const discountTiers = product.discountTiers ?? [];
  const TipoIcon = TIPO_ICONS[product.tipo] ?? Package;
  const colors = TIPO_COLORS[product.tipo] ?? TIPO_COLORS.outro;

  const irpj = parseFloat(product.irpj ?? "6") / 100;
  const comRestaurante = parseFloat(product.comRestaurante ?? "15") / 100;
  const comComercialProduto = parseFloat(product.comComercial ?? "10") / 100;
  const comParceiro = hasPartner ? BV_PADRAO_AGENCIA : 0;

  const volumes = useMemo(
    () => tiers.map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b),
    [tiers]
  );

  const smallestVol = volumes[0];
  const smallestTier = tiers.find((t: any) => t.volumeMin === smallestVol);
  const baseUnitPrice4sem = smallestTier
    ? calcUnitPriceAdv({
        custoUnitario: parseFloat(smallestTier.custoUnitario),
        frete: parseFloat(smallestTier.frete),
        margem: parseFloat(smallestTier.margem) / 100,
        artes: smallestTier.artes ?? 1,
        volume: smallestVol,
        irpj, comRestaurante, comComercialProduto, comParceiro,
        pricingMode: product.pricingMode,
        precoBaseTier: parseFloat(smallestTier.precoBase ?? "0"),
      })
    : 0;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        {product.imagemUrl && (
          <div className="relative -mx-6 -mt-6 mb-4 h-48 overflow-hidden">
            <img
              src={product.imagemUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        )}
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${colors.bg}`}>
              <TipoIcon className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div>
              <SheetTitle className="text-lg">{product.name}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{TIPO_LABELS[product.tipo] ?? product.tipo}</p>
            </div>
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{product.description}</p>
          )}
        </SheetHeader>

        <div className="py-5 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            {hasPartner ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <Tag className="w-3.5 h-3.5" />
                Inclui comissão de agência (+{(BV_PADRAO_AGENCIA * 100).toFixed(0)}% BV)
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                <Tag className="w-3.5 h-3.5" />
                Preço direto — sem comissão de agência
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3 h-3" />
              Estimativa: {USOS_POR_PORTA_COPO} usos por porta-copo
            </div>
          </div>

          {tiers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Package className="w-8 h-8 opacity-20" />
              <p className="text-sm">Tabela de preços não configurada</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/30">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                      Volume · Impressões/mês
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Preço/un</th>
                    {SEMANAS_OPTIONS.map(s => (
                      <th key={s} className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                        {s} sem.
                        {DESCONTOS_PRAZO[s] ? (
                          <span className="block text-emerald-400 font-normal">-{DESCONTOS_PRAZO[s]}%</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((vol: number) => {
                    const tier = tiers.find((t: any) => t.volumeMin === vol);
                    if (!tier) return null;
                    const unitPrice4sem = calcUnitPriceAdv({
                      custoUnitario: parseFloat(tier.custoUnitario),
                      frete: parseFloat(tier.frete),
                      margem: parseFloat(tier.margem) / 100,
                      artes: tier.artes ?? 1,
                      volume: vol,
                      irpj, comRestaurante, comComercialProduto, comParceiro,
                      pricingMode: product.pricingMode,
                      precoBaseTier: parseFloat(tier.precoBase ?? "0"),
                    });
                    const discountVol = baseUnitPrice4sem > 0 && vol > smallestVol
                      ? (1 - unitPrice4sem / baseUnitPrice4sem) : 0;
                    const impr = impressoesEstimadas(vol);

                    return (
                      <tr key={vol} className="border-t border-border/10 hover:bg-accent/10 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-medium whitespace-nowrap">
                          <span>{vol.toLocaleString("pt-BR")} {product.unitLabelPlural}</span>
                          {discountVol > 0 && (
                            <span className="ml-1.5 text-emerald-400 text-[10px]">-{(discountVol * 100).toFixed(0)}% vol.</span>
                          )}
                          <br />
                          <span className="text-[10px] text-sky-400 font-normal">{fmtImpr(impr)} impressões</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmtBRL4(unitPrice4sem)}</td>
                        {SEMANAS_OPTIONS.map(s => {
                          const nPer = s / 4;
                          const precoBruto = unitPrice4sem * vol * nPer;
                          const precoPosFaixa = applyDiscountTierAdv(precoBruto, discountTiers);
                          const dsc = (DESCONTOS_PRAZO[s] ?? 0) / 100;
                          const precoTotal = precoPosFaixa * (1 - dsc);
                          const precoUnit = vol > 0 ? precoTotal / (vol * nPer) : 0;
                          return (
                            <td key={s} className="px-3 py-2.5 text-right font-mono">
                              <span className="font-semibold">{fmtBRL4(precoUnit)}</span>
                              <br />
                              <span className="text-muted-foreground text-[10px]">{fmtBRL(precoTotal)}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Product Card (Produtos tab — shopping style) ─────────────────────────────

function ShoppingProductCard({
  product,
  hasPartner,
  onViewDetails,
}: {
  product: any;
  hasPartner: boolean;
  onViewDetails: () => void;
}) {
  const volumes = useMemo(() =>
    (product.tiers ?? []).map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b),
    [product.tiers]
  );

  const defaultVol = product.defaultQtyPerLocation ?? (volumes[0] ?? 500);
  const impressoes = impressoesEstimadas(defaultVol);
  const TipoIcon = TIPO_ICONS[product.tipo] ?? Package;
  const colors = TIPO_COLORS[product.tipo] ?? TIPO_COLORS.outro;

  const irpj = parseFloat(product.irpj ?? "6") / 100;
  const comRestaurante = parseFloat(product.comRestaurante ?? "15") / 100;
  const comComercialProduto = parseFloat(product.comComercial ?? "10") / 100;
  const comParceiro = hasPartner ? BV_PADRAO_AGENCIA : 0;

  const tiers = product.tiers ?? [];
  const discountTiers = product.discountTiers ?? [];
  const smallestVol = volumes[0];
  const smallestTier = tiers.find((t: any) => t.volumeMin === smallestVol);

  const minMonthlyPrice = useMemo(() => {
    if (!smallestTier || smallestVol == null) return null;
    const unitPrice = calcUnitPriceAdv({
      custoUnitario: parseFloat(smallestTier.custoUnitario),
      frete: parseFloat(smallestTier.frete),
      margem: parseFloat(smallestTier.margem) / 100,
      artes: smallestTier.artes ?? 1,
      volume: smallestVol,
      irpj, comRestaurante, comComercialProduto, comParceiro,
      pricingMode: product.pricingMode,
      precoBaseTier: parseFloat(smallestTier.precoBase ?? "0"),
    });
    const precoBruto = unitPrice * smallestVol * 1;
    const precoPosFaixa = applyDiscountTierAdv(precoBruto, discountTiers);
    return precoPosFaixa;
  }, [smallestTier, smallestVol, irpj, comRestaurante, comComercialProduto, comParceiro, discountTiers]);

  return (
    <button
      type="button"
      onClick={onViewDetails}
      className={`group text-left w-full bg-card border border-border/30 rounded-2xl overflow-hidden ${colors.hoverBorder} hover:shadow-xl hover:shadow-black/10 transition-all duration-300 flex flex-col cursor-pointer`}
    >
      {product.imagemUrl ? (
        <div className="relative border-b border-border/20 h-40 overflow-hidden">
          <img
            src={product.imagemUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <h3 className="font-bold text-base leading-tight text-white drop-shadow">{product.name}</h3>
            <span className={`text-[11px] font-medium mt-0.5 inline-block px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              {TIPO_LABELS[product.tipo] ?? product.tipo}
            </span>
          </div>
        </div>
      ) : (
        <div className={`bg-gradient-to-br ${colors.gradient} border-b border-border/20 px-6 py-8 flex flex-col items-center justify-center gap-4`}>
          <div className={`w-16 h-16 rounded-2xl ${colors.bg} border ${colors.border} flex items-center justify-center shadow-lg`}>
            <TipoIcon className={`w-8 h-8 ${colors.text}`} />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-base leading-tight">{product.name}</h3>
            <span className={`text-[11px] font-medium mt-1 inline-block px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              {TIPO_LABELS[product.tipo] ?? product.tipo}
            </span>
          </div>
        </div>
      )}

      <div className="px-5 py-4 flex flex-col gap-3 flex-1">
        {product.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{product.description}</p>
        )}

        <div className="flex items-center gap-1.5 text-xs text-sky-400 bg-sky-500/8 border border-sky-500/15 rounded-lg px-3 py-2">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>
            {defaultVol.toLocaleString("pt-BR")} {product.unitLabelPlural} → {fmtImpr(impressoes)} impressões/mês
          </span>
        </div>

        {minMonthlyPrice != null && minMonthlyPrice > 0 && (
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-muted-foreground">a partir de</span>
            <span className="text-lg font-bold text-foreground">{fmtBRL(minMonthlyPrice)}</span>
            <span className="text-[10px] text-muted-foreground">/mês</span>
          </div>
        )}

        {volumes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {volumes.map((v: number) => (
              <span key={v} className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded-md px-2 py-0.5">
                {v.toLocaleString("pt-BR")} {product.unitLabel}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-border/20 flex gap-2">
          <div className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 bg-background hover:bg-accent transition-colors pointer-events-none">
            <Tag className="w-3.5 h-3.5" />
            Ver preços
          </div>
          <div className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs rounded-md px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors pointer-events-none">
            <ShoppingBag className="w-3.5 h-3.5" />
            Solicitar cotação
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Price Table (Tabela de Preços tab) ───────────────────────────────────────

function AdvertiserProductTable({ product, hasPartner }: { product: any; hasPartner: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const tiers = product.tiers ?? [];
  const discountTiers = product.discountTiers ?? [];

  const irpj = parseFloat(product.irpj ?? "6") / 100;
  const comRestaurante = parseFloat(product.comRestaurante ?? "15") / 100;
  const comComercialProduto = parseFloat(product.comComercial ?? "10") / 100;
  const comParceiro = hasPartner ? BV_PADRAO_AGENCIA : 0;

  const volumes = useMemo(
    () => tiers.map((t: any) => t.volumeMin).sort((a: number, b: number) => a - b),
    [tiers]
  );

  if (tiers.length === 0) {
    return (
      <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4">
          <Package className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{product.name}</span>
          <span className="text-[10px] text-muted-foreground border border-border/30 rounded px-2 py-0.5">Tabela não configurada</span>
        </div>
      </div>
    );
  }

  const smallestVol = volumes[0];
  const smallestTier = tiers.find((t: any) => t.volumeMin === smallestVol);
  const baseUnitPrice4sem = smallestTier
    ? calcUnitPriceAdv({
        custoUnitario: parseFloat(smallestTier.custoUnitario),
        frete: parseFloat(smallestTier.frete),
        margem: parseFloat(smallestTier.margem) / 100,
        artes: smallestTier.artes ?? 1,
        volume: smallestVol,
        irpj, comRestaurante, comComercialProduto, comParceiro,
        pricingMode: product.pricingMode,
        precoBaseTier: parseFloat(smallestTier.precoBase ?? "0"),
      })
    : 0;

  return (
    <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <Package className="w-4 h-4 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">{product.name}</span>
        <span className="text-xs text-muted-foreground hidden sm:block">{product.unitLabelPlural}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-t border-border/20 bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                  Volume · Impressões/mês
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">Preço/un</th>
                {SEMANAS_OPTIONS.map(s => (
                  <th key={s} className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
                    {s} sem.
                    {DESCONTOS_PRAZO[s] ? (
                      <span className="block text-emerald-400 font-normal">-{DESCONTOS_PRAZO[s]}%</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volumes.map((vol: number) => {
                const tier = tiers.find((t: any) => t.volumeMin === vol);
                if (!tier) return null;
                const unitPrice4sem = calcUnitPriceAdv({
                  custoUnitario: parseFloat(tier.custoUnitario),
                  frete: parseFloat(tier.frete),
                  margem: parseFloat(tier.margem) / 100,
                  artes: tier.artes ?? 1,
                  volume: vol,
                  irpj, comRestaurante, comComercialProduto, comParceiro,
                  pricingMode: product.pricingMode,
                  precoBaseTier: parseFloat(tier.precoBase ?? "0"),
                });
                const discountVol = baseUnitPrice4sem > 0 && vol > smallestVol
                  ? (1 - unitPrice4sem / baseUnitPrice4sem) : 0;
                const impr = impressoesEstimadas(vol);

                return (
                  <tr key={vol} className="border-t border-border/10 hover:bg-accent/10 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-medium whitespace-nowrap">
                      <span>{vol.toLocaleString("pt-BR")} {product.unitLabelPlural}</span>
                      {discountVol > 0 && (
                        <span className="ml-1.5 text-emerald-400 text-[10px]">-{(discountVol * 100).toFixed(0)}% vol.</span>
                      )}
                      <br />
                      <span className="text-[10px] text-sky-400 font-normal">{fmtImpr(impr)} impressões</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtBRL4(unitPrice4sem)}</td>
                    {SEMANAS_OPTIONS.map(s => {
                      const nPer = s / 4;
                      const precoBruto = unitPrice4sem * vol * nPer;
                      const precoPosFaixa = applyDiscountTierAdv(precoBruto, discountTiers);
                      const dsc = (DESCONTOS_PRAZO[s] ?? 0) / 100;
                      const precoTotal = precoPosFaixa * (1 - dsc);
                      const precoUnit = vol > 0 ? precoTotal / (vol * nPer) : 0;
                      return (
                        <td key={s} className="px-3 py-2.5 text-right font-mono">
                          <span className="font-semibold">{fmtBRL4(precoUnit)}</span>
                          <br />
                          <span className="text-muted-foreground text-[10px]">{fmtBRL(precoTotal)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string; icon: typeof CircleDot }> = {
  draft:       { label: "Rascunho",      dot: "bg-zinc-500",    icon: CircleDot },
  briefing:    { label: "Briefing",      dot: "bg-sky-500",     icon: FileText },
  design:      { label: "Design",        dot: "bg-violet-500",  icon: Pencil },
  aprovacao:   { label: "Aprovação",     dot: "bg-amber-500",   icon: CheckCircle2 },
  producao:    { label: "Produção",      dot: "bg-blue-500",    icon: Package },
  distribuicao:{ label: "Distribuição",  dot: "bg-orange-500",  icon: Truck },
  transito:    { label: "Trânsito",      dot: "bg-amber-500",   icon: Truck },
  executar:    { label: "Executar",      dot: "bg-purple-500",  icon: Play },
  veiculacao:  { label: "Em Veiculação", dot: "bg-emerald-500", icon: Radio },
  inativa:     { label: "Finalizada",    dot: "bg-zinc-500",    icon: Archive },
  active:      { label: "Ativa",         dot: "bg-emerald-500", icon: CheckCircle2 },
  completed:   { label: "Concluída",     dot: "bg-zinc-500",    icon: CheckCircle2 },
  paused:      { label: "Pausada",       dot: "bg-amber-500",   icon: Clock },
  archived:    { label: "Arquivada",     dot: "bg-zinc-500",    icon: Archive },
};

const PIPELINE_STAGES: { key: string; label: string; icon: typeof CircleDot }[] = [
  { key: "briefing",    label: "Briefing",     icon: FileText },
  { key: "design",      label: "Design",       icon: Pencil },
  { key: "aprovacao",   label: "Aprovação",    icon: CheckCircle2 },
  { key: "producao",    label: "Produção",     icon: Package },
  { key: "distribuicao",label: "Distribuição", icon: Truck },
  { key: "veiculacao",  label: "Veiculação",   icon: Radio },
];

const STAGE_ORDER: Record<string, number> = {
  briefing: 0, design: 1, aprovacao: 2, producao: 3,
  distribuicao: 4, transito: 4,
  veiculacao: 5, executar: 5, active: 5,
  inativa: 6, completed: 6,
};

const Q_STATUS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho",  color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  enviada:  { label: "Enviada",   color: "text-blue-400  bg-blue-500/10  border-blue-500/20" },
  ativa:    { label: "Ativa",     color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  os_gerada:{ label: "OS Gerada", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  win:      { label: "Aprovada",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  perdida:  { label: "Perdida",   color: "text-red-400   bg-red-500/10   border-red-500/20" },
  expirada: { label: "Expirada",  color: "text-zinc-400  bg-zinc-500/10  border-zinc-500/20" },
};

const OS_STATUS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho",              color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
  enviada:  { label: "Aguardando Assinatura", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  assinada: { label: "Assinada",              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  execucao: { label: "Em Execução",           color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  concluida:{ label: "Concluída",             color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  emitida:  { label: "Emitida",   color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  paga:     { label: "Paga",      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  vencida:  { label: "Vencida",   color: "text-red-400 bg-red-500/10 border-red-500/20" },
  cancelada:{ label: "Cancelada", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
};

type CampaignSO = {
  id: number; orderNumber: string;
  type: "anunciante" | "producao" | "distribuicao";
  status: string; trackingCode: string | null;
  freightProvider: string | null; freightExpectedDate: string | null;
  periodStart: string | null; periodEnd: string | null;
};

type CampaignProof = {
  id: number; week: number; photoUrl: string;
  restaurantId: number; restaurantName: string | null; createdAt: string;
};

function fmt(value: string | number | null | undefined) {
  if (!value) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function StatusPill({ status, cfg }: { status: string; cfg: { label: string; color: string } }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function CampaignDetail({ campaign, onBack, clientId }: { campaign: any; onBack: () => void; clientId?: number | null }) {
  const { data: campSOs = [] } = trpc.portal.myCampaignServiceOrders.useQuery({ campaignId: campaign.id });
  const { data: proofs = [] } = trpc.portal.myCampaignProofs.useQuery({ campaignId: campaign.id });
  const { data: allReports = [] } = trpc.campaignReport.getForPortal.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId }
  );
  const campaignReports = (allReports as any[]).filter(r => r.campaignId === campaign.id);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  const serviceOrders = campSOs as CampaignSO[];
  const proofPhotos = proofs as CampaignProof[];
  const stageIdx = STAGE_ORDER[campaign.status] ?? -1;
  const prodSO = serviceOrders.find(so => so.type === "producao");
  const distSO = serviceOrders.find(so => so.type === "distribuicao");
  const freightSO = prodSO ?? distSO;
  const showFreight = ["producao", "distribuicao", "transito"].includes(campaign.status);
  const showProofs = ["veiculacao", "executar", "active", "inativa", "completed"].includes(campaign.status);

  const proofsByWeek = proofPhotos.reduce<Record<number, CampaignProof[]>>((acc, p) => {
    if (!acc[p.week]) acc[p.week] = [];
    acc[p.week].push(p);
    return acc;
  }, {});

  const meta = STATUS_META[campaign.status] ?? STATUS_META.draft;
  const StatusIcon = meta.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Campanhas
        </button>
        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
        <span className="text-foreground/80 truncate max-w-xs">{campaign.name}</span>
      </div>

      <div className="flex items-stretch gap-4 pb-6 border-b">
        <div className={`w-1 rounded-full shrink-0 ${meta.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${meta.dot.replace("bg-", "text-")}`}>
                {meta.label}
              </p>
              <h2 className="text-xl font-bold leading-snug">{campaign.name}</h2>
              {campaign.campaignNumber && (
                <p className="text-xs font-mono text-muted-foreground mt-1">{campaign.campaignNumber}</p>
              )}
            </div>
            {campaign.isBonificada && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Sparkles className="w-3 h-3" />
                Bonificada
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 flex-wrap text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Bolachas</p>
              <p className="font-semibold">{campaign.coasterVolume?.toLocaleString("pt-BR") ?? "—"}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Início</p>
              <p className="font-semibold">{fmtDate(campaign.startDate)}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Veiculação</p>
              <p className="font-semibold">{fmtDate(campaign.veiculacaoStartDate)}</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Término</p>
              <p className="font-semibold">{fmtDate(campaign.endDate)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">Esteira de Produção</p>
        <div className="flex items-start justify-between gap-0">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = stageIdx > i;
            const current = stageIdx === i;
            const pending = stageIdx < i;
            const StageIcon = stage.icon;
            return (
              <div key={stage.key} className="flex flex-col items-center flex-1 min-w-0">
                <div className="relative flex items-center w-full">
                  {i > 0 && (
                    <div className={`absolute right-1/2 left-0 h-px top-5 ${done || current ? "bg-primary" : "bg-border"}`} />
                  )}
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={`absolute left-1/2 right-0 h-px top-5 ${done ? "bg-primary" : "bg-border"}`} />
                  )}
                  <div className="relative mx-auto z-10">
                    {done ? (
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                        <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                      </div>
                    ) : current ? (
                      <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center shadow-lg shadow-primary/20 ring-4 ring-primary/10">
                        <StageIcon className="w-4 h-4 text-primary" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-border bg-background flex items-center justify-center">
                        <StageIcon className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </div>
                <p className={`mt-2.5 text-[11px] text-center font-medium leading-tight ${
                  current ? "text-primary" : pending ? "text-muted-foreground/30" : "text-muted-foreground"
                }`}>{stage.label}</p>
                {current && (
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary mx-auto animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showFreight && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Truck className="w-4 h-4 text-orange-400" />
            </div>
            <p className="text-sm font-semibold">Rastreio de Mercadoria</p>
          </div>
          {!freightSO || (!freightSO.trackingCode && !freightSO.freightProvider && !freightSO.freightExpectedDate) ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>As informações de rastreio serão disponibilizadas assim que o material for despachado pela equipe Mesa Ads.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Código</p>
                <p className="font-mono font-semibold text-sm">{freightSO.trackingCode || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Transportadora</p>
                <p className="font-medium text-sm">{freightSO.freightProvider || "—"}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Previsão</p>
                <p className="font-medium text-sm">{fmtDate(freightSO.freightExpectedDate)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {campaign.materialReceivedDate && (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground px-1">
          <Package className="w-4 h-4 shrink-0" />
          <span>Material recebido nos estabelecimentos em <strong className="text-foreground">{fmtDate(campaign.materialReceivedDate)}</strong></span>
        </div>
      )}

      {campaignReports.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <FileBarChart2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold">Relatórios de Campanha</p>
          </div>
          <div className="space-y-3">
            {campaignReports.map((report: any) => {
              const typeLabel = report.reportType === "telas" ? "Telas" : report.reportType === "ativacao" ? "Ativação" : "Coasters";
              return (
                <div key={report.id} className="border border-border/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold truncate">{report.title}</h4>
                        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400 bg-blue-500/10">{typeLabel}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(report.periodStart).toLocaleDateString("pt-BR")} – {new Date(report.periodEnd).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs shrink-0"
                      disabled={pdfLoadingId === report.id}
                      onClick={async () => {
                        setPdfLoadingId(report.id);
                        try {
                          await generateReportPdf({
                            campaignName: campaign.name ?? "",
                            clientName: campaign.clientName ?? undefined,
                            reportTitle: report.title,
                            periodStart: report.periodStart,
                            periodEnd: report.periodEnd,
                            reportType: report.reportType ?? "coaster",
                            numRestaurants: report.numRestaurants ?? 0,
                            coastersDistributed: report.coastersDistributed ?? 0,
                            usagePerDay: report.usagePerDay ?? 3,
                            daysInPeriod: report.daysInPeriod ?? 30,
                            numScreens: report.numScreens ?? 0,
                            spotsPerDay: report.spotsPerDay ?? 0,
                            spotDurationSeconds: report.spotDurationSeconds ?? 30,
                            activationEvents: report.activationEvents ?? 0,
                            peoplePerEvent: report.peoplePerEvent ?? 0,
                            totalImpressions: report.totalImpressions ?? 0,
                            notes: report.notes,
                            photos: report.photos ?? [],
                            publishedAt: report.publishedAt,
                          });
                        } catch {
                          toast.error("Erro ao gerar PDF do relatório.");
                        } finally {
                          setPdfLoadingId(null);
                        }
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {pdfLoadingId === report.id ? "Gerando..." : "Baixar PDF"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-muted-foreground">Impressões:</span>
                      <span className="text-sm font-bold text-emerald-400 font-mono">{(report.totalImpressions ?? 0).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>

                  {report.photos && report.photos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {(report.photos as any[]).map((photo: any) => (
                        <div key={photo.id} className="rounded-md overflow-hidden border border-border/20 aspect-square">
                          <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  {report.notes && (
                    <p className="text-xs text-muted-foreground border-t border-border/20 pt-2">{report.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showProofs && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <ImageIcon className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-sm font-semibold">Fotos Semanais</p>
          </div>
          {proofPhotos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <ImageIcon className="w-8 h-8 opacity-20" />
              <p className="text-sm">Nenhuma foto registrada ainda</p>
              <p className="text-xs opacity-60">Aparecerão aqui conforme os estabelecimentos registrarem</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(proofsByWeek)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([week, photos]) => (
                  <div key={week}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Semana {week}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {photos.map(photo => (
                        <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-white/5 bg-muted aspect-square">
                          <img
                            src={photo.photoUrl}
                            alt={`Semana ${week} — ${photo.restaurantName ?? "Estabelecimento"}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2">
                            <p className="text-white text-[10px] font-medium truncate">{photo.restaurantName ?? "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type NavSection = "home" | "campanhas" | "cotacoes" | "os" | "financeiro" | "produtos" | "tabela" | "perfil";

const NAV_TABS: { key: NavSection; label: string; icon: typeof CircleDot }[] = [
  { key: "campanhas",  label: "Campanhas",        icon: Megaphone },
  { key: "cotacoes",   label: "Cotações",          icon: FileText },
  { key: "os",         label: "Ordens de Serviço", icon: FileSignature },
  { key: "financeiro", label: "Financeiro",        icon: Receipt },
  { key: "produtos",   label: "Produtos",          icon: ShoppingBag },
  { key: "tabela",     label: "Tabela de Preços",  icon: Tag },
  { key: "perfil",     label: "Meu Perfil",        icon: Building2 },
];

type HomeSectionCard = {
  key: NavSection;
  label: string;
  description: string;
  icon: typeof CircleDot;
  badgeCount?: number;
  badgeLabel?: string;
  color: string;
  bgColor: string;
};

export default function AnunciantePortal() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.portal.myProfile.useQuery();
  const { data: campaignsData = [] } = trpc.portal.myCampaigns.useQuery();
  const campaigns: any[] = campaignsData;
  const { data: quotationsData = [] } = trpc.portal.myQuotations.useQuery();
  const quotations: any[] = quotationsData;
  const { data: serviceOrdersData = [] } = trpc.portal.myServiceOrders.useQuery();
  const serviceOrders: any[] = serviceOrdersData;
  const { data: invoicesData = [] } = trpc.portal.myInvoices.useQuery();
  const invoices: any[] = invoicesData;
  const { data: priceTableData } = trpc.portal.getPriceTable.useQuery();
  const { data: mediaKitData } = trpc.mediaKit.getPublicData.useQuery();

  const [activeTab, setActiveTab] = useState<NavSection>("home");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    contactEmail: "", contactPhone: "", instagram: "",
    address: "", addressNumber: "", neighborhood: "", city: "", state: "", cep: "",
  });
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const utils = trpc.useUtils();
  const updateProfileMutation = trpc.portal.updateProfile.useMutation({
    onSuccess: () => { utils.portal.myProfile.invalidate(); setEditOpen(false); toast.success("Perfil atualizado"); },
    onError: (e) => toast.error(e.message),
  });

  const openEdit = () => {
    if (profile) setEditForm({
      contactEmail: profile.contactEmail || "", contactPhone: profile.contactPhone || "",
      instagram: profile.instagram || "", address: profile.address || "",
      addressNumber: profile.addressNumber || "", neighborhood: profile.neighborhood || "",
      city: profile.city || "", state: profile.state || "", cep: profile.cep || "",
    });
    setEditOpen(true);
  };

  const activeCampaigns = campaigns.filter((c) =>
    ["veiculacao", "active", "executar", "producao", "transito", "distribuicao", "briefing", "design", "aprovacao"].includes(c.status)
  );
  const pendingInvoices = invoices.filter((i) => i.status === "emitida" || i.status === "vencida");
  const totalInvoiced = invoices
    .filter((i) => i.status !== "cancelada")
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const pendingOS = serviceOrders.filter((os) => os.status === "enviada");
  const pendingQuotations = quotations.filter((q) => q.status === "enviada" || q.status === "ativa");

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;
  const selectedProduct = priceTableData?.products.find((p: any) => p.id === selectedProductId) ?? null;

  const navigateTo = (section: NavSection) => {
    setActiveTab(section);
    setSelectedCampaignId(null);
  };

  const homeCards: HomeSectionCard[] = [
    {
      key: "campanhas",
      label: "Campanhas",
      description: "Acompanhe suas campanhas em veiculação, produção e histórico completo.",
      icon: Megaphone,
      badgeCount: activeCampaigns.length,
      badgeLabel: activeCampaigns.length === 1 ? "campanha ativa" : "campanhas ativas",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      key: "cotacoes",
      label: "Cotações",
      description: "Veja suas cotações enviadas, aprovadas e em análise.",
      icon: FileText,
      badgeCount: pendingQuotations.length,
      badgeLabel: pendingQuotations.length === 1 ? "cotação pendente" : "cotações pendentes",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "os",
      label: "Ordens de Serviço",
      description: "Contratos e ordens de serviço para assinatura e acompanhamento.",
      icon: FileSignature,
      badgeCount: pendingOS.length,
      badgeLabel: pendingOS.length === 1 ? "aguardando assinatura" : "aguardando assinatura",
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
    },
    {
      key: "financeiro",
      label: "Financeiro",
      description: "Faturas emitidas, pagas e pendentes de pagamento.",
      icon: Receipt,
      badgeCount: pendingInvoices.length,
      badgeLabel: pendingInvoices.length === 1 ? "fatura pendente" : "faturas pendentes",
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      key: "produtos",
      label: "Produtos",
      description: "Catálogo de produtos disponíveis para sua campanha publicitária.",
      icon: ShoppingBag,
      badgeCount: priceTableData?.products.length ?? 0,
      badgeLabel: "produtos disponíveis",
      color: "text-teal-400",
      bgColor: "bg-teal-500/10",
    },
    {
      key: "tabela",
      label: "Tabela de Preços",
      description: "Tabela consolidada com preços, volumes e descontos por prazo.",
      icon: Tag,
      badgeCount: priceTableData?.products.length ?? 0,
      badgeLabel: "produtos com tabela",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
    },
    {
      key: "perfil",
      label: "Meu Perfil",
      description: "Dados cadastrais da sua empresa e informações de contato.",
      icon: Building2,
      badgeCount: undefined,
      badgeLabel: "atualizado",
      color: "text-zinc-400",
      bgColor: "bg-zinc-500/10",
    },
  ];

  if (profileLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8 text-primary/60" />
          </div>
          <h2 className="text-xl font-semibold">Portal do Anunciante</h2>
          <p className="text-sm text-muted-foreground">
            Seu perfil ainda não foi vinculado a um anunciante. Entre em contato com a equipe Mesa Ads para completar o cadastro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Portal do Anunciante</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{profile.company || profile.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">Olá, {user?.firstName || profile.name}</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {priceTableData && priceTableData.products.length > 0 && (
                <Button
                  onClick={() => setBuilderOpen(true)}
                  className="gap-2 bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Montar Minha Campanha
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={!mediaKitData}
                onClick={() => mediaKitData && generateMediaKitPdf(mediaKitData)}
              >
                <Download className="w-3.5 h-3.5" />
                Media Kit
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
            <div>
              <p className="text-2xl font-bold tabular-nums">{campaigns.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Campanhas</p>
            </div>
            <div className="w-px h-7 bg-border hidden sm:block" />
            <div>
              <p className="text-2xl font-bold tabular-nums">{quotations.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Cotações</p>
            </div>
            <div className="w-px h-7 bg-border hidden sm:block" />
            <div>
              <p className="text-2xl font-bold tabular-nums">{pendingInvoices.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Faturas pendentes</p>
            </div>
            {totalInvoiced > 0 && (
              <>
                <div className="w-px h-7 bg-border hidden sm:block" />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{fmt(totalInvoiced)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Total faturado</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 border-b overflow-x-auto">
          <button
            onClick={() => navigateTo("home")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "home"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Início
          </button>
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => navigateTo(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "home" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Megaphone className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Campanhas ativas</p>
                </div>
                <p className="text-2xl font-bold tabular-nums">{activeCampaigns.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Cotações</p>
                </div>
                <p className="text-2xl font-bold tabular-nums">{quotations.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Receipt className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Faturas pendentes</p>
                </div>
                <p className="text-2xl font-bold tabular-nums">{pendingInvoices.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-violet-500/10">
                    <FileSignature className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">OS pendentes</p>
                </div>
                <p className="text-2xl font-bold tabular-nums">{pendingOS.length}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Navegação rápida</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {homeCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.key}
                      onClick={() => navigateTo(card.key)}
                      className="group text-left rounded-2xl border border-border/30 bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 p-5 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`p-2.5 rounded-xl ${card.bgColor} shrink-0`}>
                          <Icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                        {card.badgeCount != null && card.badgeLabel && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeCount > 0 ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/50 text-muted-foreground border-border/30"} border shrink-0 mt-0.5`}>
                            {card.badgeCount} {card.badgeLabel}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors">{card.label}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.description}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors mt-auto">
                        <span>Acessar</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "campanhas" && (
          selectedCampaign ? (
            <CampaignDetail campaign={selectedCampaign} onBack={() => setSelectedCampaignId(null)} clientId={profile?.id ?? null} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Início
                </button>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                <span className="text-foreground/80">Campanhas</span>
              </div>
              {campaigns.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Megaphone className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhuma campanha encontrada</p>
                  <p className="text-xs opacity-60">Suas campanhas aparecerão aqui assim que forem criadas</p>
                </div>
              ) : (
                campaigns.map((campaign) => {
                  const meta = STATUS_META[campaign.status] ?? STATUS_META.draft;
                  const Icon = meta.icon;
                  const isActive = ["veiculacao", "active", "executar", "producao", "transito", "distribuicao", "briefing", "design", "aprovacao"].includes(campaign.status);
                  return (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className="w-full text-left group"
                    >
                      <div className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
                        isActive
                          ? "bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                          : "bg-card/50 hover:bg-card hover:border-border/80"
                      }`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${meta.dot}`} />
                        <div className="pl-5 pr-4 py-4 flex items-center gap-4">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${meta.dot.replace("bg-", "bg-").replace("500", "500/10")}`}>
                            <Icon className={`w-4 h-4 ${meta.dot.replace("bg-", "text-")}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{campaign.name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              {campaign.campaignNumber && <span className="font-mono">{campaign.campaignNumber}</span>}
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {fmtDate(campaign.startDate)} — {fmtDate(campaign.endDate)}
                              </span>
                              {campaign.coasterVolume && (
                                <span className="flex items-center gap-1">
                                  <Boxes className="w-3 h-3" />
                                  {campaign.coasterVolume.toLocaleString("pt-BR")} bolachas
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {campaign.isBonificada && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Sparkles className="w-2.5 h-2.5" />
                                Bonif.
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              meta.dot.replace("bg-", "border-").replace("500", "500/20")
                            } ${meta.dot.replace("bg-", "text-")} ${meta.dot.replace("bg-", "bg-").replace("500", "500/10")}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${isActive ? "animate-pulse" : ""}`} />
                              {meta.label}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )
        )}

        {activeTab === "cotacoes" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              <span className="text-foreground/80">Cotações</span>
            </div>
            {quotations.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <FileText className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma cotação encontrada</p>
              </div>
            ) : (
              quotations.map((q) => {
                const cfg = Q_STATUS[q.status] ?? Q_STATUS.rascunho;
                return (
                  <div key={q.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{q.quotationNumber}</span>
                        {q.quotationName && <span className="text-sm text-muted-foreground truncate">{q.quotationName}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {q.coasterVolume && <span>{q.coasterVolume.toLocaleString("pt-BR")} bolachas</span>}
                        {q.validUntil && <span>Válida até {fmtDate(q.validUntil)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {q.isBonificada && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Bonif.</span>
                      )}
                      <StatusPill status={q.status} cfg={cfg} />
                      <p className="text-sm font-semibold text-right hidden sm:block">{fmt(q.totalValue)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "os" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              <span className="text-foreground/80">Ordens de Serviço</span>
            </div>
            {serviceOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <FileSignature className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma ordem de serviço encontrada</p>
              </div>
            ) : (
              serviceOrders.map((os) => {
                const cfg = OS_STATUS[os.status] ?? OS_STATUS.rascunho;
                return (
                  <div key={os.id} className="rounded-xl border bg-card p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
                        <FileSignature className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{os.orderNumber}</span>
                          <StatusPill status={os.status} cfg={cfg} />
                        </div>
                        {os.description && <p className="text-xs text-muted-foreground mt-1">{os.description}</p>}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{fmtDate(os.periodStart)} — {fmtDate(os.periodEnd)}</span>
                          <span className="font-semibold text-foreground/80">{fmt(os.totalValue)}</span>
                        </div>
                        {os.signedAt && (
                          <p className="text-xs text-emerald-400 mt-1">✓ Assinada em {fmtDate(os.signedAt)} por {os.signedByName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {os.status === "enviada" && os.quotationPublicToken && (
                          <a href={`/cotacao/assinar/${os.quotationPublicToken}`}>
                            <Button size="sm" className="gap-1.5 text-xs">
                              <FileSignature className="w-3.5 h-3.5" />
                              Assinar
                            </Button>
                          </a>
                        )}
                        {os.signedAt && (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                            generateQuotationSignPdf({
                              orderNumber: os.orderNumber,
                              quotationNumber: os.quotationNumber || "",
                              quotationName: os.quotationName || os.description || "",
                              description: os.description || undefined,
                              totalValue: parseFloat(os.totalValue) || 0,
                              coasterVolume: os.coasterVolume || 0,
                              periodStart: os.periodStart || "",
                              periodEnd: os.periodEnd || "",
                              restaurants: os.restaurantNames || [],
                              signerName: os.signedByName || "",
                              signerCpf: os.signedByCpf || "",
                              signedAt: new Date(os.signedAt).toISOString(),
                              signatureHash: os.signatureHash || undefined,
                            });
                          }}>
                            <Download className="w-3.5 h-3.5" />
                            Contrato
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "financeiro" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              <span className="text-foreground/80">Financeiro</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Total faturado</p>
                <p className="text-2xl font-bold">{fmt(totalInvoiced)}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Faturas pagas</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {invoices.filter((i) => i.status === "paga").length}
                </p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
                <p className="text-2xl font-bold text-amber-400">{pendingInvoices.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Receipt className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhuma fatura encontrada</p>
                </div>
              ) : (
                invoices.map((inv) => {
                  const cfg = INV_STATUS[inv.status] ?? INV_STATUS.emitida;
                  return (
                    <div key={inv.id} className="rounded-xl border bg-card p-4 flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                        <Receipt className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">{inv.invoiceNumber}</span>
                          {inv.campaignName && <span className="text-xs text-muted-foreground">{inv.campaignName}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>Emissão: {fmtDate(inv.issueDate)}</span>
                          <span>Vencimento: {fmtDate(inv.dueDate)}</span>
                          {inv.paymentDate && <span className="text-emerald-400">Pago: {fmtDate(inv.paymentDate)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-sm font-bold">{fmt(inv.amount)}</p>
                        <StatusPill status={inv.status} cfg={cfg} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "produtos" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              <span className="text-foreground/80">Produtos</span>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-500/5 border border-sky-500/20">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-sky-300 mb-0.5">Estimativa de impressões</p>
                <p>Baseada em 3 utilizações/dia × 26 dias úteis/mês por porta-copos distribuídos. Valores reais podem variar conforme o perfil dos estabelecimentos.</p>
              </div>
            </div>

            {!priceTableData || priceTableData.products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhum produto disponível</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {priceTableData.products.map((p: any) => (
                  <ShoppingProductCard
                    key={p.id}
                    product={p}
                    hasPartner={priceTableData.hasPartner}
                    onViewDetails={() => setSelectedProductId(p.id)}
                  />
                ))}
              </div>
            )}

            {selectedProduct && (
              <ProductPriceSheet
                product={selectedProduct}
                hasPartner={priceTableData?.hasPartner ?? false}
                open={!!selectedProductId}
                onClose={() => setSelectedProductId(null)}
              />
            )}
          </div>
        )}

        {activeTab === "tabela" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              <span className="text-foreground/80">Tabela de Preços</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {priceTableData?.hasPartner ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  <Tag className="w-3.5 h-3.5" />
                  Inclui comissão de agência (+{(BV_PADRAO_AGENCIA * 100).toFixed(0)}% BV)
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  <Tag className="w-3.5 h-3.5" />
                  Preço direto — sem comissão de agência
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                Estimativa: 3 usos/dia × 26 dias/mês por porta-copos
              </div>
            </div>

            {!priceTableData || priceTableData.products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Tag className="w-10 h-10 opacity-20" />
                <p className="text-sm">Tabela de preços indisponível</p>
              </div>
            ) : (
              <div className="space-y-4">
                {priceTableData.products.map((p: any) => (
                  <AdvertiserProductTable key={p.id} product={p} hasPartner={priceTableData.hasPartner} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "perfil" && (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 px-5 pt-5">
              <button onClick={() => navigateTo("home")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Início
              </button>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              <span className="text-foreground/80">Meu Perfil</span>
            </div>
            <div className="flex items-center justify-between p-5 border-b border-t">
              <div>
                <p className="font-semibold">Dados da Empresa</p>
                <p className="text-xs text-muted-foreground mt-0.5">Informações cadastrais do anunciante</p>
              </div>
              <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Empresa</p>
                  <p className="font-semibold text-lg">{profile.company || profile.name}</p>
                </div>
                {profile.razaoSocial && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Razão Social</p>
                    <p className="text-sm">{profile.razaoSocial}</p>
                  </div>
                )}
                {profile.cnpj && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">CNPJ</p>
                    <p className="font-mono text-sm">{profile.cnpj}</p>
                  </div>
                )}
                {profile.segment && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Segmento</p>
                    <p className="text-sm">{profile.segment}</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">E-mail</p>
                    <p className="text-sm">{profile.contactEmail || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Telefone</p>
                    <p className="text-sm">{profile.contactPhone || "—"}</p>
                  </div>
                </div>
                {profile.instagram && (
                  <div className="flex items-center gap-3">
                    <Instagram className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Instagram</p>
                      <p className="text-sm">@{profile.instagram.replace("@", "")}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Endereço</p>
                    <p className="text-sm">
                      {[profile.address, profile.addressNumber, profile.neighborhood,
                        profile.city && profile.state ? `${profile.city}/${profile.state}` : profile.city || profile.state,
                        profile.cep].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Perfil</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail de contato</Label>
                <Input value={editForm.contactEmail} onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={editForm.contactPhone} onChange={e => setEditForm({ ...editForm, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={editForm.instagram} onChange={e => setEditForm({ ...editForm, instagram: e.target.value })} placeholder="@perfil" />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label>Endereço</Label>
                <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={editForm.addressNumber} onChange={e => setEditForm({ ...editForm, addressNumber: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={editForm.neighborhood} onChange={e => setEditForm({ ...editForm, neighborhood: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={editForm.state} onChange={e => setEditForm({ ...editForm, state: e.target.value })} maxLength={2} placeholder="SP" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={editForm.cep} onChange={e => setEditForm({ ...editForm, cep: e.target.value })} placeholder="00000-000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateProfileMutation.mutate(editForm)} disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Montar Minha Campanha
            </DialogTitle>
          </DialogHeader>
          {profile && priceTableData && (
            <CampaignBuilder
              clientId={profile.id}
              hasPartner={priceTableData.hasPartner}
              isPartner={false}
              products={priceTableData.products}
              onClose={() => setBuilderOpen(false)}
              onSuccess={() => {
                utils.portal.myQuotations.invalidate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
