import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import RestaurantAvatar from "@/components/RestaurantAvatar";
import { NotificationBell } from "@/components/NotificationPanel";
import { generateTermPdf } from "@/lib/generate-term-pdf";
import { generateCommissionStatementPdf, buildCommissionStatementData, type CommissionStatementRestaurant } from "@/lib/generate-commission-statement-pdf";
import { Textarea } from "@/components/ui/textarea";
import {
  UtensilsCrossed,
  Megaphone,
  FileText,
  Phone,
  Mail,
  Instagram,
  MapPin,
  Pencil,
  CheckCircle2,
  Clock,
  Radio,
  Archive,
  Package,
  Truck,
  Play,
  CircleDot,
  AlertCircle,
  ShieldCheck,
  Download,
  Bell,
  Star,
  Boxes,
  CalendarDays,
  DollarSign,
  ClipboardList,
  Users,
  Wine,
  Armchair,
  Ban,
} from "lucide-react";

import { EXCLUDED_CATEGORIES } from "@shared/excluded-categories";

function parseExcluded(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
  } catch {}
  if (raw.includes("||")) return raw.split("||").map(s => s.trim()).filter(Boolean);
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatRefMonth(m: string | null | undefined) {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  if (!y || !mo) return m;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(mo) - 1] || mo}/${y}`;
}

const osStatusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-400" },
  assinada: { label: "Assinada", color: "bg-emerald-500/10 text-emerald-400" },
  execucao: { label: "Em execução", color: "bg-purple-500/10 text-purple-400" },
  concluida: { label: "Concluída", color: "bg-gray-500/10 text-gray-400" },
};

const osTypeLabel: Record<string, string> = {
  anunciante: "Anunciante",
  producao: "Produção",
  distribuicao: "Distribuição",
};

const campaignStatusConfig: Record<string, { label: string; color: string; icon: typeof CircleDot }> = {
  draft: { label: "Rascunho", color: "bg-gray-500/10 text-gray-500", icon: CircleDot },
  producao: { label: "Produção", color: "bg-blue-500/10 text-blue-500", icon: Package },
  transito: { label: "Trânsito", color: "bg-amber-500/10 text-amber-500", icon: Truck },
  executar: { label: "Executar", color: "bg-purple-500/10 text-purple-500", icon: Play },
  veiculacao: { label: "Em Veiculação", color: "bg-emerald-500/10 text-emerald-500", icon: Radio },
  inativa: { label: "Finalizada", color: "bg-gray-500/10 text-gray-400", icon: Archive },
  active: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-500", icon: CheckCircle2 },
  completed: { label: "Concluída", color: "bg-gray-500/10 text-gray-400", icon: CheckCircle2 },
  paused: { label: "Pausada", color: "bg-amber-500/10 text-amber-500", icon: Clock },
  archived: { label: "Arquivada", color: "bg-gray-500/10 text-gray-400", icon: Archive },
};

const termStatusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-500" },
  enviado: { label: "Enviado", color: "bg-blue-500/10 text-blue-500" },
  assinado: { label: "Assinado", color: "bg-emerald-500/10 text-emerald-500" },
  vigente: { label: "Vigente", color: "bg-emerald-500/10 text-emerald-700" },
  encerrado: { label: "Encerrado", color: "bg-gray-500/10 text-gray-400" },
  cancelado: { label: "Cancelado", color: "bg-red-500/10 text-red-500" },
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

const VALID_TABS = ["campaigns", "calendar", "commissions", "os", "terms", "profile"] as const;
type RestaurantePortalTab = typeof VALID_TABS[number];

function getInitialTab(): RestaurantePortalTab {
  if (typeof window === "undefined") return "campaigns";
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  return (VALID_TABS as readonly string[]).includes(t ?? "") ? (t as RestaurantePortalTab) : "campaigns";
}

export default function RestaurantePortal() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<RestaurantePortalTab>(getInitialTab);

  useEffect(() => {
    const next = getInitialTab();
    setActiveTab(next);
  }, [location]);
  const { data: restaurant, isLoading } = trpc.restaurantePortal.myRestaurant.useQuery();
  const { data: campaigns = [] } = trpc.restaurantePortal.myCampaigns.useQuery();
  const { data: terms = [] } = trpc.restaurantePortal.myTerms.useQuery();
  const { data: pendingData } = trpc.restaurantePortal.pendingTerms.useQuery();
  const { data: acceptances = [] } = trpc.restaurantePortal.myAcceptances.useQuery();
  const { data: occupancy } = trpc.restaurantePortal.myOccupancyCalendar.useQuery();
  const { data: commissions } = trpc.restaurantePortal.myCommissions.useQuery();
  const { data: serviceOrdersList = [] } = trpc.restaurantePortal.myServiceOrders.useQuery();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    contactName: "",
    whatsapp: "",
    email: "",
    financialEmail: "",
    instagram: "",
    pixKey: "",
  });

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [acceptingItem, setAcceptingItem] = useState<{
    type: "template" | "term";
    id: number;
    title: string;
    content: string;
  } | null>(null);
  const [acceptForm, setAcceptForm] = useState({
    name: "",
    cpf: "",
    accepted: false,
  });

  const [statementPeriod, setStatementPeriod] = useState<{ start: string; end: string }>({ start: "", end: "" });

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    monthlyCustomers: 0,
    monthlyDrinksSold: 0,
    tableCount: 0,
    seatCount: 0,
    excludedCategories: [] as string[],
    excludedOther: "",
  });

  const utils = trpc.useUtils();
  const updateContactMutation = trpc.restaurantePortal.updateContact.useMutation({
    onSuccess: () => {
      utils.restaurantePortal.myRestaurant.invalidate();
      setEditOpen(false);
      toast.success("Dados de contato atualizados!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateProfileMutation = trpc.restaurantePortal.updateProfile.useMutation({
    onSuccess: () => {
      utils.restaurantePortal.myRestaurant.invalidate();
      setProfileOpen(false);
      toast.success("Dados operacionais atualizados!");
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmMaterialMutation = trpc.restaurantePortal.confirmMaterialReceived.useMutation({
    onSuccess: () => {
      utils.restaurantePortal.myCampaigns.invalidate();
      utils.restaurantePortal.myServiceOrders.invalidate();
      toast.success("Recebimento confirmado!");
    },
    onError: (e) => toast.error(e.message),
  });

  const acceptTermMutation = trpc.restaurantePortal.acceptTerm.useMutation({
    onSuccess: () => {
      if (acceptingItem) {
        generateTermPdf({
          title: acceptingItem.title,
          content: acceptingItem.content,
          signerName: acceptForm.name,
          signerCpf: acceptForm.cpf,
          signerEmail: user?.email || "",
          signedAt: new Date().toISOString(),
          termHash: undefined,
        });
      }
      utils.restaurantePortal.pendingTerms.invalidate();
      utils.restaurantePortal.myAcceptances.invalidate();
      utils.restaurantePortal.myTerms.invalidate();
      setAcceptDialogOpen(false);
      setAcceptingItem(null);
      setAcceptForm({ name: "", cpf: "", accepted: false });
      toast.success("Termo aceito com sucesso! PDF gerado para download.");
    },
    onError: (e) => toast.error(e.message),
  });

  const openProfileDialog = () => {
    if (restaurant) {
      setProfileForm({
        monthlyCustomers: (restaurant as any).monthlyCustomers || 0,
        monthlyDrinksSold: (restaurant as any).monthlyDrinksSold || 0,
        tableCount: (restaurant as any).tableCount || 0,
        seatCount: (restaurant as any).seatCount || 0,
        excludedCategories: parseExcluded((restaurant as any).excludedCategories),
        excludedOther: (restaurant as any).excludedOther || "",
      });
    }
    setProfileOpen(true);
  };

  const toggleProfileCategory = (cat: string) => {
    setProfileForm(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(cat)
        ? prev.excludedCategories.filter(c => c !== cat)
        : [...prev.excludedCategories, cat],
    }));
  };

  const openEditDialog = () => {
    if (restaurant) {
      setEditForm({
        contactName: restaurant.contactName || "",
        whatsapp: restaurant.whatsapp || "",
        email: restaurant.email || "",
        financialEmail: restaurant.financialEmail || "",
        instagram: restaurant.instagram || "",
        pixKey: restaurant.pixKey || "",
      });
    }
    setEditOpen(true);
  };

  const openAcceptDialog = (type: "template" | "term", id: number, title: string, content: string) => {
    setAcceptingItem({ type, id, title, content });
    const prefillName = user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.firstName || restaurant?.contactName || "";
    setAcceptForm({ name: prefillName, cpf: "", accepted: false });
    setAcceptDialogOpen(true);
  };

  const handleAcceptTerm = () => {
    if (!acceptingItem || !acceptForm.accepted || !acceptForm.name || !acceptForm.cpf) return;
    acceptTermMutation.mutate({
      ...(acceptingItem.type === "term" ? { termId: acceptingItem.id } : { templateId: acceptingItem.id }),
      acceptedByName: acceptForm.name,
      acceptedByCpf: acceptForm.cpf,
    });
  };

  const activeCampaigns = campaigns.filter((c: any) =>
    ["veiculacao", "active", "executar", "producao", "transito"].includes(c.status)
  );
  const campaignsAwaitingMaterialConfirm = campaigns.filter((c: any) =>
    c.status === "executar" && !c.materialReceivedDate
  );
  const signedTerms = terms.filter((t: any) => t.status === "assinado" || t.status === "vigente");

  const pendingTemplates = pendingData?.templates || [];
  const pendingTermsList = pendingData?.terms || [];
  const totalPending = pendingTemplates.length + pendingTermsList.length;

  const totalNotifications = totalPending + campaignsAwaitingMaterialConfirm.length;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando portal...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Portal do Local</h2>
          <p className="text-muted-foreground">
            Seu perfil ainda não foi vinculado a um local. Entre em contato com a equipe Mesa Ads.
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
            <h1 className="text-2xl font-bold">Portal do Local</h1>
            <p className="text-muted-foreground">
              Bem-vindo, {user?.firstName || restaurant.contactName || restaurant.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell isAdmin={false} isRestaurante />
            <RestaurantAvatar name={restaurant.name} logoUrl={(restaurant as any).logoUrl} size="sm" />
            <Badge variant="outline" className="text-sm px-3 py-1">
              {restaurant.name}
            </Badge>
          </div>
        </div>

        {totalNotifications > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">
                {totalNotifications} {totalNotifications === 1 ? "ação pendente" : "ações pendentes"}
              </p>
            </div>
            {totalPending > 0 && (
              <div className="flex items-center gap-3 text-sm text-amber-200 bg-amber-500/8 rounded-lg px-3 py-2 border border-amber-500/15">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {totalPending} {totalPending === 1 ? "termo pendente" : "termos pendentes"} aguardando seu aceite
                </span>
              </div>
            )}
            {campaignsAwaitingMaterialConfirm.length > 0 && (
              <div className="flex items-center gap-3 text-sm text-amber-200 bg-amber-500/8 rounded-lg px-3 py-2 border border-amber-500/15">
                <Package className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Material da campanha chegou — confirme o recebimento na aba Campanhas
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-2xl font-bold">{signedTerms.length + acceptances.length}</p>
                  <p className="text-xs text-muted-foreground">Termos aceitos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RestaurantePortalTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="w-4 h-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="w-4 h-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="commissions" className="gap-1.5">
              <DollarSign className="w-4 h-4" />
              Comissões
            </TabsTrigger>
            <TabsTrigger value="os" className="gap-1.5">
              <ClipboardList className="w-4 h-4" />
              OS
              {campaignsAwaitingMaterialConfirm.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {campaignsAwaitingMaterialConfirm.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Termos
              {totalPending > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {totalPending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5">
              <UtensilsCrossed className="w-4 h-4" />
              Meu Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Campanhas no Estabelecimento</CardTitle>
                <CardDescription>Campanhas em veiculação ou programadas para o seu local</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma campanha encontrada</p>
                    <p className="text-sm mt-1">As campanhas aparecerão aqui quando forem vinculadas ao seu local</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign: any) => {
                      const cfg = campaignStatusConfig[campaign.status] || campaignStatusConfig.draft;
                      const Icon = cfg.icon;
                      const needsMaterialConfirm = campaign.status === "executar" && !campaign.materialReceivedDate;
                      return (
                        <div key={campaign.id} className={`p-4 rounded-lg border bg-card transition-colors ${needsMaterialConfirm ? "border-amber-500/30 bg-amber-500/5" : "hover:bg-accent/50"}`}>
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg ${cfg.color}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">{campaign.name}</p>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                  {campaign.campaignNumber && (
                                    <span className="font-mono">{campaign.campaignNumber}</span>
                                  )}
                                  <span>{formatDate(campaign.startDate)} — {formatDate(campaign.endDate)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cfg.color}>{cfg.label}</Badge>
                              {needsMaterialConfirm && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                  disabled={confirmMaterialMutation.isPending}
                                  onClick={() => confirmMaterialMutation.mutate({ campaignId: campaign.campaignId ?? campaign.id })}
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  Confirmar recebimento
                                </Button>
                              )}
                              {campaign.materialReceivedDate && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Material recebido em {formatDate(campaign.materialReceivedDate)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Calendário de ocupação
                </CardTitle>
                <CardDescription>
                  Períodos em que seu local tem campanhas programadas ou em veiculação
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!occupancy || occupancy.campaigns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma campanha agendada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {occupancy.campaigns.map((c: any) => {
                      const phases = occupancy.phases.filter((p: any) => p.campaignId === c.id);
                      const cfg = campaignStatusConfig[c.status] || campaignStatusConfig.draft;
                      return (
                        <div key={c.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {c.campaignNumber && <span className="font-mono">{c.campaignNumber}</span>}
                                {c.clientLabel && <span>· {c.clientLabel}</span>}
                              </div>
                            </div>
                            <Badge className={cfg.color}>{cfg.label}</Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-md border border-border/30 bg-background/40 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Período total</p>
                              <p className="font-medium">{formatDate(c.startDate)} — {formatDate(c.endDate)}</p>
                            </div>
                            {(c.veiculacaoStartDate || c.veiculacaoEndDate) && (
                              <div className="rounded-md border border-border/30 bg-background/40 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Veiculação</p>
                                <p className="font-medium">{formatDate(c.veiculacaoStartDate)} — {formatDate(c.veiculacaoEndDate)}</p>
                              </div>
                            )}
                          </div>
                          {phases.length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fases / Ciclos</p>
                              {phases.map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between text-sm rounded-md border border-border/20 bg-background/30 px-3 py-1.5">
                                  <span className="font-medium">{p.label}</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(p.periodStart)} — {formatDate(p.periodEnd)}</span>
                                  <Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-4 space-y-4">
            <Card>
              <CardContent className="pt-6 flex flex-col md:flex-row md:items-end gap-4 justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="statement-start" className="text-xs text-muted-foreground">De (mês)</Label>
                    <Input
                      id="statement-start"
                      type="month"
                      value={statementPeriod.start}
                      onChange={(e) => setStatementPeriod(p => ({ ...p, start: e.target.value }))}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label htmlFor="statement-end" className="text-xs text-muted-foreground">Até (mês)</Label>
                    <Input
                      id="statement-end"
                      type="month"
                      value={statementPeriod.end}
                      onChange={(e) => setStatementPeriod(p => ({ ...p, end: e.target.value }))}
                    />
                  </div>
                  {(statementPeriod.start || statementPeriod.end) && (
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatementPeriod({ start: "", end: "" })}
                      >
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  className="gap-2"
                  disabled={!commissions}
                  onClick={() => {
                    if (!commissions || !restaurant) return;
                    if (statementPeriod.start && statementPeriod.end && statementPeriod.start > statementPeriod.end) {
                      toast.error("O mês inicial deve ser anterior ou igual ao mês final");
                      return;
                    }
                    const restaurantForPdf: CommissionStatementRestaurant = {
                      name: restaurant.name,
                      razaoSocial: restaurant.razaoSocial,
                      cnpj: restaurant.cnpj,
                      address: restaurant.address,
                      neighborhood: restaurant.neighborhood,
                      city: restaurant.city,
                      state: restaurant.state,
                      cep: restaurant.cep,
                      contactName: restaurant.contactName,
                      email: restaurant.email,
                      whatsapp: restaurant.whatsapp,
                    };
                    const statementData = buildCommissionStatementData(
                      commissions,
                      restaurantForPdf,
                      statementPeriod,
                      formatRefMonth,
                    );
                    if (!statementData) {
                      toast.error(statementPeriod.start || statementPeriod.end
                        ? "Nenhuma comissão no período selecionado"
                        : "Nenhuma comissão registrada para gerar o extrato");
                      return;
                    }
                    generateCommissionStatementPdf(statementData);
                  }}
                >
                  <Download className="w-4 h-4" />
                  Baixar extrato
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Total acumulado</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{formatBRL(commissions?.totalAmount || 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {commissions?.paymentCount || 0} {commissions?.paymentCount === 1 ? "pagamento" : "pagamentos"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Já recebido</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-400 mt-1">{formatBRL(commissions?.totalPaid || 0)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">A receber</p>
                  <p className="text-2xl font-bold tabular-nums text-amber-400 mt-1">{formatBRL(commissions?.totalPending || 0)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Comissões por campanha
                </CardTitle>
                <CardDescription>Detalhamento dos repasses por campanha vinculada ao seu local</CardDescription>
              </CardHeader>
              <CardContent>
                {!commissions || commissions.byCampaign.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma comissão registrada ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {commissions.byCampaign.map((g: any) => (
                      <div key={`${g.campaignId ?? "none"}`} className="rounded-lg border bg-card">
                        <div className="p-4 flex items-center justify-between gap-3 flex-wrap border-b border-border/30">
                          <div>
                            <p className="font-medium">{g.campaignName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {g.campaignNumber && <span className="font-mono">{g.campaignNumber}</span>}
                              {g.clientLabel && <span>· {g.clientLabel}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold tabular-nums">{formatBRL(g.totalAmount)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {g.paymentCount} {g.paymentCount === 1 ? "pagamento" : "pagamentos"} · pago {formatBRL(g.paidAmount)} · a receber {formatBRL(g.pendingAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="divide-y divide-border/20">
                          {g.payments.map((p: any) => {
                            const isPaid = p.status === "pago" || p.status === "paid";
                            return (
                              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className="text-xs">{formatRefMonth(p.referenceMonth)}</Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {p.periodStart ? `${formatDate(p.periodStart)} — ${formatDate(p.periodEnd)}` : (p.paymentDate ? `Pago em ${formatDate(p.paymentDate)}` : "Sem data")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-mono tabular-nums">{formatBRL(p.amountNumber)}</span>
                                  <Badge className={isPaid ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}>
                                    {isPaid ? "Pago" : "Pendente"}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="os" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  Ordens de Serviço
                </CardTitle>
                <CardDescription>
                  OS vinculadas às suas campanhas, com rastreamento e confirmação de recebimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {serviceOrdersList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma OS registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviceOrdersList.map((os: any) => {
                      const cfg = osStatusConfig[os.status] || osStatusConfig.rascunho;
                      const isDistribution = os.type === "distribuicao";
                      const needsConfirm = isDistribution && os.campaignId && !os.materialReceivedDate;
                      return (
                        <div key={os.id} className={`rounded-lg border p-4 ${needsConfirm ? "border-amber-500/30 bg-amber-500/5" : "bg-card"}`}>
                          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Truck className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-mono text-sm font-medium">{os.orderNumber}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <Badge variant="outline" className="text-[10px]">{osTypeLabel[os.type] || os.type}</Badge>
                                  {os.campaignNumber && <span className="font-mono">{os.campaignNumber}</span>}
                                  {os.campaignName && <span>· {os.campaignName}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cfg.color}>{cfg.label}</Badge>
                              {needsConfirm && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                  disabled={confirmMaterialMutation.isPending}
                                  onClick={() => confirmMaterialMutation.mutate({ campaignId: os.campaignId })}
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  Confirmar recebimento
                                </Button>
                              )}
                              {os.materialReceivedDate && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Recebido em {formatDate(os.materialReceivedDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mt-2">
                            {(os.periodStart || os.periodEnd) && (
                              <div className="rounded-md border border-border/20 bg-background/30 px-2.5 py-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Período</p>
                                <p>{formatDate(os.periodStart)} — {formatDate(os.periodEnd)}</p>
                              </div>
                            )}
                            {os.estimatedDeadline && (
                              <div className="rounded-md border border-border/20 bg-background/30 px-2.5 py-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prazo estimado</p>
                                <p>{formatDate(os.estimatedDeadline)}</p>
                              </div>
                            )}
                            {os.coasterVolume != null && (
                              <div className="rounded-md border border-border/20 bg-background/30 px-2.5 py-1.5">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume</p>
                                <p>{Number(os.coasterVolume).toLocaleString("pt-BR")} un.</p>
                              </div>
                            )}
                          </div>
                          {(os.trackings.length > 0 || os.trackingCode) && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rastreamentos</p>
                              {os.trackingCode && os.trackings.length === 0 && (
                                <div className="flex items-center justify-between text-xs rounded-md border border-border/20 bg-background/30 px-2.5 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-mono">{os.trackingCode}</span>
                                    {os.freightProvider && <span className="text-muted-foreground">· {os.freightProvider}</span>}
                                  </div>
                                  {os.freightExpectedDate && (
                                    <span className="text-muted-foreground">previsto {formatDate(os.freightExpectedDate)}</span>
                                  )}
                                </div>
                              )}
                              {os.trackings.map((t: any) => (
                                <div key={t.id} className="flex items-center justify-between text-xs rounded-md border border-border/20 bg-background/30 px-2.5 py-1.5">
                                  <div className="flex items-center gap-2">
                                    <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-mono">{t.trackingCode}</span>
                                    {t.freightProvider && <span className="text-muted-foreground">· {t.freightProvider}</span>}
                                    {t.label && <span className="text-muted-foreground">· {t.label}</span>}
                                  </div>
                                  {t.expectedDate && (
                                    <span className="text-muted-foreground">previsto {formatDate(t.expectedDate)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms" className="mt-4 space-y-4">
            {totalPending > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    Pendentes
                  </CardTitle>
                  <CardDescription>Termos que aguardam seu aceite</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingTemplates.map((template: any) => (
                      <div key={`tpl-${template.id}`} className="flex items-center justify-between p-4 rounded-lg border bg-amber-500/5 border-amber-500/20">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10">
                            <FileText className="w-5 h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="font-medium">{template.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Versão {template.version}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openAcceptDialog("template", template.id, template.title, template.content)}
                        >
                          Aceitar
                        </Button>
                      </div>
                    ))}
                    {pendingTermsList.map((term: any) => (
                      <div key={`term-${term.id}`} className="flex items-center justify-between p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="w-5 h-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium font-mono text-sm">{term.termNumber}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>Vigência: {formatDate(term.validFrom)} — {formatDate(term.validUntil)}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => openAcceptDialog(
                            "term",
                            term.id,
                            `Termo ${term.termNumber}`,
                            JSON.stringify({
                              conditions: term.conditions,
                              remunerationRule: term.remunerationRule,
                              allowedCategories: term.allowedCategories,
                              blockedCategories: term.blockedCategories,
                              restaurantObligations: term.restaurantObligations,
                              mesaObligations: term.mesaObligations,
                            }, null, 2)
                          )}
                        >
                          Aceitar
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  Aceitos
                </CardTitle>
                <CardDescription>Registros de termos aceitos</CardDescription>
              </CardHeader>
              <CardContent>
                {acceptances.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhum termo aceito ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {acceptances.map((acceptance: any) => (
                      <div key={acceptance.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-medium">{acceptance.title}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>Aceito por {acceptance.acceptedByName}</span>
                              <span>em {formatDateTime(acceptance.acceptedAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => generateTermPdf({
                              title: acceptance.title,
                              content: acceptance.termContent || "",
                              signerName: acceptance.acceptedByName || "",
                              signerCpf: acceptance.acceptedByCpf || "",
                              signerEmail: acceptance.acceptedByEmail || "",
                              signedAt: acceptance.acceptedAt || new Date().toISOString(),
                              termHash: acceptance.termHash || undefined,
                            })}
                          >
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          <Badge className="bg-emerald-500/10 text-emerald-500">Aceito</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-4 space-y-4">
            {((restaurant as any).coastersAllocated || (restaurant as any).ratingScore || (restaurant as any).ratingTier) && (
              <div className="grid grid-cols-2 gap-4">
                {(restaurant as any).coastersAllocated && (
                  <div className="rounded-xl border border-border/30 bg-card p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                      <Boxes className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bolachas alocadas</p>
                      <p className="text-xl font-bold tabular-nums">{(restaurant as any).coastersAllocated?.toLocaleString("pt-BR")}</p>
                      <p className="text-[10px] text-muted-foreground">por ciclo</p>
                    </div>
                  </div>
                )}
                {(restaurant as any).ratingTier && (
                  <div className="rounded-xl border border-border/30 bg-card p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 shrink-0">
                      <Star className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avaliação na rede</p>
                      <p className="text-xl font-bold capitalize text-amber-400">{(restaurant as any).ratingTier}</p>
                      {(restaurant as any).ratingScore && (
                        <p className="text-[10px] text-muted-foreground">Score: {parseFloat((restaurant as any).ratingScore).toFixed(1)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meu Estabelecimento</CardTitle>
                    <CardDescription>Dados cadastrais do local</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={openEditDialog}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar Contato
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Estabelecimento</p>
                      <p className="font-medium text-lg">{restaurant.name}</p>
                    </div>
                    {restaurant.razaoSocial && (
                      <div>
                        <p className="text-sm text-muted-foreground">Razão Social</p>
                        <p className="font-medium">{restaurant.razaoSocial}</p>
                      </div>
                    )}
                    {restaurant.cnpj && (
                      <div>
                        <p className="text-sm text-muted-foreground">CNPJ</p>
                        <p className="font-mono">{restaurant.cnpj}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Endereço</p>
                        <p>
                          {[
                            restaurant.address,
                            restaurant.neighborhood,
                            restaurant.city && restaurant.state ? `${restaurant.city}/${restaurant.state}` : restaurant.city || restaurant.state,
                            restaurant.cep,
                          ].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">E-mail</p>
                        <p>{restaurant.email || "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">WhatsApp</p>
                        <p>{restaurant.whatsapp || "—"}</p>
                      </div>
                    </div>
                    {restaurant.instagram && (
                      <div className="flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Instagram</p>
                          <p>@{restaurant.instagram.replace("@", "")}</p>
                        </div>
                      </div>
                    )}
                    {restaurant.contactName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Contato</p>
                        <p>{restaurant.contactName} {restaurant.contactRole ? `(${restaurant.contactRole})` : ""}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Chave Pix (recebimento de comissões)</p>
                      <p data-testid="text-restaurante-pix" className="font-mono text-sm">
                        {restaurant.pixKey || <span className="text-muted-foreground italic font-sans">Não cadastrada</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Dados Operacionais</CardTitle>
                    <CardDescription>Capacidade, fluxo de clientes e categorias bloqueadas para anúncios</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={openProfileDialog}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="rounded-lg border border-border/30 bg-card p-3 flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Clientes/mês</p>
                      <p className="text-lg font-bold tabular-nums">{((restaurant as any).monthlyCustomers || 0).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-card p-3 flex items-center gap-2.5">
                    <Wine className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bebidas/mês</p>
                      <p className="text-lg font-bold tabular-nums">{((restaurant as any).monthlyDrinksSold || 0).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-card p-3 flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mesas</p>
                      <p className="text-lg font-bold tabular-nums">{(restaurant as any).tableCount || 0}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/30 bg-card p-3 flex items-center gap-2.5">
                    <Armchair className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lugares</p>
                      <p className="text-lg font-bold tabular-nums">{(restaurant as any).seatCount || 0}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Ban className="w-4 h-4 text-red-400" />
                    <p className="text-sm font-medium">Categorias bloqueadas para anúncios</p>
                  </div>
                  {(() => {
                    const cats = parseExcluded((restaurant as any).excludedCategories);
                    const other = (restaurant as any).excludedOther;
                    if (cats.length === 0 && !other) {
                      return <p className="text-sm text-muted-foreground">Nenhuma categoria bloqueada.</p>;
                    }
                    return (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {cats.map((c, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-red-500/30 text-red-300">{c}</Badge>
                          ))}
                        </div>
                        {other && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium">Outras:</span> {other}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Dados de Contato</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Contato</Label>
                <Input
                  value={editForm.contactName}
                  onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail Financeiro</Label>
                <Input
                  value={editForm.financialEmail}
                  onChange={(e) => setEditForm({ ...editForm, financialEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={editForm.instagram}
                  onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                  placeholder="@perfil"
                />
              </div>
              <div className="space-y-2">
                <Label>Chave Pix (recebimento de comissões)</Label>
                <Input
                  value={editForm.pixKey}
                  onChange={(e) => setEditForm({ ...editForm, pixKey: e.target.value })}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  data-testid="input-restaurante-pix"
                />
                <p className="text-xs text-muted-foreground">Esta chave será usada pela Mesa para repasses mensais de comissão.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => updateContactMutation.mutate(editForm)}
                disabled={updateContactMutation.isPending}
              >
                {updateContactMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Dados Operacionais</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Clientes por mês</Label>
                  <Input
                    type="number"
                    min={0}
                    value={profileForm.monthlyCustomers}
                    onChange={(e) => setProfileForm({ ...profileForm, monthlyCustomers: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bebidas vendidas por mês</Label>
                  <Input
                    type="number"
                    min={0}
                    value={profileForm.monthlyDrinksSold}
                    onChange={(e) => setProfileForm({ ...profileForm, monthlyDrinksSold: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de mesas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={profileForm.tableCount}
                    onChange={(e) => setProfileForm({ ...profileForm, tableCount: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de lugares</Label>
                  <Input
                    type="number"
                    min={0}
                    value={profileForm.seatCount}
                    onChange={(e) => setProfileForm({ ...profileForm, seatCount: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categorias bloqueadas para anúncios</Label>
                <p className="text-xs text-muted-foreground">Marque as categorias que você NÃO deseja que apareçam em sua veiculação.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto rounded-md border border-border/30 p-3">
                  {EXCLUDED_CATEGORIES.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/40 rounded px-1.5 py-1">
                      <Checkbox
                        checked={profileForm.excludedCategories.includes(cat)}
                        onCheckedChange={() => toggleProfileCategory(cat)}
                      />
                      <span className={profileForm.excludedCategories.includes(cat) ? "text-red-300" : ""}>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Outras categorias bloqueadas (texto livre)</Label>
                <Textarea
                  value={profileForm.excludedOther}
                  onChange={(e) => setProfileForm({ ...profileForm, excludedOther: e.target.value })}
                  placeholder="Categorias adicionais que você não quer anunciar..."
                  className="min-h-[60px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProfileOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => updateProfileMutation.mutate(profileForm)}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={acceptDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setAcceptDialogOpen(false);
            setAcceptingItem(null);
            setAcceptForm({ name: "", cpf: "", accepted: false });
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{acceptingItem?.title || "Aceitar Termo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Conteúdo do Termo</Label>
                <ScrollArea className="h-[300px] mt-2 rounded-md border p-4 bg-muted/30">
                  <div
                    className="prose prose-sm prose-invert max-w-none text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mb-1 [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(acceptingItem?.content || "") }}
                  />
                </ScrollArea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={acceptForm.name}
                    onChange={(e) => setAcceptForm({ ...acceptForm, name: e.target.value })}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={acceptForm.cpf}
                    onChange={(e) => setAcceptForm({ ...acceptForm, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="accept-terms"
                  checked={acceptForm.accepted}
                  onCheckedChange={(checked) => setAcceptForm({ ...acceptForm, accepted: checked === true })}
                />
                <Label htmlFor="accept-terms" className="text-sm cursor-pointer">
                  Li e concordo com os termos acima
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setAcceptDialogOpen(false);
                setAcceptingItem(null);
                setAcceptForm({ name: "", cpf: "", accepted: false });
              }}>
                Cancelar
              </Button>
              <Button
                onClick={handleAcceptTerm}
                disabled={!acceptForm.accepted || !acceptForm.name || !acceptForm.cpf || acceptTermMutation.isPending}
              >
                {acceptTermMutation.isPending ? "Processando..." : "Confirmar Aceite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
