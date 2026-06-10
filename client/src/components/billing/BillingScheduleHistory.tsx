// Task #262 — Histórico de alterações das condições de pagamento de uma cotação.
// Lê de billingSchedule.historyForQuotation (financial_audit_log) e mostra, por
// salvamento, quem alterou, quando, e o diff das parcelas (antes → depois).
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { History, ChevronDown, ChevronUp, Loader2, User } from "lucide-react";

type ScheduleItem = { sequence: number; amount: string; dueDate: string; notes: string | null };

function fmtDateTime(d: string | Date): string {
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function fmtDueDate(d: string): string {
  try {
    return new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return d;
  }
}

function sumOf(items: ScheduleItem[]): number {
  return items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
}

function ScheduleList({ items, label }: { items: ScheduleItem[]; label: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">— sem parcelas —</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it) => (
            <li key={it.sequence} className="flex items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-muted-foreground">#{it.sequence} · {fmtDueDate(it.dueDate)}</span>
              <span>{formatCurrency(parseFloat(it.amount) || 0)}</span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 text-[11px] font-mono border-t border-border/20 pt-0.5 mt-0.5 font-semibold">
            <span className="text-muted-foreground">Σ</span>
            <span>{formatCurrency(sumOf(items))}</span>
          </li>
        </ul>
      )}
    </div>
  );
}

function HistoryEntry({ entry }: { entry: any }) {
  const [open, setOpen] = useState(false);
  const beforeItems: ScheduleItem[] = entry.before ?? [];
  const afterItems: ScheduleItem[] = entry.after ?? [];
  const wasEmpty = beforeItems.length === 0;
  return (
    <li className="border border-border/20 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">
            {entry.actorName || "Usuário desconhecido"}
            {entry.actorRole && (
              <span className="ml-1.5 text-[9px] uppercase tracking-wide text-muted-foreground">{entry.actorRole}</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{fmtDateTime(entry.createdAt)}</div>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
          {wasEmpty ? "criou" : `${beforeItems.length}→${afterItems.length}`} · {formatCurrency(sumOf(afterItems))}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20 flex gap-4">
          <ScheduleList items={beforeItems} label="Antes" />
          <ScheduleList items={afterItems} label="Depois" />
        </div>
      )}
    </li>
  );
}

export function BillingScheduleHistory({ quotationId }: { quotationId: number }) {
  const [collapsed, setCollapsed] = useState(true);
  const { data, isLoading } = trpc.billingSchedule.historyForQuotation.useQuery(
    { quotationId },
    { enabled: quotationId > 0 },
  );

  const count = data?.length ?? 0;
  if (!isLoading && count === 0) return null;

  return (
    <div className="bg-card border border-border/30 rounded-xl">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Histórico de alterações</h3>
          {count > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {count} {count === 1 ? "alteração" : "alterações"}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-1 border-t border-border/20">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> carregando...
            </div>
          ) : (
            <ul className="space-y-2">
              {(data ?? []).map((entry: any) => (
                <HistoryEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
