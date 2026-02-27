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
  user: {
    label: "Usuário",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    icon: Shield,
  },
  viewer: {
    label: "Visualizador",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    icon: Shield,
  },
  anunciante: {
    label: "Anunciante",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: Shield,
  },
};

export default function Members() {
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    action: "activate" | "deactivate";
    userName: string;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: membersList = [], isLoading } = trpc.members.list.useQuery();

  const updateRoleMutation = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      toast.success("Papel atualizado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const toggleActiveMutation = trpc.members.toggleActive.useMutation({
    onSuccess: () => {
      utils.members.list.invalidate();
      setConfirmAction(null);
      toast.success("Status do membro atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const filtered = membersList.filter(
    (m) =>
      (m.firstName || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.lastName || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const adminCount = membersList.filter((m) => m.role === "admin").length;
  const activeCount = membersList.filter((m) => m.isActive !== false).length;
  const inactiveCount = membersList.filter((m) => m.isActive === false).length;

  return (
    <PageContainer
      title="Membros"
      description="Gestão de usuários e permissões"
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
              <p className="text-xs text-muted-foreground">Inativos</p>
            </div>
            <p className="text-2xl font-bold font-mono text-red-400">{inactiveCount}</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/30"
          />
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
              const roleConfig = ROLE_CONFIG[member.role || "user"] || ROLE_CONFIG.user;
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

                  <div>
                    <Select
                      value={member.role || "user"}
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

                  <div className="flex justify-center">
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
                          <UserX className="w-3.5 h-3.5" /> Inativo
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

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
            <div className="bg-background/50 border border-gray-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-400">Usuário</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Visualizar dashboard</li>
                <li>✓ Simulador de preços</li>
                <li>✓ Visualizar campanhas</li>
                <li className="text-red-400/60">✗ Criar/editar registros</li>
                <li className="text-red-400/60">✗ Módulos financeiros</li>
              </ul>
            </div>
            <div className="bg-background/50 border border-purple-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-semibold text-purple-400">Visualizador</h4>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>✓ Visualizar campanhas</li>
                <li>✓ Visualizar restaurantes</li>
                <li>✓ Visualizar clientes</li>
                <li className="text-red-400/60">✗ Criar ou editar</li>
                <li className="text-red-400/60">✗ Módulos financeiros</li>
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
                ? "Desativar membro?"
                : "Reativar membro?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "deactivate"
                ? `${confirmAction.userName} não poderá mais acessar a plataforma.`
                : `${confirmAction?.userName} terá o acesso restaurado à plataforma.`}
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
              {confirmAction?.action === "deactivate" ? "Desativar" : "Reativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
