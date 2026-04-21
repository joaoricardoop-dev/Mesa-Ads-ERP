import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ExternalShellProps {
  children: ReactNode;
  className?: string;
  /** Extra classes for the inner z-10 wrapper that holds the children.
   * Use this to pass flex/sizing classes (e.g. "flex flex-1 min-h-0 w-full")
   * so the children participate correctly in the outer layout. */
  innerClassName?: string;
  /** When true, applies the full "ambient" treatment with grain, spotlight, and orbs.
   * When false, only the color/font tokens are applied (useful for sub-areas already inside an ExternalShell). */
  ambient?: boolean;
}

/**
 * Wraps external user surfaces (advertiser portal, partner portal, wizard)
 * with the original mesa-ads visual identity: dark surfaces, neon accent,
 * Bricolage Grotesque, grain overlay, cursor-tracked spotlight, ambient orbs.
 *
 * Internal ERP views are NOT wrapped, so the existing UI stays untouched.
 */
export function ExternalShell({ children, className, innerClassName, ambient = true }: ExternalShellProps) {
  useEffect(() => {
    if (!ambient) return;
    const handler = (e: PointerEvent) => {
      document.documentElement.style.setProperty("--mx", `${e.clientX}px`);
      document.documentElement.style.setProperty("--my", `${e.clientY}px`);
    };
    window.addEventListener("pointermove", handler);
    return () => window.removeEventListener("pointermove", handler);
  }, [ambient]);

  return (
    <div
      className={cn(
        "theme-external relative min-h-screen w-full",
        ambient && "grain",
        className,
      )}
    >
      {ambient && (
        <>
          <div className="spotlight" aria-hidden />
          <div
            aria-hidden
            className="pointer-events-none fixed -top-40 -left-32 h-[520px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(0,230,64,0.10), rgba(0,230,64,0) 70%)",
              filter: "blur(30px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none fixed -bottom-40 -right-32 h-[520px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,46,138,0.10), rgba(255,46,138,0) 70%)",
              filter: "blur(30px)",
            }}
          />
        </>
      )}
      <div className={cn("relative z-10", innerClassName)}>{children}</div>
    </div>
  );
}
