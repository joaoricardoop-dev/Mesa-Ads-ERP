import { cn } from "@/lib/utils";

interface Props {
  available: number;
  total: number;
  className?: string;
}

// Badge reutilizável "X de Y shares disponíveis" com cor que reflete a pressão
// de ocupação (verde / âmbar / vermelho).
export function ShareAvailabilityBadge({ available, total, className }: Props) {
  const ratio = total > 0 ? available / total : 0;
  const tone =
    available <= 0
      ? "bg-mesa-red/15 text-mesa-red border-mesa-red/40"
      : ratio < 0.34
      ? "bg-mesa-amber/15 text-mesa-amber border-mesa-amber/40"
      : "bg-mesa-neon/10 text-mesa-neon border-mesa-neon/40";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-[0.14em] font-semibold tabular-nums",
        tone,
        className,
      )}
      data-testid="share-availability-badge"
    >
      {available} de {total} shares
    </span>
  );
}
