import { useState } from "react";
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
} from "lucide-react";
import { generateQuotationSignPdf } from "@/lib/generate-quotation-pdf";

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

function CampaignDetail({ campaign, onBack }: { campaign: any; onBack: () => void }) {
  const { data: campSOs = [] } = trpc.portal.myCampaignServiceOrders.useQuery({ campaignId: campaign.id });
  const { data: proofs = [] } = trpc.portal.myCampaignProofs.useQuery({ campaignId: campaign.id });

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

type NavSection = "campanhas" | "cotacoes" | "os" | "financeiro" | "perfil";

const NAV_TABS: { key: NavSection; label: string; icon: typeof CircleDot }[] = [
  { key: "campanhas",  label: "Campanhas",        icon: Megaphone },
  { key: "cotacoes",   label: "Cotações",          icon: FileText },
  { key: "os",         label: "Ordens de Serviço", icon: FileSignature },
  { key: "financeiro", label: "Financeiro",        icon: Receipt },
  { key: "perfil",     label: "Meu Perfil",        icon: Building2 },
];

export default function AnunciantePortal() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.portal.myProfile.useQuery();
  const { data: campaigns = [] } = trpc.portal.myCampaigns.useQuery();
  const { data: quotations = [] } = trpc.portal.myQuotations.useQuery();
  const { data: serviceOrders = [] } = trpc.portal.myServiceOrders.useQuery();
  const { data: invoices = [] } = trpc.portal.myInvoices.useQuery();

  const [activeTab, setActiveTab] = useState<NavSection>("campanhas");
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    contactEmail: "", contactPhone: "", instagram: "",
    address: "", addressNumber: "", neighborhood: "", city: "", state: "", cep: "",
  });

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

  const activeCampaigns = campaigns.filter((c: any) =>
    ["veiculacao", "active", "executar", "producao", "transito", "distribuicao", "briefing", "design", "aprovacao"].includes(c.status)
  );
  const pendingInvoices = invoices.filter((i: any) => i.status === "emitida" || i.status === "vencida");
  const totalInvoiced = invoices
    .filter((i: any) => i.status !== "cancelada")
    .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);

  const selectedCampaign = campaigns.find((c: any) => c.id === selectedCampaignId) ?? null;

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

        <div className="flex items-center gap-1 border-b">
          {NAV_TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedCampaignId(null); }}
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

        {activeTab === "campanhas" && (
          selectedCampaign ? (
            <CampaignDetail campaign={selectedCampaign} onBack={() => setSelectedCampaignId(null)} />
          ) : (
            <div className="space-y-3">
              {campaigns.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Megaphone className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Nenhuma campanha encontrada</p>
                  <p className="text-xs opacity-60">Suas campanhas aparecerão aqui assim que forem criadas</p>
                </div>
              ) : (
                campaigns.map((campaign: any) => {
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
            {quotations.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <FileText className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma cotação encontrada</p>
              </div>
            ) : (
              quotations.map((q: any) => {
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
            {serviceOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <FileSignature className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhuma ordem de serviço encontrada</p>
              </div>
            ) : (
              serviceOrders.map((os: any) => {
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
                              restaurants: (os as any).restaurantNames || [],
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Total faturado</p>
                <p className="text-2xl font-bold">{fmt(totalInvoiced)}</p>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Faturas pagas</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {invoices.filter((i: any) => i.status === "paga").length}
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
                invoices.map((inv: any) => {
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

        {activeTab === "perfil" && (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between p-5 border-b">
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
    </div>
  );
}
