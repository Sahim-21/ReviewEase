"use client";

import { DraftLoading } from "@/components/ui/DraftLoading";
import { tapFeedback } from "@/lib/haptic";

type DraftProps = {
  text: string;
  loading: boolean;
  retrying: boolean;
  error: string | null;
  copying: boolean;
  onChange: (value: string) => void;
  onTryAgain: () => void;
  onCopyAndOpen: () => void;
  onPrivateFeedback: () => void;
};

export function Draft({
  text,
  loading,
  retrying,
  error,
  copying,
  onChange,
  onTryAgain,
  onCopyAndOpen,
  onPrivateFeedback,
}: DraftProps) {
  const firstWrite = loading && !retrying && !text.trim();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-xl font-semibold tracking-tight">Your review is ready</h2>
      {firstWrite ? (
        <DraftLoading label="Writing your review..." />
      ) : (
        <div className="relative mt-4 min-h-40 flex-1">
          <textarea
            value={text}
            onChange={(event) => onChange(event.target.value)}
            disabled={loading}
            className="h-full min-h-40 w-full resize-none rounded-2xl bg-white p-4 text-base leading-relaxed outline-none shadow-sm ring-0 disabled:opacity-70"
          />
          {retrying ? (
            <div className="absolute right-3 top-3" aria-hidden>
              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
            </div>
          ) : null}
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onCopyAndOpen();
        }}
        disabled={loading || copying || !text.trim()}
        className="mt-4 w-full rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        Copy and open Google
      </button>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onTryAgain();
        }}
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white py-3 text-sm font-medium disabled:opacity-40"
      >
        {retrying ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        ) : null}
        Try again
      </button>
      <button
        type="button"
        onClick={() => {
          tapFeedback();
          onPrivateFeedback();
        }}
        className="mt-4 text-center text-sm text-neutral-500 underline decoration-dotted"
      >
        Send private feedback instead
      </button>
    </div>
  );
}
