import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import { useClerk } from "@clerk/clerk-react";
import type { User } from "@shared/models/auth";
import type { Impersonation } from "../App";
import {
  BarChart3,
  Building2,
  Calculator,
  ChevronRight,
  DollarSign,
  Factory,
  FileBarChart,
  FileText,
  HandCoins,
  Image,
  LogOut,
  Megaphone,
  Pencil,
  PanelLeft,
  Receipt,
  Settings,
  Sun,
  Moon,
  UserCog,
  UtensilsCrossed,
  Users,
  Wallet,
  ClipboardList,
  Layers,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  adminOnly?: boolean;
  allowedRoles?: string[];
}

interface NavGroup {
  icon: LucideIcon;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  allowedRoles?: string[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

const ANUNCIANTE_NAV_ENTRIES: NavEntry[] = [
  { icon: BarChart3, label: "Meu Portal", path: "/" },
];

const RESTAURANTE_NAV_ENTRIES: NavEntry[] = [
  { icon: UtensilsCrossed, label: "Meu Portal", path: "/" },
];

const NAV_ENTRIES: NavEntry[] = [
  { icon: BarChart3, label: "Dashboard", path: "/" },
  {
    icon: DollarSign,
    label: "Comercial",
    items: [
      { icon: ClipboardList, label: "Cotações", path: "/comercial/cotacoes" },
      { icon: BarChart3, label: "Simulador", path: "/comercial/simulador" },
      { icon: Calculator, label: "Tabela de Preços", path: "/comercial/tabela-precos" },
      { icon: Users, label: "Leads", path: "/comercial/leads" },
    ],
  },
  { icon: Building2, label: "Anunciantes", path: "/clientes" },
  { icon: Megaphone, label: "Campanhas", path: "/campanhas" },
  {
    icon: Wallet,
    label: "Financeiro",
    allowedRoles: ["admin", "financeiro", "manager"],
    items: [
      { icon: BarChart3, label: "Dashboard", path: "/financeiro" },
      { icon: Receipt, label: "Faturamento", path: "/financeiro/faturamento" },
      { icon: HandCoins, label: "Pagamentos", path: "/financeiro/pagamentos" },
      { icon: Calculator, label: "Custos", path: "/financeiro/custos" },
      { icon: FileBarChart, label: "Relatórios", path: "/financeiro/relatorios" },
    ],
  },
  { icon: UtensilsCrossed, label: "Restaurantes", path: "/restaurantes" },
  { icon: Image, label: "Biblioteca", path: "/biblioteca" },
  {
    icon: Settings,
    label: "Configurações",
    items: [
      { icon: DollarSign, label: "Economics", path: "/economics" },
      { icon: Factory, label: "Produção", path: "/producao" },
      { icon: Layers, label: "Batches", path: "/configuracoes/batches", adminOnly: true },
      { icon: FileText, label: "Termos Padrão", path: "/configuracoes/termos", adminOnly: true },
      { icon: Users, label: "Gestão de Usuários", path: "/configuracoes/usuarios", adminOnly: true },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

interface DashboardLayoutProps {
  children: React.ReactNode;
  user?: User | null;
  impersonation?: Impersonation;
  onExitImpersonation?: () => void;
  onImpersonate?: (imp: Impersonation) => void;
}

export default function DashboardLayout({ children, user, impersonation, onExitImpersonation, onImpersonate }: DashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (!user) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent user={user} setSidebarWidth={setSidebarWidth} impersonation={impersonation} onExitImpersonation={onExitImpersonation}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  user,
  setSidebarWidth,
  impersonation,
  onExitImpersonation,
}: {
  children: React.ReactNode;
  user: User;
  setSidebarWidth: (w: number) => void;
  impersonation?: Impersonation;
  onExitImpersonation?: () => void;
}) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useClerk();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
  });
  const queryClient = useQueryClient();
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setProfileOpen(false);
      toast.success("Perfil atualizado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const activeLabel = findActiveLabel(location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-14 justify-center border-b border-border/20">
            <div className="flex items-center gap-2 px-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <img src="/logo-white.png" alt="mesa.ads" className="h-5 dark:block hidden" />
              )}
              {!isCollapsed && (
                <img src="/logo-black.png" alt="mesa.ads" className="h-5 dark:hidden block" />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-2">
            <SidebarMenu>
              {(user.role === "anunciante" ? ANUNCIANTE_NAV_ENTRIES : user.role === "restaurante" ? RESTAURANTE_NAV_ENTRIES : NAV_ENTRIES).map((entry) => {
                const userRole = user.role || "";
                const canSee = (item: { adminOnly?: boolean; allowedRoles?: string[] }) => {
                  if (item.adminOnly && userRole !== "admin") return false;
                  if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return false;
                  return true;
                };

                if (isGroup(entry)) {
                  if (!canSee(entry)) return null;
                  const visibleItems = entry.items.filter(canSee);
                  if (visibleItems.length === 0) return null;
                  const groupActive = visibleItems.some((i) => location === i.path || location.startsWith(i.path + "/"));

                  return (
                    <NavGroupItem
                      key={entry.label}
                      group={{ ...entry, items: visibleItems }}
                      location={location}
                      navigate={setLocation}
                      isActive={groupActive}
                    />
                  );
                }

                if (!canSee(entry)) return null;
                const isActive = location === entry.path;
                return (
                  <SidebarMenuItem key={entry.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(entry.path)}
                      tooltip={entry.label}
                      className="h-9 transition-all font-normal text-sm"
                    >
                      <entry.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{entry.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt=""
                      className="h-8 w-8 rounded-full border border-border/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Avatar className="h-8 w-8 border shrink-0">
                      <AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">
                        {(user.firstName || user.email || "U")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user.firstName || user.email || "-"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate mt-1">
                      {{admin: "Administrador", comercial: "Comercial", operacoes: "Operações", financeiro: "Financeiro", manager: "Gerente", anunciante: "Anunciante", restaurante: "Restaurante"}[user.role || ""] || user.role || "—"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    setProfileForm({
                      firstName: user.firstName || "",
                      lastName: user.lastName || "",
                    });
                    setProfileOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-1 group-data-[collapsible=icon]:hidden">
              v{__APP_VERSION__} · {__APP_ENV__}
            </p>
          </SidebarFooter>

          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent className="bg-card border-border/30 max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-primary" />
                  Meu Perfil
                </DialogTitle>
                <DialogDescription>
                  Atualize suas informações pessoais.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>E-mail</Label>
                  <Input
                    value={user.email || ""}
                    disabled
                    className="bg-muted border-border/30 text-muted-foreground"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    O e-mail não pode ser alterado por aqui.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Nome *</Label>
                  <Input
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    placeholder="Nome"
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Sobrenome</Label>
                  <Input
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    placeholder="Sobrenome"
                    className="bg-background border-border/30"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProfileOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!profileForm.firstName.trim()) {
                      toast.error("O nome é obrigatório.");
                      return;
                    }
                    updateProfileMutation.mutate({
                      firstName: profileForm.firstName.trim(),
                      lastName: profileForm.lastName.trim() || undefined,
                    });
                  }}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (!isCollapsed) setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {impersonation && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                Visualizando como <span className="font-bold">{impersonation.name}</span> — {impersonation.role === "restaurante" ? "Restaurante" : "Anunciante"}
              </span>
            </div>
            <button
              onClick={onExitImpersonation}
              className="text-xs px-3 py-1 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors font-medium"
            >
              Voltar para minha visão
            </button>
          </div>
        )}
        <div className="flex border-b border-border/30 h-12 items-center justify-between bg-card/30 backdrop-blur px-3 sticky top-0 z-40 flex-shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-8 w-8 rounded-lg" />}
            <span className="text-sm font-medium text-muted-foreground">{activeLabel}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <main className="flex-1 overflow-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}

function NavGroupItem({
  group,
  location,
  navigate,
  isActive,
}: {
  group: NavGroup;
  location: string;
  navigate: (path: string) => void;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(isActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={group.label}
            className="h-9 transition-all font-normal text-sm"
          >
            <group.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
            <span className={isActive ? "font-medium" : ""}>{group.label}</span>
            <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {group.items.map((item) => {
              const itemActive = location === item.path || location.startsWith(item.path + "/");
              return (
                <SidebarMenuSubItem key={item.path}>
                  <SidebarMenuSubButton
                    onClick={() => navigate(item.path)}
                    isActive={itemActive}
                    className="text-sm"
                  >
                    <item.icon className={`h-3.5 w-3.5 ${itemActive ? "text-primary" : ""}`} />
                    <span>{item.label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function findActiveLabel(location: string): string {
  for (const entry of [...NAV_ENTRIES, ...ANUNCIANTE_NAV_ENTRIES, ...RESTAURANTE_NAV_ENTRIES]) {
    if (isGroup(entry)) {
      for (const item of entry.items) {
        if (location === item.path || location.startsWith(item.path + "/")) {
          return `${entry.label} / ${item.label}`;
        }
      }
    } else if (location === entry.path) {
      return entry.label;
    }
  }
  return "";
}
