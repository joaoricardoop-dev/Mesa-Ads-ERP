import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
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
import { generateTermPdf } from "@/lib/generate-term-pdf";
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
} from "lucide-react";

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

export default function RestaurantePortal() {
  const { user } = useAuth();
  const { data: restaurant, isLoading } = trpc.restaurantePortal.myRestaurant.useQuery();
  const { data: campaigns = [] } = trpc.restaurantePortal.myCampaigns.useQuery();
  const { data: terms = [] } = trpc.restaurantePortal.myTerms.useQuery();
  const { data: pendingData } = trpc.restaurantePortal.pendingTerms.useQuery();
  const { data: acceptances = [] } = trpc.restaurantePortal.myAcceptances.useQuery();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    contactName: "",
    whatsapp: "",
    email: "",
    financialEmail: "",
    instagram: "",
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

  const utils = trpc.useUtils();
  const updateContactMutation = trpc.restaurantePortal.updateContact.useMutation({
    onSuccess: () => {
      utils.restaurantePortal.myRestaurant.invalidate();
      setEditOpen(false);
      toast.success("Dados de contato atualizados!");
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

  const openEditDialog = () => {
    if (restaurant) {
      setEditForm({
        contactName: restaurant.contactName || "",
        whatsapp: restaurant.whatsapp || "",
        email: restaurant.email || "",
        financialEmail: restaurant.financialEmail || "",
        instagram: restaurant.instagram || "",
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

        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="w-4 h-4" />
              Campanhas
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
                                  onClick={() => toast.info("Para confirmar o recebimento, entre em contato com a equipe Mesa Ads.")}
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
                  </div>
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
