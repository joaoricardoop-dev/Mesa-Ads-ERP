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
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const NAV_ITEMS = [
  { path: "/", label: "Simulador", icon: BarChart3 },
  { path: "/prospeccao", label: "Prospecção", icon: Search },
  { path: "/restaurantes", label: "Restaurantes", icon: UtensilsCrossed },
  { path: "/clientes", label: "Clientes", icon: Building2 },
  { path: "/campanhas", label: "Campanhas", icon: Megaphone },
  { path: "/economics", label: "Economics", icon: DollarSign },
  { path: "/producao", label: "Produção", icon: Factory },
];

export default function AppNav() {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-border/30 bg-card/50 backdrop-blur-sm flex-shrink-0 z-10">
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
        </div>
      </div>
    </header>
  );
}
