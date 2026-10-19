"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { tapFeedback } from "@/lib/haptic";

type StepFooterProps = {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  /** Small element rendered under the buttons (skip link, helper text...). */
  below?: ReactNode;
};

/** Sticky Back / Next bar shared by the diner steps. */
export function StepFooter({ onBack, onNext, nextLabel = "Next", nextDisabled, below }: StepFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      <div className="flex gap-3">
        {onBack ? (
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => {
              tapFeedback();
              onBack();
            }}
          >
            <Icon name="arrowBack" />
            Back
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary flex-[2]"
          disabled={nextDisabled}
          onClick={() => {
            tapFeedback();
            onNext();
          }}
        >
          {nextLabel}
          <Icon name="arrowForward" />
        </button>
      </div>
      {below ? <div className="mt-3 text-center text-sm text-muted">{below}</div> : null}
    </div>
  );
}
