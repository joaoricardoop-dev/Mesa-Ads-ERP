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
import CampaignWizard from "@/components/campaign-wizard/CampaignWizard";

const WIZARD_ROLES = new Set([
  "anunciante",
  "parceiro",
  "admin",
  "comercial",
  "manager",
  "operacoes",
  "financeiro",
]);

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

  if (isAuthenticated && userRole && WIZARD_ROLES.has(userRole)) {
    return <CampaignWizard />;
  }

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
    <div className="min-h-screen w-full flex flex-col text-chalk">
      <header className="relative z-10 px-6 sm:px-10 py-6 flex items-center justify-between">
        <a href="/" className="inline-flex items-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-7" />
        </a>
        <a
          href="/"
          className="text-xs sm:text-sm font-medium text-chalk-muted hover:text-chalk transition-colors"
        >
          Voltar para o site
        </a>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-10"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] mb-5 text-mesa-neon glow-neon bg-ink-900">
              <Sparkles className="w-3.5 h-3.5" />
              Onboarding mesa.ads
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-4 text-balance text-chalk">
              Como você quer entrar?
            </h1>
            <p className="text-sm sm:text-base max-w-xl mx-auto leading-relaxed text-chalk-muted">
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
              className="group relative text-left rounded-2xl p-6 sm:p-7 overflow-hidden transition-all duration-500 disabled:opacity-60 disabled:cursor-not-allowed bg-ink-900 border border-hairline hover:border-mesa-neon/40 glow-neon"
            >
              <div
                className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{ background: "rgba(0, 230, 64, 0.4)" }}
              />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-mesa-neon/15 border border-mesa-neon/30">
                  <Megaphone className="w-6 h-6 text-mesa-neon" />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold mb-2 text-chalk">
                  Quero anunciar
                </h2>
                <p className="text-sm leading-relaxed mb-5 text-chalk-muted">
                  Crie sua conta de anunciante e monte sua primeira
                  campanha em porta-copos.
                </p>

                <div className="flex flex-col gap-2 mb-6 text-xs text-chalk-dim">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-mesa-neon shrink-0" />
                    <span>Cadastro rápido da sua marca</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-mesa-neon shrink-0" />
                    <span>Briefing guiado e cotação na hora</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-2 text-sm font-semibold transition-transform group-hover:translate-x-1 text-mesa-neon">
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
              className="group relative text-left rounded-2xl p-6 sm:p-7 overflow-hidden transition-all duration-500 bg-ink-900 border border-hairline hover:border-hairline-bold"
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-ink-800 border border-hairline-bold">
                  <LogIn className="w-6 h-6 text-chalk" />
                </div>
                <h2 className="font-display text-lg sm:text-xl font-bold mb-2 text-chalk">
                  Já sou parceiro, agência ou interno
                </h2>
                <p className="text-sm leading-relaxed mb-5 text-chalk-muted">
                  Acesse sua conta existente. Você será direcionado
                  automaticamente para o portal certo.
                </p>

                <div className="flex flex-col gap-2 mb-6 text-xs text-chalk-dim">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 shrink-0 text-chalk-muted" />
                    <span>Parceiros e agências</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 shrink-0 text-chalk-muted" />
                    <span>Locais parceiros e times internos</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-2 text-sm font-semibold transition-transform group-hover:translate-x-1 text-chalk">
                  Entrar
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </motion.button>
          </div>

          <div className="text-center mt-8">
            <p className="text-xs text-chalk-dim">
              É um local que quer receber porta-copos?{" "}
              <a
                href="/parceiro"
                className="underline-offset-2 hover:underline text-mesa-neon"
              >
                Cadastre seu estabelecimento
              </a>
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 text-center">
        <p className="text-[11px] text-chalk-dim/60 tracking-[0.2em] uppercase">
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Manaus · AM
        </p>
      </footer>
    </div>
  );
}
