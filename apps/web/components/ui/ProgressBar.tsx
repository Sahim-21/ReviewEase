import { motion } from "framer-motion";

type ProgressBarProps = {
  step: number;
  total: number;
};

export function ProgressBar({ step, total }: ProgressBarProps) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="flex items-center gap-3" aria-label={`Step ${step} of ${total}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
        <motion.div
          className="h-full rounded-full bg-[var(--brand)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
        />
      </div>
      <span className="text-xs font-medium text-neutral-600">
        {step}/{total}
      </span>
    </div>
  );
}
