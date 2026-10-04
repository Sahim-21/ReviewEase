"use client";

import { motion } from "framer-motion";

import { SENTIMENT_OPTIONS, type Sentiment } from "@/lib/sentiment";

type DoneProps = {
  restaurantName: string;
  dishes: string[];
  sentiment: Sentiment | null;
};

export function Done({ restaurantName, dishes, sentiment }: DoneProps) {
  const experience = SENTIMENT_OPTIONS.find((option) => option.id === sentiment);
  const badge =
    sentiment === "loved"
      ? "bg-emerald-100 text-emerald-800"
      : sentiment === "issues"
        ? "bg-amber-100 text-amber-900"
        : "bg-neutral-100 text-neutral-800";

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <motion.div
        className="rounded-3xl bg-white p-6 shadow-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Thanks for sharing!</h2>
        <p className="mt-2 text-sm text-neutral-600">Your feedback helps {restaurantName} get better.</p>
        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-700">Your meal today</p>
          <ul className="mt-3 space-y-2">
            {dishes.length ? (
              dishes.map((dish) => (
                <li key={dish} className="flex items-center gap-2 text-sm">
                  <span aria-hidden>🍽️</span>
                  {dish}
                </li>
              ))
            ) : (
              <li className="text-sm text-neutral-500">No dishes selected</li>
            )}
          </ul>
          {experience ? (
            <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-sm font-medium ${badge}`}>
              {experience.emoji} {experience.label}
            </p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
