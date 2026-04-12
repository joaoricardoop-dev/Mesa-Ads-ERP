import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Users,
  Shield,
  ShieldCheck,
  UserCog,
  Search,
  UserX,
  UserCheck,
  Crown,
  Mail,
  Clock,
  CalendarDays,
  UserPlus,
  Send,
  XCircle,
  CheckCircle2,
  Hourglass,
  Ban,
  Building2,
  Store,
  Handshake,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  admin: {
    label: "Administrador",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: Crown,
  },
  comercial: {
    label: "Comercial",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: ShieldCheck,
  },
  operacoes: {
    label: "Operações",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: ShieldCheck,
  },
  financeiro: {
    label: "Financeiro",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    icon: ShieldCheck,
  },
  manager: {
    label: "Gerente",
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    icon: ShieldCheck,
  },
  restaurante: {
    label: "Local",
    color: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    icon: Shield,
  },
  anunciante: {
    label: "Anunciante",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: Shield,
  },
  parceiro: {
    label: "Parceiro",
    color: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    icon: Handshake,
  },
};

export default function Members() {
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    action: "activate" | "deactivate";
    userName: string;
  } | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [linkPartnerDialog, setLinkPartnerDialog] = useState<{
    userId: string;
    userName: string;
    currentPartnerId: number | null;
  } | null>(null);
  const [segment, setSegment] = useState<"internos" | "externos">("internos");
  const [createForm, setCreateForm] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    clientId: number | null;
    partnerId: number | null;
  }>({
    email: "",
    firstName: "",
    lastName: "",
    role: "comercial",
    clientId: null,
    partnerId: null,
  });




  const utils = trpc.useUtils();
  const { data: membersList = [], isLoading } = trpc.members.list.useQuery();
  const { data: clientsData } = trpc.advertiser.list.useQuery();
  const clientsList = clientsData?.items ?? [];
  const { data: partnersList = [] } = trpc.partner.list.useQuery();
  const { data: invitationsList = [], isLoading: isLoadingInvitations } = trpc.members.listInvitations.useQuery();

  const updateRoleMutation = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      toast.success("Papel atualizado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const toggleActiveMutation = trpc.members.toggleActive.useMutation({
    onSuccess: (_, variables) => {
      utils.members.list.invalidate();
      setConfirmAction(null);
      toast.success(variables.isActive ? "Membro desbanido com sucesso!" : "Membro banido com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const inviteUserMutation = trpc.members.inviteUser.useMutation({
    onSuccess: (data) => {
      utils.members.list.invalidate();
      utils.members.listInvitations.invalidate();
      setCreateDialogOpen(false);
      setCreateForm({ email: "", firstName: "", lastName: "", role: "comercial", clientId: null, partnerId: null });
      toast.success(`Convite enviado para ${data.email}! O usuário receberá um e-mail para criar sua conta.`);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const revokeInvitationMutation = trpc.members.revokeInvitation.useMutation({
    onSuccess: () => {
      utils.members.listInvitations.invalidate();
      toast.success("Convite revogado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updatePartnerMutation = trpc.members.updatePartner.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      setLinkPartnerDialog(null);
      toast.success("Vínculo de parceiro atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });




  const INTERNAL_ROLES = ["admin", "comercial", "operacoes", "financeiro", "manager"];
  const EXTERNAL_ROLES = ["anunciante", "restaurante", "parceiro"];

  const searchFiltered = membersList.filter(
    (m) =>
      (m.firstName || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.lastName || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const internos = searchFiltered.filter((m) => INTERNAL_ROLES.includes(m.role || ""));
  const externos = searchFiltered.filter((m) => EXTERNAL_ROLES.includes(m.role || ""));
  const filtered = segment === "internos" ? internos : externos;

  const internosTotal = membersList.filter((m) => INTERNAL_ROLES.includes(m.role || "")).length;
  const externosTotal = membersList.filter((m) => EXTERNAL_ROLES.includes(m.role || "")).length;
  const adminCount = membersList.filter((m) => m.role === "admin").length;
  const activeCount = membersList.filter((m) => m.isActive !== false).length;
  const inactiveCount = membersList.filter((m) => m.isActive === false).length;

  return (
    <PageContainer
      title="Gestão de Usuários"
      description="Cadastrar, gerenciar papéis e permissões dos usuários da plataforma"
      actions={
        <Button onClick={() => {
          setCreateForm({ email: "", firstName: "", lastName: "", role: "comercial", clientId: null, partnerId: null });
          setCreateDialogOpen(true);
        }}>
          <Send className="w-4 h-4 mr-2" />
          Convidar Usuário
        </Button>
      }
    >

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <p className="text-2xl font-bold font-mono">{membersList.length}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
            <p className="text-2xl font-bold font-mono text-amber-400">{adminCount}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
            <p className="text-2xl font-bold font-mono text-primary">{activeCount}</p>
          </div>
          <div className="bg-card border border-border/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <UserX className="w-4 h-4 text-red-400" />
              <p className="text-xs text-muted-foreground">Banidos</p>
            </div>
            <p className="text-2xl font-bold font-mono text-red-400">{inactiveCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-card border border-border/30 rounded-lg p-1">
            <button
              onClick={() => setSegment("internos")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${segment === "internos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Building2 className="w-4 h-4" />
              Internos
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{internosTotal}</Badge>
            </button>
            <button
              onClick={() => setSegment("externos")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${segment === "externos" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Store className="w-4 h-4" />
              Externos
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{externosTotal}</Badge>
            </button>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border/30"
            />
          </div>
        </div>

        <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_200px_160px_120px_120px] gap-4 px-4 py-3 border-b border-border/20 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Membro</p>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:block">Email</p>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Papel</p>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:block">Último Login</p>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"}
            </div>
          ) : (
            filtered.map((member) => {
              const roleConfig = ROLE_CONFIG[member.role || "comercial"] || ROLE_CONFIG.comercial;
              const isActive = member.isActive !== false;
              const RoleIcon = roleConfig.icon;

              return (
                <div
                  key={member.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_200px_160px_120px_120px] gap-4 px-4 py-3 border-b border-border/10 items-center hover:bg-muted/20 transition-colors ${!isActive ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {member.profileImageUrl ? (
                      <img
                        src={member.profileImageUrl}
                        alt=""
                        className="w-9 h-9 rounded-full border border-border/30 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                        {(member.firstName || member.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {member.firstName} {member.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate md:hidden">
                        {member.email}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          Desde {member.createdAt ? new Date(member.createdAt).toLocaleDateString("pt-BR") : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center">
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {member.email || "—"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Select
                      value={member.role || "comercial"}
                      onValueChange={(role) => {
                        updateRoleMutation.mutate({ userId: member.id, role });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs border-border/30 bg-background/50 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            <span className="flex items-center gap-1.5">
                              <config.icon className={`w-3 h-3 ${config.color.split(" ")[1]}`} />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {member.role === "parceiro" && (
                      <button
                        className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                        onClick={() => setLinkPartnerDialog({
                          userId: member.id,
                          userName: [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || member.id,
                          currentPartnerId: member.partnerId ?? null,
                        })}
                      >
                        <Handshake className="w-3 h-3" />
                        {member.partnerId
                          ? `Parceiro: ${partnersList.find((p) => p.id === member.partnerId)?.name || `#${member.partnerId}`}`
                          : "Vincular parceiro"}
                      </button>
                    )}
                  </div>

                  <div className="hidden md:flex items-center">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {member.lastLoginAt
                        ? formatDistanceToNow(new Date(member.lastLoginAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : "Nunca"}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 text-xs px-2 ${
                        isActive
                          ? "text-primary hover:text-red-400 hover:bg-red-500/10"
                          : "text-red-400 hover:text-primary hover:bg-primary/10"
                      }`}
                      onClick={() =>
                        setConfirmAction({
                          userId: member.id,
                          action: isActive ? "deactivate" : "activate",
                          userName: `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email || "Usuário",
                        })
                      }
                    >
                      {isActive ? (
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <UserX className="w-3.5 h-3.5" /> Banido
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {invitationsList.length > 0 && (
          <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20 bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Convites Enviados
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {invitationsList.filter((i) => i.status === "pending").length} pendente{invitationsList.filter((i) => i.status === "pending").length !== 1 ? "s" : ""}
                </Badge>
              </h3>
            </div>

            <div className="grid grid-cols-[1fr_140px_120px_100px] gap-4 px-4 py-2.5 border-b border-border/20 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Convidado</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Papel</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enviado</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Status</p>
            </div>

            {invitationsList.map((inv) => {
              const roleConfig = ROLE_CONFIG[inv.role || "comercial"] || ROLE_CONFIG.comercial;
              const statusMap: Record<string, { label: string; icon: typeof Clock; color: string }> = {
                pending: { label: "Pendente", icon: Hourglass, color: "text-amber-400" },
                accepted: { label: "Aceito", icon: CheckCircle2, color: "text-green-400" },
                revoked: { label: "Revogado", icon: Ban, color: "text-red-400" },
              };
              const statusConfig = statusMap[inv.status] || { label: inv.status, icon: Clock, color: "text-muted-foreground" };

              return (
                <div
                  key={inv.id}
                  className={`grid grid-cols-[1fr_140px_120px_100px] gap-4 px-4 py-3 border-b border-border/10 items-center hover:bg-muted/20 transition-colors ${inv.status === "revoked" ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      {inv.email}
                    </p>
                    {(inv.firstName || inv.lastName) && (
                      <p className="text-xs text-muted-foreground mt-0.5 pl-5">
                        {[inv.firstName, inv.lastName].filter(Boolean).join(" ")}
                      </p>
                    )}
                  </div>

                  <div>
                    <Badge variant="outline" className={`text-[10px] ${roleConfig.color}`}>
                      {roleConfig.label}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      {inv.createdAt
                        ? formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true, locale: ptBR })
                        : "—"}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    {inv.status === "pending" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-amber-400 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => revokeInvitationMutation.mutate({ invitationId: inv.id })}
                        disabled={revokeInvitationMutation.isPending}
                        title="Revogar convite"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Revogar
                      </Button>
                    ) : (
                      <span className={`flex items-center gap-1 text-xs ${statusConfig.color}`}>
                        <statusConfig.icon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-card/50 border border-border/30 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Permissões por Papel
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-background/50 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-amber-400">Administrador</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Acesso total a todos os módulos</li>
                <li>✓ Gestão de usuários e permissões</li>
                <li>✓ Dashboard completo</li>
                <li>✓ Configurações do sistema</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <h4 className="text-sm font-semibold text-green-400">Comercial</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Cotações (criar, marcar WIN)</li>
                <li>✓ Simulador</li>
                <li>✓ Leads / CRM</li>
                <li>✓ Cadastro de anunciantes</li>
                <li>✓ OS para anunciantes</li>
                <li>✓ Biblioteca</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-semibold text-blue-400">Operações</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Campanhas (todas as etapas)</li>
                <li>✓ OS de produção gráfica</li>
                <li>✓ Biblioteca</li>
                <li>✓ Provas de execução</li>
                <li>✓ Dashboard operacional</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-cyan-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <h4 className="text-sm font-semibold text-cyan-400">Financeiro</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Dashboard financeiro</li>
                <li>✓ Faturamento</li>
                <li>✓ Pagamentos</li>
                <li>✓ Custos operacionais</li>
                <li>✓ Relatórios</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-indigo-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-semibold text-indigo-400">Gerente</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Acesso a Comercial + Operações</li>
                <li>✓ Cotações e campanhas</li>
                <li>✓ Leads e OS</li>
                <li>✓ Dashboard financeiro</li>
                <li className="text-red-400/60">✗ Gestão de usuários</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-teal-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-teal-400" />
                <h4 className="text-sm font-semibold text-teal-400">Local</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Portal do restaurante</li>
                <li>✓ Ver campanhas vinculadas</li>
                <li>✓ Aceitar termos</li>
                <li>✓ Editar contato</li>
                <li className="text-red-400/60">✗ Acesso interno</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-orange-400" />
                <h4 className="text-sm font-semibold text-orange-400">Anunciante</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Portal do anunciante</li>
                <li>✓ Ver próprias campanhas</li>
                <li>✓ Solicitar novas campanhas</li>
                <li>✓ Editar perfil próprio</li>
                <li className="text-red-400/60">✗ Acesso interno</li>
              </ul>
            </div>
          </div>
        </div>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "deactivate"
                ? "Banir membro?"
                : "Desbanir membro?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "deactivate"
                ? `${confirmAction.userName} será banido e não poderá mais acessar a plataforma.`
                : `${confirmAction?.userName} será desbanido e terá o acesso restaurado.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction?.action === "deactivate"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
              onClick={() => {
                if (confirmAction) {
                  toggleActiveMutation.mutate({
                    userId: confirmAction.userId,
                    isActive: confirmAction.action === "activate",
                  });
                }
              }}
            >
              {confirmAction?.action === "deactivate" ? "Banir" : "Desbanir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-card border-border/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Convidar Usuário
            </DialogTitle>
            <DialogDescription>
              O usuário receberá um e-mail com um link para criar sua conta e definir a própria senha.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                placeholder="Nome"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sobrenome</Label>
              <Input
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                placeholder="Sobrenome"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid gap-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="usuario@empresa.com"
                className="bg-background border-border/30"
              />
            </div>
            <div className="grid gap-2">
              <Label>Papel</Label>
              <Select
                value={createForm.role}
                onValueChange={(role) => setCreateForm({ ...createForm, role })}
              >
                <SelectTrigger className="bg-background border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-1.5">
                        <config.icon className={`w-3 h-3 ${config.color.split(" ")[1]}`} />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createForm.role === "anunciante" && (
              <div className="grid gap-2">
                <Label>Anunciante vinculado</Label>
                <Select
                  value={createForm.clientId?.toString() || ""}
                  onValueChange={(val) => setCreateForm({ ...createForm, clientId: val ? parseInt(val) : null })}
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue placeholder="Selecione o anunciante..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientsList.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.company || c.name} {c.cnpj ? `(${c.cnpj})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  O anunciante verá apenas campanhas, cotações e faturas desta empresa.
                </p>
              </div>
            )}
            {createForm.role === "parceiro" && (
              <div className="grid gap-2">
                <Label>Parceiro vinculado</Label>
                <Select
                  value={createForm.partnerId?.toString() || ""}
                  onValueChange={(val) => setCreateForm({ ...createForm, partnerId: val ? parseInt(val) : null })}
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue placeholder="Selecione o parceiro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(partnersList as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name} {p.company ? `(${p.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  O parceiro acessa o portal com visibilidade restrita aos seus leads e cotações.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!createForm.email.trim() || !createForm.firstName.trim()) {
                  toast.error("Nome e e-mail são obrigatórios.");
                  return;
                }
                inviteUserMutation.mutate(createForm);
              }}
              disabled={inviteUserMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {inviteUserMutation.isPending ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={!!linkPartnerDialog} onOpenChange={(open) => { if (!open) setLinkPartnerDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Vincular Parceiro</DialogTitle>
            <DialogDescription>
              Altere o parceiro vinculado ao usuário <strong>{linkPartnerDialog?.userName}</strong>.
              Deixe em branco para remover o vínculo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Select
              value={linkPartnerDialog?.currentPartnerId?.toString() || "none"}
              onValueChange={(val) => {
                if (linkPartnerDialog) {
                  setLinkPartnerDialog({ ...linkPartnerDialog, currentPartnerId: val && val !== "none" ? parseInt(val) : null });
                }
              }}
            >
              <SelectTrigger className="bg-background border-border/30">
                <SelectValue placeholder="Selecione o parceiro..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem parceiro</SelectItem>
                {(partnersList as any[]).map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name} {p.company ? `(${p.company})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkPartnerDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!linkPartnerDialog) return;
                updatePartnerMutation.mutate({
                  userId: linkPartnerDialog.userId,
                  partnerId: linkPartnerDialog.currentPartnerId,
                });
              }}
              disabled={updatePartnerMutation.isPending}
            >
              {updatePartnerMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageContainer>
  );
}
