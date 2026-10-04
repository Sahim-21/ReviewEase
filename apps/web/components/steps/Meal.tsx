"use client";

import { useState } from "react";

import { DishCard } from "@/components/ui/DishCard";
import { tapFeedback } from "@/lib/haptic";
import { SENTIMENT_OPTIONS, type Sentiment } from "@/lib/sentiment";
import type { MenuItemPublic } from "@/lib/types";

const CUSTOM_LIMIT = 60;

type MealProps = {
  dishes: MenuItemPublic[];
  selected: string[];
  custom: string;
  sentiment: Sentiment | null;
  onToggleDish: (name: string) => void;
  onSentiment: (value: Sentiment) => void;
  onNext: (custom: string) => void;
};

export function Meal({ dishes, selected, custom, sentiment, onToggleDish, onSentiment, onNext }: MealProps) {
  const [customFood, setCustomFood] = useState(custom);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="text-xl font-semibold tracking-tight">What did you have & how did you feel?</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <section>
            <p className="text-sm font-medium text-neutral-700">What did you have?</p>
            {dishes.length ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {dishes.map((item) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    selected={selected.includes(item.name)}
                    onToggle={onToggleDish}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Pick how the visit felt — you can still continue.</p>
            )}
            <label className="mt-4 block text-sm font-medium text-neutral-700">
              Something not on the list?
              <input
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-base font-normal shadow-sm outline-none"
                maxLength={CUSTOM_LIMIT}
                placeholder="Add something not listed (e.g. house special, add-ons, extras...)"
                value={customFood}
                onChange={(event) => setCustomFood(event.target.value.slice(0, CUSTOM_LIMIT))}
              />
            </label>
          </section>
          <section>
            <p className="text-sm font-medium text-neutral-700">How did you feel?</p>
            <div className="mt-3 flex flex-col gap-2">
              {SENTIMENT_OPTIONS.map((option) => {
                const active = sentiment === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      onSentiment(option.id);
                    }}
                    className={`rounded-2xl border px-4 py-4 text-left text-base font-semibold shadow-sm ${
                      active
                        ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_16%,white)]"
                        : "border-black/10 bg-white"
                    }`}
                    aria-pressed={active}
                  >
                    <span className="mr-2 text-2xl" aria-hidden>
                      {option.emoji}
                    </span>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onNext(customFood);
        }}
        disabled={!sentiment}
        className="mt-4 w-full rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}
