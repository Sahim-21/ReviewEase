"use client";

import { motion } from "framer-motion";

type DraftLoadingProps = {
  label?: string;
};

export function DraftLoading({ label }: DraftLoadingProps) {
  return (
    <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-4" role="status">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-3 w-3 rounded-full bg-[var(--brand)]"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }}
          />
        ))}
      </div>
      {label ? <p className="text-sm text-neutral-600">{label}</p> : null}
    </div>
  );
}
