import { useMotionValue, useSpring, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

interface Props {
  value: number;
  format?: (v: number) => string;
  className?: string;
  stiffness?: number;
  damping?: number;
  integer?: boolean;
}

export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString("pt-BR"),
  className,
  stiffness = 140,
  damping = 24,
  integer = true,
}: Props) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness, damping, mass: 1 });
  const display = useTransform(spring, (v) => format(integer ? Math.round(v) : v));

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  return <motion.span className={className}>{display}</motion.span>;
}
