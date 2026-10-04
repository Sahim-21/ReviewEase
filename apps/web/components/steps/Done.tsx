"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";

import { StepHeader } from "@/components/ui/StepHeader";
import { tapFeedback } from "@/lib/haptic";
import type { Aspect, Ratings } from "@/lib/types";

const ASPECTS: Aspect[] = ["food", "service", "ambience", "value"];

type DoneProps = {
  restaurantName: string;
  dishes: string[];
  ratings: Ratings;
  onPrivateFeedback: () => void;
};

export function Done({ restaurantName, dishes, ratings, onPrivateFeedback }: DoneProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function shareCard() {
    tapFeedback();
    if (!cardRef.current) {
      return;
    }
    setSharing(true);
    setShareError(null);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "meal-journey.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My meal journey" });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "meal-journey.png";
        link.click();
      }
    } catch {
      setShareError("Could not save the card. Try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <StepHeader
        title="Your meal journey"
        subtitle="A stamp for finishing this visit — not for posting a review."
      />
      <motion.div
        className="relative mt-4"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <div
          ref={cardRef}
          className="rounded-3xl bg-white p-5 shadow-md"
          style={{ background: "linear-gradient(180deg, #fff 60%, color-mix(in srgb, var(--brand) 12%, white))" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{restaurantName}</p>
          <p className="mt-2 text-lg font-semibold">You finished your meal journey</p>
          <p className="mt-1 text-sm text-neutral-600">Same stamp for every visit. Ratings are just your notes.</p>
          <div className="mt-4">
            <p className="text-xs font-medium text-neutral-500">Dishes</p>
            <p className="mt-1 text-sm">{dishes.length ? dishes.join(" · ") : "No dishes selected"}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {ASPECTS.map((aspect) => (
              <div key={aspect} className="rounded-xl bg-black/5 px-3 py-2">
                <p className="text-[11px] capitalize text-neutral-500">{aspect}</p>
                <p className="text-sm font-semibold">{ratings[aspect] ? `${ratings[aspect]} / 5` : "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      <button
        type="button"
        onClick={() => void shareCard()}
        disabled={sharing}
        className="mt-4 rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {sharing ? "Preparing image…" : "Share card as image"}
      </button>
      {shareError ? <p className="mt-2 text-sm text-red-600">{shareError}</p> : null}
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onPrivateFeedback();
        }}
        className="mt-3 rounded-full border border-black/15 bg-white py-3 text-sm font-medium"
      >
        Send private feedback
      </button>
    </div>
  );
}
