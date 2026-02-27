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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { User } from "@shared/models/auth";
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
  PanelLeft,
  Receipt,
  Search,
  Settings,
  Sun,
  Moon,
  UserCog,
  UtensilsCrossed,
  Users,
  Wallet,
  ClipboardList,
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

const NAV_ENTRIES: NavEntry[] = [
  { icon: BarChart3, label: "Dashboard", path: "/" },
  {
    icon: DollarSign,
    label: "Comercial",
    items: [
      { icon: ClipboardList, label: "Cotações", path: "/comercial/cotacoes" },
      { icon: BarChart3, label: "Simulador", path: "/comercial/simulador" },
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
  {
    icon: UtensilsCrossed,
    label: "Parceiros",
    items: [
      { icon: Search, label: "Prospecção", path: "/prospeccao" },
      { icon: UtensilsCrossed, label: "Restaurantes", path: "/restaurantes" },
    ],
  },
  { icon: Image, label: "Biblioteca", path: "/biblioteca" },
  {
    icon: Settings,
    label: "Configurações",
    items: [
      { icon: DollarSign, label: "Economics", path: "/economics" },
      { icon: Factory, label: "Produção", path: "/producao" },
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
}

export default function DashboardLayout({ children, user }: DashboardLayoutProps) {
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
      <DashboardLayoutContent user={user} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  user,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  user: User;
  setSidebarWidth: (w: number) => void;
}) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

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
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-display-landing text-sm font-extrabold tracking-tight">Mesa</span>
                  <span className="bg-brand text-white font-display-landing font-bold text-[9px] px-1.5 py-0.5 rounded-md leading-none">
                    Ads
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-2">
            <SidebarMenu>
              {NAV_ENTRIES.map((entry) => {
                const userRole = user.role || "user";
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
                      {{admin: "Administrador", comercial: "Comercial", operacoes: "Operações", financeiro: "Financeiro", manager: "Gerente", viewer: "Visualizador", anunciante: "Anunciante", user: "Usuário"}[user.role || "user"] || "Usuário"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild className="cursor-pointer text-destructive focus:text-destructive">
                  <a href="/api/logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
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
  for (const entry of NAV_ENTRIES) {
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
