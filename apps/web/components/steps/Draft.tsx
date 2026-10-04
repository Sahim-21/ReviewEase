"use client";

import { DraftLoading } from "@/components/ui/DraftLoading";
import { StepHeader } from "@/components/ui/StepHeader";
import { tapFeedback } from "@/lib/haptic";

type DraftProps = {
  text: string;
  loading: boolean;
  error: string | null;
  remaining: number;
  copying: boolean;
  showGoogleFallback: boolean;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  onCopyAndOpen: () => void;
  onOpenGoogle: () => void;
  onPrivateFeedback: () => void;
  onJourney: () => void;
  onBack: () => void;
};

export function Draft({
  text,
  loading,
  error,
  remaining,
  copying,
  showGoogleFallback,
  onChange,
  onRegenerate,
  onCopyAndOpen,
  onOpenGoogle,
  onPrivateFeedback,
  onJourney,
  onBack,
}: DraftProps) {
  const regenerateLeft = Math.max(0, remaining);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StepHeader title="Your draft" />
      <p className="mt-2 rounded-xl bg-black/5 px-3 py-2 text-xs text-neutral-700">
        AI helped phrase this from your inputs. Edit freely.
      </p>
      {loading ? (
        <DraftLoading />
      ) : (
        <textarea
          value={text}
          onChange={(event) => onChange(event.target.value)}
          className="mt-4 min-h-40 flex-1 resize-none rounded-2xl border border-black/10 bg-white p-4 text-base leading-relaxed outline-none focus:border-[var(--brand)]"
        />
      )}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onRegenerate();
        }}
        disabled={loading || regenerateLeft <= 0}
        className="mt-3 text-left text-sm font-medium text-[var(--brand)] disabled:opacity-40"
      >
        {regenerateLeft <= 0
          ? "No regenerations left"
          : `Regenerate (${regenerateLeft} left)`}
      </button>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onCopyAndOpen();
        }}
        disabled={loading || copying || !text.trim()}
        className="mt-4 rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {copying ? "Opening Google…" : "Copy and open Google"}
      </button>
      {showGoogleFallback ? (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            onOpenGoogle();
          }}
          className="mt-2 text-center text-sm font-medium underline"
        >
          Copied? Tap here to open Google
        </button>
      ) : null}
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
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onJourney();
        }}
        disabled={loading}
        className="mt-3 rounded-full bg-[var(--brand)]/10 py-3 text-sm font-semibold text-[var(--brand)] disabled:opacity-40"
      >
        See my meal journey
      </button>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onBack();
        }}
        className="mt-2 py-2 text-sm text-neutral-500"
      >
        Back
      </button>
    </div>
  );
}
