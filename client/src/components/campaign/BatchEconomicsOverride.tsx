import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, X, Check, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Field = {
  key: string;
  label: string;
  unit: "%" | "R$";
  show: (canalTipo: string, hasBV: boolean) => boolean;
};

const FIELDS: Field[] = [
  { key: "taxRateOverride",              label: "Alíquota IRPJ",        unit: "%",  show: () => true },
  { key: "restaurantCommissionOverride", label: "Comissão Restaurante", unit: "%",  show: (c) => c === "restaurante" },
  { key: "vipRepasseOverride",           label: "Repasse Sala VIP",     unit: "%",  show: (c) => c === "vip" },
  { key: "bvPercentOverride",            label: "BV da Campanha",       unit: "%",  show: (_, b) => b },
  { key: "grossUpRateOverride",          label: "Gross-up BV",          unit: "%",  show: (_, b) => b },
  { key: "freightCostOverride",          label: "Custo Frete",          unit: "R$", show: (c) => c !== "vip" },
  { key: "batchCostOverride",            label: "Custo Produção (batch)", unit: "R$", show: (c) => c !== "vip" },
];

const EFFECTIVE_KEY: Record<string, string> = {
  taxRateOverride: "taxRate",
  restaurantCommissionOverride: "restaurantCommission",
  vipRepasseOverride: "vipRepasse",
  bvPercentOverride: "bvPercent",
  grossUpRateOverride: "grossUpRate",
  freightCostOverride: "freightCost",
  batchCostOverride: "productionCost",
};

function fmt(value: number, unit: "%" | "R$") {
  if (unit === "%") return `${value.toFixed(2).replace(".", ",")}%`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BatchEconomicsOverride({
  phaseId,
  financials,
  partner,
  onChange,
}: {
  phaseId: number;
  financials: any;
  partner: any;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const setMut = trpc.campaignPhase.setOverride.useMutation({
    onSuccess: () => { toast.success("Override salvo"); setEditing(null); onChange(); },
    onError: (e) => toast.error(e.message),
  });
  const clearMut = trpc.campaignPhase.clearOverride.useMutation({
    onSuccess: () => { toast.success("Override removido"); onChange(); },
    onError: (e) => toast.error(e.message),
  });

  const canalTipo = financials.canalTipo as string;
  const hasBV = !!partner;

  const visible = FIELDS.filter((f) => f.show(canalTipo, hasBV));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Parâmetros deste Batch
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            Vazio = herda da campanha
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Parâmetro</th>
                <th className="text-right px-3 py-2 font-medium">Valor Efetivo</th>
                <th className="text-right px-3 py-2 font-medium w-32">Origem</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => {
                const effKey = EFFECTIVE_KEY[f.key];
                const eff = financials.effective[effKey];
                const isOverride = eff?.source === "override";
                const isEditing = editing === f.key;
                return (
                  <tr key={f.key} className="border-t">
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setMut.mutate({ phaseId, field: f.key as any, value: draft || null });
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="h-7 text-right w-24 ml-auto"
                          placeholder={f.unit === "%" ? "0,00" : "0,00"}
                        />
                      ) : (
                        fmt(Number(eff?.value ?? 0), f.unit)
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isOverride ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">override</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">herdado</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => setMut.mutate({ phaseId, field: f.key as any, value: draft || null })}
                              disabled={setMut.isPending}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setDraft(String(eff?.value ?? "")); setEditing(f.key); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {isOverride && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600"
                                onClick={() => clearMut.mutate({ phaseId, field: f.key as any })}
                                disabled={clearMut.isPending}
                                title="Restaurar valor herdado">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
