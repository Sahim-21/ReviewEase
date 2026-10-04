"use client";

import { EmojiRating } from "@/components/ui/EmojiRating";
import { StepHeader } from "@/components/ui/StepHeader";
import { StepNav } from "@/components/ui/StepNav";
import type { Aspect, Ratings } from "@/lib/types";

const ASPECTS: Aspect[] = ["food", "service", "ambience", "value"];

type RatingsProps = {
  ratings: Ratings;
  onChange: (aspect: Aspect, value: number) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Ratings({ ratings, onChange, onBack, onNext }: RatingsProps) {
  const ready = ASPECTS.every((aspect) => typeof ratings[aspect] === "number");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepHeader title="How was it?" subtitle="Tap a face for each part of the visit." />
      <div className="mt-4 flex flex-col gap-3 overflow-y-auto pb-2">
        {ASPECTS.map((aspect) => (
          <EmojiRating
            key={aspect}
            label={aspect}
            value={ratings[aspect]}
            onChange={(value) => onChange(aspect, value)}
          />
        ))}
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!ready} />
    </div>
  );
}
