"use client";

import { tapFeedback } from "@/lib/haptic";

type StepNavProps = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
};

export function StepNav({ onBack, onNext, nextLabel = "Next", nextDisabled }: StepNavProps) {
  return (
    <div className="mt-auto flex gap-3 pt-4">
      {onBack ? (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onBack();
          }}
          className="flex-1 rounded-full border border-black/15 bg-white py-3 text-sm font-medium"
        >
          Back
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onNext();
          }}
          disabled={nextDisabled}
          className="flex-[2] rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {nextLabel}
        </button>
      ) : null}
    </div>
  );
}
