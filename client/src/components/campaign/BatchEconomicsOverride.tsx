import { useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, X, Check, Settings2 } from "lucide-react";
import { toast } from "sonner";

type FinancialsData = RouterOutputs["campaignPhase"]["getFinancials"];
type Financials = FinancialsData["financials"];
type Partner = FinancialsData["partner"];
type EffectiveKey = keyof Financials["effective"];

const OVERRIDE_FIELDS = [
  "taxRateOverride",
  "restaurantCommissionOverride",
  "vipRepasseOverride",
  "bvPercentOverride",
  "grossUpRateOverride",
  "freightCostOverride",
  "batchCostOverride",
] as const;
type OverrideField = (typeof OVERRIDE_FIELDS)[number];

type Field = {
  key: OverrideField;
  effectiveKey: EffectiveKey;
  label: string;
  unit: "%" | "R$";
  applies: (canalTipo: Financials["canalTipo"], hasBV: boolean) => boolean;
};

const FIELDS: Field[] = [
  { key: "taxRateOverride",              effectiveKey: "taxRate",              label: "Alíquota IRPJ",          unit: "%",  applies: () => true },
  { key: "restaurantCommissionOverride", effectiveKey: "restaurantCommission", label: "Comissão Restaurante",   unit: "%",  applies: (c) => c === "restaurante" },
  { key: "vipRepasseOverride",           effectiveKey: "vipRepasse",           label: "Repasse Sala VIP",       unit: "%",  applies: (c) => c === "vip" },
  { key: "bvPercentOverride",            effectiveKey: "bvPercent",            label: "BV da Campanha",         unit: "%",  applies: (_, b) => b },
  { key: "grossUpRateOverride",          effectiveKey: "grossUpRate",          label: "Gross-up BV",            unit: "%",  applies: (_, b) => b },
  { key: "freightCostOverride",          effectiveKey: "freightCost",          label: "Custo Frete",            unit: "R$", applies: () => true },
  { key: "batchCostOverride",            effectiveKey: "productionCost",       label: "Custo Produção (batch)", unit: "R$", applies: () => true },
];

function fmt(value: number, unit: "%" | "R$") {
  if (unit === "%") return `${value.toFixed(2).replace(".", ",")}%`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inheritedFor(effective: { value: number; source: string }): number | null {
  // Quando NÃO há override, effective.value já é o herdado.
  if (effective.source !== "override") return effective.value;
  // Quando há override, o backend ainda não devolve o valor herdado
  // explícito; renderizamos "—" para evitar mostrar zeros sintéticos.
  return null;
}

export function BatchEconomicsOverride({
  phaseId,
  financials,
  partner,
  onChange,
}: {
  phaseId: number;
  financials: Financials;
  partner: Partner;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<OverrideField | null>(null);
  const [draft, setDraft] = useState("");

  const setMut = trpc.campaignPhase.setOverride.useMutation({
    onSuccess: () => { toast.success("Override salvo"); setEditing(null); onChange(); },
    onError: (e) => toast.error(e.message),
  });
  const clearMut = trpc.campaignPhase.clearOverride.useMutation({
    onSuccess: () => { toast.success("Override removido"); onChange(); },
    onError: (e) => toast.error(e.message),
  });

  const canalTipo = financials.canalTipo;
  const hasBV = !!partner;

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
                <th className="text-right px-3 py-2 font-medium">Campanha (herdado)</th>
                <th className="text-right px-3 py-2 font-medium">Este Batch</th>
                <th className="px-3 py-2 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const eff = financials.effective[f.effectiveKey];
                const isOverride = eff.source === "override";
                const isEditing = editing === f.key;
                const applies = f.applies(canalTipo, hasBV);
                const inherited = inheritedFor(eff);
                return (
                  <tr key={f.key} className={`border-t ${applies ? "" : "opacity-60"}`}>
                    <td className="px-3 py-2">
                      {f.label}
                      {!applies && (
                        <span className="ml-2 text-xs text-muted-foreground">(não aplicável a este canal)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {inherited === null ? "—" : fmt(inherited, f.unit)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setMut.mutate({ phaseId, field: f.key, value: draft || null });
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="h-7 text-right w-24 ml-auto"
                          placeholder={f.unit === "%" ? "0,00" : "0,00"}
                        />
                      ) : isOverride ? (
                        <span className="inline-flex items-center gap-2">
                          {fmt(eff.value, f.unit)}
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">override</Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => setMut.mutate({ phaseId, field: f.key, value: draft || null })}
                              disabled={setMut.isPending}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(null)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                              disabled={!applies}
                              onClick={() => { setDraft(isOverride ? String(eff.value) : ""); setEditing(f.key); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {isOverride && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600"
                                onClick={() => clearMut.mutate({ phaseId, field: f.key })}
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
        <p className="text-xs text-muted-foreground mt-2">
          Salvar override regenera automaticamente os lançamentos previstos
          deste batch (paid/pending preservados).
        </p>
      </CardContent>
    </Card>
  );
}
