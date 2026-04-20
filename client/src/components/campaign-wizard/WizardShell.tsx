import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWizardStore, STEP_ORDER, WizardStep } from "./wizardStore";
import { MesaButton, MesaChip } from "./mesa/MesaUI";
import { MesaProgressRail } from "./mesa/MesaProgressRail";
import { cn } from "@/lib/utils";

interface WizardShellProps {
  title: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  summary?: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideFooter?: boolean;
  hideBack?: boolean;
  isLoading?: boolean;
}

export function WizardShell({
  title,
  eyebrow,
  subtitle,
  children,
  summary,
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  hideFooter,
  hideBack,
  isLoading,
}: WizardShellProps) {
  const step = useWizardStore((s) => s.step);
  const back = useWizardStore((s) => s.back);
  const next = useWizardStore((s) => s.next);

  const visible: WizardStep[] = STEP_ORDER.filter((s) => s !== "success");
  const idx = visible.indexOf(step);

  return (
    <div className="relative min-h-screen text-chalk lg:pl-[124px] pt-[64px] lg:pt-0">
      <MesaProgressRail />

      <header className="relative z-10 px-6 sm:px-10 pt-6 pb-4 flex items-center justify-end">
        <div className="flex items-center gap-3">
          <MesaChip tone="neon" dot size="xs">
            ao vivo
          </MesaChip>
          <span className="hidden md:inline text-[11px] uppercase tracking-[0.18em] text-chalk-dim tabular-nums">
            etapa {String(idx + 1).padStart(2, "0")} / {String(visible.length).padStart(2, "0")}
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1240px] px-6 sm:px-10 pb-24 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12">
        {/* Main pane */}
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-8">
                {eyebrow && (
                  <div className="text-[10px] uppercase tracking-[0.22em] text-mesa-neon mb-3">
                    {eyebrow}
                  </div>
                )}
                <h1
                  className="font-display font-semibold leading-[1.02] tracking-[-0.03em] text-chalk text-balance"
                  style={{ fontSize: "var(--text-title)" }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-3 max-w-[55ch] text-sm sm:text-[15px] leading-relaxed text-chalk-muted">
                    {subtitle}
                  </p>
                )}
              </div>

              {children}

              {!hideFooter && (
                <div className="mt-12 flex items-center justify-between gap-3 border-t border-hairline pt-6">
                  {hideBack ? (
                    <span />
                  ) : (
                    <MesaButton
                      variant="quiet"
                      size="md"
                      onClick={back}
                      disabled={idx <= 0}
                      iconLeft={<ArrowLeft className="w-4 h-4" />}
                    >
                      Voltar
                    </MesaButton>
                  )}
                  <MesaButton
                    variant="primary"
                    size="lg"
                    onClick={onNext ?? next}
                    disabled={nextDisabled || isLoading}
                    iconRight={
                      step === "checkout" ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <ArrowRight className="w-5 h-5" />
                      )
                    }
                  >
                    {isLoading ? "Enviando..." : nextLabel}
                  </MesaButton>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Order summary aside */}
        {summary && (
          <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-auto">
            <div className="rounded-2xl border border-hairline bg-ink-900/80 backdrop-blur-md p-6 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.22em] text-chalk-dim">
                  pedido
                </span>
                <MesaChip tone="ice" size="xs">estimativa</MesaChip>
              </div>
              {summary}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
