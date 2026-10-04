"use client";

import { motion } from "framer-motion";

import { tapFeedback } from "@/lib/haptic";

type EmojiRatingProps = {
  value: number | undefined;
  onChange: (value: number) => void;
  label: string;
};

const FACES = [
  { score: 1, emoji: "1", caption: "1" },
  { score: 2, emoji: "2", caption: "2" },
  { score: 3, emoji: "3", caption: "3" },
  { score: 4, emoji: "4", caption: "4" },
  { score: 5, emoji: "5", caption: "5" },
] as const;

const FACE_EMOJI = ["😞", "😕", "😐", "🙂", "😍"] as const;

export function EmojiRating({ value, onChange, label }: EmojiRatingProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold capitalize">{label}</p>
      <div className="flex justify-between gap-1" role="radiogroup" aria-label={label}>
        {FACES.map((face) => {
          const active = value === face.score;
          return (
            <motion.button
              key={face.score}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${label} ${face.score} of 5`}
              onClick={() => {
                tapFeedback();
                onChange(face.score);
              }}
              whileTap={{ scale: 0.88 }}
              animate={{ scale: active ? 1.08 : 1 }}
              className={`flex flex-1 flex-col items-center rounded-xl py-2 text-2xl ${
                active ? "bg-[color-mix(in_srgb,var(--brand)_18%,white)]" : "opacity-70"
              }`}
            >
              <span aria-hidden>{FACE_EMOJI[face.score - 1]}</span>
              <span className="mt-1 text-[10px] font-medium text-neutral-600">{face.caption}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
