import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, Building2, User, ArrowLeft, Search, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "register-cnpj" | "register-form";

interface FoundClient {
  id: number;
  name: string;
  company: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [cnpj, setCnpj] = useState("");
  const [cnpjError, setCnpjError] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [foundClient, setFoundClient] = useState<FoundClient | null>(null);

  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
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

  const handleCnpjLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCnpjError("");
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjError("Digite um CNPJ válido com 14 dígitos.");
      return;
    }
    setCnpjLoading(true);
    try {
      const response = await fetch(`/api/auth/lookup-client?cnpj=${digits}`);
      const body = await response.json();
      if (!response.ok) {
        setCnpjError(body.message || "CNPJ não encontrado.");
        return;
      }
      setFoundClient(body);
      setMode("register-form");
    } catch (err: any) {
      setCnpjError(err.message || "Erro ao buscar CNPJ.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    if (!regFirstName.trim()) {
      setRegError("Nome é obrigatório.");
      return;
    }
    if (!regEmail.trim()) {
      setRegError("E-mail é obrigatório.");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setRegLoading(true);
    try {
      const response = await fetch("/api/auth/register-advertiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          cnpj: cnpj.replace(/\D/g, ""),
          email: regEmail,
          password: regPassword,
          firstName: regFirstName,
          lastName: regLastName,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setRegError(body.message || "Erro ao criar conta.");
        return;
      }
      toast.success("Conta criada com sucesso!");
      window.location.reload();
    } catch (err: any) {
      setRegError(err.message || "Erro ao criar conta.");
    } finally {
      setRegLoading(false);
    }
  };

  const resetToLogin = () => {
    setMode("login");
    setCnpj("");
    setCnpjError("");
    setFoundClient(null);
    setRegFirstName("");
    setRegLastName("");
    setRegEmail("");
    setRegPassword("");
    setRegError("");
  };

  const inputStyle = {
    background: "hsl(0 0% 11%)",
    border: "1px solid hsl(0 0% 18%)",
    color: "hsl(0 0% 95%)",
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
          {mode === "login" && (
            <>
              <h3 className="text-lg font-bold mb-1" style={{ color: "hsl(0 0% 95%)" }}>Entrar na plataforma</h3>
              <p className="text-xs mb-6" style={{ color: "hsl(0 0% 50%)" }}>Acesse com suas credenciais</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                      style={inputStyle}
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
                      style={inputStyle}
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

              <div className="mt-5 pt-4" style={{ borderTop: "1px solid hsl(0 0% 14%)" }}>
                <button
                  onClick={() => setMode("register-cnpj")}
                  className="w-full text-center text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: "hsl(22 100% 50%)" }}
                >
                  Sou anunciante — criar minha conta
                </button>
              </div>
            </>
          )}

          {mode === "register-cnpj" && (
            <>
              <button
                onClick={resetToLogin}
                className="flex items-center gap-1.5 text-xs mb-4 transition-colors hover:opacity-80"
                style={{ color: "hsl(0 0% 50%)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar ao login
              </button>

              <h3 className="text-lg font-bold mb-1" style={{ color: "hsl(0 0% 95%)" }}>Cadastro de Anunciante</h3>
              <p className="text-xs mb-6" style={{ color: "hsl(0 0% 50%)" }}>
                Digite o CNPJ da sua empresa para verificar o cadastro
              </p>

              <form onSubmit={handleCnpjLookup} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>CNPJ</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                      className="w-full h-10 pl-10 pr-3 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                      style={inputStyle}
                      placeholder="00.000.000/0000-00"
                      autoFocus
                    />
                  </div>
                </div>

                {cnpjError && <p className="text-xs text-red-400">{cnpjError}</p>}

                <button
                  type="submit"
                  disabled={cnpjLoading || cnpj.replace(/\D/g, "").length !== 14}
                  className="w-full h-10 bg-[hsl(22,100%,50%)] text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {cnpjLoading ? "Buscando..." : "Buscar CNPJ"}
                </button>
              </form>
            </>
          )}

          {mode === "register-form" && foundClient && (
            <>
              <button
                onClick={() => { setMode("register-cnpj"); setFoundClient(null); setRegError(""); }}
                className="flex items-center gap-1.5 text-xs mb-4 transition-colors hover:opacity-80"
                style={{ color: "hsl(0 0% 50%)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Trocar CNPJ
              </button>

              <div
                className="rounded-lg p-3 mb-5 flex items-start gap-3"
                style={{ background: "hsl(142 76% 36% / 0.1)", border: "1px solid hsl(142 76% 36% / 0.2)" }}
              >
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "hsl(142 76% 36%)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "hsl(0 0% 95%)" }}>
                    {foundClient.company || foundClient.name}
                  </p>
                  {foundClient.razaoSocial && (
                    <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 60%)" }}>{foundClient.razaoSocial}</p>
                  )}
                  <p className="text-xs font-mono mt-0.5" style={{ color: "hsl(0 0% 50%)" }}>{foundClient.cnpj}</p>
                  {(foundClient.city || foundClient.state) && (
                    <p className="text-xs mt-0.5" style={{ color: "hsl(0 0% 50%)" }}>
                      {[foundClient.city, foundClient.state].filter(Boolean).join("/")}
                    </p>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold mb-1" style={{ color: "hsl(0 0% 95%)" }}>Crie sua conta</h3>
              <p className="text-xs mb-4" style={{ color: "hsl(0 0% 50%)" }}>
                Dados de acesso para o portal do anunciante
              </p>

              <form onSubmit={handleRegister} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>Nome *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                      <input
                        type="text"
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                        style={inputStyle}
                        placeholder="Nome"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>Sobrenome</label>
                    <input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                      style={inputStyle}
                      placeholder="Sobrenome"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>E-mail *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                      style={inputStyle}
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>Senha *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                    <input
                      type={showRegPw ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full h-10 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(22,100%,50%)]"
                      style={inputStyle}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button type="button" onClick={() => setShowRegPw(!showRegPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(0 0% 40%)" }}>
                      {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {regError && <p className="text-xs text-red-400">{regError}</p>}

                <button
                  type="submit"
                  disabled={regLoading || !regFirstName || !regEmail || regPassword.length < 6}
                  className="w-full h-10 bg-[hsl(22,100%,50%)] text-white font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {regLoading ? "Criando conta..." : "Criar conta e entrar"}
                </button>
              </form>

              <div className="mt-4 pt-3" style={{ borderTop: "1px solid hsl(0 0% 14%)" }}>
                <button
                  onClick={resetToLogin}
                  className="w-full text-center text-xs transition-colors hover:opacity-80"
                  style={{ color: "hsl(0 0% 50%)" }}
                >
                  Já tenho conta — fazer login
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          Mesa Ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}
