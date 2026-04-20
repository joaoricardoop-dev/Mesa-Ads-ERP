import { motion } from "framer-motion";
import {
  STEP_LABELS,
  STEP_ORDER,
  useWizardStore,
  type WizardStep,
} from "../wizardStore";
import { MesaAdsLogo } from "./MesaUI";
import { cn } from "@/lib/utils";

interface Props {
  forceStep?: WizardStep;
  interactive?: boolean;
}

export function MesaProgressRail({ forceStep, interactive = true }: Props) {
  const storeStep = useWizardStore((s) => s.step);
  const goTo = useWizardStore((s) => s.goTo);
  const step = forceStep ?? storeStep;

  const visible: WizardStep[] = STEP_ORDER.filter((s) => s !== "success");
  const idx = visible.indexOf(step);

  return (
    <>
      {/* Desktop vertical rail — fixed to viewport, hovers above all steps */}
      <aside
        className="fixed left-0 top-0 z-30 hidden lg:flex h-screen w-[124px] flex-col justify-between border-r border-hairline bg-ink-950/60 backdrop-blur-xl px-5 py-7"
        aria-label="Etapas do checkout"
      >
        <a href="/" className="flex flex-col gap-2 text-[15px]">
          <MesaAdsLogo />
          <span className="text-[9px] uppercase tracking-[0.22em] text-chalk-dim leading-tight">
            auto-checkout
          </span>
        </a>

        <ol className="flex flex-col gap-3.5">
          {visible.map((s, i) => {
            const state: "done" | "active" | "idle" =
              i < idx ? "done" : i === idx ? "active" : "idle";
            const reachable = interactive && i <= idx;
            return (
              <li key={s} className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-current={state === "active" ? "step" : undefined}
                  onClick={() => reachable && goTo(s)}
                  disabled={!reachable}
                  className={cn(
                    "relative shrink-0 size-2.5 rounded-full border transition-all duration-300 ease-apple",
                    state === "idle" && "border-chalk/15 bg-chalk/5",
                    state === "active" && "border-mesa-neon bg-mesa-neon shadow-neon-sm",
                    state === "done" && "border-mesa-neon/40 bg-mesa-neon/60",
                  )}
                >
                  {state === "active" && (
                    <motion.span
                      layoutId="mesa-rail-active"
                      className="absolute inset-0 rounded-full bg-mesa-neon"
                      style={{ filter: "blur(8px)", opacity: 0.55 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
                <span
                  className={cn(
                    "text-[10px] tracking-[0.16em] uppercase transition-colors duration-300",
                    state === "active" ? "text-chalk" : "text-chalk-dim/70",
                  )}
                >
                  {STEP_LABELS[s]}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="text-[10px] tracking-[0.22em] uppercase text-chalk-dim/60">
          manaus · am
        </div>
      </aside>

      {/* Mobile top dots rail */}
      <div className="fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-hairline bg-ink-950/80 backdrop-blur-xl lg:hidden">
        <a href="/" className="inline-flex items-center gap-2">
          <MesaAdsLogo className="text-[15px]" />
        </a>
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-chalk-dim tabular-nums hidden sm:block">
            {String(idx + 1).padStart(2, "0")} / {String(visible.length).padStart(2, "0")} ·{" "}
            {STEP_LABELS[step]}
          </div>
          <div className="flex items-center gap-1.5" aria-hidden>
            {visible.map((s, i) => {
              const active = i === idx;
              const done = i < idx;
              return (
                <span
                  key={s}
                  className={cn(
                    "h-1 rounded-full transition-all duration-500 ease-apple",
                    active ? "w-6 bg-mesa-neon" : done ? "w-3 bg-mesa-neon/50" : "w-3 bg-chalk/15",
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
