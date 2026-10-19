"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState, type KeyboardEvent } from "react";

import { Icon } from "@/components/ui/Icon";
import { tapFeedback } from "@/lib/haptic";

type StarRatingProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  size?: "lg" | "sm";
};

const SPARKS = [
  { x: -26, y: -30, e: "✨" },
  { x: 28, y: -26, e: "⭐" },
  { x: 0, y: -42, e: "✨" },
  { x: -34, y: 6, e: "⭐" },
  { x: 34, y: 8, e: "✨" },
];

export function StarRating({ value, onChange, label, size = "lg" }: StarRatingProps) {
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState<{ star: number; id: number } | null>(null);
  const idRef = useRef(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const large = size === "lg";

  const pick = (n: number) => {
    tapFeedback();
    onChange(n);
    idRef.current += 1;
    setBurst({ star: n, id: idRef.current });
  };

  const onKeyDown = (event: KeyboardEvent, n: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(5, n + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, n - 1);
    if (next !== null) {
      event.preventDefault();
      pick(next);
      refs.current[next - 1]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex items-center justify-center ${large ? "gap-1.5 sm:gap-2" : "gap-1"}`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            ref={(node) => {
              refs.current[n - 1] = node;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            onClick={() => pick(n)}
            onKeyDown={(event) => onKeyDown(event, n)}
            className={`relative flex items-center justify-center rounded-2xl transition-colors ${
              large ? "h-14 w-14 sm:h-16 sm:w-16" : "h-10 w-10"
            } ${filled ? "bg-marigold/20" : "bg-white"}`}
          >
            <motion.span
              key={`${n}-${filled ? value : 0}`}
              initial={filled && !reduce ? { scale: 0.5, rotate: -25 } : false}
              animate={filled && !reduce ? { scale: [1.35, 1], rotate: 0 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 14, delay: filled ? (n - 1) * 0.045 : 0 }}
              whileTap={reduce ? undefined : { scale: 0.8 }}
              className={`flex ${filled ? "text-marigold drop-shadow-[0_2px_0_var(--pop)]" : "text-ink/20"}`}
            >
              <Icon name="star" size={large ? 44 : 28} />
            </motion.span>
            <AnimatePresence>
              {!reduce && burst && burst.star === n ? (
                <motion.span
                  key={burst.id}
                  className="pointer-events-none absolute inset-0"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  aria-hidden
                >
                  {SPARKS.map((spark, i) => (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 top-1/2 text-xs"
                      initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }}
                      animate={{ x: spark.x, y: spark.y, scale: 1.1, opacity: 0 }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                    >
                      {spark.e}
                    </motion.span>
                  ))}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

/** Read-only row of stars used in summaries. */
export function StarsDisplay({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "text-marigold" : "text-ink/20"}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}
