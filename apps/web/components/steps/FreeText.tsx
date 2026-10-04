"use client";

import { VoiceInput } from "@/components/ui/VoiceInput";
import { StepHeader } from "@/components/ui/StepHeader";
import { StepNav } from "@/components/ui/StepNav";

type FreeTextProps = {
  value: string;
  onChange: (value: string) => void;
  speechLocale: string;
  onBack: () => void;
  onNext: () => void;
};

export function FreeText({ value, onChange, speechLocale, onBack, onNext }: FreeTextProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepHeader
        title="Anything else?"
        subtitle="Optional. Broken English, Hinglish, Hindi, or Kannada is fine."
      />
      <label className="mt-4 flex min-h-40 flex-1 flex-col">
        <span className="sr-only">Notes about your visit</span>
        <textarea
          value={value}
          maxLength={1000}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Spicy gravy, slow service, cozy tables…"
          className="min-h-40 flex-1 resize-none rounded-2xl border border-black/10 bg-white p-4 text-base outline-none focus:border-[var(--brand)]"
        />
      </label>
      <VoiceInput
        locale={speechLocale}
        onTranscript={(piece) => {
          onChange([value.trim(), piece].filter(Boolean).join(" ").slice(0, 1000));
        }}
      />
      <StepNav onBack={onBack} onNext={onNext} nextLabel={value.trim() ? "Next" : "Skip"} />
    </div>
  );
}
