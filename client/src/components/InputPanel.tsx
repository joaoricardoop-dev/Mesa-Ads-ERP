/*
 * Design: Bloomberg Terminal Reimaginado
 * Sidebar escura com inputs agrupados por categoria
 * Labels em DM Sans, valores em JetBrains Mono
 * Acentos em verde-esmeralda (#10B981)
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SimulatorInputs, CommissionType, PricingType } from "@/hooks/useSimulator";
import {
  Package,
  Eye,
  Calendar,
  Store,
  Megaphone,
  Percent,
  Shield,
  Tag,
  Target,
  Clock,
  DollarSign,
  TrendingUp,
  Crosshair,
} from "lucide-react";

interface InputPanelProps {
  inputs: SimulatorInputs;
  updateInput: <K extends keyof SimulatorInputs>(
    key: K,
    value: SimulatorInputs[K]
  ) => void;
  grossMargin?: number;
}

interface InputFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: React.ReactNode;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  showSlider?: boolean;
}

function InputField({
  label,
  value,
  onChange,
  icon,
  suffix,
  min = 0,
  max = 100000,
  step = 1,
  showSlider = false,
}: InputFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="font-mono text-sm bg-background/50 border-border/50 h-9 tabular-nums"
          min={min}
          max={max}
          step={step}
        />
        {suffix && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {suffix}
          </span>
        )}
      </div>
      {showSlider && (
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          className="mt-1"
        />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      {children}
    </h3>
  );
}

function solveMarkupForMargin(targetMargin: number, inputs: SimulatorInputs, restDbRate: number = 10): number | null {
  const sellerRate = inputs.sellerCommission / 100;
  const taxRateDecimal = inputs.taxRate / 100;
  const agencyVarRate = inputs.commissionType === "variable" ? inputs.restaurantCommission / 100 : 0;
  const totalVarRate = sellerRate + taxRateDecimal + agencyVarRate + (restDbRate / 100);
  const denom = 1 - totalVarRate - targetMargin / 100;
  if (denom <= 0) return null;
  const mult = 1.0;
  const markup = 100 * ((1 - totalVarRate) / (denom * mult) - 1);
  if (markup < 0) return null;
  return Math.round(markup * 10) / 10;
}

function GoalSeekMargin({ grossMargin, inputs, updateInput }: {
  grossMargin: number;
  inputs: SimulatorInputs;
  updateInput: <K extends keyof SimulatorInputs>(key: K, value: SimulatorInputs[K]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetMargin, setTargetMargin] = useState("");
  const [result, setResult] = useState<{ markup: number } | { error: string } | null>(null);

  const handleSolve = () => {
    const target = parseFloat(targetMargin);
    if (isNaN(target) || target <= 0 || target >= 100) {
      setResult({ error: "Informe uma margem entre 0% e 100%" });
      return;
    }
    const markup = solveMarkupForMargin(target, inputs);
    if (markup === null) {
      setResult({ error: "Margem impossível com as taxas atuais" });
    } else {
      setResult({ markup });
    }
  };

  const handleApply = () => {
    if (result && "markup" in result) {
      updateInput("pricingType", "variable" as PricingType);
      updateInput("markupPercent", result.markup);
      setOpen(false);
      setResult(null);
      setTargetMargin("");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Shield className="w-3 h-3" />
        Margem bruta atual
      </Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-background/50 border border-border/50 rounded-md h-9 px-3">
          <span className={`font-mono text-sm font-semibold tabular-nums ${
            grossMargin >= 40 ? "text-primary" : grossMargin >= 20 ? "text-amber-400" : "text-destructive"
          }`}>
            {grossMargin.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResult(null); setTargetMargin(""); } }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
              title="Atingir meta de margem"
            >
              <Crosshair className="w-4 h-4 text-primary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" side="right" align="start">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Target className="w-4 h-4 text-primary" />
                Atingir Meta
              </div>
              <p className="text-xs text-muted-foreground">
                Informe a margem bruta desejada e o sistema calculará o markup necessário.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Margem bruta desejada</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={targetMargin}
                    onChange={(e) => { setTargetMargin(e.target.value); setResult(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSolve(); }}
                    placeholder="ex: 35"
                    className="font-mono text-sm h-8"
                    min={1}
                    max={99}
                    step={0.1}
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <Button onClick={handleSolve} size="sm" className="w-full gap-2" variant="secondary">
                <Crosshair className="w-3.5 h-3.5" />
                Calcular
              </Button>
              {result && "error" in result && (
                <p className="text-xs text-destructive font-medium">{result.error}</p>
              )}
              {result && "markup" in result && (
                <div className="space-y-2 pt-1 border-t border-border/30">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Markup necessário:</span>
                    <span className="font-mono font-bold text-primary">{result.markup.toFixed(1)}%</span>
                  </div>
                  <Button onClick={handleApply} size="sm" className="w-full gap-2">
                    <Target className="w-3.5 h-3.5" />
                    Aplicar markup de {result.markup.toFixed(1)}%
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export default function InputPanel({ inputs, updateInput, grossMargin = 0 }: InputPanelProps) {
  return (
    <div className="space-y-6 p-5 pb-24">
      {/* Operacionais */}
      <div>
        <SectionTitle>Operacional</SectionTitle>
        <div className="space-y-3">
          <InputField
            label="Coasters / restaurante"
            value={inputs.coastersPerRestaurant}
            onChange={(v) => updateInput("coastersPerRestaurant", v)}
            icon={<Package className="w-3 h-3" />}
            suffix="un"
            min={50}
            max={5000}
            step={50}
          />
          <InputField
            label="Uso médio / dia"
            value={inputs.usagePerDay}
            onChange={(v) => updateInput("usagePerDay", v)}
            icon={<Eye className="w-3 h-3" />}
            suffix="x"
            min={1}
            max={20}
          />
          <InputField
            label="Dias por mês"
            value={inputs.daysPerMonth}
            onChange={(v) => updateInput("daysPerMonth", v)}
            icon={<Calendar className="w-3 h-3" />}
            suffix="dias"
            min={1}
            max={31}
          />
          <InputField
            label="Restaurantes ativos"
            value={inputs.activeRestaurants}
            onChange={(v) => updateInput("activeRestaurants", v)}
            icon={<Store className="w-3 h-3" />}
            min={1}
            max={100}
            showSlider
          />
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* Precificação */}
      <div>
        <SectionTitle>Precificação</SectionTitle>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="w-3 h-3" />
              Markup sobre custo bruto
            </Label>
            <div className="flex rounded-md overflow-hidden border border-border/50">
              <button
                type="button"
                onClick={() => updateInput("pricingType", "fixed" as PricingType)}
                className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 font-medium transition-colors ${
                  inputs.pricingType === "fixed"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <DollarSign className="w-3 h-3 inline mr-1" />
                Fixo (R$)
              </button>
              <button
                type="button"
                onClick={() => updateInput("pricingType", "variable" as PricingType)}
                className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 font-medium transition-colors ${
                  inputs.pricingType === "variable"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Percent className="w-3 h-3 inline mr-1" />
                Variável (%)
              </button>
            </div>

            {inputs.pricingType === "fixed" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={inputs.fixedPrice}
                  onChange={(e) =>
                    updateInput("fixedPrice", Number(e.target.value))
                  }
                  className="font-mono text-sm bg-background/50 border-border/50 h-9 tabular-nums"
                  min={0}
                  max={50000}
                  step={50}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  R$/rest.
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={inputs.markupPercent}
                    onChange={(e) =>
                      updateInput("markupPercent", Number(e.target.value))
                    }
                    className="font-mono text-sm bg-background/50 border-border/50 h-9 tabular-nums"
                    min={0}
                    max={300}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    %
                  </span>
                </div>
                <Slider
                  value={[inputs.markupPercent]}
                  onValueChange={([v]) =>
                    updateInput("markupPercent", v)
                  }
                  min={0}
                  max={300}
                  step={5}
                  className="mt-1"
                />
              </>
            )}
          </div>

          {/* Comissão Agência/Parceiro */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Percent className="w-3 h-3" />
              Comissão Agência/Parceiro
            </Label>
            {/* Toggle Fixo / Variável */}
            <div className="flex rounded-md overflow-hidden border border-border/50">
              <button
                type="button"
                onClick={() => updateInput("commissionType", "fixed" as CommissionType)}
                className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 font-medium transition-colors ${
                  inputs.commissionType === "fixed"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <DollarSign className="w-3 h-3 inline mr-1" />
                Fixo (R$)
              </button>
              <button
                type="button"
                onClick={() => updateInput("commissionType", "variable" as CommissionType)}
                className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 font-medium transition-colors ${
                  inputs.commissionType === "variable"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/50 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Percent className="w-3 h-3 inline mr-1" />
                Variável (%)
              </button>
            </div>

            {inputs.commissionType === "fixed" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={inputs.fixedCommission}
                  onChange={(e) =>
                    updateInput("fixedCommission", Number(e.target.value))
                  }
                  className="font-mono text-sm bg-background/50 border-border/50 h-9 tabular-nums"
                  min={0}
                  max={5}
                  step={0.01}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  R$/coaster
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={inputs.restaurantCommission}
                    onChange={(e) =>
                      updateInput("restaurantCommission", Number(e.target.value))
                    }
                    className="font-mono text-sm bg-background/50 border-border/50 h-9 tabular-nums"
                    min={0}
                    max={50}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    %
                  </span>
                </div>
                <Slider
                  value={[inputs.restaurantCommission]}
                  onValueChange={([v]) =>
                    updateInput("restaurantCommission", v)
                  }
                  min={0}
                  max={50}
                  step={1}
                  className="mt-1"
                />
              </>
            )}
          </div>

          <GoalSeekMargin
            grossMargin={grossMargin}
            inputs={inputs}
            updateInput={updateInput}
          />
          <InputField
            label="Desconto máximo"
            value={inputs.maxDiscount}
            onChange={(v) => updateInput("maxDiscount", v)}
            icon={<Tag className="w-3 h-3" />}
            suffix="%"
            min={0}
            max={50}
            showSlider
          />
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* Comerciais */}
      <div>
        <SectionTitle>Comercial</SectionTitle>
        <div className="space-y-3">
          <InputField
            label="Comissão vendedor"
            value={inputs.sellerCommission}
            onChange={(v) => updateInput("sellerCommission", v)}
            icon={<Megaphone className="w-3 h-3" />}
            suffix="%"
            min={0}
            max={30}
            step={1}
            showSlider
          />
          <InputField
            label="Carga tributária"
            value={inputs.taxRate}
            onChange={(v) => updateInput("taxRate", v)}
            icon={<Percent className="w-3 h-3" />}
            suffix="%"
            min={0}
            max={40}
            step={0.5}
            showSlider
          />
          <InputField
            label="Duração contrato"
            value={inputs.contractDuration}
            onChange={(v) => updateInput("contractDuration", v)}
            icon={<Clock className="w-3 h-3" />}
            suffix="meses"
            min={1}
            max={36}
          />
        </div>
      </div>
    </div>
  );
}
