"use client";

import { motion } from "framer-motion";

import { Icon } from "@/components/ui/Icon";
import { tapFeedback } from "@/lib/haptic";
import type { MenuItemPublic } from "@/lib/types";

type DishCardProps = {
  item: MenuItemPublic;
  selected: boolean;
  index: number;
  onToggle: (name: string) => void;
};

export function DishCard({ item, selected, index, onToggle }: DishCardProps) {
  const tilt = index % 2 === 0 ? -1.5 : 1.5;
  return (
    <motion.button
      type="button"
      onClick={() => {
        tapFeedback();
        onToggle(item.name);
      }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, rotate: selected ? tilt : 0, scale: selected ? 1.03 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22, delay: Math.min(index, 8) * 0.04 }}
      whileTap={{ scale: 0.94 }}
      aria-pressed={selected}
      className={`relative flex min-h-[7rem] flex-col justify-between rounded-2xl border-2 p-3.5 text-left ${
        selected
          ? "border-line bg-tint-strong shadow-pop-sm"
          : "border-hairline bg-white shadow-[0_3px_0_0_var(--hairline)]"
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        {item.category ? (
          <span
            className={`rounded-full px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide ${
              selected ? "bg-brand text-on-brand" : "bg-tint text-muted"
            }`}
          >
            {item.category}
          </span>
        ) : (
          <span />
        )}
        <motion.span
          animate={{ scale: selected ? [0.4, 1.25, 1] : 1 }}
          transition={{ duration: 0.35 }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            selected ? "bg-brand text-on-brand" : "bg-tint text-muted"
          }`}
        >
          <Icon name={selected ? "check" : "add"} size={16} />
        </motion.span>
      </span>
      <span className="mt-3 font-display text-base font-bold leading-snug">{item.name}</span>
    </motion.button>
  );
}
