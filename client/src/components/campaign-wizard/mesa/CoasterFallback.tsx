interface FallbackCoaster {
  color: string;
  ink: string;
  label: string[];
  x: string;
  y: string;
  size: number;
  rotate: number;
  opacity?: number;
}

const COASTERS: FallbackCoaster[] = [
  { color: "#00E640", ink: "#0A0A0C", label: ["TENTA", "ME", "IGNORAR"], x: "18%", y: "22%", size: 220, rotate: -14 },
  { color: "#FF2E8A", ink: "#0A0A0C", label: ["ESSE ANÚNCIO", "VOCÊ NÃO", "PODE PULAR"], x: "78%", y: "18%", size: 200, rotate: 12, opacity: 0.92 },
  { color: "#F5E63A", ink: "#0A0A0C", label: ["OLHA", "PRA MIM!", "JÁ OLHOU"], x: "82%", y: "70%", size: 230, rotate: -8 },
  { color: "#F27A1A", ink: "#0A0A0C", label: ["SUA MARCA", "NESSA", "MESA"], x: "12%", y: "74%", size: 210, rotate: 18, opacity: 0.92 },
];

function CoasterSvg({ coaster, gradientId }: { coaster: FallbackCoaster; gradientId: string }) {
  const fontSize = coaster.label.length <= 1 ? 30 : coaster.label.length === 2 ? 26 : 22;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: coaster.x,
        top: coaster.y,
        width: coaster.size,
        height: coaster.size,
        transform: `translate(-50%, -50%) rotate(${coaster.rotate}deg)`,
        opacity: coaster.opacity ?? 1,
        filter: "drop-shadow(0 24px 30px rgba(0,0,0,0.55))",
      }}
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill={coaster.color} />
        <circle cx="100" cy="100" r="92" fill="none" stroke={coaster.ink} strokeOpacity="0.18" strokeWidth="1.2" />
        <circle cx="100" cy="100" r="96" fill={`url(#${gradientId})`} />
        <g
          fill={coaster.ink}
          fontFamily='"Bricolage Grotesque Variable","Bricolage Grotesque",system-ui,sans-serif'
          fontWeight={900}
          textAnchor="middle"
          fontSize={fontSize}
        >
          {coaster.label.map((line, i) => (
            <text
              key={i}
              x="100"
              y={100 + (i - (coaster.label.length - 1) / 2) * fontSize * 1.05}
              dominantBaseline="middle"
            >
              {line}
            </text>
          ))}
          <text x="100" y="172" fontSize={11} fontWeight={600} opacity={0.7}>
            mesa.ads
          </text>
        </g>
      </svg>
    </div>
  );
}

export function CoasterFallback({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 25%, rgba(0,230,64,0.12), transparent 55%), radial-gradient(ellipse at 75% 70%, rgba(255,46,138,0.10), transparent 55%), #050507",
        }}
      />
      <div className="absolute inset-0 hidden sm:block">
        {COASTERS.map((c, i) => (
          <CoasterSvg key={i} coaster={c} gradientId={`coaster-fallback-grad-lg-${i}`} />
        ))}
      </div>
      <div className="absolute inset-0 sm:hidden">
        {COASTERS.slice(0, 2).map((c, i) => (
          <CoasterSvg
            key={i}
            coaster={{ ...c, size: Math.round(c.size * 0.75) }}
            gradientId={`coaster-fallback-grad-sm-${i}`}
          />
        ))}
      </div>
    </div>
  );
}
