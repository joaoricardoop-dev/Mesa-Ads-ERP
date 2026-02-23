import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Store,
  Building2,
  Megaphone,
  DollarSign,
  Factory,
  Sun,
  Moon,
  Search,
  UtensilsCrossed,
  LogOut,
  UserCog,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { User } from "@shared/models/auth";

const NAV_ITEMS = [
  { path: "/", label: "Simulador", icon: BarChart3 },
  { path: "/prospeccao", label: "Prospecção", icon: Search },
  { path: "/restaurantes", label: "Restaurantes", icon: UtensilsCrossed },
  { path: "/clientes", label: "Clientes", icon: Building2 },
  { path: "/campanhas", label: "Campanhas", icon: Megaphone },
  { path: "/economics", label: "Economics", icon: DollarSign },
  { path: "/producao", label: "Produção", icon: Factory },
];

const ADMIN_NAV_ITEMS = [
  { path: "/membros", label: "Membros", icon: UserCog },
];

interface AppNavProps {
  user?: User | null;
}

export default function AppNav({ user }: AppNavProps) {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-border/30 bg-card/80 backdrop-blur-md flex-shrink-0 z-50">
      <div className="flex items-center justify-between px-4 lg:px-6 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Megaphone className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Mesa Ads</h1>
            <p className="text-[10px] text-muted-foreground">
              Plataforma de Gestão
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`text-xs gap-1.5 ${
                    isActive ? "text-primary bg-primary/10" : ""
                  }`}
                  onClick={() => navigate(item.path)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{item.label}</span>
                </Button>
              );
            })}
            {user?.role === "admin" &&
              ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    size="sm"
                    className={`text-xs gap-1.5 ${
                      isActive ? "text-primary bg-primary/10" : ""
                    }`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Button>
                );
              })}
          </nav>

          <div className="w-px h-5 bg-border/50 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 p-0"
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </Button>

          {user && (
            <>
              <div className="w-px h-5 bg-border/50 mx-1" />
              <div className="flex items-center gap-2">
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="w-7 h-7 rounded-full border border-border/30"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {(user.firstName || user.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden lg:inline text-xs text-muted-foreground max-w-[100px] truncate">
                  {user.firstName || user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-muted-foreground hover:text-destructive"
                  asChild
                >
                  <a href="/api/logout" title="Sair">
                    <LogOut className="w-3.5 h-3.5" />
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
