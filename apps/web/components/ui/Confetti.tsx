"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

const COLORS = ["var(--brand)", "var(--marigold)", "var(--pine)", "#ffffff"];

/** One-shot confetti burst. Finite (~3s) and skipped under reduced motion. */
export function Confetti({ count = 28 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic pseudo-random spread so server and client markup agree.
        const seed = (i * 9301 + 49297) % 233280;
        const r = (n: number) => ((seed * (n + 3)) % 1000) / 1000;
        return {
          id: i,
          left: 8 + r(1) * 84,
          dx: (r(2) - 0.5) * 160,
          rotate: (r(3) - 0.5) * 720,
          delay: r(4) * 0.5,
          duration: 2.2 + r(5) * 1.2,
          size: 6 + r(6) * 6,
          color: COLORS[i % COLORS.length],
          round: i % 3 === 0,
        };
      }),
    [count],
  );

  if (reduce) {
    return null;
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute top-8 border border-ink/10 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 0.5, background: p.color }}
          initial={{ y: -10, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 420, x: p.dx, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.7, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
