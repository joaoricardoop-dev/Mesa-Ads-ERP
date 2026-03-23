import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { generateQuotationSignPdf } from "@/lib/generate-quotation-pdf";

const campaignStatusConfig: Record<string, { label: string; color: string; icon: typeof CircleDot }> = {
  draft: { label: "Rascunho", color: "bg-gray-500/10 text-gray-500", icon: CircleDot },
  briefing: { label: "Briefing", color: "bg-sky-500/10 text-sky-500", icon: FileText },
  design: { label: "Design", color: "bg-violet-500/10 text-violet-500", icon: Pencil },
  aprovacao: { label: "Aprovação", color: "bg-amber-500/10 text-amber-500", icon: CheckCircle2 },
  producao: { label: "Produção", color: "bg-blue-500/10 text-blue-500", icon: Package },
  distribuicao: { label: "Distribuição", color: "bg-orange-500/10 text-orange-500", icon: Truck },
  transito: { label: "Trânsito", color: "bg-amber-500/10 text-amber-500", icon: Truck },
  executar: { label: "Executar", color: "bg-purple-500/10 text-purple-500", icon: Play },
  veiculacao: { label: "Em Veiculação", color: "bg-emerald-500/10 text-emerald-500", icon: Radio },
  inativa: { label: "Finalizada", color: "bg-gray-500/10 text-gray-400", icon: Archive },
  active: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  completed: { label: "Concluída", color: "bg-gray-500/10 text-gray-400", icon: CheckCircle2 },
  paused: { label: "Pausada", color: "bg-amber-500/10 text-amber-500", icon: Clock },
  archived: { label: "Arquivada", color: "bg-gray-500/10 text-gray-400", icon: Archive },
};

const quotationStatusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-500" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-500" },
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-500" },
  os_gerada: { label: "OS Gerada", color: "bg-purple-500/10 text-purple-500" },
  win: { label: "Aprovada", color: "bg-emerald-500/10 text-emerald-700" },
  perdida: { label: "Perdida", color: "bg-red-500/10 text-red-500" },
  expirada: { label: "Expirada", color: "bg-gray-500/10 text-gray-400" },
};

const osStatusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-500" },
  enviada: { label: "Aguardando Assinatura", color: "bg-blue-500/10 text-blue-500" },
  assinada: { label: "Assinada", color: "bg-emerald-500/10 text-emerald-500" },
  execucao: { label: "Em Execução", color: "bg-orange-500/10 text-orange-500" },
  concluida: { label: "Concluída", color: "bg-emerald-500/10 text-emerald-700" },
};

const invoiceStatusConfig: Record<string, { label: string; color: string }> = {
  emitida: { label: "Emitida", color: "bg-blue-500/10 text-blue-500" },
  paga: { label: "Paga", color: "bg-emerald-500/10 text-emerald-500" },
  vencida: { label: "Vencida", color: "bg-red-500/10 text-red-500" },
  cancelada: { label: "Cancelada", color: "bg-gray-500/10 text-gray-400" },
};

const PIPELINE_STAGES: { key: string; label: string; icon: typeof CircleDot }[] = [
  { key: "briefing", label: "Briefing", icon: FileText },
  { key: "design", label: "Design", icon: Pencil },
  { key: "aprovacao", label: "Aprovação", icon: CheckCircle2 },
  { key: "producao", label: "Produção", icon: Package },
  { key: "distribuicao", label: "Distribuição", icon: Truck },
  { key: "veiculacao", label: "Veiculação", icon: Radio },
];

const STAGE_ORDER: Record<string, number> = {
  briefing: 0, design: 1, aprovacao: 2, producao: 3, distribuicao: 4, veiculacao: 5,
  inativa: 6, active: 5, completed: 6,
};

