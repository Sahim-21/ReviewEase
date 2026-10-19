"use client";

import { useState } from "react";

import { DishCard } from "@/components/ui/DishCard";
import { StepFooter } from "@/components/ui/StepFooter";
import type { MenuItemPublic } from "@/lib/types";

const CUSTOM_LIMIT = 60;

type MealProps = {
  dishes: MenuItemPublic[];
  selected: string[];
  custom: string;
  onToggleDish: (name: string) => void;
  onNext: (custom: string) => void;
};

export function Meal({ dishes, selected, custom, onToggleDish, onNext }: MealProps) {
  const [customFood, setCustomFood] = useState(custom);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="mb-4">
        <h2 className="font-display text-[1.65rem] font-extrabold leading-tight tracking-tight">
          What did you have? <span aria-hidden>🍛</span>
        </h2>
        <p className="mt-1 text-base text-muted">Tap everything you ate or drank.</p>
      </section>

      {dishes.length ? (
        <div className="grid grid-cols-2 gap-3">
          {dishes.map((item, index) => (
            <DishCard
              key={item.id}
              item={item}
              index={index}
              selected={selected.includes(item.name)}
              onToggle={onToggleDish}
            />
          ))}
        </div>
      ) : (
        <div className="sticker-flat flex flex-col items-center gap-2 p-6 text-center">
          <span className="text-4xl" aria-hidden>
            🍽️
          </span>
          <p className="font-display text-lg font-bold">No menu yet</p>
          <p className="max-w-[16rem] text-sm text-muted">
            Just add what you had below, or continue.
          </p>
        </div>
      )}

      <label className="sticker-flat mt-5 block p-4">
        <span className="flex items-center justify-between font-display text-sm font-bold">
          <span>Something not on the list?</span>
          <span className="text-xs font-semibold tabular-nums text-muted">
            {customFood.length}/{CUSTOM_LIMIT}
          </span>
        </span>
        <input
          className="field mt-2"
          maxLength={CUSTOM_LIMIT}
          placeholder="Add something not listed (e.g. house special, add-ons, extras...)"
          value={customFood}
          onChange={(event) => setCustomFood(event.target.value.slice(0, CUSTOM_LIMIT))}
        />
      </label>

      <div className="h-6" />
      <StepFooter onNext={() => onNext(customFood)} />
    </div>
  );
}
