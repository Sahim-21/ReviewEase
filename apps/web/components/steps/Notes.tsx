"use client";

import { tapFeedback } from "@/lib/haptic";
import type { Tone } from "@/lib/types";

const LIMIT = 300;

const TONES: { id: Tone; label: string }[] = [
  { id: "casual", label: "Casual ✦" },
  { id: "detailed", label: "Detailed ✦" },
  { id: "short", label: "Short ✦" },
];

type NotesProps = {
  value: string;
  tone: Tone;
  onChange: (value: string) => void;
  onTone: (tone: Tone) => void;
  onNext: () => void;
};

export function Notes({ value, tone, onChange, onTone, onNext }: NotesProps) {
  const left = LIMIT - value.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-xl font-semibold tracking-tight">Tell us more (optional)</h2>
      <textarea
        value={value}
        maxLength={LIMIT}
        onChange={(event) => onChange(event.target.value.slice(0, LIMIT))}
        placeholder="e.g. biryani was great, AC too cold, waiter was helpful..."
        className="mt-4 min-h-36 flex-1 resize-none rounded-2xl bg-white p-4 text-base outline-none shadow-sm ring-0"
      />
      {left < 50 ? <p className="mt-2 text-xs text-neutral-500">{left} characters left</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {TONES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              tapFeedback();
              onTone(option.id);
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tone === option.id
                ? "bg-[var(--brand)] text-white"
                : "bg-white text-neutral-800 shadow-sm"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onNext();
        }}
        className="mt-6 w-full rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white"
      >
        Write my review →
      </button>
      <p className="mt-2 text-center text-xs text-neutral-500">We&apos;ll turn your notes into a review</p>
    </div>
  );
}
