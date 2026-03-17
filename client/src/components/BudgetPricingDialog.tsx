import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { Download, Info } from "lucide-react";
import {
  SEMANAS_OPTIONS,
  DESCONTOS_PRAZO,
  DEFAULT_PREMISSAS,
  calcItemPrice,
  fmtBRL,
  fmtBRL4,
  type ItemPremissas,
} from "../hooks/useBudgetCalculator";

interface PricingTier {
  id: number;
  productId: number;
  volumeMin: number;
  volumeMax: number | null;
  custoUnitario: string;
  frete: string;
  margem: string;
  artes: number | null;
}

export interface PricingDialogImportResult {
  volumeIdx?: number;
  freeVolume?: number;
  freeManualCost?: number;
  semanas: number;
  premissas: ItemPremissas;
}

interface BudgetPricingDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  tiers: PricingTier[];
  hasTiers: boolean;
  initialVolumeIdx?: number;
  initialFreeVolume?: number;
  initialFreeManualCost?: number;
  initialSemanas?: number;
  initialPremissas?: ItemPremissas;
  onImport: (result: PricingDialogImportResult) => void;
}

function TierLabel({ tier }: { tier: PricingTier }) {
  const max = tier.volumeMax ? `${tier.volumeMax.toLocaleString("pt-BR")}` : "∞";
  return (
    <span>
      {tier.volumeMin.toLocaleString("pt-BR")} – {max} un.
      <span className="text-muted-foreground ml-2 text-xs">
        (custo {fmtBRL4(parseFloat(tier.custoUnitario))}/un.)
      </span>
    </span>
  );
}

