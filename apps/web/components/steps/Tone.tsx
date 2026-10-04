"use client";

import { StepHeader } from "@/components/ui/StepHeader";
import { StepNav } from "@/components/ui/StepNav";
import { LANG_OPTIONS, TONE_OPTIONS } from "@/lib/lang";
import { tapFeedback } from "@/lib/haptic";
import type { OutputLang, Tone } from "@/lib/types";

type ToneProps = {
  value: Tone;
  onChange: (tone: Tone) => void;
  lang: OutputLang;
  onLangChange: (lang: OutputLang) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Tone({ value, onChange, lang, onLangChange, onBack, onNext }: ToneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepHeader title="How should it sound?" subtitle="We’ll phrase your notes in this tone and language." />
      <div className="mt-4 flex flex-col gap-3">
        {TONE_OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                tapFeedback();
                onChange(option.id);
              }}
              className={`rounded-2xl border p-4 text-left shadow-sm ${
                selected
                  ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_14%,white)]"
                  : "border-black/10 bg-white"
              }`}
            >
              <p className="font-semibold">{option.label}</p>
              <p className="mt-1 text-sm text-neutral-600">{option.hint}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-sm font-medium">Output language</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {LANG_OPTIONS.map((option) => {
          const selected = lang === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                tapFeedback();
                onLangChange(option.id);
              }}
              className={`rounded-2xl border p-3 text-left shadow-sm ${
                selected
                  ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_14%,white)]"
                  : "border-black/10 bg-white"
              }`}
            >
              <p className="font-semibold">{option.label}</p>
              <p className="mt-0.5 text-xs text-neutral-600">{option.hint}</p>
            </button>
          );
        })}
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Phrase my review" />
    </div>
  );
}
