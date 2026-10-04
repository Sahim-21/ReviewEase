"use client";

import { motion } from "framer-motion";

import { tapFeedback } from "@/lib/haptic";
import type { MenuItemPublic } from "@/lib/types";

type DishCardProps = {
  item: MenuItemPublic;
  selected: boolean;
  onToggle: (name: string) => void;
};

export function DishCard({ item, selected, onToggle }: DishCardProps) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        tapFeedback();
        onToggle(item.name);
      }}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: selected ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className={`rounded-2xl border px-3 py-4 text-left shadow-sm ${
        selected
          ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_16%,white)]"
          : "border-black/10 bg-white"
      }`}
      aria-pressed={selected}
    >
      <p className="text-sm font-semibold">{item.name}</p>
      {item.category ? (
        <p className="mt-1 text-xs capitalize text-neutral-500">{item.category}</p>
      ) : null}
    </motion.button>
  );
}
