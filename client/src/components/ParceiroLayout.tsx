import { useClerk } from "@clerk/clerk-react";
import { LogOut, LayoutDashboard, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import type { User } from "@shared/models/auth";

interface ParceiroLayoutProps {
  user: User | null;
  children: React.ReactNode;
}

export function ParceiroLayout({ user, children }: ParceiroLayoutProps) {
  const { signOut } = useClerk();
  const { theme } = useTheme();
  const [location, navigate] = useLocation();

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Parceiro";

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tabela-precos", label: "Tabela de Preços", icon: Tag },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "/portal";
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border/30 bg-card flex items-center px-6 shrink-0 z-10 gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={theme === "dark" ? "/logo-white.png" : "/logo-black.png"}
            alt="mesa.ads"
            className="h-5"
          />
          <span className="text-xs text-muted-foreground border-l border-border/30 pl-3 hidden sm:block">Portal do Parceiro</span>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => (
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
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
