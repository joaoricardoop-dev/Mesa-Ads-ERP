import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Crown,
  ShieldCheck,
  Shield,
  Bug,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const ROLES = [
  { value: "admin", label: "Admin", icon: Crown, color: "text-amber-400" },
  { value: "comercial", label: "Comercial", icon: ShieldCheck, color: "text-green-400" },
  { value: "operacoes", label: "Operações", icon: ShieldCheck, color: "text-blue-400" },
  { value: "financeiro", label: "Financeiro", icon: ShieldCheck, color: "text-cyan-400" },
  { value: "anunciante", label: "Anunciante", icon: Shield, color: "text-orange-400" },
  { value: "manager", label: "Gerente", icon: ShieldCheck, color: "text-indigo-400" },
  { value: "user", label: "Usuário", icon: Shield, color: "text-gray-400" },
  { value: "viewer", label: "Viewer", icon: Shield, color: "text-purple-400" },
];

export default function DevRoleSwitcher({ currentRole }: { currentRole?: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const switchMutation = trpc.dev.switchRole.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast.success("Perfil alterado! Recarregando...");
      setTimeout(() => window.location.reload(), 600);
    },
    onError: (err) => toast.error(err.message),
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg transition-colors"
      >
        <Bug className="w-3.5 h-3.5" />
        DEV
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {open && (
        <div className="absolute bottom-10 right-0 bg-card border border-border/50 rounded-lg shadow-2xl p-2 w-48 space-y-0.5">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold px-2 py-1">
            Trocar perfil
          </p>
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isActive = currentRole === role.value;
            return (
              <button
                key={role.value}
                disabled={isActive || switchMutation.isPending}
                onClick={() => switchMutation.mutate({ role: role.value })}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${role.color}`} />
                {role.label}
                {isActive && <span className="ml-auto text-[9px] text-primary">atual</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
