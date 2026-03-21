import { useClerk } from "@clerk/clerk-react";
import { LogOut, LayoutDashboard, Tag, Users, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import type { User } from "@shared/models/auth";
import type { Impersonation } from "@/App";

interface ParceiroLayoutProps {
  user: User | null;
  children: React.ReactNode;
  impersonation?: Impersonation;
  onExitImpersonation?: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Meus Leads", icon: Users },
  { href: "/tabela-precos", label: "Tabela de Preços", icon: Tag },
];

export function ParceiroLayout({ user, children, impersonation, onExitImpersonation }: ParceiroLayoutProps) {
  const { signOut } = useClerk();
  const { theme } = useTheme();
  const [location, navigate] = useLocation();

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Parceiro";

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "/portal";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {impersonation && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 shrink-0">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">
              Visualizando como <span className="font-bold">{impersonation.name}</span> — Parceiro
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

      <header className="h-14 border-b border-border/30 bg-card flex items-center px-6 shrink-0 z-10 gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={theme === "dark" ? "/logo-white.png" : "/logo-black.png"}
            alt="mesa.ads"
            className="h-5 shrink-0"
          />
          <span className="text-xs text-muted-foreground border-l border-border/30 pl-3 hidden sm:block">Portal do Parceiro</span>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive(href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground hidden sm:block">{displayName}</span>
          {!impersonation && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          )}
        </div>
      </header>

      <nav className="sm:hidden flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-card overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <button
            key={href}
            onClick={() => navigate(href)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 ${
              isActive(href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
