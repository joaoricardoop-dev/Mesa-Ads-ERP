import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWizardStore } from "./wizardStore";
import { CoasterStage } from "./mesa/CoasterStage";
import { MesaButton, MesaChip } from "./mesa/MesaUI";
import { MesaProgressRail } from "./mesa/MesaProgressRail";

interface Props {
  role: "anunciante" | "parceiro" | "internal" | "guest";
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepHero({ role: _role }: Props) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const goTo = useWizardStore((s) => s.goTo);

  function handleAdvance() {
    if (!isAuthenticated) {
      try {
        localStorage.setItem("mesa-checkout-pending", "1");
      } catch {}
      setLocation("/?mode=signup&redirect=/montar-campanha%3Fstep%3Dlocais");
      return;
    }
    goTo("locais");
  }

  return (
    <div className="relative min-h-screen text-chalk overflow-hidden lg:pl-[124px] pt-[64px] lg:pt-0">
      <MesaProgressRail />
      <CoasterStage className="absolute inset-0 z-0 lg:left-[124px] top-[64px] lg:top-0 [touch-action:none]" />
      <div className="pointer-events-none absolute inset-0 z-[1] lg:left-[124px] top-[64px] lg:top-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,4,5,0.55)_55%,rgba(4,4,5,0.92)_100%)]" />

      <div className="relative z-10 min-h-[calc(100vh-64px)] lg:min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 pt-6 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <MesaChip tone="neon" dot size="xs">ao vivo</MesaChip>
            {!isAuthenticated && (
              <button
                onClick={() => setLocation("/?mode=signin&redirect=/montar-campanha")}
                className="text-[12px] tracking-tight text-chalk-muted hover:text-chalk transition-colors"
              >
                Entrar
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 grid place-items-center px-6 sm:px-10 py-10">
          <div className="max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mesa-neon/10 border border-mesa-neon/30 text-mesa-neon mb-7 text-[11px] uppercase tracking-[0.22em] font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              monte sua campanha em 60 segundos
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="font-display font-semibold tracking-[-0.04em] leading-[0.95] text-chalk text-balance"
              style={{ fontSize: "var(--text-mega)" }}
            >
              tenta me <span className="text-mesa-neon">ignorar</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="mt-7 max-w-[58ch] mx-auto text-base sm:text-lg leading-relaxed text-chalk-muted text-pretty"
            >
              Escolha onde sua marca vai aparecer. Defina os produtos por local,
              quantos shares e quantos ciclos. O carrinho monta o orçamento
              completo — e o time mesa.ads cuida do resto.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 flex flex-col items-center gap-3"
            >
              <MesaButton
                variant="primary"
                size="lg"
                onClick={handleAdvance}
                iconRight={<ArrowRight className="w-5 h-5" />}
              >
                {isAuthenticated ? "escolher locais" : "quero anunciar"}
              </MesaButton>
              {!isAuthenticated && (
                <span className="text-[12px] text-chalk-dim">
                  Faça login para começar a montar sua campanha.
                </span>
              )}
            </motion.div>
          </div>
        </main>

        <footer className="px-6 sm:px-10 pb-6 text-center">
          <p className="text-[10px] tracking-[0.22em] uppercase text-chalk-dim/70">
            mesa.ads · manaus · am
          </p>
        </footer>
      </div>
    </div>
  );
}
