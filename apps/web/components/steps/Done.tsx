"use client";

import { motion } from "framer-motion";

import { Confetti } from "@/components/ui/Confetti";
import { StarsDisplay } from "@/components/ui/StarRating";
import { ratingTone, starMood, type RatingTone } from "@/lib/stars";

type DoneProps = {
  restaurantName: string;
  dishes: string[];
  stars: number | null;
};

const TONE_STYLE: Record<RatingTone, string> = {
  good: "bg-pine/15 border-pine/40",
  neutral: "bg-tint border-hairline",
  low: "bg-marigold/20 border-marigold/50",
};

export function Done({ restaurantName, dishes, stars }: DoneProps) {
  const mood = starMood(stars);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
      <motion.div
        className="sticker relative overflow-hidden p-6 text-center"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Confetti />
        <span className="blob -right-10 -top-10 h-36 w-36" aria-hidden />

        <motion.div
          className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-line bg-white text-5xl shadow-pop-sm"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{
            scale: { type: "spring", stiffness: 300, damping: 12, delay: 0.1 },
            rotate: { duration: 0.6, ease: "easeInOut", delay: 0.1 },
          }}
          aria-hidden
        >
          🎉
        </motion.div>
        <h2 className="relative mt-4 font-display text-3xl font-extrabold tracking-tight">Thanks for sharing!</h2>
        <p className="relative mt-1 text-base text-muted">Your feedback helps {restaurantName} get better.</p>

        <div className="relative mt-6 text-left">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-bold">🍽️ Your meal today</p>
            <span className="rounded-full bg-tint px-2.5 py-0.5 text-xs font-bold text-muted">
              {dishes.length} {dishes.length === 1 ? "item" : "items"}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {dishes.length ? (
              dishes.map((dish, index) => (
                <motion.li
                  key={dish}
                  className="flex items-center gap-3 rounded-2xl bg-tint px-3 py-2.5 text-sm font-semibold"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + index * 0.07 }}
                >
                  <span aria-hidden>🍽️</span>
                  {dish}
                </motion.li>
              ))
            ) : (
              <li className="rounded-2xl bg-tint px-3 py-3 text-sm text-muted">No dishes selected</li>
            )}
          </ul>
        </div>

        {stars ? (
          <div className="relative mt-5 text-left">
            <p className="font-display text-sm font-bold">⭐ Your rating</p>
            <div
              className={`mt-2 flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 ${TONE_STYLE[ratingTone(stars)]}`}
            >
              <div>
                <StarsDisplay value={stars} size={22} />
                <p className="mt-0.5 text-xs font-bold text-muted">{stars} / 5 rating</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-display text-sm font-bold shadow-sm">
                <span aria-hidden>{mood.emoji}</span>
                {mood.caption}
              </span>
            </div>
          </div>
        ) : null}

        <p className="relative mt-6 text-sm font-medium text-muted">You can close this tab now.</p>
      </motion.div>
    </div>
  );
}
