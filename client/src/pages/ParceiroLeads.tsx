import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ArrowLeft,
  Clock,
  Loader2,
  Users,
  Rocket,
  Package,
} from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type LeadListItem = RouterOutput["parceiroPortal"]["getLeads"][number];
type LeadDetail = RouterOutput["parceiroPortal"]["getLeadDetail"];
type PriceTableOutput = RouterOutput["parceiroPortal"]["getPriceTable"];
type PriceTableProduct = PriceTableOutput["products"][number];
type PricingTier = PriceTableProduct["tiers"][number];
type PriceDiscountTier = PriceTableProduct["discountTiers"][number];
type LeadDetailQuotation = LeadDetail["quotations"][number];
type StageHistoryItem = LeadDetail["stageHistory"][number];

const STAGES = [
  { key: "novo", label: "Novo", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { key: "contato", label: "Contato", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  { key: "qualificado", label: "Qualificado", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  { key: "proposta", label: "Proposta", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  { key: "negociacao", label: "Negociação", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  { key: "ganho", label: "Ganho", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  { key: "perdido", label: "Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, { key: StageKey; label: string; color: string }>;

const QUOTATION_STATUS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  os_gerada: { label: "OS Gerada", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  win: { label: "Aprovada", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  perdida: { label: "Perdida", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  expirada: { label: "Expirada", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function getStageConfig(stage: string | null): { label: string; color: string } {
  if (!stage) return { label: "—", color: "" };
  return STAGE_MAP[stage as StageKey] ?? { label: stage, color: "" };
}

interface LeadFormData {
  name: string;
  company: string;
  cnpj: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state: string;
  notes: string;
}

const emptyForm: LeadFormData = {
  name: "",
  company: "",
  cnpj: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  city: "",
  state: "",
  notes: "",
};

function StageTimeline({ stageHistory }: { stageHistory: StageHistoryItem[] }) {
  if (stageHistory.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Nenhuma mudança de estágio registrada.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {stageHistory.map((item) => (
        <div key={item.id} className="flex items-start gap-3 text-xs">
          <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-foreground">{item.content || "Estágio atualizado"}</p>
            <p className="text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuotationCard({ quotation }: { quotation: LeadDetailQuotation }) {
  const statusCfg = QUOTATION_STATUS[quotation.status] ?? { label: quotation.status, color: "" };
  const monthlyValue =
    quotation.totalValue && quotation.cycles && Number(quotation.cycles) > 0
      ? Number(quotation.totalValue) / Number(quotation.cycles)
      : null;

  return (
    <div className="bg-muted/20 border border-border/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{quotation.quotationNumber}</span>
        </div>
        <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
          {statusCfg.label}
        </Badge>
      </div>
      {quotation.quotationName && (
        <p className="text-xs text-muted-foreground">{quotation.quotationName}</p>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {quotation.productName && (
          <div>
            <p className="text-muted-foreground">Produto</p>
            <p className="font-medium">{quotation.productName}</p>
          </div>
        )}
        {quotation.coasterVolume != null && (
          <div>
            <p className="text-muted-foreground">Volume</p>
            <p className="font-medium font-mono">{Number(quotation.coasterVolume).toLocaleString("pt-BR")} un.</p>
          </div>
        )}
        {quotation.cycles != null && (
          <div>
            <p className="text-muted-foreground">Período</p>
            <p className="font-medium">{quotation.cycles} {quotation.cycles === 1 ? "mês" : "meses"}</p>
          </div>
        )}
        {quotation.totalValue && Number(quotation.totalValue) > 0 && (
          <div>
            <p className="text-muted-foreground">Valor Total</p>
            <p className="font-medium font-mono text-primary">{formatCurrency(Number(quotation.totalValue))}</p>
          </div>
        )}
        {monthlyValue != null && monthlyValue > 0 && (
          <div>
            <p className="text-muted-foreground">Valor Mensal</p>
            <p className="font-medium font-mono">{formatCurrency(monthlyValue)}</p>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Criada em {formatDate(quotation.createdAt)}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

const SEMANAS_OPTIONS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];

const DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11, 28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
};

function calcQuotationUnitPrice(params: {
  custoUnitario: number;
  frete: number;
  margem: number;
  artes: number;
  volume: number;
  irpj: number;
  comRestaurante: number;
  comComercial: number;
  billingMode: "bruto" | "liquido";
  pricingMode?: "cost_based" | "price_based";
  precoBaseTier?: number;
}) {
  const { custoUnitario, frete, margem, artes, volume, irpj, comRestaurante, comComercial, billingMode, pricingMode = "cost_based", precoBaseTier = 0 } = params;

  if (pricingMode === "price_based") {
    if (precoBaseTier <= 0) return 0;
    const grossUpDen = 1 - comComercial - irpj;
    const precoTotal = billingMode === "bruto" && grossUpDen > 0
      ? precoBaseTier / grossUpDen
      : precoBaseTier;
    return volume > 0 ? precoTotal / volume : 0;
  }

  const denominadorBase = 1 - margem - irpj - comRestaurante;
  const custoTotal = custoUnitario * artes * volume + frete;
  const precoBase = denominadorBase > 0 && custoTotal > 0 ? custoTotal / denominadorBase : 0;
  const precoTotal = billingMode === "bruto" && comComercial < 1
    ? precoBase / (1 - comComercial)
    : precoBase;
  return volume > 0 ? precoTotal / volume : 0;
}

function getPricingTierForVolume(tiers: PricingTier[], volume: number) {
  if (!tiers || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.volumeMin - b.volumeMin);
  let match = sorted[0];
  for (const t of sorted) {
    if (volume >= t.volumeMin) match = t;
  }
  return match;
}

function CreateQuotationDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
}: {
  leadId: number;
  leadName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data: priceData } = trpc.parceiroPortal.getPriceTable.useQuery({ adminPartnerId });
  const utils = trpc.useUtils();

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [volume, setVolume] = useState<string>("1000");
  const [semanas, setSemanas] = useState<number>(4);
  const [notes, setNotes] = useState("");

  const products = priceData?.products ?? [];
  const commissionPercent = priceData?.commissionPercent ?? 10;
  const billingMode = priceData?.billingMode ?? "bruto";
  const comComercial = commissionPercent / 100;

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const volumeNum = parseInt(volume, 10) || 0;

  const pricing = useMemo(() => {
    if (!selectedProduct || volumeNum <= 0) return null;
    const tier = getPricingTierForVolume(selectedProduct.tiers ?? [], volumeNum);
    if (!tier) return null;
    const irpj = parseFloat(selectedProduct.irpj ?? "6") / 100;
    const comRestaurante = parseFloat(selectedProduct.comRestaurante ?? "0") / 100;
    const pricingMode = (selectedProduct.pricingMode ?? "cost_based") as "cost_based" | "price_based";
    const unitPrice = calcQuotationUnitPrice({
      custoUnitario: parseFloat(tier.custoUnitario),
      frete: parseFloat(tier.frete),
      margem: parseFloat(tier.margem) / 100,
      artes: tier.artes ?? 1,
      volume: volumeNum,
      irpj,
      comRestaurante,
      comComercial,
      billingMode,
      pricingMode,
      precoBaseTier: parseFloat(tier.precoBase ?? "0"),
    });
    const cycles = Math.ceil(semanas / 4);
    // Gross total before discounts
    const precoBruto = unitPrice * volumeNum * cycles;
    // Faixa discount applied on bruto first
    const discountTiersList: PriceDiscountTier[] = selectedProduct.discountTiers ?? [];
    const faixaTier = discountTiersList.find((t) => precoBruto >= parseFloat(String(t.priceMin)) && precoBruto <= parseFloat(String(t.priceMax)));
    const descFaixaPerc = faixaTier ? parseFloat(String(faixaTier.discountPercent)) / 100 : 0;
    const precoPosFaixa = precoBruto * (1 - descFaixaPerc);
    // Then prazo discount
    const dsc = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
    const totalValue = precoPosFaixa * (1 - dsc);
    const effectiveUnitPrice = volumeNum > 0 && cycles > 0 ? totalValue / (volumeNum * cycles) : unitPrice;
    return { unitPrice: effectiveUnitPrice, totalValue, cycles, discount: dsc, descFaixaPerc };
  }, [selectedProduct, volumeNum, semanas, comComercial, billingMode]);

  const createMutation = trpc.parceiroPortal.createQuotation.useMutation({
    onSuccess: (data) => {
      toast.success(`Cotação ${data.quotationNumber} criada com sucesso!`);
      onOpenChange(false);
      setSelectedProductId(null);
      setVolume("1000");
      setSemanas(4);
      setNotes("");
      utils.parceiroPortal.getLeadDetail.invalidate({ leadId });
      utils.parceiroPortal.getLeads.invalidate();
      utils.parceiroPortal.getDashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!selectedProductId || !pricing || volumeNum <= 0) {
      toast.error("Selecione um produto e informe o volume.");
      return;
    }
    createMutation.mutate({
      leadId,
      productId: selectedProductId,
      volume: volumeNum,
      semanas,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            Criar Cotação
          </DialogTitle>
          <DialogDescription>
            Nova cotação para <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Produto</Label>
            <Select
              value={selectedProductId?.toString() ?? ""}
              onValueChange={(v) => setSelectedProductId(Number(v))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    <span className="flex items-center gap-2">
                      <Package className="w-3 h-3" />
                      {p.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Volume (unidades)</Label>
              <Input
                type="number"
                min={1}
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Duração (semanas)</Label>
              <Select value={semanas.toString()} onValueChange={(v) => setSemanas(Number(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMANAS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s.toString()}>
                      {s} semanas ({Math.ceil(s / 4)} {Math.ceil(s / 4) === 1 ? "mês" : "meses"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais para esta cotação..."
              className="mt-1"
              rows={2}
            />
          </div>

          {pricing && (
            <div className="bg-muted/20 border border-border/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${billingMode === "bruto" ? "text-blue-400 border-blue-500/30 bg-blue-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}
                >
                  {billingMode === "bruto" ? "Fat. Bruto" : "Fat. Líquido"}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Comissão {commissionPercent}%
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Preço Unitário</p>
                  <p className="font-mono font-semibold">{formatCurrency(pricing.unitPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Período</p>
                  <p className="font-mono font-semibold">{pricing.cycles} {pricing.cycles === 1 ? "mês" : "meses"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Total</p>
                  <p className="font-mono font-semibold text-primary">{formatCurrency(pricing.totalValue)}</p>
                </div>
              </div>
              {(pricing.descFaixaPerc > 0 || pricing.discount > 0) && (
                <div className="space-y-0.5 mt-1">
                  {pricing.descFaixaPerc > 0 && (
                    <p className="text-[10px] text-amber-400">
                      Desconto por faixa de preço: {(pricing.descFaixaPerc * 100).toFixed(0)}%
                    </p>
                  )}
                  {pricing.discount > 0 && (
                    <p className="text-[10px] text-emerald-400">
                      Desconto de prazo: {(pricing.discount * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedProductId || !pricing || createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" />
            )}
            Criar Cotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadDetailPanel({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data: lead, isLoading } = trpc.parceiroPortal.getLeadDetail.useQuery({ leadId, adminPartnerId });
  const [quotationDialogOpen, setQuotationDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">Lead não encontrado.</div>
    );
  }

  const stage = getStageConfig(lead.stage);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold">{lead.name}</h2>
            <Badge variant="outline" className={`text-xs ${stage.color}`}>{stage.label}</Badge>
            {lead.quotations.length > 0 && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                <FileText className="w-2.5 h-2.5 mr-1" /> Com cotação
              </Badge>
            )}
          </div>
          {lead.company && <p className="text-sm text-muted-foreground mt-0.5">{lead.company}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setQuotationDialogOpen(true)}
          >
            <Rocket className="w-3.5 h-3.5" />
            Criar Cotação
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Dados da Empresa
          </h3>
          <InfoRow label="Empresa" value={lead.company} />
          <InfoRow label="CNPJ" value={lead.cnpj} />
          {(lead.city || lead.state) && (
            <InfoRow
              label="Cidade/Estado"
              value={[lead.city, lead.state].filter(Boolean).join(", ")}
              icon={MapPin}
            />
          )}
        </div>

        <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Contato
          </h3>
          <InfoRow label="Nome" value={lead.contactName} />
          <InfoRow label="Telefone" value={lead.contactPhone} icon={Phone} />
          <InfoRow label="E-mail" value={lead.contactEmail} icon={Mail} />
        </div>
      </div>

      {lead.notes && (
        <div className="bg-card border border-border/30 rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      <div className="bg-card border border-border/30 rounded-xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Histórico de Estágios
        </h3>
        <StageTimeline stageHistory={lead.stageHistory} />
      </div>

      {lead.quotations.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Cotações
          </h3>
          {lead.quotations.map((q) => (
            <QuotationCard key={q.id} quotation={q} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border/30 rounded-xl p-4 text-center text-sm text-muted-foreground">
          Nenhuma cotação gerada para este lead ainda.
        </div>
      )}

      <CreateQuotationDialog
        leadId={leadId}
        leadName={lead.company || lead.name}
        open={quotationDialogOpen}
        onOpenChange={setQuotationDialogOpen}
      />
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: LeadListItem; onClick: () => void }) {
  const stage = getStageConfig(lead.stage);
  return (
    <div
      className="bg-card border border-border/30 rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-colors space-y-2"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        </div>
        {lead.hasQuotation && (
          <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">{formatDate(lead.updatedAt)}</p>
        {lead.latestQuotation && lead.latestQuotation.totalValue && Number(lead.latestQuotation.totalValue) > 0 && (
          <span className="text-[10px] font-mono text-primary">
            {formatCurrency(Number(lead.latestQuotation.totalValue))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ParceiroLeads() {
  const [, navigate] = useLocation();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(emptyForm);

  const utils = trpc.useUtils();
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data: leads = [], isLoading } = trpc.parceiroPortal.getLeads.useQuery(
    stageFilter !== "all" ? { stage: stageFilter, adminPartnerId } : { adminPartnerId }
  );

  const createMutation = trpc.parceiroPortal.createLead.useMutation({
    onSuccess: () => {
      toast.success("Lead indicado com sucesso!");
      setCreateOpen(false);
      setFormData(emptyForm);
      utils.parceiroPortal.getLeads.invalidate();
      utils.parceiroPortal.getDashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const nameValue = formData.company.trim() || formData.name.trim();
    if (!nameValue) {
      toast.error("Informe o nome da empresa ou do responsável");
      return;
    }
    createMutation.mutate({
      ...formData,
      name: nameValue,
    });
  };

  const leadsByStage = STAGES.reduce<Record<string, LeadListItem[]>>((acc, stage) => {
    acc[stage.key] = leads.filter((l) => l.stage === stage.key);
    return acc;
  }, {});

  const totalByStage = STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage.key] = leads.filter((l) => l.stage === stage.key).length;
    return acc;
  }, {});

  if (selectedLeadId !== null) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <LeadDetailPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Meus Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads.length} {leads.length === 1 ? "lead indicado" : "leads indicados"}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Indicar Lead
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lista
          </button>
        </div>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Filtrar por estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estágios</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
                {totalByStage[s.key] > 0 && ` (${totalByStage[s.key]})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum lead indicado ainda.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> Indicar primeiro lead
          </Button>
        </div>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {STAGES.filter((s) => {
            if (stageFilter !== "all") return s.key === stageFilter;
            return (leadsByStage[s.key]?.length ?? 0) > 0 || ["novo", "contato", "qualificado"].includes(s.key);
          }).map((stage) => (
            <div key={stage.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Badge variant="outline" className={`text-xs ${stage.color}`}>
                  {stage.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{leadsByStage[stage.key]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(leadsByStage[stage.key] ?? []).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => setSelectedLeadId(lead.id)}
                  />
                ))}
                {(leadsByStage[stage.key]?.length ?? 0) === 0 && (
                  <div className="border border-dashed border-border/30 rounded-lg p-3 text-center text-xs text-muted-foreground">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground border-b border-border/20">
                <th className="text-left px-4 py-3 font-medium">Empresa / Contato</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Cidade</th>
                <th className="text-left px-4 py-3 font-medium">Estágio</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cotação</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const stage = getStageConfig(lead.stage);
                const hasQuotationValue =
                  lead.hasQuotation &&
                  lead.latestQuotation?.totalValue &&
                  Number(lead.latestQuotation.totalValue) > 0;
                return (
                  <tr
                    key={lead.id}
                    className="border-t border-border/20 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[200px]">{lead.name}</p>
                      {lead.company && (
                        <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.city || lead.state || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${stage.color}`}>
                        {stage.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {lead.hasQuotation ? (
                        <div className="flex items-center gap-1 text-primary text-xs">
                          <FileText className="w-3 h-3" />
                          {hasQuotationValue
                            ? formatCurrency(Number(lead.latestQuotation!.totalValue))
                            : "Sim"}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                      {formatDate(lead.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Indicar Novo Lead
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Indique um novo anunciante. Após o envio, nossa equipe entrará em contato e você poderá acompanhar o progresso aqui.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome da Empresa <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ex: Padaria São João Ltda"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome do Responsável</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    placeholder="São Paulo"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input
                    placeholder="SP"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Telefone / WhatsApp</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="contato@empresa.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome do Contato na Empresa</Label>
                <Input
                  placeholder="Ex: Maria Souza"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  placeholder="Contexto do lead, como conheceu, interesse, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Indicar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
