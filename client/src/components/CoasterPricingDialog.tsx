import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, PackageCheck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { PricingDialogImportResult } from "./BudgetPricingDialog";
import type { ItemPremissas } from "@/hooks/useBudgetCalculator";

const SEMANAS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];

const DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11,
  28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
};

const PAGAMENTO_AJUSTE: Record<string, number> = { pix: -0.05, boleto: 0, cartao: 0 };

interface PricingTier {
  volumeMin: number;
  volumeMax: number | null;
  custoUnitario: string;
  frete: string;
  margem: string;
  artes: number;
}

interface CoasterPricingDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  tiers: PricingTier[];
  initialVolumeIdx?: number;
  initialSemanas?: number;
  initialPremissas?: ItemPremissas;
  onImport: (result: PricingDialogImportResult) => void;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function CoasterPricingDialog({
  open,
  onClose,
  productName,
  tiers,
  initialVolumeIdx = 0,
  initialSemanas = 12,
  initialPremissas,
  onImport,
}: CoasterPricingDialogProps) {
  const [volumeIdx, setVolumeIdx] = useState(initialVolumeIdx);
  const [semanas, setSemanas] = useState(initialSemanas);
  const [formaPagamento, setFormaPagamento] = useState("boleto");
  const [descontoParceiro, setDescontoParceiro] = useState(false);
  const [premissasOpen, setPremissasOpen] = useState(false);
  const [premissas, setPremissas] = useState<ItemPremissas>(
    initialPremissas ?? { irpj: 6, comissaoRestaurante: 15, comissaoComercial: 10 }
  );

  const semanaIdx = SEMANAS.indexOf(semanas) >= 0 ? SEMANAS.indexOf(semanas) : 2;

  const tier = tiers[Math.min(volumeIdx, tiers.length - 1)];

  const dados = useMemo(() => {
    if (!tier) return { custoGPC: 0, frete: 0, margem: 0.5, artes: 1 };
    return {
      custoGPC: parseFloat(tier.custoUnitario),
      frete: parseFloat(tier.frete),
      margem: parseFloat(tier.margem) / 100,
      artes: tier.artes,
    };
  }, [tier]);

  const calc = useMemo(() => {
    const volume = tier?.volumeMin ?? 1000;
    const irpj = premissas.irpj / 100;
    const comRest = premissas.comissaoRestaurante / 100;
    const comCom = premissas.comissaoComercial / 100;
    const denominador = 1 - dados.margem - irpj - comRest - comCom;

    const custoTotal4sem = dados.custoGPC * dados.artes * volume + dados.frete;
    const precoTotalBase4sem = denominador > 0
      ? custoTotal4sem / denominador
      : 0;
    const precoUnit4sem = volume > 0 ? precoTotalBase4sem / volume : 0;

    const smallestTier = tiers[0];
    const precoUnitSmallest = (() => {
      if (!smallestTier) return precoUnit4sem;
      const sv = smallestTier.volumeMin;
      const sg = parseFloat(smallestTier.custoUnitario);
      const sf = parseFloat(smallestTier.frete);
      const sm = parseFloat(smallestTier.margem) / 100;
      const sa = smallestTier.artes;
      const ct = sg * sa * sv + sf;
      const den = 1 - sm - irpj - comRest - comCom;
      return den > 0 ? (ct / den) / sv : 0;
    })();

    const descPrazo = (DESCONTOS_PRAZO[semanas] ?? 0) / 100;
    const ajPag = PAGAMENTO_AJUSTE[formaPagamento] ?? 0;
    const descParcPerc = descontoParceiro ? 0.10 : 0;

    const nPeriodos = semanas / 4;
    const precoSemDesconto = precoTotalBase4sem * nPeriodos;
    const precoComDescDuracao = precoSemDesconto * (1 - descPrazo);
    const precoAntesDescParceiro = precoComDescDuracao * (1 + ajPag);
    const precoFinal = precoAntesDescParceiro * (1 - descParcPerc);
    const precoUnitComDesc = volume > 0 ? precoFinal / (volume * nPeriodos) : 0;
    const descontoQuantidade = precoUnitSmallest > 0 && volume > (smallestTier?.volumeMin ?? 0)
      ? 1 - precoUnit4sem / precoUnitSmallest
      : 0;

    const custoTotalPeriodo = custoTotal4sem * nPeriodos;
    const valorIRPJ = precoFinal * irpj;
    const valorComRest = precoFinal * comRest;
    const valorComCom = precoFinal * comCom;
    const receitaLiquida = precoFinal - valorIRPJ - valorComRest - valorComCom;
    const lucroBruto = receitaLiquida - custoTotalPeriodo;
    const margemLiquida = precoFinal > 0 ? lucroBruto / precoFinal : 0;

    const tabela = SEMANAS.map((s) => {
      const mult = s / 4;
      const pSemDesc = precoTotalBase4sem * mult;
      const dsc = (DESCONTOS_PRAZO[s] ?? 0) / 100;
      const pComDesc = pSemDesc * (1 - dsc);
      const pFinal = pComDesc * (1 + ajPag) * (1 - descParcPerc);
      return { semanas: s, desconto: dsc, precoSemDesconto: pSemDesc, economia: pSemDesc - pComDesc, precoComDesconto: pComDesc, precoFinal: pFinal };
    });

    return {
      volume, precoUnit4sem, precoUnitSmallest, descontoQuantidade,
      nPeriodos, precoComDescDuracao, precoFinal, precoUnitComDesc,
      margemLiquida, custoTotalPeriodo, denominador,
      valorIRPJ, valorComRest, valorComCom, lucroBruto,
      custoTotal4sem, descPrazo, tabela,
    };
  }, [tier, tiers, dados, semanas, formaPagamento, descontoParceiro, premissas]);

  const handleImport = () => {
    onImport({ volumeIdx, semanas, premissas });
    onClose();
  };

  if (!tiers.length) return null;

  const inputCls = "bg-background border-border/30 h-7 text-xs font-mono px-2 w-20 text-right";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/30">
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackageCheck className="w-4 h-4 text-primary" />
            Simulador — {productName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure volume, duração e condições. Ao importar, os valores são aplicados ao item do orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5">
          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Volume
              </Label>
              <Badge variant="secondary" className="font-mono text-xs">
                {calc.volume.toLocaleString("pt-BR")} unidades
              </Badge>
            </div>
            <Slider
              min={0}
              max={tiers.length - 1}
              step={1}
              value={[volumeIdx]}
              onValueChange={([v]) => setVolumeIdx(v)}
              className="py-1"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {tiers.map((t, i) => (
                <span key={i} className={i === volumeIdx ? "text-primary font-semibold" : ""}>
                  {(t.volumeMin / 1000).toFixed(0)}k
                </span>
              ))}
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Duração da campanha
              </Label>
              <Badge variant="secondary" className="font-mono text-xs">
                {semanas} semanas · {semanas / 4} período{semanas / 4 > 1 ? "s" : ""}
              </Badge>
            </div>
            <Slider
              min={0}
              max={SEMANAS.length - 1}
              step={1}
              value={[semanaIdx]}
              onValueChange={([i]) => setSemanas(SEMANAS[i])}
              className="py-1"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              {SEMANAS.map((s, i) => (
                <span key={i} className={s === semanas ? "text-primary font-semibold" : ""}>
                  {s}s
                </span>
              ))}
            </div>
          </div>

          {/* Pagamento + Parceiro */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Forma de pagamento
              </Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger className="h-7 text-xs w-32 border-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto" className="text-xs">Boleto</SelectItem>
                  <SelectItem value="pix" className="text-xs">Pix (−5%)</SelectItem>
                  <SelectItem value="cartao" className="text-xs">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Switch
                checked={descontoParceiro}
                onCheckedChange={setDescontoParceiro}
                className="scale-90"
              />
              <Label className="text-xs cursor-pointer" onClick={() => setDescontoParceiro(!descontoParceiro)}>
                Desconto de parceiro (−10%)
              </Label>
            </div>
          </div>

          {/* Premissas */}
          <Collapsible open={premissasOpen} onOpenChange={setPremissasOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider font-medium transition-colors">
              {premissasOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Premissas financeiras
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-3 gap-3 bg-muted/30 rounded-lg p-3">
                {([
                  ["IRPJ (%)", "irpj"],
                  ["Com. Local (%)", "comissaoRestaurante"],
                  ["Com. Com. (%)", "comissaoComercial"],
                ] as [string, keyof ItemPremissas][]).map(([label, key]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      className={inputCls}
                      type="number"
                      value={premissas[key]}
                      onChange={(e) =>
                        setPremissas((p) => ({ ...p, [key]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <span>Margem (tier): {fmtPct(dados.margem)}</span>
                <span>Denominador: {fmtPct(calc.denominador)}</span>
                <span>Custo/un.: {fmtBRL(dados.custoGPC)}</span>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Resultado */}
          <div className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden">
            <div className="bg-primary/10 border-b border-border/30 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor total da campanha</p>
                <p className="text-2xl font-bold text-primary font-mono">{fmtBRL(calc.precoFinal)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço por unidade</p>
                <p className="text-lg font-semibold font-mono">{fmtBRL(calc.precoUnitComDesc)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/30 text-center">
              {[
                { label: "Duração", value: `${semanas}s · ${calc.nPeriodos}per.` },
                { label: "Margem liq.", value: fmtPct(calc.margemLiquida) },
                { label: "Desc. prazo", value: fmtPct(calc.descPrazo) },
                { label: "Lucro bruto", value: fmtBRL(calc.lucroBruto) },
              ].map((kpi) => (
                <div key={kpi.label} className="py-2 px-3">
                  <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  <p className="text-xs font-semibold font-mono">{kpi.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela de preços por duração */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Tabela de preços por duração
            </p>
            <div className="rounded-lg border border-border/30 overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/30">
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Semanas</th>
                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Preço s/ Desc.</th>
                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Desc.</th>
                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Economia</th>
                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Preço Final</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.tabela.map((row) => (
                    <tr
                      key={row.semanas}
                      className={`border-b border-border/20 transition-colors ${
                        row.semanas === semanas
                          ? "bg-primary/10 font-semibold"
                          : "hover:bg-muted/20"
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        {row.semanas}s
                        <span className="text-muted-foreground ml-1 font-normal">
                          · {row.semanas / 4}per.
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                        {fmtBRL(row.precoSemDesconto)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-emerald-600">
                        {row.desconto > 0 ? `−${fmtPct(row.desconto)}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-600">
                        {row.economia > 0 ? fmtBRL(row.economia) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {fmtBRL(row.precoFinal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleImport} className="gap-1.5">
              <PackageCheck className="w-3.5 h-3.5" />
              Importar para Orçamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
