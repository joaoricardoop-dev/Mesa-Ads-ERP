import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Pencil,
  Trash2,
  Star,
  Network,
  UserPlus,
  Search,
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
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", role: "", notes: "", isPrimary: false });
  const [linkParentOpen, setLinkParentOpen] = useState(false);
  const [linkChildOpen, setLinkChildOpen] = useState(false);
  const [createChildOpen, setCreateChildOpen] = useState(false);
  const [createChildForm, setCreateChildForm] = useState({ name: "", cnpj: "", contactEmail: "", contactPhone: "" });
  const [parentSearch, setParentSearch] = useState("");
  const [childSearch, setChildSearch] = useState("");
  const [includeChildContacts, setIncludeChildContacts] = useState(false);

  const utils = trpc.useUtils();
  const { data: client, isLoading } = trpc.advertiser.get.useQuery({ id: clientId }, { enabled: clientId > 0 });
  const { data: childClients = [] } = trpc.advertiser.getChildren.useQuery({ clientId }, { enabled: clientId > 0 });
  const isParent = childClients.length > 0;
  const { data: campaigns = [] } = trpc.advertiser.getCampaigns.useQuery({ clientId, includeChildren: isParent }, { enabled: clientId > 0 });
  const { data: quotationsData = [] } = trpc.advertiser.getQuotations.useQuery({ clientId, includeChildren: isParent }, { enabled: clientId > 0 });
  const { data: invoicesData = [] } = trpc.advertiser.getInvoices.useQuery({ clientId, includeChildren: isParent }, { enabled: clientId > 0 });
  const { data: serviceOrdersData = [] } = trpc.serviceOrder.list.useQuery({ clientId });
  const { data: linkedUsers = [] } = trpc.advertiser.getLinkedUsers.useQuery({ clientId }, { enabled: clientId > 0 });
  const { data: availableUsers = [] } = trpc.advertiser.listAvailableUsers.useQuery(undefined, { enabled: isLinkUserDialogOpen });
  const { data: contactsList = [] } = trpc.contact.list.useQuery({ clientId }, { enabled: clientId > 0 });
  const childIds = useMemo(() => (childClients as any[]).map((c: any) => c.id), [childClients]);
  const { data: childContactsList = [] } = trpc.contact.listByClients.useQuery(
    { clientIds: childIds },
    { enabled: includeChildContacts && childIds.length > 0 }
  );
  const displayedContacts = useMemo(() => {
    if (!includeChildContacts) return contactsList;
    return [...contactsList, ...childContactsList];
  }, [contactsList, childContactsList, includeChildContacts]);
  const { data: parentClient } = trpc.advertiser.getParent.useQuery(
    { parentId: client?.parentId! },
    { enabled: !!client?.parentId }
  );
  const { data: allClients = [] } = trpc.advertiser.list.useQuery(undefined, { enabled: linkParentOpen || linkChildOpen });

  const linkUserMutation = trpc.advertiser.linkUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário vinculado com sucesso!");
      utils.advertiser.getLinkedUsers.invalidate({ clientId });
      setIsLinkUserDialogOpen(false);
      setSelectedUserId("");
    },
    onError: (e) => toast.error(e.message),
  });

  const createContactMutation = trpc.contact.create.useMutation({
    onSuccess: () => {
      toast.success("Contato adicionado!");
      utils.contact.list.invalidate({ clientId });
      setContactDialogOpen(false);
      setContactForm({ name: "", email: "", phone: "", role: "", notes: "", isPrimary: false });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateContactMutation = trpc.contact.update.useMutation({
    onSuccess: () => {
      toast.success("Contato atualizado!");
      utils.contact.list.invalidate({ clientId });
      setContactDialogOpen(false);
      setEditingContactId(null);
      setContactForm({ name: "", email: "", phone: "", role: "", notes: "", isPrimary: false });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteContactMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      toast.success("Contato removido!");
      utils.contact.list.invalidate({ clientId });
    },
    onError: (e) => toast.error(e.message),
  });

  const setParentMutation = trpc.advertiser.setParent.useMutation({
    onSuccess: () => {
      toast.success("Hierarquia atualizada!");
      utils.advertiser.get.invalidate({ id: clientId });
      utils.advertiser.getChildren.invalidate({ clientId });
      setLinkParentOpen(false);
      setLinkChildOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createChildMutation = trpc.advertiser.create.useMutation({
    onSuccess: () => {
      toast.success("Filial criada com sucesso!");
      utils.advertiser.getChildren.invalidate({ clientId });
      setCreateChildOpen(false);
      setCreateChildForm({ name: "", cnpj: "", contactEmail: "", contactPhone: "" });
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

      {parentClient && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-blue-500/5 border-blue-500/20">
          <Network className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-400">
            Filial de{" "}
            <button className="font-semibold underline hover:no-underline" onClick={() => navigate(`/clientes/${parentClient.id}`)}>
              {parentClient.name}
            </button>
          </span>
        </div>
      )}

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
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full h-10">
            <TabsTrigger value="painel" className="text-xs">Painel</TabsTrigger>
            <TabsTrigger value="info" className="text-xs">Informações</TabsTrigger>
            <TabsTrigger value="campanhas" className="text-xs">Campanhas</TabsTrigger>
            <TabsTrigger value="cotacoes" className="text-xs">Cotações</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="contatos" className="text-xs">Contatos</TabsTrigger>
            <TabsTrigger value="filiais" className="text-xs">Filiais</TabsTrigger>
            <TabsTrigger value="os" className="text-xs">Ordens</TabsTrigger>
            <TabsTrigger value="contas" className="text-xs">Contas</TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="contatos" className="mt-4">
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-semibold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" /> Contatos ({displayedContacts.length})
              </h3>
              <div className="flex items-center gap-3">
                {childClients.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox checked={includeChildContacts} onCheckedChange={(v) => setIncludeChildContacts(!!v)} />
                    Incluir filiais
                  </label>
                )}
                <Button size="sm" className="gap-2" onClick={() => {
                  setEditingContactId(null);
                  setContactForm({ name: "", email: "", phone: "", role: "", notes: "", isPrimary: false });
                  setContactDialogOpen(true);
                }}>
                  <Plus className="w-4 h-4" /> Novo Contato
                </Button>
              </div>
            </div>
            {displayedContacts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum contato cadastrado</p>
                <p className="text-xs mt-1">Adicione contatos para este cliente</p>
              </div>
            ) : (
              <div className="divide-y">
                {displayedContacts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-4 hover:bg-accent/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {c.name[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.isPrimary && (
                            <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] px-1.5 py-0">
                              <Star className="w-3 h-3 mr-0.5" /> Principal
                            </Badge>
                          )}
                          {c.role && (
                            <Badge variant="outline" className="text-[10px]">{c.role}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                          {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
                          {c.clientId !== clientId && c.clientName && (
                            <span className="flex items-center gap-1 text-blue-400"><Building2 className="w-3 h-3" /> {c.clientName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditingContactId(c.id);
                        setContactForm({ name: c.name, email: c.email || "", phone: c.phone || "", role: c.role || "", notes: c.notes || "", isPrimary: c.isPrimary });
                        setContactDialogOpen(true);
                      }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteContactMutation.mutate({ id: c.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="filiais" className="mt-4 space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" /> Hierarquia
              </h3>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { setParentSearch(""); setLinkParentOpen(true); }}>
                <Link2 className="w-4 h-4" /> Vincular Matriz
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {client?.parentId && parentClient ? (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-blue-500/5 border-blue-500/20">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Matriz</p>
                      <button className="text-sm font-medium text-blue-400 hover:underline" onClick={() => navigate(`/clientes/${parentClient.id}`)}>
                        {parentClient.name}
                      </button>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setParentMutation.mutate({ clientId, parentId: null })}>
                    Desvincular
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma matriz vinculada.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Filiais ({childClients.length})
              </h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setChildSearch(""); setLinkChildOpen(true); }}>
                  <Link2 className="w-4 h-4" /> Vincular Existente
                </Button>
                <Button size="sm" className="gap-2" onClick={() => { setCreateChildForm({ name: "", cnpj: "", contactEmail: "", contactPhone: "" }); setCreateChildOpen(true); }}>
                  <Plus className="w-4 h-4" /> Nova Filial
                </Button>
              </div>
            </div>
            {childClients.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma filial vinculada</p>
              </div>
            ) : (
              <div className="divide-y">
                {childClients.map((child: any) => (
                  <div key={child.id} className="flex items-center justify-between p-4 hover:bg-accent/20 transition-colors">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/clientes/${child.id}`)}>
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{child.name}</p>
                        <p className="text-xs text-muted-foreground">{child.cnpj || "Sem CNPJ"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={child.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}>
                        {child.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setParentMutation.mutate({ clientId: child.id, parentId: null })}>
                        Desvincular
                      </Button>
                      <button onClick={() => navigate(`/clientes/${child.id}`)}><ExternalLink className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  </div>
                ))}
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

      <Dialog open={contactDialogOpen} onOpenChange={(open) => { if (!open) { setContactDialogOpen(false); setEditingContactId(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              {editingContactId ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Nome do contato" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Cargo / Função</Label>
              <Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} placeholder="Ex: Diretor de Marketing" />
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Notas sobre o contato" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={contactForm.isPrimary} onCheckedChange={(v) => setContactForm({ ...contactForm, isPrimary: !!v })} id="isPrimary" />
              <Label htmlFor="isPrimary" className="text-sm font-normal">Contato principal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!contactForm.name.trim() || createContactMutation.isPending || updateContactMutation.isPending}
              onClick={() => {
                if (editingContactId) {
                  updateContactMutation.mutate({ id: editingContactId, ...contactForm });
                } else {
                  createContactMutation.mutate({ clientId, ...contactForm });
                }
              }}
            >
              {(createContactMutation.isPending || updateContactMutation.isPending) ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkParentOpen} onOpenChange={setLinkParentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" /> Vincular Matriz
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={parentSearch} onChange={(e) => setParentSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {allClients
                .filter((c: any) => c.id !== clientId && c.name.toLowerCase().includes(parentSearch.toLowerCase()))
                .slice(0, 20)
                .map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-sm flex items-center justify-between"
                    onClick={() => setParentMutation.mutate({ clientId, parentId: c.id })}
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.cnpj || "Sem CNPJ"}</p>
                    </div>
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createChildOpen} onOpenChange={setCreateChildOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Nova Filial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={createChildForm.name} onChange={(e) => setCreateChildForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da filial" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={createChildForm.cnpj} onChange={(e) => setCreateChildForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={createChildForm.contactEmail} onChange={(e) => setCreateChildForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={createChildForm.contactPhone} onChange={(e) => setCreateChildForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="(00) 00000-0000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateChildOpen(false)}>Cancelar</Button>
            <Button
              disabled={!createChildForm.name.trim() || createChildMutation.isPending}
              onClick={() => createChildMutation.mutate({
                name: createChildForm.name.trim(),
                cnpj: createChildForm.cnpj || undefined,
                contactEmail: createChildForm.contactEmail || undefined,
                contactPhone: createChildForm.contactPhone || undefined,
                parentId: clientId,
              })}
            >
              {createChildMutation.isPending ? "Criando..." : "Criar Filial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkChildOpen} onOpenChange={setLinkChildOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> Vincular Filial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={childSearch} onChange={(e) => setChildSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {allClients
                .filter((c: any) => c.id !== clientId && !c.parentId && c.name.toLowerCase().includes(childSearch.toLowerCase()))
                .slice(0, 20)
                .map((c: any) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors text-sm flex items-center justify-between"
                    onClick={() => setParentMutation.mutate({ clientId: c.id, parentId: clientId })}
                  >
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.cnpj || "Sem CNPJ"}</p>
                    </div>
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
