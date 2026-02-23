/*
 * Design: Bloomberg Terminal Reimaginado
 * Sidebar escura com inputs agrupados por categoria
 * Labels em DM Sans, valores em JetBrains Mono
 * Acentos em verde-esmeralda (#10B981)
 */

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import type { SimulatorInputs, CommissionType } from "@/hooks/useSimulator";
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
} from "lucide-react";

interface InputPanelProps {
  inputs: SimulatorInputs;
  updateInput: <K extends keyof SimulatorInputs>(
    key: K,
    value: SimulatorInputs[K]
  ) => void;
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

export default function InputPanel({ inputs, updateInput }: InputPanelProps) {
  return (
    <div className="space-y-6 p-5 pb-24">
      {/* Logo / Title */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Megaphone className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">Mesa Ads</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Simulador Financeiro
          </p>
        </div>
      </div>

      <Separator className="bg-border/30" />

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

      {/* Mídia */}
      <div>
        <SectionTitle>Mídia</SectionTitle>
        <div className="space-y-3">
          <InputField
            label="CPM"
            value={inputs.cpm}
            onChange={(v) => updateInput("cpm", v)}
            icon={<Megaphone className="w-3 h-3" />}
            suffix="R$"
            min={10}
            max={150}
            showSlider
          />

          {/* Comissão do Restaurante - Seletor Fixo/Variável */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Percent className="w-3 h-3" />
              Comissão paga ao rest.
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
                  max={10000}
                  step={10}
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

          <InputField
            label="Margem mínima"
            value={inputs.minMargin}
            onChange={(v) => updateInput("minMargin", v)}
            icon={<Shield className="w-3 h-3" />}
            suffix="%"
            min={5}
            max={80}
            showSlider
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
            label="CAC / restaurante"
            value={inputs.cacPerRestaurant}
            onChange={(v) => updateInput("cacPerRestaurant", v)}
            icon={<Target className="w-3 h-3" />}
            suffix="R$"
            min={0}
            max={5000}
            step={50}
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
