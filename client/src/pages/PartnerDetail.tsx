import { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Handshake,
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  Megaphone,
  Tag,
  Pencil,
  Hash,
  UserPlus,
  Send,
} from "lucide-react";

interface PartnerLead {
  id: number;
  name: string;
  company: string | null;
  type: string | null;
  stage: string | null;
  createdAt: string | null;
}

interface PartnerUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
}

const TYPE_LABELS: Record<string, string> = {
  agencia: "Agência",
  indicador: "Indicador",
  consultor: "Consultor",
};

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  contato: { label: "Contato", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  qualificado: { label: "Qualificado", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  proposta: { label: "Proposta", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  negociacao: { label: "Negociação", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  ganho: { label: "Ganho", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  perdido: { label: "Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
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

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: LucideIcon }) {
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

function KpiCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string | number; color: string }) {
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

export default function PartnerDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/comercial/parceiros/:id");
  const partnerId = match ? parseInt(params!.id) : 0;

  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "" });
  const [editForm, setEditForm] = useState({
    name: "",
    company: "",
    cnpj: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    type: "indicador" as "agencia" | "indicador" | "consultor",
    commissionPercent: "10.00",
    status: "active" as "active" | "inactive",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: partner, isLoading } = trpc.partner.get.useQuery({ id: partnerId }, { enabled: partnerId > 0 });
  const { data: partnerLeads = [] } = trpc.partner.getLeads.useQuery({ partnerId }, { enabled: partnerId > 0 });
  const { data: partnerQuotations = [] } = trpc.partner.getQuotations.useQuery({ partnerId }, { enabled: partnerId > 0 });
  const { data: revenueData } = trpc.partner.getRevenue.useQuery({ partnerId }, { enabled: partnerId > 0 });
  const { data: partnerUsers = [], refetch: refetchUsers } = trpc.parceiroPortal.getUsers.useQuery({ partnerId }, { enabled: partnerId > 0 });

  const updateMutation = trpc.partner.update.useMutation({
    onSuccess: () => {
      utils.partner.get.invalidate({ id: partnerId });
      setEditOpen(false);
      toast.success("Parceiro atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const inviteMutation = trpc.parceiroPortal.invitePartnerUser.useMutation({
    onSuccess: () => {
      setInviteOpen(false);
      setInviteForm({ email: "", firstName: "", lastName: "" });
      toast.success("Convite enviado com sucesso!");
      refetchUsers();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const totalRevenue = revenueData?.totalRevenue || 0;
  const activeCampaigns = revenueData?.activeCampaigns || 0;

  const wonQuotationsCount = useMemo(() =>
    partnerQuotations.filter((q) => q.status === "win").length,
    [partnerQuotations]
  );

  const openEdit = () => {
    if (!partner) return;
    setEditForm({
      name: partner.name,
      company: partner.company || "",
      cnpj: partner.cnpj || "",
      contactName: partner.contactName || "",
      contactPhone: partner.contactPhone || "",
      contactEmail: partner.contactEmail || "",
      type: partner.type,
      commissionPercent: partner.commissionPercent,
      status: partner.status,
      notes: partner.notes || "",
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateMutation.mutate({ id: partnerId, ...editForm });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Parceiro não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/comercial/parceiros")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/comercial/parceiros")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Handshake className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{partner.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {partner.company && (
                <Badge variant="outline" className="text-xs">{partner.company}</Badge>
              )}
              <Badge className="bg-primary/10 text-primary border-primary/30">
                <Tag className="w-3 h-3 mr-1" /> {TYPE_LABELS[partner.type] || partner.type}
              </Badge>
              <Badge className={partner.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}>
                {partner.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={openEdit}>
          <Pencil className="w-4 h-4" /> Editar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Faturamento Gerado" value={formatCurrency(totalRevenue)} color="bg-emerald-500/10 text-emerald-500" />
        <KpiCard icon={Users} label="Leads Indicados" value={partnerLeads.length} color="bg-blue-500/10 text-blue-500" />
        <KpiCard icon={FileText} label="Cotações" value={partnerQuotations.length} color="bg-purple-500/10 text-purple-500" />
        <KpiCard icon={Megaphone} label="Campanhas Ativas" value={activeCampaigns} color="bg-amber-500/10 text-amber-500" />
      </div>

      <Tabs defaultValue="painel" className="w-full">
        <TabsList className="h-10">
          <TabsTrigger value="painel" className="text-xs">Painel</TabsTrigger>
          <TabsTrigger value="leads" className="text-xs">Leads ({partnerLeads.length})</TabsTrigger>
          <TabsTrigger value="cotacoes" className="text-xs">Cotações ({partnerQuotations.length})</TabsTrigger>
          <TabsTrigger value="usuarios" className="text-xs">Usuários ({partnerUsers.length})</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Informações</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-sm">Resumo Comercial</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Leads Indicados</span>
                  <span className="font-semibold">{partnerLeads.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Cotações Geradas</span>
                  <span className="font-semibold">{partnerQuotations.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Cotações Ganhas</span>
                  <span className="font-semibold text-emerald-400">{wonQuotationsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Campanhas Ativas</span>
                  <span className="font-semibold text-primary">{activeCampaigns}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Comissão</span>
                  <span className="font-semibold">{partner.commissionPercent}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-sm">Faturamento</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Total Gerado</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Comissão Estimada</span>
                  <span className="font-semibold text-amber-400">
                    {formatCurrency(totalRevenue * Number(partner.commissionPercent) / 100)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Contato</h3>
              </div>
              <div className="space-y-2">
                <InfoRow label="Nome" value={partner.contactName} icon={Users} />
                <InfoRow label="Telefone" value={partner.contactPhone} icon={Phone} />
                <InfoRow label="E-mail" value={partner.contactEmail} icon={Mail} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            {partnerLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum lead associado a este parceiro.
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {(partnerLeads as PartnerLead[]).map((lead) => {
                  const stageCfg = STAGE_LABELS[lead.stage ?? ""] || { label: lead.stage ?? "—", color: "bg-gray-500/10 text-gray-400" };
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-4 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => navigate("/comercial/leads")}
                    >
                      <div>
                        <p className="text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.company || "—"} · {lead.type === "anunciante" ? "Anunciante" : "Restaurante"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={stageCfg.color}>
                          {stageCfg.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="cotacoes" className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            {partnerQuotations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhuma cotação associada a este parceiro.
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {partnerQuotations.map((q) => {
                  const statusCfg = QUOTATION_STATUS_CONFIG[q.status] || { label: q.status, color: "" };
                  return (
                    <div
                      key={q.id}
                      className="flex items-center justify-between p-4 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/comercial/cotacoes/${q.id}`)}
                    >
                      <div>
                        <p className="text-sm font-medium">{q.quotationNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.clientName || "—"} · {q.coasterVolume?.toLocaleString("pt-BR")} un.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {q.totalValue && (
                          <span className="text-sm font-mono font-medium">
                            {formatCurrency(Number(q.totalValue))}
                          </span>
                        )}
                        <Badge variant="outline" className={statusCfg.color}>
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Usuários vinculados a este parceiro</h3>
            <Button size="sm" className="gap-2" onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4" /> Convidar Usuário
            </Button>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            {partnerUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum usuário vinculado. Convide um usuário para dar acesso ao portal do parceiro.
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {(partnerUsers as PartnerUser[]).map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {u.firstName || u.email}
                        {u.lastName ? ` ${u.lastName}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs bg-primary/10 text-primary border-primary/30"
                      >
                        parceiro
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${u.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}
                      >
                        {u.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 space-y-1">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> Dados do Parceiro
              </h3>
              <InfoRow label="Nome" value={partner.name} icon={Handshake} />
              <InfoRow label="Empresa" value={partner.company} icon={Building2} />
              <InfoRow label="CNPJ" value={partner.cnpj} icon={Hash} />
              <InfoRow label="Tipo" value={TYPE_LABELS[partner.type] || partner.type} icon={Tag} />
              <InfoRow label="Comissão" value={`${partner.commissionPercent}%`} icon={DollarSign} />
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-1">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Contato
              </h3>
              <InfoRow label="Nome do Contato" value={partner.contactName} icon={Users} />
              <InfoRow label="Telefone" value={partner.contactPhone} icon={Phone} />
              <InfoRow label="E-mail" value={partner.contactEmail} icon={Mail} />
            </div>
            {partner.notes && (
              <div className="rounded-xl border bg-card p-5 md:col-span-2">
                <h3 className="font-semibold text-sm mb-3">Observações</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{partner.notes}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário do Parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O usuário receberá um convite por e-mail e terá acesso ao portal do parceiro com a comissão configurada.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sobrenome</Label>
                <Input
                  value={inviteForm.lastName}
                  onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                  placeholder="Sobrenome"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="usuario@empresa.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button
              className="gap-2"
              disabled={inviteMutation.isPending || !inviteForm.email.trim() || !inviteForm.firstName.trim()}
              onClick={() => inviteMutation.mutate({ email: inviteForm.email, firstName: inviteForm.firstName, lastName: inviteForm.lastName || undefined, partnerId })}
            >
              {inviteMutation.isPending ? "Enviando..." : <><Send className="w-4 h-4" /> Enviar Convite</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Empresa</Label>
                <Input
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={editForm.cnpj}
                  onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v as typeof editForm.type })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agencia">Agência</SelectItem>
                    <SelectItem value="indicador">Indicador</SelectItem>
                    <SelectItem value="consultor">Consultor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Contato</Label>
                <Input
                  value={editForm.contactName}
                  onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
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
              <Label>E-mail</Label>
              <Input
                value={editForm.contactEmail}
                onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Comissão (%)</Label>
                <Input
                  value={editForm.commissionPercent}
                  onChange={(e) => setEditForm({ ...editForm, commissionPercent: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as typeof editForm.status })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
