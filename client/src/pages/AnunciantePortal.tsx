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
  Eye,
  CircleDot,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Package,
  Truck,
  Play,
  Radio,
  Archive,
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

const quotationStatusConfig: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-500" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-500" },
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-500" },
  os_gerada: { label: "OS Gerada", color: "bg-purple-500/10 text-purple-500" },
  win: { label: "Aprovada", color: "bg-emerald-500/10 text-emerald-700" },
  perdida: { label: "Perdida", color: "bg-red-500/10 text-red-500" },
  expirada: { label: "Expirada", color: "bg-gray-500/10 text-gray-400" },
};

const invoiceStatusConfig: Record<string, { label: string; color: string }> = {
  emitida: { label: "Emitida", color: "bg-blue-500/10 text-blue-500" },
  paga: { label: "Paga", color: "bg-emerald-500/10 text-emerald-500" },
  vencida: { label: "Vencida", color: "bg-red-500/10 text-red-500" },
  cancelada: { label: "Cancelada", color: "bg-gray-500/10 text-gray-400" },
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

export default function AnunciantePortal() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = trpc.portal.myProfile.useQuery();
  const { data: campaigns = [] } = trpc.portal.myCampaigns.useQuery();
  const { data: quotations = [] } = trpc.portal.myQuotations.useQuery();
  const { data: invoices = [] } = trpc.portal.myInvoices.useQuery();

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

  const activeCampaigns = campaigns.filter((c: any) => ["veiculacao", "active", "executar", "producao", "transito"].includes(c.status));
  const totalInvoiced = invoices
    .filter((i: any) => i.status !== "cancelada")
    .reduce((sum: number, i: any) => sum + (parseFloat(i.amount) || 0), 0);
  const pendingInvoices = invoices.filter((i: any) => i.status === "emitida" || i.status === "vencida");

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        <Tabs defaultValue="campaigns" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="w-4 h-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="quotations" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Cotações
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
            <Card>
              <CardHeader>
                <CardTitle>Minhas Campanhas</CardTitle>
                <CardDescription>Acompanhe o status das suas campanhas de mídia em bolachas de chopp</CardDescription>
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
                  />
                </div>
              </div>
              <div className="space-y-2 max-w-[180px]">
                <Label>CEP</Label>
                <Input
                  value={editForm.cep}
                  onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })}
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
