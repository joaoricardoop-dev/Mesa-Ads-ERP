import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function MesaAdsLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-display font-semibold tracking-[-0.04em] select-none",
        className,
      )}
      aria-label="mesa.ads"
    >
      <span className="text-chalk">mesa</span>
      <span className="text-mesa-neon">.ads</span>
    </span>
  );
}

type Variant = "primary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

interface MesaButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  children?: React.ReactNode;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const variantCls: Record<Variant, string> = {
  primary:
    "bg-mesa-neon text-ink-950 font-semibold hover:brightness-110 active:brightness-95 shadow-neon-sm disabled:opacity-40",
  ghost:
    "bg-white/5 text-chalk border border-hairline hover:bg-white/10 disabled:opacity-40",
  quiet:
    "bg-transparent text-chalk/70 hover:text-chalk hover:bg-white/5 disabled:opacity-40",
  danger:
    "bg-rose-500/15 text-rose-200 border border-rose-500/30 hover:bg-rose-500/25",
};

const sizeCls: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-full",
  md: "h-11 px-6 text-sm rounded-full",
  lg: "h-14 px-8 text-base rounded-full",
};

export const MesaButton = forwardRef<HTMLButtonElement, MesaButtonProps>(function MesaButton(
  { variant = "primary", size = "md", children, iconLeft, iconRight, fullWidth, className, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 tracking-tight transition-colors duration-200 ease-apple select-none",
        variantCls[variant],
        sizeCls[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {iconLeft}
      <span>{children}</span>
      {iconRight}
    </motion.button>
  );
});

interface MesaChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neon" | "magenta" | "amber" | "orange" | "neutral" | "ice";
  size?: "xs" | "sm";
  dot?: boolean;
}

const toneCls: Record<NonNullable<MesaChipProps["tone"]>, string> = {
  neon: "text-mesa-neon bg-mesa-neon/10 border-mesa-neon/30",
  magenta: "text-mesa-magenta bg-mesa-magenta/10 border-mesa-magenta/30",
  amber: "text-mesa-amber bg-mesa-amber/10 border-mesa-amber/30",
  orange: "text-mesa-orange bg-mesa-orange/10 border-mesa-orange/30",
  ice: "text-mesa-ice bg-mesa-ice/10 border-mesa-ice/30",
  neutral: "text-chalk/70 bg-white/5 border-hairline",
};

export function MesaChip({
  tone = "neutral",
  size = "sm",
  dot,
  className,
  children,
  ...rest
}: MesaChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border tracking-tight",
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        toneCls[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="inline-block size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
