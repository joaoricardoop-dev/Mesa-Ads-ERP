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
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { PackagePlus, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export interface CustomProductValues {
  customProductName: string;
  customProjectCost: string;
  customPricingMode: "margin" | "fixed_price";
  customMarginPercent: string;
  customFinalPrice: string;
  customRestaurantCommission: string;
  customPartnerCommission: string;
  customSellerCommission: string;
  calculatedFinalPrice: number;
}

interface CustomProductDialogProps {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  initialValues?: Partial<CustomProductValues>;
  onConfirm: (values: CustomProductValues) => void;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number) {
  return `${v.toFixed(2)}%`;
}

export function CustomProductDialog({
  open,
  onClose,
  onOpenChange,
  initialValues,
  onConfirm,
}: CustomProductDialogProps) {
  const handleClose = () => {
    onClose?.();
    onOpenChange?.(false);
  };
  const [productName, setProductName] = useState(initialValues?.customProductName ?? "");
  const [projectCost, setProjectCost] = useState(initialValues?.customProjectCost ?? "");
  const [pricingMode, setPricingMode] = useState<"margin" | "fixed_price">(
    initialValues?.customPricingMode ?? "margin"
  );
  const [marginPercent, setMarginPercent] = useState(initialValues?.customMarginPercent ?? "30");
  const [finalPriceInput, setFinalPriceInput] = useState(initialValues?.customFinalPrice ?? "");
  const [restaurantComm, setRestaurantComm] = useState(initialValues?.customRestaurantCommission ?? "20");
  const [partnerComm, setPartnerComm] = useState(initialValues?.customPartnerCommission ?? "10");
  const [sellerComm, setSellerComm] = useState(initialValues?.customSellerCommission ?? "10");

  const calc = useMemo(() => {
    const cost = parseFloat(projectCost.replace(",", ".")) || 0;
    const restRate = (parseFloat(restaurantComm) || 0) / 100;
    const partnerRate = (parseFloat(partnerComm) || 0) / 100;
    const sellerRate = (parseFloat(sellerComm) || 0) / 100;

    if (pricingMode === "margin") {
      const marginRate = (parseFloat(marginPercent) || 0) / 100;
      const denominator = 1 - restRate - partnerRate - sellerRate - marginRate;
      if (denominator <= 0 || cost <= 0) return null;
      const finalPrice = cost / denominator;
      const restValue = finalPrice * restRate;
      const partnerValue = finalPrice * partnerRate;
      const sellerValue = finalPrice * sellerRate;
      const marginValue = finalPrice * marginRate;
      return {
        finalPrice,
        restValue,
        partnerValue,
        sellerValue,
        marginValue,
        marginPct: marginRate * 100,
        denominator,
      };
    } else {
      const fp = parseFloat(finalPriceInput.replace(",", ".")) || 0;
      if (fp <= 0 || cost <= 0) return null;
      const restValue = fp * restRate;
      const partnerValue = fp * partnerRate;
      const sellerValue = fp * sellerRate;
      const marginValue = fp - cost - restValue - partnerValue - sellerValue;
      const marginPct = fp > 0 ? (marginValue / fp) * 100 : 0;
      return {
        finalPrice: fp,
        restValue,
        partnerValue,
        sellerValue,
        marginValue,
        marginPct,
        denominator: fp > 0 ? cost / fp : 0,
      };
    }
  }, [projectCost, pricingMode, marginPercent, finalPriceInput, restaurantComm, partnerComm, sellerComm]);

  const isValid = !!(productName.trim() && calc && calc.finalPrice > 0);

  const handleConfirm = () => {
    if (!isValid || !calc) return;
    onConfirm({
      customProductName: productName.trim(),
      customProjectCost: projectCost,
      customPricingMode: pricingMode,
      customMarginPercent: marginPercent,
      customFinalPrice: pricingMode === "fixed_price" ? finalPriceInput : String(calc.finalPrice.toFixed(2)),
      customRestaurantCommission: restaurantComm,
      customPartnerCommission: partnerComm,
      customSellerCommission: sellerComm,
      calculatedFinalPrice: calc.finalPrice,
    });
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PackagePlus className="w-4 h-4 text-primary" />
            Produto Personalizado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Nome / Descrição do projeto <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Evento especial, Ação de marketing..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="h-9"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Custo total do projeto (R$) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={projectCost}
              onChange={(e) => setProjectCost(e.target.value)}
              className="h-9"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Modo de precificação</Label>
            <ToggleGroup
              type="single"
              value={pricingMode}
              onValueChange={(v) => { if (v) setPricingMode(v as "margin" | "fixed_price"); }}
              className="justify-start gap-2"
            >
              <ToggleGroupItem value="margin" className="h-8 text-xs px-3">
                Definir margem (%)
              </ToggleGroupItem>
              <ToggleGroupItem value="fixed_price" className="h-8 text-xs px-3">
                Definir preço final (R$)
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {pricingMode === "margin" ? (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Margem (%)</Label>
              <Input
                type="number"
                min={0}
                max={99}
                step={0.5}
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                className="h-9 w-32"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Preço final (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                value={finalPriceInput}
                onChange={(e) => setFinalPriceInput(e.target.value)}
                className="h-9 w-48"
              />
            </div>
          )}

          <Separator />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Comissões individuais
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Restaurante (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={restaurantComm}
                  onChange={(e) => setRestaurantComm(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Parceiro/Agência (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={partnerComm}
                  onChange={(e) => setPartnerComm(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Comercial (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={sellerComm}
                  onChange={(e) => setSellerComm(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {calc && (
            <div className="bg-muted/30 rounded-lg border border-border/30 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Resultado do cálculo
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Preço final (gross-up)</span>
                <span className="text-xl font-bold font-mono text-primary">{fmt(calc.finalPrice)}</span>
              </div>
              <Separator className="opacity-50" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo do projeto</span>
                  <span className="font-mono">{fmt(parseFloat(projectCost.replace(",", ".")) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Com. restaurante</span>
                  <span className="font-mono">{fmt(calc.restValue)} ({fmtPct(parseFloat(restaurantComm) || 0)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Com. parceiro</span>
                  <span className="font-mono">{fmt(calc.partnerValue)} ({fmtPct(parseFloat(partnerComm) || 0)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Com. comercial</span>
                  <span className="font-mono">{fmt(calc.sellerValue)} ({fmtPct(parseFloat(sellerComm) || 0)})</span>
                </div>
                <div className="flex justify-between col-span-2 border-t border-border/30 pt-2 mt-1">
                  <span className="text-muted-foreground">Margem bruta</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {fmt(calc.marginValue)} ({fmtPct(calc.marginPct)})
                  </Badge>
                </div>
              </div>
              {calc.marginValue < 0 && (
                <p className="text-xs text-destructive">
                  Atenção: as comissões excedem o preço final. Revise os valores.
                </p>
              )}
            </div>
          )}

          {!calc && parseFloat(projectCost.replace(",", ".")) > 0 && (
            <p className="text-xs text-amber-500">
              {pricingMode === "margin"
                ? "A soma das comissões e da margem não pode exceder 100%."
                : "Informe um preço final válido."}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid} className="gap-1.5">
            <PackagePlus className="w-4 h-4" />
            Usar este produto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
