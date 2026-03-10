import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Megaphone,
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  Banknote,
  Target,
  Tag,
  ExternalLink,
  Eye,
  Calendar,
  Hash,
  Plus,
  Link2,
  CircleDot,
  Package,
  Truck,
  Play,
  Radio,
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

const CAMPAIGN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CircleDot }> = {
  draft: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400 border-gray-500/30", icon: CircleDot },
  producao: { label: "Produção", color: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: Package },
  transito: { label: "Trânsito", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Truck },
  executar: { label: "Executando", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30", icon: Play },
  veiculacao: { label: "Em Veiculação", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: Radio },
  inativa: { label: "Finalizada", color: "bg-purple-500/10 text-purple-400 border-purple-500/30", icon: Archive },
};

const QUOTATION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  os_gerada: { label: "OS Gerada", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  win: { label: "Ganha", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  perdida: { label: "Perdida", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  expirada: { label: "Expirada", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
};

const INVOICE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  paid: { label: "Pago", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  cancelled: { label: "Cancelado", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

const OS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  assinada: { label: "Assinada", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  execucao: { label: "Em Execução", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  concluida: { label: "Concluída", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/clientes/:id");
  const clientId = match ? parseInt(params!.id) : 0;

  const [isLinkUserDialogOpen, setIsLinkUserDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  const utils = trpc.useUtils();
  const { data: client, isLoading } = trpc.advertiser.get.useQuery({ id: clientId }, { enabled: clientId > 0 });
  const { data: campaigns = [] } = trpc.advertiser.getCampaigns.useQuery({ clientId }, { enabled: clientId > 0 });
  const { data: quotationsData = [] } = trpc.advertiser.getQuotations.useQuery({ clientId }, { enabled: clientId > 0 });
  const { data: invoicesData = [] } = trpc.advertiser.getInvoices.useQuery({ clientId }, { enabled: clientId > 0 });
  const { data: serviceOrdersData = [] } = trpc.serviceOrder.list.useQuery({ clientId });
  const { data: linkedUsers = [] } = trpc.advertiser.getLinkedUsers.useQuery({ clientId }, { enabled: clientId > 0 });
  const { data: availableUsers = [] } = trpc.advertiser.listAvailableUsers.useQuery(undefined, { enabled: isLinkUserDialogOpen });

  const linkUserMutation = trpc.advertiser.linkUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário vinculado com sucesso!");
      utils.advertiser.getLinkedUsers.invalidate({ clientId });
      setIsLinkUserDialogOpen(false);
      setSelectedUserId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const activeCampaigns = useMemo(() =>
    campaigns.filter((c: any) => ["veiculacao", "executar", "producao", "transito"].includes(c.status)),
    [campaigns]
  );

  const totalRevenue = useMemo(() =>
    invoicesData.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0),
    [invoicesData]
  );

  const bonificadaCampaignIds = useMemo(() =>
    new Set(campaigns.filter((c: any) => c.isBonificada).map((c: any) => c.id)),
    [campaigns]
  );

  const pendingInvoices = useMemo(() =>
    invoicesData.filter((i: any) => i.status === "pending" || i.status === "overdue"),
    [invoicesData]
  );

  const conversionRate = useMemo(() => {
    if (quotationsData.length === 0) return 0;
    const won = quotationsData.filter((q: any) => q.status === "win").length;
    return Math.round((won / quotationsData.length) * 100);
  }, [quotationsData]);

  const handleImpersonate = () => {
    if (typeof window !== "undefined") {
      const imp = {
        role: "anunciante" as const,
        clientId,
        name: client?.name || `Cliente #${clientId}`,
      };
      (window as any).__IMPERSONATION__ = imp;
      window.dispatchEvent(new CustomEvent("impersonation-change", { detail: imp }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/clientes")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clientes")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {client.cnpj && (
                <Badge variant="outline" className="font-mono text-xs">{client.cnpj}</Badge>
              )}
              {client.segment && (
                <Badge className="bg-primary/10 text-primary border-primary/30">
                  <Tag className="w-3 h-3 mr-1" /> {client.segment}
                </Badge>
              )}
              <Badge className={client.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}>
                {client.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleImpersonate}>
          <Eye className="w-4 h-4" /> Entrar como Anunciante
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Receita Total" value={formatCurrency(totalRevenue)} color="bg-emerald-500/10 text-emerald-500" />
        <KpiCard icon={Megaphone} label="Campanhas Ativas" value={activeCampaigns.length} color="bg-blue-500/10 text-blue-500" />
        <KpiCard icon={FileText} label="Cotações" value={quotationsData.length} color="bg-purple-500/10 text-purple-500" />
        <KpiCard icon={Banknote} label="Faturas Pendentes" value={pendingInvoices.length} color="bg-amber-500/10 text-amber-500" />
      </div>

      <Tabs defaultValue="painel" className="w-full">
        <TabsList className="grid w-full grid-cols-7 h-10">
          <TabsTrigger value="painel" className="text-xs">Painel</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Informações</TabsTrigger>
          <TabsTrigger value="campanhas" className="text-xs">Campanhas</TabsTrigger>
          <TabsTrigger value="cotacoes" className="text-xs">Cotações</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
          <TabsTrigger value="os" className="text-xs">Ordens de Serviço</TabsTrigger>
          <TabsTrigger value="contas" className="text-xs">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Resumo Comercial</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total de Campanhas</span>
                  <span className="font-semibold">{campaigns.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total de Cotações</span>
                  <span className="font-semibold">{quotationsData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Taxa de Conversão</span>
                  <span className="font-semibold text-primary">{conversionRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Ordens de Serviço</span>
                  <span className="font-semibold">{serviceOrdersData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Campanhas Bonificadas</span>
                  <span className="font-semibold text-amber-400">{campaigns.filter((c: any) => c.isBonificada).length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-sm">Resumo Financeiro</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total Faturado</span>
                  <span className="font-semibold">{formatCurrency(invoicesData.reduce((s: number, i: any) => s + Number(i.amount || 0), 0))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total Pago</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total Pendente</span>
                  <span className="font-semibold text-amber-400">{formatCurrency(pendingInvoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Faturas Vencidas</span>
                  <span className="font-semibold text-red-400">{invoicesData.filter((i: any) => i.status === "overdue").length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Contato</h3>
              </div>
              <div className="space-y-2">
                <InfoRow label="E-mail" value={client.contactEmail} icon={Mail} />
                <InfoRow label="Telefone" value={client.contactPhone} icon={Phone} />
                <InfoRow label="Instagram" value={client.instagram} icon={Instagram} />
              </div>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" /> Campanhas Recentes
              </h3>
              <div className="space-y-2">
                {campaigns.slice(0, 5).map((c: any) => {
                  const cfg = CAMPAIGN_STATUS_CONFIG[c.status] || CAMPAIGN_STATUS_CONFIG.draft;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-background/50 hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => navigate(`/campanhas/${c.id}`)}>
                      <div className="flex items-center gap-3">
                        <StatusIcon className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.campaignNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.isBonificada && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
                        )}
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-1">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Dados da Empresa
              </h3>
              <InfoRow label="Nome Fantasia" value={client.name} icon={Building2} />
              <InfoRow label="Razão Social" value={client.razaoSocial || client.company} />
              <InfoRow label="CNPJ" value={client.cnpj} icon={Hash} />
              <InfoRow label="Segmento" value={client.segment} icon={Tag} />
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-1">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Endereço
              </h3>
              <InfoRow label="Logradouro" value={client.address ? `${client.address}${client.addressNumber ? `, ${client.addressNumber}` : ""}` : null} icon={MapPin} />
              <InfoRow label="Bairro" value={client.neighborhood} />
              <InfoRow label="Cidade / UF" value={client.city ? `${client.city}${client.state ? ` - ${client.state}` : ""}` : null} />
              <InfoRow label="CEP" value={client.cep} />
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-1 md:col-span-2">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
                <InfoRow label="E-mail" value={client.contactEmail} icon={Mail} />
                <InfoRow label="Telefone" value={client.contactPhone} icon={Phone} />
                <InfoRow label="Instagram" value={client.instagram} icon={Instagram} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="campanhas" className="mt-4">
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-primary" /> Campanhas ({campaigns.length})
              </h3>
            </div>
            {campaigns.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma campanha encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {campaigns.map((c: any) => {
                  const cfg = CAMPAIGN_STATUS_CONFIG[c.status] || CAMPAIGN_STATUS_CONFIG.draft;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-4 hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => navigate(`/campanhas/${c.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cfg.color}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono">{c.campaignNumber}</span>
                            {c.startDate && c.endDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {formatDate(c.startDate)} — {formatDate(c.endDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.isBonificada && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
                        )}
                        {c.totalValue && (
                          <span className="text-sm font-semibold">{formatCurrency(Number(c.totalValue))}</span>
                        )}
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cotacoes" className="mt-4">
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Cotações ({quotationsData.length})
              </h3>
            </div>
            {quotationsData.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma cotação encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {quotationsData.map((q: any) => {
                  const cfg = QUOTATION_STATUS_CONFIG[q.status] || QUOTATION_STATUS_CONFIG.rascunho;
                  return (
                    <div key={q.id} className="flex items-center justify-between p-4 hover:bg-accent/20 cursor-pointer transition-colors" onClick={() => navigate(`/comercial/cotacoes/${q.id}`)}>
                      <div>
                        <p className="font-medium text-sm">{q.quotationName || q.quotationNumber}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{q.quotationNumber}</span>
                          {q.coasterVolume && <span>{Number(q.coasterVolume).toLocaleString("pt-BR")} bolachas</span>}
                          {q.validUntil && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Válida até {formatDate(q.validUntil)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {q.isBonificada && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
                        )}
                        {q.totalValue && (
                          <span className="text-sm font-semibold">{formatCurrency(Number(q.totalValue))}</span>
                        )}
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Faturado</p>
              <p className="text-lg font-bold">{formatCurrency(invoicesData.reduce((s: number, i: any) => s + Number(i.amount || 0), 0))}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Pendente</p>
              <p className="text-lg font-bold text-amber-400">{formatCurrency(pendingInvoices.reduce((s: number, i: any) => s + Number(i.amount || 0), 0))}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Faturas Vencidas</p>
              <p className="text-lg font-bold text-red-400">{invoicesData.filter((i: any) => i.status === "overdue").length}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Faturas ({invoicesData.length})
              </h3>
            </div>
            {invoicesData.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">Nº Fatura</th>
                      <th className="text-left p-3 font-medium">Campanha</th>
                      <th className="text-right p-3 font-medium">Valor</th>
                      <th className="text-left p-3 font-medium">Emissão</th>
                      <th className="text-left p-3 font-medium">Vencimento</th>
                      <th className="text-left p-3 font-medium">Pagamento</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoicesData.map((inv: any) => {
                      const cfg = INVOICE_STATUS_CONFIG[inv.status] || INVOICE_STATUS_CONFIG.pending;
                      return (
                        <tr key={inv.id} className="hover:bg-accent/10 text-sm">
                          <td className="p-3 font-mono text-xs">{inv.invoiceNumber || `#${inv.id}`}</td>
                          <td className="p-3">{inv.campaignName || "—"}</td>
                          <td className="p-3 text-right font-semibold">{formatCurrency(Number(inv.amount || 0))}</td>
                          <td className="p-3 text-xs">{formatDate(inv.issueDate)}</td>
                          <td className="p-3 text-xs">{formatDate(inv.dueDate)}</td>
                          <td className="p-3 text-xs">{formatDate(inv.paymentDate)}</td>
                          <td className="p-3"><Badge className={cfg.color}>{cfg.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="os" className="mt-4">
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Ordens de Serviço ({serviceOrdersData.length})
              </h3>
            </div>
            {serviceOrdersData.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma ordem de serviço encontrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {serviceOrdersData.map((os: any) => {
                  const cfg = OS_STATUS_CONFIG[os.status] || OS_STATUS_CONFIG.rascunho;
                  return (
                    <div key={os.id} className="flex items-center justify-between p-4 hover:bg-accent/20 transition-colors">
                      <div>
                        <p className="font-medium text-sm font-mono">{os.orderNumber}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{os.type === "producao" ? "Produção" : "Anunciante"}</span>
                          {os.periodStart && os.periodEnd && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formatDate(os.periodStart)} — {formatDate(os.periodEnd)}
                            </span>
                          )}
                          {os.description && <span className="truncate max-w-[200px]">{os.description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {os.totalValue && (
                          <span className="text-sm font-semibold">{formatCurrency(Number(os.totalValue))}</span>
                        )}
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contas" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Usuários Vinculados ({linkedUsers.length})
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleImpersonate}>
                  <Eye className="w-4 h-4" /> Entrar como Anunciante
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setIsLinkUserDialogOpen(true)}>
                  <Plus className="w-4 h-4" /> Vincular Usuário
                </Button>
              </div>
            </div>
            {linkedUsers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum usuário vinculado</p>
                <p className="text-xs mt-1">Vincule usuários para que eles acessem o portal do anunciante</p>
              </div>
            ) : (
              <div className="divide-y">
                {linkedUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">{u.role}</Badge>
                      {u.lastLoginAt && (
                        <span className="text-xs text-muted-foreground">
                          Último login: {formatDate(u.lastLoginAt)}
                        </span>
                      )}
                      {u.isActive ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isLinkUserDialogOpen} onOpenChange={(open) => { if (!open) { setIsLinkUserDialogOpen(false); setSelectedUserId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" /> Vincular Usuário ao Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Selecione um usuário para vincular a <strong>{client.name}</strong>. O usuário receberá o papel de Anunciante.
            </p>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um usuário..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsLinkUserDialogOpen(false); setSelectedUserId(""); }}>
              Cancelar
            </Button>
            <Button
              disabled={!selectedUserId || linkUserMutation.isPending}
              onClick={() => linkUserMutation.mutate({ userId: selectedUserId, clientId })}
            >
              {linkUserMutation.isPending ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
