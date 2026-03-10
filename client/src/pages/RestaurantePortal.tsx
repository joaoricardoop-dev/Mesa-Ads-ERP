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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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

export default function RestaurantePortal() {
  const { user } = useAuth();
  const { data: restaurant, isLoading } = trpc.restaurantePortal.myRestaurant.useQuery();
  const { data: campaigns = [] } = trpc.restaurantePortal.myCampaigns.useQuery();
  const { data: terms = [] } = trpc.restaurantePortal.myTerms.useQuery();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    contactName: "",
    whatsapp: "",
    email: "",
    financialEmail: "",
    instagram: "",
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

  const activeCampaigns = campaigns.filter((c: any) =>
    ["veiculacao", "active", "executar", "producao", "transito"].includes(c.status)
  );
  const signedTerms = terms.filter((t: any) => t.status === "assinado" || t.status === "vigente");

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
          <h2 className="text-xl font-semibold">Portal do Restaurante</h2>
          <p className="text-muted-foreground">
            Seu perfil ainda não foi vinculado a um restaurante. Entre em contato com a equipe Mesa Ads.
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
            <h1 className="text-2xl font-bold">Portal do Restaurante</h1>
            <p className="text-muted-foreground">
              Bem-vindo, {user?.firstName || restaurant.contactName || restaurant.name}
            </p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {restaurant.name}
          </Badge>
        </div>

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
                  <p className="text-2xl font-bold">{signedTerms.length}</p>
                  <p className="text-xs text-muted-foreground">Termos assinados</p>
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
                <CardDescription>Campanhas em veiculação ou programadas para o seu restaurante</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma campanha encontrada</p>
                    <p className="text-sm mt-1">As campanhas aparecerão aqui quando forem vinculadas ao seu restaurante</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {campaigns.map((campaign: any) => {
                      const cfg = campaignStatusConfig[campaign.status] || campaignStatusConfig.draft;
                      const Icon = cfg.icon;
                      return (
                        <div key={campaign.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
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
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Termos de Parceria</CardTitle>
                <CardDescription>Termos aceitos e status da parceria</CardDescription>
              </CardHeader>
              <CardContent>
                {terms.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhum termo encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {terms.map((term: any) => {
                      const cfg = termStatusConfig[term.status] || termStatusConfig.rascunho;
                      return (
                        <div key={term.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                          <div>
                            <p className="font-medium font-mono text-sm">{term.termNumber}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>Vigência: {formatDate(term.validFrom)} — {formatDate(term.validUntil)}</span>
                            </div>
                          </div>
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meu Restaurante</CardTitle>
                    <CardDescription>Dados cadastrais do estabelecimento</CardDescription>
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
      </div>
    </div>
  );
}
