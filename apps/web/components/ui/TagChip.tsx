"use client";

import { motion } from "framer-motion";

import { tapFeedback } from "@/lib/haptic";

type TagChipProps = {
  label: string;
  selected: boolean;
  onToggle: (label: string) => void;
};

export function TagChip({ label, selected, onToggle }: TagChipProps) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        tapFeedback();
        onToggle(label);
      }}
      whileTap={{ scale: 0.92 }}
      animate={{ scale: selected ? 1.05 : 1 }}
      className={`rounded-full border px-3 py-2 text-sm ${
        selected
          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
          : "border-black/15 bg-white text-neutral-800"
      }`}
      aria-pressed={selected}
    >
      {label}
    </motion.button>
  );
}
