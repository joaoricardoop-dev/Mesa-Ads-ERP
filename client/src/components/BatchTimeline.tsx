import { Check, Circle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type StageKey = "briefing" | "design" | "aprovacao" | "producao" | "distribuicao" | "veiculacao" | "concluida";

const STAGE_DEFS: { key: StageKey; label: string; threshold: number | null }[] = [
  { key: "briefing", label: "Briefing", threshold: 5 },
  { key: "design", label: "Design", threshold: 5 },
  { key: "aprovacao", label: "Aprovação", threshold: 5 },
  { key: "producao", label: "Produção", threshold: 14 },
  { key: "distribuicao", label: "Distribuição", threshold: 7 },
  { key: "veiculacao", label: "Veiculação", threshold: null },
  { key: "concluida", label: "Concluída", threshold: null },
];

const STAGE_COL_MAP: Record<StageKey, string> = {
  briefing: "briefingEnteredAt",
  design: "designEnteredAt",
  aprovacao: "aprovacaoEnteredAt",
  producao: "producaoEnteredAt",
  distribuicao: "distribuicaoEnteredAt",
  veiculacao: "veiculacaoEnteredAt",
  concluida: "concluidaAt",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface BatchTimelineProps {
  phase: {
    id: number;
    sequence: number;
    label: string;
    campaignId?: number;
    [key: string]: any;
  };
  /** Permite clicar nos passos para marcar/desmarcar. Default true. */
  editable?: boolean;
}

export function BatchTimeline({ phase, editable = true }: BatchTimelineProps) {
  const utils = trpc.useUtils();
  const advanceMutation = trpc.campaignPhase.advanceStage.useMutation({
    onSuccess: () => {
      utils.campaignPhase.listByCampaign.invalidate();
      utils.campaign.get.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toDate = (k: StageKey): Date | null => {
    const v = phase[STAGE_COL_MAP[k]];
    return v ? new Date(v) : null;
  };

  const MS_DAY = 1000 * 60 * 60 * 24;
  const now = Date.now();
  const stagesRaw = STAGE_DEFS.map((s) => ({ ...s, at: toDate(s.key) }));
  const lastDoneIdx = stagesRaw.reduce((acc, s, i) => (s.at ? i : acc), -1);
  const currentIdx = lastDoneIdx >= 0 && lastDoneIdx < stagesRaw.length - 1 ? lastDoneIdx + 1 : lastDoneIdx;

  const stages = stagesRaw.map((s, i) => {
    const next = stagesRaw[i + 1];
    const start = s.at;
    const end = next?.at ?? (i === currentIdx ? new Date(now) : null);
    const days = start && end ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_DAY)) : null;
    const isCurrent = i === currentIdx && !s.at;
    const isInProgress = !!start && !next?.at && i === lastDoneIdx;
    return { ...s, days, isCurrent, isInProgress };
  });

  function handleClick(stage: StageKey, isDone: boolean) {
    if (!editable || advanceMutation.isPending) return;
    advanceMutation.mutate({
      phaseId: phase.id,
      stage,
      action: isDone ? "clear" : "mark",
    }, {
      onSuccess: () => {
        toast.success(isDone ? "Etapa desmarcada" : "Etapa marcada");
      },
    });
  }

  return (
    <div className="rounded-lg border border-border/30 bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Linha do tempo do batch
        </div>
        <div className="text-[11px] text-muted-foreground">
          Batch {phase.sequence} — {phase.label}
          {editable && <span className="ml-2 opacity-70">· clique pra avançar</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {stages.map((s, i) => {
          const isDone = !!s.at;
          const isCurrent = s.isCurrent;
          const overdue = s.threshold !== null && s.days !== null && s.days > s.threshold;
          const warning = s.threshold !== null && s.days !== null && !overdue && s.days > s.threshold * 0.7;
          const dayColor = s.days === null
            ? "text-muted-foreground/60 border-border/30 bg-muted/20"
            : overdue
            ? "text-red-400 border-red-500/30 bg-red-500/10"
            : warning
            ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
            : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
          return (
            <div key={s.key} className="flex items-center gap-1 min-w-fit">
              <button
                type="button"
                disabled={!editable || advanceMutation.isPending}
                onClick={() => handleClick(s.key, isDone)}
                className={cn(
                  "flex flex-col items-center min-w-[72px]",
                  editable ? "cursor-pointer hover:opacity-80" : "cursor-default"
                )}
                data-testid={`batch-stage-${s.key}`}
                title={editable ? (isDone ? "Clique pra desmarcar" : "Clique pra marcar como concluído") : undefined}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors",
                    isDone
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-500"
                      : isCurrent
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-muted/30 border-border/50 text-muted-foreground"
                  )}
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
                {s.threshold !== null && (s.days !== null || isCurrent || s.isInProgress) && (
                  <div
                    className={cn(
                      "mt-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-semibold",
                      dayColor
                    )}
                    title={`SLA: ${s.threshold} dias`}
                  >
                    {overdue && <AlertTriangle className="w-2.5 h-2.5" />}
                    {s.days !== null ? `${s.days}d` : "…"}
                    {s.isInProgress && s.days !== null && <span className="opacity-60">·em curso</span>}
                  </div>
                )}
              </button>
              {i < stages.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-6 -mt-10",
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
