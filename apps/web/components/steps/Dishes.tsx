"use client";

import { FormEvent, useState } from "react";

import { DishCard } from "@/components/ui/DishCard";
import { StepHeader } from "@/components/ui/StepHeader";
import { StepNav } from "@/components/ui/StepNav";
import { tapFeedback } from "@/lib/haptic";
import type { MenuItemPublic } from "@/lib/types";

type DishesProps = {
  items: MenuItemPublic[];
  selected: string[];
  customTags: string[];
  onToggle: (name: string) => void;
  onAddCustomDish: (name: string) => void;
  onAddCustomService: (label: string) => void;
  onRemoveCustomService: (label: string) => void;
  onBack?: () => void;
  onNext: () => void;
};

export function Dishes({
  items,
  selected,
  customTags,
  onToggle,
  onAddCustomDish,
  onAddCustomService,
  onRemoveCustomService,
  onBack,
  onNext,
}: DishesProps) {
  const [extraDish, setExtraDish] = useState("");
  const [extraService, setExtraService] = useState("");
  const listed = new Set(items.map((item) => item.name));
  const customDishes = selected.filter((name) => !listed.has(name));

  function addDish(event: FormEvent) {
    event.preventDefault();
    const name = extraDish.trim();
    if (!name) {
      return;
    }
    tapFeedback();
    onAddCustomDish(name);
    setExtraDish("");
  }

  function addService(event: FormEvent) {
    event.preventDefault();
    const label = extraService.trim();
    if (!label) {
      return;
    }
    tapFeedback();
    onAddCustomService(label);
    setExtraService("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepHeader
        title="What did you have?"
        subtitle="Tap the mains on the list, or type anything else you want mentioned — a dish or the service."
      />
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <DishCard
              key={item.id}
              item={item}
              selected={selected.includes(item.name)}
              onToggle={onToggle}
            />
          ))}
        </div>

        <form className="mt-5 flex gap-2" onSubmit={addDish}>
          <label className="min-w-0 flex-1 text-sm">
            Other dish
            <input
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-base"
              value={extraDish}
              maxLength={80}
              placeholder="e.g. Mandi rice"
              onChange={(event) => setExtraDish(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="mt-6 shrink-0 rounded-full border border-black/15 bg-white px-3 py-2 text-sm font-medium"
          >
            Add
          </button>
        </form>
        {customDishes.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {customDishes.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onToggle(name)}
                className="rounded-full border border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_16%,white)] px-3 py-1 text-sm"
              >
                {name} ×
              </button>
            ))}
          </div>
        ) : null}

        <form className="mt-4 flex gap-2" onSubmit={addService}>
          <label className="min-w-0 flex-1 text-sm">
            Other service
            <input
              className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-base"
              value={extraService}
              maxLength={80}
              placeholder="e.g. staff explained the grill"
              onChange={(event) => setExtraService(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="mt-6 shrink-0 rounded-full border border-black/15 bg-white px-3 py-2 text-sm font-medium"
          >
            Add
          </button>
        </form>
        {customTags.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {customTags.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onRemoveCustomService(label)}
                className="rounded-full border border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_16%,white)] px-3 py-1 text-sm"
              >
                {label} ×
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={selected.length || customTags.length ? "Next" : "Skip"}
      />
    </div>
  );
}
