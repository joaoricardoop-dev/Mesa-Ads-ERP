import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { getInvoiceBadgeMeta, type ScheduleSlot } from "./InvoiceSchedule";
import { Badge } from "@/components/ui/badge";

function fmtDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function EmitInvoiceModal({
  open,
  onOpenChange,
  campaignName,
  slots,
  defaultPhaseId,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignName: string;
  slots: ScheduleSlot[];
  defaultPhaseId?: number | null;
  onConfirmed?: () => void;
}) {
  // Filtra só os slots que têm fatura prevista (são os emissíveis)
  const previstaSlots = useMemo(
    () => slots.filter((s) => s.invoice?.status === "prevista"),
    [slots],
  );

  const initialPhaseId = useMemo(() => {
    if (defaultPhaseId && previstaSlots.find((s) => s.phaseId === defaultPhaseId)) {
      return defaultPhaseId;
    }
    // Sugere o primeiro previsto (cronologicamente)
    return previstaSlots[0]?.phaseId ?? null;
  }, [defaultPhaseId, previstaSlots]);

  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(initialPhaseId);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedPhaseId(initialPhaseId);
  }, [open, initialPhaseId]);

  const selected = previstaSlots.find((s) => s.phaseId === selectedPhaseId) ?? null;

  useEffect(() => {
    if (!selected?.invoice) return;
    const today = new Date().toISOString().slice(0, 10);
    setIssueDate(today);
    setDueDate(addDaysIso(today, 15));
    setInvoiceNumber("");
    setDocumentUrl("");
  }, [selected?.invoice?.id]);

  const utils = trpc.useContext();
  const confirmMut = trpc.financial.confirmInvoiceEmission.useMutation({
    onSuccess: () => {
      toast.success("Fatura emitida com sucesso");
      utils.campaignPhase.consolidation.invalidate().catch(() => {});
      utils.campaignPhase.listByCampaign.invalidate().catch(() => {});
      utils.financial.listInvoices?.invalidate?.().catch?.(() => {});
      onConfirmed?.();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao emitir fatura");
    },
  });

  const handleConfirm = () => {
    if (!selected?.invoice) return;
    confirmMut.mutate({
      id: selected.invoice.id,
      invoiceNumber: invoiceNumber.trim() || undefined,
      issueDate: issueDate || undefined,
      dueDate: dueDate || undefined,
      documentUrl: documentUrl.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Emitir Fatura · {campaignName}</DialogTitle>
        </DialogHeader>

        {previstaSlots.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Não há faturas previstas pendentes de emissão para esta campanha.
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Escolha o batch a faturar
              </Label>
              <RadioGroup
                value={selectedPhaseId ? String(selectedPhaseId) : ""}
                onValueChange={(v) => setSelectedPhaseId(Number(v))}
                className="mt-2 space-y-1.5 max-h-64 overflow-y-auto"
              >
                {slots.map((s) => {
                  const status = s.invoice?.status ?? "none";
                  const meta = getInvoiceBadgeMeta(status);
                  const disabled = status !== "prevista";
                  return (
                    <label
                      key={s.phaseId}
                      htmlFor={`emit-slot-${s.phaseId}`}
                      className={`flex items-center gap-2.5 border rounded-lg p-2.5 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"} ${selectedPhaseId === s.phaseId ? "border-primary/60 bg-primary/5" : "border-border/30"}`}
                    >
                      <RadioGroupItem
                        id={`emit-slot-${s.phaseId}`}
                        value={String(s.phaseId)}
                        disabled={disabled}
                        data-testid={`emit-radio-batch-${s.sequence}`}
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-sm font-medium">Batch {s.sequence} · {s.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(s.invoice?.amount ?? s.expectedRevenue)}
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-[9px] uppercase ${meta.cls}`}>
                        {meta.label}
                      </Badge>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {selected?.invoice && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">Número NF</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Auto se vazio (FAT-AAAA-NNNN)"
                    maxLength={20}
                    data-testid="input-emit-invoice-number"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">Data de emissão</Label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => {
                      setIssueDate(e.target.value);
                      if (e.target.value) setDueDate(addDaysIso(e.target.value, 15));
                    }}
                    data-testid="input-emit-issue-date"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">Vencimento (+15 dias)</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    data-testid="input-emit-due-date"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">URL da NF (opcional)</Label>
                  <Input
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                    placeholder="https://…"
                    data-testid="input-emit-document-url"
                  />
                </div>
                <div className="col-span-2 text-[11px] text-muted-foreground">
                  Período do batch: {fmtDate(selected.periodStart)} → {fmtDate(selected.periodEnd)}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected?.invoice || confirmMut.isPending || previstaSlots.length === 0}
            data-testid="button-confirm-emit-invoice"
          >
            {confirmMut.isPending ? "Emitindo…" : "Confirmar emissão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
