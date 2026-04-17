import { Check, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = {
  key: string;
  label: string;
  at: Date | null;
};

const STAGE_DEFS = [
  { key: "briefing", label: "Briefing" },
  { key: "design", label: "Design" },
  { key: "aprovacao", label: "Aprovação" },
  { key: "producao", label: "Produção" },
  { key: "distribuicao", label: "Distribuição" },
  { key: "veiculacao", label: "Veiculação" },
  { key: "concluida", label: "Concluída" },
] as const;

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface BatchTimelineProps {
  phase: {
    id: number;
    sequence: number;
    label: string;
    briefingEnteredAt?: string | Date | null;
    designEnteredAt?: string | Date | null;
    aprovacaoEnteredAt?: string | Date | null;
    producaoEnteredAt?: string | Date | null;
    distribuicaoEnteredAt?: string | Date | null;
    veiculacaoEnteredAt?: string | Date | null;
    concluidaAt?: string | Date | null;
  };
}

export function BatchTimeline({ phase }: BatchTimelineProps) {
  const toDate = (v: string | Date | null | undefined): Date | null =>
    v ? new Date(v as any) : null;

  const stages: Stage[] = [
    { key: "briefing", label: "Briefing", at: toDate(phase.briefingEnteredAt) },
    { key: "design", label: "Design", at: toDate(phase.designEnteredAt) },
    { key: "aprovacao", label: "Aprovação", at: toDate(phase.aprovacaoEnteredAt) },
    { key: "producao", label: "Produção", at: toDate(phase.producaoEnteredAt) },
    { key: "distribuicao", label: "Distribuição", at: toDate(phase.distribuicaoEnteredAt) },
    { key: "veiculacao", label: "Veiculação", at: toDate(phase.veiculacaoEnteredAt) },
    { key: "concluida", label: "Concluída", at: toDate(phase.concluidaAt) },
  ];

  // O índice atual = última etapa marcada
  const lastDoneIdx = stages.reduce((acc, s, i) => (s.at ? i : acc), -1);
  const currentIdx = lastDoneIdx >= 0 && lastDoneIdx < stages.length - 1 ? lastDoneIdx + 1 : lastDoneIdx;

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Linha do tempo do batch
        </div>
        <div className="text-[11px] text-muted-foreground">
          Batch {phase.sequence} — {phase.label}
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const isDone = !!s.at;
          const isCurrent = i === currentIdx && !isDone;
          return (
            <div key={s.key} className="flex items-center gap-1 min-w-fit">
              <div className="flex flex-col items-center min-w-[68px]">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center border-2",
                    isDone
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-500"
                      : isCurrent
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted/30 border-border/50 text-muted-foreground"
                  )}
                  data-testid={`batch-stage-${s.key}`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-2.5 h-2.5" />
                  )}
                </div>
                <div
                  className={cn(
                    "text-[10px] mt-1 font-medium text-center leading-tight",
                    isDone ? "text-emerald-500" : isCurrent ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </div>
                <div className="text-[9px] text-muted-foreground/70">{fmtDate(s.at)}</div>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-6 -mt-5",
                    isDone ? "bg-emerald-500/60" : "bg-border/40"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