function formatCurrency(value: string | number | null | undefined) {
  if (!value) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

type CampaignSO = {
  id: number;
  orderNumber: string;
  type: "anunciante" | "producao" | "distribuicao";
  status: string;
  trackingCode: string | null;
  freightProvider: string | null;
  freightExpectedDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

type CampaignProof = {
  id: number;
  week: number;
  photoUrl: string;
  restaurantId: number;
  restaurantName: string | null;
  createdAt: string;
};

function CampaignDetail({ campaign, onBack }: { campaign: any; onBack: () => void }) {
  const { data: campSOs = [] } = trpc.portal.myCampaignServiceOrders.useQuery({ campaignId: campaign.id });
  const { data: proofs = [] } = trpc.portal.myCampaignProofs.useQuery({ campaignId: campaign.id });

  const serviceOrders = campSOs as CampaignSO[];
  const proofPhotos = proofs as CampaignProof[];

  const stageIdx = STAGE_ORDER[campaign.status] ?? -1;

  const prodSO = serviceOrders.find(so => so.type === "producao");
  const distSO = serviceOrders.find(so => so.type === "distribuicao");
  const freightSO = distSO ?? prodSO;

  const showFreight = ["producao", "distribuicao"].includes(campaign.status);
  const showProofs = ["veiculacao", "active", "inativa", "completed"].includes(campaign.status);

  const proofsByWeek = proofPhotos.reduce<Record<number, CampaignProof[]>>((acc, p) => {
    if (!acc[p.week]) acc[p.week] = [];
    acc[p.week].push(p);
    return acc;
  }, {});

  const cfg = campaignStatusConfig[campaign.status] ?? campaignStatusConfig.draft;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Campanhas</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-xs">{campaign.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold leading-tight">{campaign.name}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {campaign.campaignNumber && <span className="font-mono">{campaign.campaignNumber}</span>}
            {campaign.startDate && (
              <span>{formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {campaign.isBonificada && (
            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
          )}
          <Badge className={cfg.color}>
            <StatusIcon className="w-3.5 h-3.5 mr-1" />
            {cfg.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Boxes className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{campaign.coasterVolume?.toLocaleString("pt-BR") ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Bolachas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-base font-semibold">{formatDate(campaign.veiculacaoStartDate)}</p>
                <p className="text-xs text-muted-foreground">Início veiculação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Calendar className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-base font-semibold">{formatDate(campaign.veiculacaoEndDate)}</p>
                <p className="text-xs text-muted-foreground">Fim veiculação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Esteira de Produção</CardTitle>
          <CardDescription>Acompanhe as etapas da sua campanha em tempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="flex items-start justify-between gap-1">
              {PIPELINE_STAGES.map((stage, i) => {
                const isCompleted = stageIdx > i;
                const isCurrent = stageIdx === i;
                const isPending = stageIdx < i;
                const StageIcon = stage.icon;
                return (
                  <div key={stage.key} className="flex flex-col items-center flex-1 min-w-0">
                    <div className="relative flex items-center w-full">
                      {i > 0 && (
                        <div className={`absolute left-0 right-1/2 h-0.5 top-4 -translate-y-0 ${isCompleted || isCurrent ? "bg-primary" : "bg-border"}`} />
                      )}
                      {i < PIPELINE_STAGES.length - 1 && (
                        <div className={`absolute left-1/2 right-0 h-0.5 top-4 -translate-y-0 ${isCompleted ? "bg-primary" : "bg-border"}`} />
                      )}
                      <div className="relative mx-auto z-10">
                        {isCompleted ? (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-8 h-8 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
                            <StageIcon className="w-4 h-4 text-primary" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full border-2 border-border bg-background flex items-center justify-center">
                            <StageIcon className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                    </div>
                    <p className={`mt-2 text-[11px] text-center font-medium leading-tight ${isCurrent ? "text-primary" : isPending ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                      {stage.label}
                    </p>
                    {isCurrent && (
                      <span className="mt-1 text-[9px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Atual
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {showFreight && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Rastreio de Mercadoria
            </CardTitle>
            <CardDescription>Informações de envio dos materiais</CardDescription>
          </CardHeader>
          <CardContent>
            {!freightSO || (!freightSO.trackingCode && !freightSO.freightProvider && !freightSO.freightExpectedDate) ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Informações de rastreio ainda não disponíveis. A equipe Mesa Ads atualizará assim que o material for enviado.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Código de rastreio</p>
                  {freightSO.trackingCode ? (
                    <p className="font-mono font-semibold text-sm">{freightSO.trackingCode}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Transportadora</p>
                  <p className="text-sm font-medium">{freightSO.freightProvider || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Previsão de entrega</p>
                  <p className="text-sm font-medium">{formatDate(freightSO.freightExpectedDate)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {campaign.materialReceivedDate && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Package className="w-4 h-4 shrink-0" />
          <span>Material recebido nos estabelecimentos em <strong>{formatDate(campaign.materialReceivedDate)}</strong></span>
        </div>
      )}

      {showProofs && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Fotos Semanais
            </CardTitle>
            <CardDescription>Registros fotográficos da campanha nos estabelecimentos</CardDescription>
          </CardHeader>
          <CardContent>
            {proofPhotos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <ImageIcon className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhuma foto registrada ainda</p>
                <p className="text-xs">As fotos aparecerão aqui conforme os estabelecimentos forem registrando</p>
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(proofsByWeek)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([week, photos]) => (
                    <div key={week}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Semana {week}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {photos.map(photo => (
                          <div key={photo.id} className="group relative rounded-lg overflow-hidden border bg-muted aspect-square">
                            <img
                              src={photo.photoUrl}
                              alt={`Semana ${week} — ${photo.restaurantName ?? "Estabelecimento"}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                              <p className="text-white text-[10px] font-medium truncate">
                                {photo.restaurantName ?? "—"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AnunciantePortal() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.portal.myProfile.useQuery();
  const { data: campaigns = [] } = trpc.portal.myCampaigns.useQuery();
  const { data: quotations = [] } = trpc.portal.myQuotations.useQuery();
  const { data: serviceOrders = [] } = trpc.portal.myServiceOrders.useQuery();
  const { data: invoices = [] } = trpc.portal.myInvoices.useQuery();

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    contactEmail: "",
    contactPhone: "",
    instagram: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
  });

  const utils = trpc.useUtils();
  const updateProfileMutation = trpc.portal.updateProfile.useMutation({
    onSuccess: () => {
      utils.portal.myProfile.invalidate();
      setEditOpen(false);
      toast.success("Perfil atualizado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });

  const openEditDialog = () => {
    if (profile) {
      setEditForm({
        contactEmail: profile.contactEmail || "",
        contactPhone: profile.contactPhone || "",
        instagram: profile.instagram || "",
        address: profile.address || "",
        addressNumber: profile.addressNumber || "",
        neighborhood: profile.neighborhood || "",
        city: profile.city || "",
        state: profile.state || "",
        cep: profile.cep || "",
      });
    }
    setEditOpen(true);
  };

  const activeCampaigns = campaigns.filter((c: any) => ["veiculacao", "active", "executar", "producao", "transito", "distribuicao", "briefing", "design", "aprovacao"].includes(c.status));
  const signedOsCount = serviceOrders.filter((os: any) => ["assinada", "execucao", "concluida"].includes(os.status)).length;
  const totalInvoiced = invoices
    .filter((i: any) => i.status !== "cancelada")
    .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);
  const pendingInvoices = invoices.filter((i: any) => i.status === "emitida" || i.status === "vencida");

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
        <div className="text-center space-y-3 max-w-md">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Portal do Anunciante</h2>
          <p className="text-muted-foreground">
            Seu perfil ainda não foi vinculado a um anunciante. Entre em contato com a equipe Mesa Ads para completar o cadastro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Portal do Anunciante</h1>
            <p className="text-muted-foreground">
              Bem-vindo, {user?.firstName || profile.name}
            </p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {profile.company || profile.name}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaigns.length}</p>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Radio className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCampaigns.length}</p>
                  <p className="text-xs text-muted-foreground">Ativas agora</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{quotations.length}</p>
                  <p className="text-xs text-muted-foreground">Cotações</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <FileSignature className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{serviceOrders.length}</p>
                  <p className="text-xs text-muted-foreground">OS ({signedOsCount} assinadas)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Receipt className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingInvoices.length}</p>
                  <p className="text-xs text-muted-foreground">Faturas pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="campaigns" className="w-full" onValueChange={() => setSelectedCampaignId(null)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="w-4 h-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="quotations" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Cotações
            </TabsTrigger>
            <TabsTrigger value="os" className="gap-1.5">
              <FileSignature className="w-4 h-4" />
              Ordens de Serviço
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <Receipt className="w-4 h-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5">
              <Building2 className="w-4 h-4" />
              Meu Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            {selectedCampaign ? (
              <CampaignDetail campaign={selectedCampaign} onBack={() => setSelectedCampaignId(null)} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Minhas Campanhas</CardTitle>
                  <CardDescription>Clique em uma campanha para ver detalhes, rastreio e fotos semanais</CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>Nenhuma campanha encontrada</p>
                      <p className="text-sm mt-1">Suas campanhas aparecerão aqui assim que forem criadas</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {campaigns.map((campaign: any) => {
                        const cfg = campaignStatusConfig[campaign.status] || campaignStatusConfig.draft;
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={campaign.id}
                            type="button"
                            className="w-full text-left flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/30 transition-colors cursor-pointer group"
                            onClick={() => setSelectedCampaignId(campaign.id)}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg ${cfg.color}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium group-hover:text-primary transition-colors">{campaign.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  {campaign.campaignNumber && (
                                    <span className="font-mono">{campaign.campaignNumber}</span>
                                  )}
                                  <span>{formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {campaign.isBonificada && (
                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
                              )}
                              <Badge className={cfg.color}>{cfg.label}</Badge>
                              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quotations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Minhas Cotações</CardTitle>
                <CardDescription>Propostas comerciais recebidas</CardDescription>
              </CardHeader>
              <CardContent>
                {quotations.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma cotação encontrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.map((q: any) => {
                        const cfg = quotationStatusConfig[q.status] || quotationStatusConfig.rascunho;
                        return (
                          <TableRow key={q.id}>
                            <TableCell className="font-mono text-sm">{q.quotationNumber}</TableCell>
                            <TableCell>{q.quotationName || "—"}</TableCell>
                            <TableCell className="text-right">{q.coasterVolume?.toLocaleString("pt-BR")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(q.totalValue)}</TableCell>
                            <TableCell>{formatDate(q.validUntil)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {q.isBonificada && (
                                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
                                )}
                                <Badge className={cfg.color}>{cfg.label}</Badge>
                                {q.signedAt && (
                                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">Assinada</Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="os" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Ordens de Serviço</CardTitle>
                <CardDescription>Acompanhe suas ordens de serviço e assinaturas</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileSignature className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma ordem de serviço encontrada</p>
                    <p className="text-sm mt-1">Suas OS aparecerão aqui assim que forem criadas</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº OS</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceOrders.map((os: any) => {
                        const cfg = osStatusConfig[os.status] || osStatusConfig.rascunho;
                        return (
                          <TableRow key={os.id}>
                            <TableCell className="font-mono text-sm">{os.orderNumber}</TableCell>
                            <TableCell>{os.description || "—"}</TableCell>
                            <TableCell>
                              {formatDate(os.periodStart)} — {formatDate(os.periodEnd)}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(os.totalValue)}</TableCell>
                            <TableCell>
                              <Badge className={cfg.color}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {os.status === "enviada" && os.quotationPublicToken && (
                                  <a href={`/cotacao/assinar/${os.quotationPublicToken}`}>
                                    <Button size="sm" variant="default" className="gap-1.5">
                                      <FileSignature className="w-3.5 h-3.5" />
                                      Assinar
                                    </Button>
                                  </a>
                                )}
                                {os.signedAt && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      Assinada em {formatDate(os.signedAt)}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1.5"
                                      onClick={() => {
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
                                      }}
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      Baixar Contrato
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Financeiro</CardTitle>
                    <CardDescription>Faturas e pagamentos</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total faturado</p>
                    <p className="text-lg font-bold">{formatCurrency(totalInvoiced)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma fatura encontrada</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fatura</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv: any) => {
                        const cfg = invoiceStatusConfig[inv.status] || invoiceStatusConfig.emitida;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                            <TableCell>{inv.campaignName || "—"}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(inv.amount)}</TableCell>
                            <TableCell>{formatDate(inv.issueDate)}</TableCell>
                            <TableCell>{formatDate(inv.dueDate)}</TableCell>
                            <TableCell>{formatDate(inv.paymentDate)}</TableCell>
                            <TableCell>
                              <Badge className={cfg.color}>{cfg.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meu Perfil</CardTitle>
                    <CardDescription>Dados cadastrais da empresa</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={openEditDialog}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Empresa</p>
                      <p className="font-medium text-lg">{profile.company || profile.name}</p>
                    </div>
                    {profile.razaoSocial && (
                      <div>
                        <p className="text-sm text-muted-foreground">Razão Social</p>
                        <p className="font-medium">{profile.razaoSocial}</p>
                      </div>
                    )}
                    {profile.cnpj && (
                      <div>
                        <p className="text-sm text-muted-foreground">CNPJ</p>
                        <p className="font-mono">{profile.cnpj}</p>
                      </div>
                    )}
                    {profile.segment && (
                      <div>
                        <p className="text-sm text-muted-foreground">Segmento</p>
                        <p>{profile.segment}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">E-mail</p>
                        <p>{profile.contactEmail || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Telefone</p>
                        <p>{profile.contactPhone || "—"}</p>
                      </div>
                    </div>
                    {profile.instagram && (
                      <div className="flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Instagram</p>
                          <p>@{profile.instagram.replace("@", "")}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Endereço</p>
                        <p>
                          {[
                            profile.address,
                            profile.addressNumber,
                            profile.neighborhood,
                            profile.city && profile.state ? `${profile.city}/${profile.state}` : profile.city || profile.state,
                            profile.cep,
                          ].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Perfil</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail de contato</Label>
                  <Input
                    value={editForm.contactEmail}
                    onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={editForm.contactPhone}
                    onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={editForm.instagram}
                  onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                  placeholder="@perfil"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={editForm.addressNumber}
                    onChange={(e) => setEditForm({ ...editForm, addressNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={editForm.neighborhood}
                    onChange={(e) => setEditForm({ ...editForm, neighborhood: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input
                    value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    maxLength={2}
                    placeholder="SP"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={editForm.cep}
                  onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => updateProfileMutation.mutate(editForm)}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
