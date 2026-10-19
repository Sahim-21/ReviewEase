"use client";

import { motion } from "framer-motion";

import { Icon } from "@/components/ui/Icon";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { tapFeedback } from "@/lib/haptic";
import type { Tone } from "@/lib/types";

const LIMIT = 300;

const TONES: { id: Tone; label: string; caption: string }[] = [
  { id: "casual", label: "Casual ✦", caption: "Relaxed and friendly" },
  { id: "detailed", label: "Detailed ✦", caption: "A fuller, longer review" },
  { id: "short", label: "Short ✦", caption: "Just a line or two" },
];

type NotesProps = {
  value: string;
  tone: Tone;
  speechLocale: string;
  onChange: (value: string) => void;
  onTone: (tone: Tone) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Notes({ value, tone, speechLocale, onChange, onTone, onBack, onNext }: NotesProps) {
  const left = LIMIT - value.length;
  const activeTone = TONES.find((option) => option.id === tone) ?? TONES[0];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <section className="mb-4">
        <h2 className="font-display text-[1.9rem] font-extrabold leading-tight tracking-tight">
          Tell us more <span className="text-lg font-semibold text-muted">(optional)</span>
        </h2>
        <p className="mt-1 text-base text-muted">A few words in your own style. Any language works.</p>
      </section>

      <div className="relative">
        <label className="sr-only" htmlFor="review-notes">
          Optional review notes
        </label>
        <textarea
          id="review-notes"
          value={value}
          maxLength={LIMIT}
          onChange={(event) => onChange(event.target.value.slice(0, LIMIT))}
          placeholder="e.g. biryani was great, AC too cold, waiter was helpful..."
          className="field min-h-40 resize-none rounded-3xl p-4 leading-relaxed"
        />
        {left < 50 ? (
          <span className="absolute right-3 top-3 rounded-full bg-tint-strong px-2.5 py-0.5 text-xs font-bold">
            {left} characters left
          </span>
        ) : null}
      </div>

      <VoiceInput
        locale={speechLocale}
        onTranscript={(piece) => {
          onChange([value.trim(), piece].filter(Boolean).join(" ").slice(0, LIMIT));
        }}
      />

      <fieldset className="mt-5">
        <legend className="mb-2 font-display text-sm font-bold">Tone of your review</legend>
        <div className="relative grid grid-cols-3 gap-1 rounded-full border-2 border-hairline bg-white p-1" role="radiogroup">
          {TONES.map((option) => {
            const active = tone === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  tapFeedback();
                  onTone(option.id);
                }}
                className={`relative min-h-[2.75rem] rounded-full font-display text-sm font-bold ${
                  active ? "text-on-brand" : "text-ink"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="tone-pill"
                    className="absolute inset-0 rounded-full border-2 border-line bg-brand shadow-pop-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                ) : null}
                <span className="relative">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-1.5 px-2 text-sm font-medium text-muted">
          <Icon name="info" size={16} className="text-brand" />
          {activeTone.caption}
        </p>
      </fieldset>

      <div className="h-6" />
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            tapFeedback();
            onNext();
          }}
        >
          Write my review
          <Icon name="arrowForward" />
        </button>
        <p className="mt-2 text-center text-sm text-muted">We&apos;ll turn your notes into a review</p>
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            className="link-quiet inline-flex items-center gap-1 py-1 text-sm"
            onClick={() => {
              tapFeedback();
              onBack();
            }}
          >
            <Icon name="arrowBack" size={16} />
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
