import { lazy, Suspense, useEffect, useState } from "react";
import { CoasterFallback } from "./CoasterFallback";

const CoasterScene = lazy(() =>
  import("./CoasterScene").then((m) => ({ default: m.CoasterScene })),
);

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isLowMemoryDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 2) {
    return true;
  }
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2) {
    return true;
  }
  return false;
}

export function CoasterStage({ className }: { className?: string }) {
  const [use3D, setUse3D] = useState<boolean | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || isLowMemoryDevice() || !detectWebGL()) {
      setUse3D(false);
      return;
    }
    setUse3D(true);
  }, []);

  if (use3D === null || use3D === false) {
    return <CoasterFallback className={className} />;
  }

  return (
    <Suspense fallback={<CoasterFallback className={className} />}>
      <CoasterScene
        className={className}
        onContextLost={() => setUse3D(false)}
      />
    </Suspense>
  );
}
