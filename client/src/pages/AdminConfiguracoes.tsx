import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Percent, Save, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type FieldKey = "irpj" | "comissaoRestaurante" | "comissaoComercial" | "bvPadraoAgencia";

const FIELDS: { key: FieldKey; label: string; help: string }[] = [
  { key: "irpj", label: "IRPJ", help: "Imposto retido embutido no gross-up de preço." },
  { key: "comissaoRestaurante", label: "Comissão Local", help: "Repasse padrão ao ponto de mídia (restaurante/local)." },
  { key: "comissaoComercial", label: "Comissão Comercial", help: "Comissão padrão do time comercial." },
  { key: "bvPadraoAgencia", label: "BV Agência", help: "Bonificação de veiculação embutida nos preços públicos." },
];

const DEFAULTS: Record<FieldKey, number> = {
  irpj: 0.06,
  comissaoRestaurante: 0.15,
  comissaoComercial: 0.1,
  bvPadraoAgencia: 0.2,
};

/** decimal (0.06) → string percent ("6") */
function toPct(decimal: number): string {
  return (decimal * 100).toString();
}
/** string percent ("6") → decimal string ("0.06") */
function toDecimalStr(pct: string): string {
  const n = parseFloat(pct);
  if (!Number.isFinite(n)) return "0";
  return (n / 100).toString();
}

export default function AdminConfiguracoes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data, isLoading } = trpc.systemConfig.getAll.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<Record<FieldKey, string>>({
    irpj: toPct(DEFAULTS.irpj),
    comissaoRestaurante: toPct(DEFAULTS.comissaoRestaurante),
    comissaoComercial: toPct(DEFAULTS.comissaoComercial),
    bvPadraoAgencia: toPct(DEFAULTS.bvPadraoAgencia),
  });

  useEffect(() => {
    if (!data?.values) return;
    setForm((prev) => {
      const next = { ...prev };
      for (const f of FIELDS) {
        const raw = data.values[f.key];
        if (raw !== undefined) {
          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed)) next[f.key] = toPct(parsed);
        }
      }
      return next;
    });
  }, [data]);

  const saveMutation = trpc.systemConfig.setMany.useMutation({
    onSuccess: () => {
      toast.success("Premissas atualizadas. Novas cotações usarão os valores atuais.");
      utils.systemConfig.getAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSave() {
    const entries = FIELDS.map((f) => ({ key: f.key, value: toDecimalStr(form[f.key]) }));
    for (const e of entries) {
      const n = parseFloat(e.value);
      if (!Number.isFinite(n) || n < 0 || n >= 1) {
        toast.error(`Valor inválido para ${FIELDS.find((f) => f.key === e.key)?.label}. Use 0–99%.`);
        return;
      }
    }
    saveMutation.mutate(entries);
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          Premissas Financeiras
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fonte de verdade global de IRPJ, comissões e BV. Cada cotação grava um snapshot
          destes valores no momento da criação — alterações aqui não afetam cotações já emitidas.
        </p>
      </div>

      <div className="bg-card border border-border/40 rounded-xl p-6 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-sm font-medium">{f.label}</Label>
                <div className="relative">
                  <Input
                    id={f.key}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="99.9"
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="pr-9"
                  />
                  <Percent className="w-3.5 h-3.5 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-muted-foreground">{f.help}</p>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                {data?.updatedAt
                  ? `Última atualização: ${new Date(data.updatedAt).toLocaleString("pt-BR")}${data.updatedBy ? ` por ${data.updatedBy}` : ""}`
                  : "Ainda não configurado (usando valores padrão)."}
              </p>
              <Button size="sm" className="gap-1.5" disabled={saveMutation.isPending} onClick={handleSave}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
