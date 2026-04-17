import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Megaphone,
  LogIn,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles,
  Building2,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { captureTrackingFromUrl } from "@/lib/utmTracking";

function portalPathForRole(role: string | null | undefined): string {
  if (!role) return "/";
  if (role === "anunciante") return "/portal";
  if (role === "restaurante") return "/portal";
  if (role === "parceiro") return "/portal";
  return "/";
}

function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "anunciante":
      return "anunciante";
    case "restaurante":
      return "local parceiro";
    case "parceiro":
      return "parceiro / agência";
    case "admin":
    case "comercial":
    case "operacoes":
    case "financeiro":
    case "manager":
      return "usuário interno";
    default:
      return role || "desconhecido";
  }
}

export default function MontarCampanha() {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [showWrongAccount, setShowWrongAccount] = useState(false);

  const userRole = user?.role || null;
  const isAnunciante = userRole === "anunciante";

  useEffect(() => {
    document.title = "Montar campanha · mesa.ads";
    captureTrackingFromUrl("/montar-campanha");
  }, []);

  const handleAdvertiserClick = () => {
    if (isLoading) return;

    if (isAuthenticated && isAnunciante) {
      if (user?.onboardingComplete === false) {
        setLocation("/");
      } else {
        setLocation("/portal");
      }
      return;
    }

    if (isAuthenticated && !isAnunciante) {
      setShowWrongAccount(true);
      return;
    }

    setLocation("/?mode=signup");
  };

  const handleExistingLoginClick = () => {
    setLocation("/?mode=signin");
  };

  const goToOwnPortal = () => {
    setLocation(portalPathForRole(userRole));
  };

  const handleLogoutAndContinue = async () => {
    try {
      await logout();
    } finally {
      setShowWrongAccount(false);
      setLocation("/?mode=signup");
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "hsl(0 0% 4%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-[0.05]"
          style={{
            background:
              "radial-gradient(circle, #27d803 0%, transparent 70%)",
          }}
        />
      </div>

      <header className="relative z-10 px-6 sm:px-10 py-6 flex items-center justify-between">
        <a href="/" className="inline-flex items-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-7" />
        </a>
        <a
          href="/"
          className="text-xs sm:text-sm font-medium transition-colors"
          style={{ color: "hsl(0 0% 50%)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "hsl(0 0% 95%)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "hsl(0 0% 50%)")
          }
        >
          Voltar para o site
        </a>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-center mb-10"
          >
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider mb-5"
              style={{
                background: "rgba(39, 216, 3, 0.08)",
                color: "#27d803",
                border: "1px solid rgba(39, 216, 3, 0.2)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Onboarding mesa.ads
            </span>
            <h1
              className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4"
              style={{ color: "hsl(0 0% 95%)" }}
            >
              Como você quer entrar?
            </h1>
            <p
              className="text-sm sm:text-base max-w-xl mx-auto leading-relaxed"
              style={{ color: "hsl(0 0% 55%)" }}
            >
              Escolha o caminho certo para começar. Você pode criar uma
              campanha como anunciante ou acessar a plataforma se já tem
              conta de parceiro, agência ou time interno.
            </p>
          </motion.div>

          {showWrongAccount && isAuthenticated && !isAnunciante && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start"
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-amber-200 mb-1">
                  Conta atual não é de anunciante
                </h3>
                <p className="text-xs text-amber-100/70 leading-relaxed mb-3">
                  Você está logado como{" "}
                  <span className="font-semibold">
                    {roleLabel(userRole)}
                  </span>
                  . Para criar uma nova campanha como anunciante, saia
                  desta conta e cadastre-se. Ou volte ao seu portal
                  atual.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleLogoutAndContinue}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                  >
                    Sair e continuar
                  </button>
                  <button
                    onClick={goToOwnPortal}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-amber-100 transition-colors border border-amber-500/20"
                  >
                    Ir para meu portal
                  </button>
                  <button
                    onClick={() => setShowWrongAccount(false)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium text-amber-100/70 hover:text-amber-100 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
            <motion.button
              type="button"
              onClick={handleAdvertiserClick}
              disabled={isLoading}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -2 }}
              className="group relative text-left rounded-2xl p-6 sm:p-7 overflow-hidden transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(180deg, rgba(39, 216, 3, 0.06), rgba(39, 216, 3, 0.02))",
                border: "1px solid rgba(39, 216, 3, 0.25)",
              }}
            >
              <div
                className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{ background: "rgba(39, 216, 3, 0.4)" }}
              />
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "rgba(39, 216, 3, 0.15)",
                    border: "1px solid rgba(39, 216, 3, 0.3)",
                  }}
                >
                  <Megaphone className="w-6 h-6 text-[#27d803]" />
                </div>
                <h2
                  className="text-lg sm:text-xl font-bold mb-2"
                  style={{ color: "hsl(0 0% 95%)" }}
                >
                  Quero anunciar
                </h2>
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{ color: "hsl(0 0% 55%)" }}
                >
                  Crie sua conta de anunciante e monte sua primeira
                  campanha em porta-copos.
                </p>

                <div className="flex flex-col gap-2 mb-6 text-xs" style={{ color: "hsl(0 0% 50%)" }}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[#27d803] shrink-0" />
                    <span>Cadastro rápido da sua marca</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#27d803] shrink-0" />
                    <span>Briefing guiado e cotação na hora</span>
                  </div>
                </div>

                <span
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-transform group-hover:translate-x-1"
                  style={{ color: "#27d803" }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando...
                    </>
                  ) : isAuthenticated && isAnunciante ? (
                    <>
                      Continuar para o portal
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Criar conta de anunciante
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </span>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={handleExistingLoginClick}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -2 }}
              className="group relative text-left rounded-2xl p-6 sm:p-7 overflow-hidden transition-all"
              style={{
                background: "hsl(0 0% 7%)",
                border: "1px solid hsl(0 0% 14%)",
              }}
            >
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    background: "hsl(0 0% 11%)",
                    border: "1px solid hsl(0 0% 18%)",
                  }}
                >
                  <LogIn
                    className="w-6 h-6"
                    style={{ color: "hsl(0 0% 80%)" }}
                  />
                </div>
                <h2
                  className="text-lg sm:text-xl font-bold mb-2"
                  style={{ color: "hsl(0 0% 95%)" }}
                >
                  Já sou parceiro, agência ou interno
                </h2>
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{ color: "hsl(0 0% 55%)" }}
                >
                  Acesse sua conta existente. Você será direcionado
                  automaticamente para o portal certo.
                </p>

                <div className="flex flex-col gap-2 mb-6 text-xs" style={{ color: "hsl(0 0% 50%)" }}>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(0 0% 70%)" }} />
                    <span>Parceiros e agências</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 shrink-0" style={{ color: "hsl(0 0% 70%)" }} />
                    <span>Locais parceiros e times internos</span>
                  </div>
                </div>

                <span
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-transform group-hover:translate-x-1"
                  style={{ color: "hsl(0 0% 90%)" }}
                >
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </motion.button>
          </div>

          <div className="text-center mt-8">
            <p className="text-xs" style={{ color: "hsl(0 0% 40%)" }}>
              É um local que quer receber porta-copos?{" "}
              <a
                href="/parceiro"
                className="underline-offset-2 hover:underline"
                style={{ color: "#27d803" }}
              >
                Cadastre seu estabelecimento
              </a>
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center">
        <p className="text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de
          gestão
        </p>
      </footer>
    </div>
  );
}
