import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { CircleCheck, Circle, FileText, AlertTriangle, Ban } from "lucide-react";

export type ScheduleInvoice = {
  id: number;
  invoiceNumber: string;
  amount: number;
  status: "paga" | "emitida" | "vencida" | "prevista" | "cancelada" | "none";
  rawStatus: string;
  issueDate: string;
  dueDate: string;
  paymentDate?: string | null;
  documentUrl?: string | null;
} | null;

export type ScheduleSlot = {
  phaseId: number;
  sequence: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  expectedRevenue: number;
  invoice: ScheduleInvoice;
};

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Circle }> = {
  paga: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", Icon: CircleCheck },
  emitida: { label: "Emitida", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", Icon: FileText },
  vencida: { label: "Vencida", cls: "bg-red-500/15 text-red-400 border-red-500/30", Icon: AlertTriangle },
  prevista: { label: "Prevista", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30", Icon: Circle },
  cancelada: { label: "Cancelada", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", Icon: Ban },
  none: { label: "Sem fatura", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", Icon: AlertTriangle },
};

function fmtMonth(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
}

export function InvoiceSchedule({
  slots,
  onSelect,
}: {
  slots: ScheduleSlot[];
  onSelect?: (slot: ScheduleSlot) => void;
}) {
  if (slots.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Sem batches cadastrados — cronograma indisponível.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-6">
        {slots.map((s) => {
          const status = s.invoice?.status ?? "none";
          const meta = STATUS_META[status] ?? STATUS_META.none;
          const Icon = meta.Icon;
          return (
            <button
              key={s.phaseId}
              type="button"
              onClick={() => onSelect?.(s)}
              className="text-left bg-card border border-border/30 rounded-lg p-2.5 hover:border-primary/50 hover:bg-card/70 transition-all flex flex-col gap-1.5"
              data-testid={`schedule-slot-${s.sequence}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  B{s.sequence} · {fmtMonth(s.periodStart)}
                </span>
                <Icon className={`w-3.5 h-3.5 ${meta.cls.split(" ").find((c) => c.startsWith("text-")) ?? ""}`} />
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(s.invoice?.amount ?? s.expectedRevenue)}
              </div>
              <Badge variant="outline" className={`text-[9px] uppercase tracking-wide ${meta.cls} self-start`}>
                {meta.label}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getInvoiceBadgeMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.none;
}
