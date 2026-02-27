import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function ForcePasswordChange() {
  const { user, changePassword, isChangingPassword } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!user?.mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    try {
      await changePassword({ newPassword });
      toast.success("Senha definida com sucesso!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha.");
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border/30 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Definir nova senha</h2>
            <p className="text-xs text-muted-foreground">
              Primeiro acesso — crie sua senha pessoal
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Nova senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-lg border border-border/30 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Confirmar senha
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border/30 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Repita a senha"
            />
          </div>

          <button
            type="submit"
            disabled={isChangingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChangingPassword ? "Salvando..." : "Definir senha e entrar"}
          </button>
        </form>

        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          Após definir sua senha, você poderá fazer login com e-mail e senha.
        </p>
      </div>
    </div>
  );
}
