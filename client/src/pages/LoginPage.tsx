import { useState } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message || "Erro ao fazer login");
        return;
      }
      toast.success("Login realizado!");
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, hsl(22 100% 50%) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="flex items-baseline gap-1.5 justify-center mb-8">
          <span className="text-3xl font-extrabold tracking-tight" style={{ color: "hsl(0 0% 95%)" }}>Mesa</span>
          <span className="bg-[hsl(22,100%,50%)] text-white font-bold text-sm px-2 py-0.5 rounded">Ads</span>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <h3 className="text-lg font-bold mb-1" style={{ color: "hsl(0 0% 95%)" }}>Entrar na plataforma</h3>
          <p className="text-xs mb-6" style={{ color: "hsl(0 0% 50%)" }}>Acesse com suas credenciais</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                  placeholder="Sua senha"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(0 0% 40%)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-10 bg-[hsl(22,100%,50%)] text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "hsl(0 0% 14%)" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "hsl(0 0% 40%)" }}>ou</span>
            <div className="flex-1 h-px" style={{ background: "hsl(0 0% 14%)" }} />
          </div>

          <a
            href="/api/login"
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
            style={{ border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 70%)" }}
          >
            Entrar com Google / GitHub / Apple
          </a>
        </div>

        <p className="text-center mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          Mesa Ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}