export function BudgetPricingDialog({
  open,
  onClose,
  productName,
  tiers,
  hasTiers,
  initialVolumeIdx = 0,
  initialFreeVolume = 100,
  initialFreeManualCost = 0,
  initialSemanas = 12,
  initialPremissas = DEFAULT_PREMISSAS,
  onImport,
}: BudgetPricingDialogProps) {
  const [volumeIdx, setVolumeIdx] = useState(initialVolumeIdx);
  const [freeVolume, setFreeVolume] = useState(initialFreeVolume);
  const [freeCost, setFreeCost] = useState(initialFreeManualCost);
  const [semanas, setSemanas] = useState(initialSemanas);
  const [premissas, setPremissas] = useState<ItemPremissas>(initialPremissas);
  const [showPremissas, setShowPremissas] = useState(false);

  const selectedTier = hasTiers ? tiers[volumeIdx] : null;

  const pricingInput = useMemo(() => {
    if (hasTiers && selectedTier) {
      return {
        volume: selectedTier.volumeMin,
        custoUnitario: parseFloat(selectedTier.custoUnitario),
        frete: parseFloat(selectedTier.frete),
        margem: parseFloat(selectedTier.margem) / 100,
        artes: selectedTier.artes ?? 1,
        semanas,
        premissas,
      };
    }
    return {
      volume: freeVolume,
      custoUnitario: freeCost,
      frete: 0,
      margem: 0.5,
      artes: 1,
      semanas,
      premissas,
    };
  }, [hasTiers, selectedTier, freeVolume, freeCost, semanas, premissas]);

  const calc = useMemo(() => calcItemPrice(pricingInput), [pricingInput]);

  // Full semanas table: pricing for every duration option
  const tabelaSemanas = useMemo(() => {
    return SEMANAS_OPTIONS.map((s) => {
      const input = { ...pricingInput, semanas: s };
      const c = calcItemPrice(input);
      return {
        semanas: s,
        descPerc: DESCONTOS_PRAZO[s] ?? 0,
        precoTotal: c.precoComDescDuracao,
        precoUnit: pricingInput.volume > 0 ? c.precoComDescDuracao / pricingInput.volume : 0,
        isCurrent: s === semanas,
      };
    });
  }, [pricingInput, semanas]);

  const handleImport = () => {
    onImport({
      volumeIdx: hasTiers ? volumeIdx : undefined,
      freeVolume: hasTiers ? undefined : freeVolume,
      freeManualCost: hasTiers ? undefined : freeCost,
      semanas,
      premissas,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Precificador — <span className="text-primary">{productName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Volume */}
          {hasTiers ? (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Faixa de volume</Label>
              <Select value={String(volumeIdx)} onValueChange={(v) => setVolumeIdx(Number(v))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier, idx) => (
                    <SelectItem key={tier.id} value={String(idx)}>
                      <TierLabel tier={tier} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTier && (
                <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                  <div className="bg-muted/40 rounded p-2 text-center border border-border/20">
                    <p className="font-mono font-medium text-foreground">{fmtBRL4(parseFloat(selectedTier.custoUnitario))}</p>
                    <p>Custo/un.</p>
                  </div>
                  <div className="bg-muted/40 rounded p-2 text-center border border-border/20">
                    <p className="font-mono font-medium text-foreground">{fmtBRL(parseFloat(selectedTier.frete))}</p>
                    <p>Frete</p>
                  </div>
                  <div className="bg-muted/40 rounded p-2 text-center border border-border/20">
                    <p className="font-mono font-medium text-foreground">{parseFloat(selectedTier.margem).toFixed(1)}%</p>
                    <p>Margem</p>
                  </div>
                  <div className="bg-muted/40 rounded p-2 text-center border border-border/20">
                    <p className="font-mono font-medium text-foreground">{selectedTier.artes ?? 1}</p>
                    <p>Artes</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Volume (un.)</Label>
                <Input
                  type="number"
                  min={1}
                  value={freeVolume}
                  onChange={(e) => setFreeVolume(parseInt(e.target.value) || 1)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Custo unitário (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.0001}
                  value={freeCost}
                  onChange={(e) => setFreeCost(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          {/* Duration + Result */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Duração da campanha</Label>
              </div>
            </div>
            <Select value={String(semanas)} onValueChange={(v) => setSemanas(Number(v))}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMANAS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} semanas{(DESCONTOS_PRAZO[s] ?? 0) > 0 ? ` · −${DESCONTOS_PRAZO[s]}%` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {calc.precoTotalBase4sem > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Preço/un. base</p>
                  <p className="font-mono font-semibold text-sm mt-0.5">{fmtBRL4(calc.precoUnit4sem)}</p>
                </div>
                <div className="text-center border-x border-border/30">
                  <p className="text-xs text-muted-foreground">
                    {calc.descPrazoPerc > 0 ? `Total c/ desc. ${(calc.descPrazoPerc * 100).toFixed(0)}%` : "Total"}
                  </p>
                  <p className="font-mono font-semibold text-primary text-lg mt-0.5">{fmtBRL(calc.precoComDescDuracao)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{calc.nPeriodos} período(s) × 4sem</p>
                  <p className="font-mono text-sm text-muted-foreground mt-0.5">
                    {fmtBRL(calc.precoComDescDuracao / calc.nPeriodos)}/mês
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Semanas table */}
          {calc.precoTotalBase4sem > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Tabela de preços por duração
              </p>
              <div className="rounded-lg border border-border/30 overflow-hidden text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground">
                      <th className="text-left p-2 pl-3 font-medium">Semanas</th>
                      <th className="text-right p-2 font-medium">Desc. prazo</th>
                      <th className="text-right p-2 font-medium">Total</th>
                      <th className="text-right p-2 pr-3 font-medium">Preço/un.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabelaSemanas.map((row) => (
                      <tr
                        key={row.semanas}
                        className={`border-t border-border/20 cursor-pointer transition-colors ${row.isCurrent ? "bg-primary/8 font-semibold" : "hover:bg-muted/30"}`}
                        onClick={() => setSemanas(row.semanas)}
                      >
                        <td className="p-2 pl-3">
                          <span className="flex items-center gap-1.5">
                            {row.semanas}sem
                            {row.isCurrent && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">selecionado</Badge>
                            )}
                          </span>
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          {row.descPerc > 0 ? `−${row.descPerc}%` : "—"}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {fmtBRL(row.precoTotal)}
                        </td>
                        <td className="p-2 pr-3 text-right font-mono text-muted-foreground">
                          {fmtBRL4(row.precoUnit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" /> Clique em uma linha para selecionar essa duração
              </p>
            </div>
          )}

          {/* Premissas */}
          <div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              onClick={() => setShowPremissas(!showPremissas)}
            >
              {showPremissas ? "▾" : "▸"} Premissas ({premissas.irpj}% IRPJ · {premissas.comissaoRestaurante}% Rest. · {premissas.comissaoComercial}% Com.)
            </button>
            {showPremissas && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: "IRPJ %", key: "irpj" as const },
                  { label: "Com. Restaurante %", key: "comissaoRestaurante" as const },
                  { label: "Com. Comercial %", key: "comissaoComercial" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">{label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={premissas[key]}
                      onChange={(e) => setPremissas((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={calc.precoTotalBase4sem <= 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Importar para Orçamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
