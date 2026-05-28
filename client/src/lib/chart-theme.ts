/**
 * Mesa.ads chart palette — semantic colors for Recharts.
 *
 * All colors resolve to CSS variables defined in `index.css`, so they
 * automatically respond to light/dark theme switches. Use these semantic
 * tokens instead of hardcoded hex/hsl values in any chart.
 *
 *  positive  → neon green (chart-1)
 *  negative  → magenta (chart-4)
 *  neutral   → ice/blue (chart-2)
 *  warning   → amber (chart-3)
 *  accent    → orange (chart-5)
 */
export const chartColors = {
  positive: "var(--chart-1)",
  neutral: "var(--chart-2)",
  warning: "var(--chart-3)",
  negative: "var(--chart-4)",
  accent: "var(--chart-5)",
  // Ordered series 1..5 — use when no semantic meaning is needed.
  series: [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ] as const,
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
} as const;

export const chartTooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.25)",
};

export const chartAxisTick = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
} as const;
