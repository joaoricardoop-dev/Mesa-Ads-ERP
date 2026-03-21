import { useClerk } from "@clerk/clerk-react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import type { User } from "@shared/models/auth";

interface ParceiroLayoutProps {
  user: User | null;
  children: React.ReactNode;
}

export function ParceiroLayout({ user, children }: ParceiroLayoutProps) {
  const { signOut } = useClerk();
  const { theme } = useTheme();

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Parceiro";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border/30 bg-card flex items-center px-6 shrink-0 z-10">
        <div className="flex items-center gap-3 flex-1">
          <img
            src={theme === "dark" ? "/logo-white.png" : "/logo-black.png"}
            alt="mesa.ads"
            className="h-5"
          />
          <span className="text-xs text-muted-foreground border-l border-border/30 pl-3">Portal do Parceiro</span>
        </div>

        <div className="flex items-center gap-3">
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
