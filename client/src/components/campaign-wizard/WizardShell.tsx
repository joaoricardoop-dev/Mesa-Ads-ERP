import { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWizardStore, STEP_LABELS, STEP_ORDER, WizardStep } from "./wizardStore";
import { cn } from "@/lib/utils";

interface WizardShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  summary?: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideFooter?: boolean;
  isLoading?: boolean;
}

export function WizardShell({
  title,
  subtitle,
  children,
  summary,
  onNext,
  nextLabel = "Continuar",
  nextDisabled,
  hideFooter,
  isLoading,
}: WizardShellProps) {
  const step = useWizardStore((s) => s.step);
  const back = useWizardStore((s) => s.back);
  const next = useWizardStore((s) => s.next);
  const goTo = useWizardStore((s) => s.goTo);

  const visible: WizardStep[] = STEP_ORDER.filter((s) => s !== "success");
  const idx = visible.indexOf(step);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top progress rail */}
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src="/logo-white.png" alt="mesa.ads" className="h-5 hidden sm:block" />
          <span className="text-xs text-muted-foreground border-l border-border/30 pl-3 hidden sm:block">
            Montar campanha
          </span>
          <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto">
            {visible.map((s, i) => {
              const state: "done" | "active" | "idle" =
                i < idx ? "done" : i === idx ? "active" : "idle";
              return (
                <button
                  key={s}
                  type="button"
                  disabled={i > idx}
                  onClick={() => i < idx && goTo(s as WizardStep)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium uppercase tracking-wide transition-colors shrink-0",
                    state === "active" && "text-primary",
                    state === "done" && "text-muted-foreground hover:text-foreground",
                    state === "idle" && "text-muted-foreground/40 cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      state === "active" && "bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]",
                      state === "done" && "bg-primary/60",
                      state === "idle" && "bg-muted",
                    )}
                  />
                  <span className="hidden md:inline">{STEP_LABELS[s]}</span>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] tracking-widest uppercase text-muted-foreground hidden lg:block">
            {idx + 1} / {visible.length}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 xl:gap-10">
        <main className="min-w-0">
          <div className="mb-6 sm:mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          {children}

          {!hideFooter && (
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/40 pt-6">
              <Button
                variant="ghost"
                onClick={back}
                disabled={idx <= 0}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button
                onClick={onNext ?? next}
                disabled={nextDisabled || isLoading}
                className="gap-2"
              >
                {isLoading ? "Enviando..." : nextLabel}
                {step === "confirm" ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </main>

        {summary && (
          <aside className="xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm p-5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                Resumo da campanha
              </div>
              {summary}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
