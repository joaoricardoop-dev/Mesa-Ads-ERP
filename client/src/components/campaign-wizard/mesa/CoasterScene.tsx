import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import * as THREE from "three";
import { Coaster3D, type CoasterVariant } from "./Coaster3D";

const VARIANTS: CoasterVariant[] = [
  {
    color: "#00E640",
    ink: "#0A0A0C",
    label: ["TENTA", "ME", "IGNORAR"],
    footer: "mesa.ads",
    backColor: "#0A0A0C",
    backInk: "#00E640",
    backLabel: "mesa.ads",
  },
  {
    color: "#FF2E8A",
    ink: "#0A0A0C",
    label: ["ESSE ANÚNCIO", "VOCÊ NÃO", "PODE PULAR"],
    footer: "mesa.ads",
    backColor: "#0A0A0C",
    backInk: "#FF2E8A",
    backLabel: "mesa.ads",
  },
  {
    color: "#F5E63A",
    ink: "#0A0A0C",
    label: ["OLHA", "PRA MIM!", "JÁ OLHOU"],
    footer: "mesa.ads",
    backColor: "#0A0A0C",
    backInk: "#F5E63A",
    backLabel: "mesa.ads",
  },
  {
    color: "#0A0A0C",
    ink: "#00E640",
    label: ["QUER", "ANUNCIAR", "AQUI?"],
    footer: "mesa.ads",
    backColor: "#00E640",
    backInk: "#0A0A0C",
    backLabel: "mesa.ads",
  },
  {
    color: "#F27A1A",
    ink: "#0A0A0C",
    label: ["SUA MARCA", "NESSA", "MESA"],
    footer: "mesa.ads",
    backColor: "#0A0A0C",
    backInk: "#F27A1A",
    backLabel: "mesa.ads",
  },
  {
    color: "#F5F5F3",
    ink: "#0A0A0C",
    label: ["NA MESA", "DO", "CLIENTE"],
    footer: "mesa.ads",
    backColor: "#0A0A0C",
    backInk: "#F5F5F3",
    backLabel: "mesa.ads",
  },
];

interface FloatingProps {
  index: number;
  total: number;
  variant: CoasterVariant;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
}

function FloatingCoaster({ index, total, variant, pointer }: FloatingProps) {
  const group = useRef<THREE.Group>(null);

  const base = useMemo(() => {
    const angle = (index / total) * Math.PI * 2;
    const radius = 2.8 + ((index * 37) % 7) * 0.08;
    return {
      angle,
      radius,
      yOff: ((index * 13) % 7) * 0.18 - 0.6,
      spin: 0.2 + ((index * 7) % 5) * 0.05,
      tilt: ((index * 29) % 7) * 0.07 - 0.25,
    };
  }, [index, total]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.getElapsedTime();
    const angle = base.angle + t * base.spin * 0.18;

    const x = Math.cos(angle) * base.radius;
    const z = Math.sin(angle) * base.radius * 0.6;
    const y = Math.sin(t * 0.6 + index) * 0.25 + base.yOff;

    group.current.position.set(x, y, z);

    const targetRotY = -angle + pointer.current.x * 0.3;
    const targetRotX = base.tilt + pointer.current.y * 0.3;
    const targetRotZ = t * 0.35 + index * 0.4;

    group.current.rotation.y += (targetRotY - group.current.rotation.y) * Math.min(1, delta * 3);
    group.current.rotation.x += (targetRotX - group.current.rotation.x) * Math.min(1, delta * 3);
    group.current.rotation.z = targetRotZ;
  });

  return (
    <group ref={group}>
      <Coaster3D variant={variant} radius={0.75} thickness={0.05} />
    </group>
  );
}

function useIsSmallScreen() {
  const [isSmall, setIsSmall] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isSmall;
}

interface CoasterSceneProps {
  className?: string;
  onContextLost?: () => void;
}

export function CoasterScene({ className, onContextLost }: CoasterSceneProps) {
  const pointer = useRef({ x: 0, y: 0 });
  const isSmall = useIsSmallScreen();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const ctxLostHandlerRef = useRef<((e: Event) => void) | null>(null);

  useEffect(() => {
    return () => {
      const el = canvasElRef.current;
      const handler = ctxLostHandlerRef.current;
      if (el && handler) {
        el.removeEventListener("webglcontextlost", handler, false);
      }
      canvasElRef.current = null;
      ctxLostHandlerRef.current = null;
    };
  }, []);

  const variants = useMemo(
    () => (isSmall ? VARIANTS.slice(0, 3) : VARIANTS),
    [isSmall],
  );
  const dpr: [number, number] = isSmall ? [1, 1.5] : [1, 2];

  return (
    <div
      className={className}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.current.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        pointer.current.x = 0;
        pointer.current.y = 0;
      }}
    >
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0.6, 6.2], fov: 38 }}
        gl={{ antialias: !isSmall, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          const handler = (e: Event) => {
            e.preventDefault();
            onContextLost?.();
          };
          canvas.addEventListener("webglcontextlost", handler, false);
          canvasElRef.current = canvas;
          ctxLostHandlerRef.current = handler;
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 8, 4]} intensity={1.1} castShadow={!isSmall} />
          <directionalLight position={[-5, 3, -2]} intensity={0.6} color="#00E640" />
          {!isSmall && (
            <spotLight position={[0, 6, 6]} angle={0.6} intensity={0.4} color="#FF2E8A" />
          )}
          <Environment preset="city" />
          {variants.map((v, i) => (
            <FloatingCoaster key={i} index={i} total={variants.length} variant={v} pointer={pointer} />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default CoasterScene;
