import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "positive" | "negative" | "warning" | "neutral" | "accent";

const TONE_NUMBER: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-[color:var(--chart-1)]",
  neutral: "text-[color:var(--chart-2)]",
  warning: "text-[color:var(--chart-3)]",
  negative: "text-[color:var(--chart-4)]",
  accent: "text-[color:var(--chart-5)]",
};

const TONE_ICON: Record<Tone, string> = {
  default: "text-muted-foreground",
  positive: "text-[color:var(--chart-1)]",
  neutral: "text-[color:var(--chart-2)]",
  warning: "text-[color:var(--chart-3)]",
  negative: "text-[color:var(--chart-4)]",
  accent: "text-[color:var(--chart-5)]",
};

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  emphasis?: "default" | "hero";
  onClick?: () => void;
  className?: string;
  trailing?: React.ReactNode;
}

/**
 * Mesa.ads metric card — DS Fase 2.
 * Editorial KPI card with mono uppercase label, display-font number
 * and hairline border. Tones map directly to the semantic chart palette
 * so a KPI and its companion chart share the same color story.
 */
export default function MetricCard({
  label,
  value,
  sub,
  hint,
  icon: Icon,
  tone = "default",
  emphasis = "default",
  onClick,
  className,
  trailing,
}: MetricCardProps) {
  const isHero = emphasis === "hero";
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-1.5 rounded-xl border border-border bg-card text-left transition-colors",
        isHero ? "p-5" : "p-4",
        onClick && "hover:border-foreground/20 hover:bg-card/80",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label-mono truncate">{label}</span>
        {Icon ? (
          <Icon className={cn("h-3.5 w-3.5 shrink-0", TONE_ICON[tone])} />
        ) : trailing ? (
          <span className="shrink-0">{trailing}</span>
        ) : null}
      </div>
      <div
        className={cn(
          "font-display font-semibold leading-none tabular-nums",
          isHero ? "text-3xl md:text-4xl" : "text-2xl",
          TONE_NUMBER[tone],
        )}
      >
        {value}
      </div>
      {sub ? (
        <p className="text-[11px] text-muted-foreground leading-snug">{sub}</p>
      ) : null}
      {hint ? (
        <p className="font-serif-display text-[12px] text-muted-foreground/80 leading-snug">
          {hint}
        </p>
      ) : null}
    </Tag>
  );
}

/**
 * Section vignette: mono uppercase label + optional hairline divider.
 * Use to introduce dashboard sections without a heavy card chrome.
 */
export function SectionLabel({
  children,
  icon: Icon,
  trailing,
  className,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border pb-2",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      <span className="label-mono">{children}</span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </div>
  );
}
