"use client";

import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Número héroe con animación de conteo (saldo actual del cliente). */
export function HeroNumber({
  value,
  className,
  duration = 1.1,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span className={cn("tabular tracking-tight", className)}>{formatUSD(display)}</span>
  );
}
