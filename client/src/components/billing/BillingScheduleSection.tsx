// Task #197 — Editor inline de cronograma de pagamento.
// Modos:
//   - "quotation" : todas as linhas editáveis; status livre (rascunho/enviada/ativa).
//   - "campaign"  : linhas com invoice terminal (emitida/paga/cancelada) ficam read-only.
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, RotateCcw, Lock, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  suggestBillingSchedule,
  splitAmount,
  addDaysIso,
  sumSchedule,
  scheduleMatchesTotal,
  DEFAULT_DUE_OFFSET_DAYS,
} from "@shared/billingSchedule";

type EditableItem = {
  sequence: number;
  amount: string;
  dueDate: string;
  notes: string | null;
  locked?: boolean;
  invoiceStatus?: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    prevista: { label: "Prevista", cls: "bg-slate-500/15 text-slate-400" },
    emitida: { label: "Emitida", cls: "bg-blue-500/15 text-blue-400" },
    paga: { label: "Paga", cls: "bg-emerald-500/15 text-emerald-400" },
    cancelada: { label: "Cancelada", cls: "bg-rose-500/15 text-rose-400" },
  };
  const v = map[status] ?? map.prevista;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${v.cls}`}>{v.label}</span>;
}

export function BillingScheduleSection({
  mode,
  ownerId,
  totalValue,
  periodStart,
  defaultCollapsed = false,
  readOnly = false,
  onChange,
}: {
  mode: "quotation" | "campaign";
  ownerId: number;
  totalValue: number | string;
  periodStart?: string | null;
  defaultCollapsed?: boolean;
  readOnly?: boolean;
  onChange?: (items: EditableItem[]) => void;
}) {
  const total = typeof totalValue === "string" ? parseFloat(totalValue) : totalValue;

  const utils = trpc.useUtils();
  const quotationQuery = trpc.billingSchedule.getForQuotation.useQuery(
    { quotationId: ownerId },
    { enabled: mode === "quotation" && !readOnly },
  );
  const campaignQuery = trpc.billingSchedule.getForCampaign.useQuery(
    { campaignId: ownerId },
    { enabled: mode === "campaign" },
  );
  const data: any = mode === "quotation" ? quotationQuery.data : campaignQuery.data;
  const isLoading = mode === "quotation" ? quotationQuery.isLoading : campaignQuery.isLoading;

  const setForQuotation = trpc.billingSchedule.setForQuotation.useMutation({
    onSuccess: () => {
      toast.success("Condições de pagamento atualizadas");
      utils.billingSchedule.getForQuotation.invalidate({ quotationId: ownerId });
    },
    onError: (e) => toast.error(e.message),
  });
  const updateForCampaign = trpc.billingSchedule.updateForCampaign.useMutation({
    onSuccess: () => {
      toast.success("Cronograma atualizado");
      utils.billingSchedule.getForCampaign.invalidate({ campaignId: ownerId });
      utils.financial.invalidate?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const [items, setItems] = useState<EditableItem[]>([]);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [dirty, setDirty] = useState(false);

  // Hidrata local state quando carrega
  useEffect(() => {
    if (!data) return;
    setItems(data.map((d: any) => ({
      sequence: d.sequence,
      amount: String(d.amount),
      dueDate: d.dueDate,
      notes: d.notes ?? null,
      locked: !!d.locked,
      invoiceStatus: d.invoiceStatus,
    })));
    setDirty(false);
  }, [data]);

  useEffect(() => { onChange?.(items); }, [items]);

  const sum = useMemo(() => sumSchedule(items), [items]);
  const matches = useMemo(() => scheduleMatchesTotal(items, total), [items, total]);
  const diff = total - sum;

  // Invariante: nenhum vencimento antes do início do período. Parcelas
  // travadas (invoice terminal) são ignoradas — só validamos as editáveis.
  const anchorStart = periodStart && periodStart.length >= 10 ? periodStart.slice(0, 10) : null;
  const dueBeforeStart = useMemo(
    () => (anchorStart ? items.some((it) => !it.locked && it.dueDate < anchorStart) : false),
    [items, anchorStart],
  );

  function applySuggestion(parts: number) {
    const amounts = splitAmount(total, parts);
    const baseDue = addDaysIso(periodStart && periodStart.length >= 10 ? periodStart : todayIso(), DEFAULT_DUE_OFFSET_DAYS);
    const next: EditableItem[] = amounts.map((a, i) => ({
      sequence: i + 1,
      amount: a,
      dueDate: addDaysIso(baseDue, i * 30),
      notes: parts === 1 ? "Parcela única" : `Parcela ${i + 1}/${parts}`,
    }));
    // Preserva linhas locked (modo campanha) reaplicando por cima
    if (mode === "campaign") {
      const lockedItems = items.filter((it) => it.locked);
      const remainingTotal = total - lockedItems.reduce((s, it) => s + parseFloat(it.amount), 0);
      if (remainingTotal > 0 && parts > lockedItems.length) {
        const editableParts = parts - lockedItems.length;
        const editableAmounts = splitAmount(remainingTotal, editableParts);
        const newEditable: EditableItem[] = editableAmounts.map((a, i) => ({
          sequence: lockedItems.length + i + 1,
          amount: a,
          dueDate: addDaysIso(baseDue, (lockedItems.length + i) * 30),
          notes: `Parcela ${lockedItems.length + i + 1}/${parts}`,
        }));
        setItems([...lockedItems, ...newEditable]);
        setDirty(true);
        return;
      }
    }
    setItems(next);
    setDirty(true);
  }

  function addRow() {
    const last = items[items.length - 1];
    const baseDue = last ? addDaysIso(last.dueDate, 30) : addDaysIso(periodStart || todayIso(), DEFAULT_DUE_OFFSET_DAYS);
    setItems([
      ...items,
      { sequence: items.length + 1, amount: "0.00", dueDate: baseDue, notes: null },
    ]);
    setDirty(true);
  }

  function removeRow(idx: number) {
    if (items[idx]?.locked) return;
    const next = items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sequence: i + 1 }));
    setItems(next);
    setDirty(true);
  }

  function updateRow(idx: number, patch: Partial<EditableItem>) {
    if (items[idx]?.locked) return;
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setItems(next);
    setDirty(true);
  }

  function save() {
    const payload = items.map((it) => ({
      sequence: it.sequence,
      amount: parseFloat(it.amount).toFixed(2),
      dueDate: it.dueDate,
      notes: it.notes,
    }));
    if (mode === "quotation") {
      setForQuotation.mutate({ quotationId: ownerId, items: payload });
    } else {
      updateForCampaign.mutate({ campaignId: ownerId, items: payload });
    }
  }

  if (readOnly) {
    return (
      <ReadonlySchedule items={data ? data.map((d: any) => ({ sequence: d.sequence, amount: d.amount, dueDate: d.dueDate, notes: d.notes })) : items} total={total} loading={isLoading} />
    );
  }

  const saving = setForQuotation.isPending || updateForCampaign.isPending;

  return (
    <div className="bg-card border border-border/30 rounded-xl">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Condições de pagamento</h3>
          <span className="text-[11px] text-muted-foreground">
            {items.length} {items.length === 1 ? "parcela" : "parcelas"} · Σ {formatCurrency(sum)}
          </span>
          {matches ? (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="w-3 h-3" /> ok
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500">
              <AlertTriangle className="w-3 h-3" /> Δ {formatCurrency(Math.abs(diff))}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> carregando...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Nenhuma parcela configurada. Use "Sugerir" abaixo para começar.</p>
                )}
                {items.map((it, idx) => {
                  const locked = !!it.locked;
                  return (
                    <div key={`${it.sequence}-${idx}`} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-1 text-xs text-muted-foreground font-mono text-center">
                        #{it.sequence}
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="date"
                          value={it.dueDate}
                          disabled={locked}
                          onChange={(e) => updateRow(idx, { dueDate: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={it.amount}
                          disabled={locked}
                          onChange={(e) => updateRow(idx, { amount: e.target.value })}
                          className="h-8 text-xs font-mono text-right"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        {locked && (
                          <>
                            <Lock className="w-3 h-3 text-muted-foreground" />
                            {it.invoiceStatus && <StatusBadge status={it.invoiceStatus} />}
                          </>
                        )}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {!locked && (
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRow(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/20">
                <Button type="button" size="sm" variant="outline" onClick={addRow} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Parcela
                </Button>
                <div className="text-[10px] text-muted-foreground mx-1">Sugerir:</div>
                {[1, 2, 3, 6].map((n) => (
                  <Button key={n} type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => applySuggestion(n)}>
                    {n}×
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => applySuggestion(items.length || 1)}
                >
                  <RotateCcw className="w-3 h-3" /> Restaurar
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Total: <span className="font-mono">{formatCurrency(total)}</span>
                  </span>
                  <Button type="button" size="sm" disabled={!dirty || saving || dueBeforeStart} onClick={save}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </div>

              {!matches && (
                <p className="text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Soma das parcelas difere do total em {formatCurrency(Math.abs(diff))}. Ajuste antes de avançar.
                </p>
              )}

              {dueBeforeStart && anchorStart && (
                <p className="text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Há parcela com vencimento anterior ao início do período ({new Date(`${anchorStart}T00:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}). Ajuste antes de salvar.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ReadonlySchedule({
  items,
  total,
  loading,
}: {
  items: Array<{ sequence: number; amount: string | number; dueDate: string; notes?: string | null }>;
  total?: number | string;
  loading?: boolean;
}) {
  const fmtDate = (d: string) => {
    try { return new Date(d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString("pt-BR", { timeZone: "UTC" }); } catch { return d; }
  };
  if (loading) return <p className="text-xs text-muted-foreground">carregando...</p>;
  if (!items || items.length === 0) {
    return <p className="text-xs text-muted-foreground">Pagamento em parcela única no início da campanha.</p>;
  }
  const totalNum = total != null ? (typeof total === "string" ? parseFloat(total) : total) : items.reduce((s, it) => s + parseFloat(String(it.amount)), 0);
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground border-b border-border/20">
          <th className="text-left py-1.5">#</th>
          <th className="text-left py-1.5">Vencimento</th>
          <th className="text-right py-1.5">Valor</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.sequence} className="border-b border-border/10">
            <td className="py-1.5 font-mono">{it.sequence}</td>
            <td className="py-1.5">{fmtDate(it.dueDate)}</td>
            <td className="py-1.5 text-right font-mono">{formatCurrency(parseFloat(String(it.amount)))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="text-foreground">
          <td colSpan={2} className="pt-2 text-right text-muted-foreground">Total</td>
          <td className="pt-2 text-right font-mono font-bold">{formatCurrency(totalNum)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
