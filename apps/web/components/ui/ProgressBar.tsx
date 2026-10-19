"use client";

import { motion } from "framer-motion";

import { Icon } from "@/components/ui/Icon";

type ProgressBarProps = {
  /** 1-based index of the current step. */
  step: number;
  labels: string[];
};

export function ProgressBar({ step, labels }: ProgressBarProps) {
  const total = labels.length;
  const pct = Math.round((step / total) * 100);
  return (
    <nav aria-label={`Step ${step} of ${total}`} className="w-full">
      <ol className="mb-2 grid gap-1.5 font-display text-xs font-bold" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {labels.map((label, index) => {
          const n = index + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-1 truncate ${current ? "text-ink" : done ? "text-pine" : "text-ink/40"}`}
            >
              {done ? (
                <Icon name="check" size={14} />
              ) : (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${current ? "bg-brand animate-pulse-ring" : "bg-ink/25"}`}
                />
              )}
              <span className="truncate">
                {n}. {label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="h-3.5 w-full overflow-hidden rounded-full border-2 border-hairline bg-white p-0.5">
        <motion.div
          className="relative h-full rounded-full bg-brand"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
        >
          <span className="absolute right-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-on-brand/80" />
        </motion.div>
      </div>
    </nav>
  );
}
