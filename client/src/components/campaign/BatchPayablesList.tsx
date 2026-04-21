import { useEffect, useRef, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Wallet, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

type FinancialsData = RouterOutputs["campaignPhase"]["getFinancials"];
type Invoice = FinancialsData["invoice"];
type Payable = FinancialsData["payables"][number];

const TYPE_LABEL: Record<string, string> = {
  tax: "Imposto",
  restaurant_commission: "Comissão Restaurante",
  vip_repasse: "Repasse VIP",
  bv_campanha: "BV da Campanha",
  partner_commission: "BV da Campanha",
  supplier_cost: "Custo Fornecedor",
  freight_cost: "Frete",
  seller_commission: "Comissão Vendedor",
  manual: "Manual",
};

const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-blue-100 text-blue-800",
  pago: "bg-emerald-100 text-emerald-800",
  cancelada: "bg-zinc-100 text-zinc-700",
};

export function BatchPayablesList({
  phaseId,
  campaignId,
  invoice,
  payables,
  onChange,
}: {
  phaseId: number;
  campaignId: number;
  invoice: Invoice;
  payables: Payable[];
  onChange: () => void;
}) {
  const triedRef = useRef(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [mDesc, setMDesc] = useState("");
  const [mAmount, setMAmount] = useState("");
  const [mDue, setMDue] = useState(new Date().toISOString().slice(0, 10));

  const generateMut = trpc.campaignPhase.generatePayables.useMutation({
    onSuccess: (r) => {
      const created = r.created ?? 0;
      const updated = r.updated ?? 0;
      if (created > 0 || updated > 0) {
        toast.success(`Lançamentos gerados: ${created} novos, ${updated} atualizados`);
      }
      onChange();
    },
    onError: (e) => toast.error(e.message),
  });
  const regenMut = trpc.campaignPhase.regeneratePayables.useMutation({
    onSuccess: (r) => { toast.success(`Regenerados ${r.regenerated}, cancelados ${r.cancelled}`); onChange(); },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.financial.createAccountPayable.useMutation({
    onSuccess: () => {
      toast.success("Lançamento manual criado");
      setManualOpen(false);
      setMDesc(""); setMAmount("");
      onChange();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (triedRef.current) return;
    if (!invoice) return;
    if (payables.length > 0) return;
    if (invoice.status !== "emitida" && invoice.status !== "paga") return;
    triedRef.current = true;
    generateMut.mutate({ phaseId });
  }, [invoice, payables.length, phaseId]);

  const submitManual = () => {
    const amt = mAmount.replace(",", ".").trim();
    if (!mDesc.trim() || !amt || Number(amt) <= 0) {
      toast.error("Descrição e valor (> 0) obrigatórios");
      return;
    }
    createMut.mutate({
      campaignId,
      campaignPhaseId: phaseId,
      type: "manual",
      description: mDesc.trim(),
      amount: amt,
      dueDate: mDue || undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          Contas a Pagar deste Batch
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setManualOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar manual
            </Button>
            <Button
              size="sm" variant="ghost" className="h-7"
              onClick={() => regenMut.mutate({ phaseId })}
              disabled={regenMut.isPending || !invoice}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${regenMut.isPending ? "animate-spin" : ""}`} />
              Regenerar previstos
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {payables.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            {!invoice
              ? "Sem fatura — agende uma fatura prevista primeiro."
              : invoice.status === "prevista"
                ? "Lançamentos serão criados automaticamente quando a fatura for emitida."
                : "Gerando lançamentos automaticamente…"}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Descrição</th>
                  <th className="text-right px-3 py-2 font-medium">Valor</th>
                  <th className="text-left px-3 py-2 font-medium w-28">Vencimento</th>
                  <th className="text-right px-3 py-2 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {payables.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{TYPE_LABEL[p.sourceType ?? p.type ?? ""] ?? p.sourceType ?? p.type}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-md">{p.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(p.amount ?? 0))}</td>
                    <td className="px-3 py-2">{p.dueDate || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge className={STATUS_STYLE[p.status] ?? "bg-zinc-100 text-zinc-700"}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar lançamento manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Ex.: Custo extra de produção" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input value={mAmount} onChange={(e) => setMAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={mDue} onChange={(e) => setMDue(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button>
            <Button onClick={submitManual} disabled={createMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
