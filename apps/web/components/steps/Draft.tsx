"use client";

import { DraftLoading } from "@/components/ui/DraftLoading";
import { Icon } from "@/components/ui/Icon";
import { StarsDisplay } from "@/components/ui/StarRating";
import { tapFeedback } from "@/lib/haptic";
import { starMood } from "@/lib/stars";

type DraftProps = {
  text: string;
  stars: number | null;
  dishes: string[];
  loading: boolean;
  retrying: boolean;
  error: string | null;
  copying: boolean;
  /** Regenerations left in this session (from the API), or null if unknown. */
  draftsLeft?: number | null;
  onChange: (value: string) => void;
  onTryAgain: () => void;
  onCopyAndOpen: () => void;
  onPrivateFeedback: () => void;
};

export function Draft({
  text,
  stars,
  dishes,
  loading,
  retrying,
  error,
  copying,
  draftsLeft = null,
  onChange,
  onTryAgain,
  onCopyAndOpen,
  onPrivateFeedback,
}: DraftProps) {
  const firstWrite = loading && !retrying && !text.trim();
  const mood = starMood(stars);
  // Low ratings make the private route the main button. Google stays available: nobody is blocked.
  const lowRating = stars !== null && stars <= 2;
  return (
    <div className="flex min-h-0 flex-1 flex-col pb-4">
      {firstWrite ? (
        <>
          <h2 className="sr-only">Writing your review</h2>
          <DraftLoading label="Writing your review..." />
        </>
      ) : (
        <>
          <section className="mb-3 flex items-end justify-between gap-3">
            <div>
              <span className="inline-flex rotate-[-1deg] items-center gap-1 rounded-full bg-pine px-2.5 py-0.5 font-display text-xs font-bold text-white">
                <Icon name="check" size={14} />
                Polished &amp; ready
              </span>
              <h2 className="mt-1.5 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight">
                Your review is ready
              </h2>
            </div>
            <span className="rotate-3 text-4xl" aria-hidden>
              📝
            </span>
          </section>

          <article className="sticker relative flex flex-col gap-3 p-4">
            {retrying ? (
              <span
                className="absolute right-4 top-4 z-10 flex animate-wobble items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-on-brand shadow-pop-sm"
                role="status"
              >
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-brand/50 border-t-on-brand" />
                Rewriting...
              </span>
            ) : null}

            {stars || dishes.length ? (
              <div className="flex flex-wrap items-center gap-2">
                {stars ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-1">
                    <StarsDisplay value={stars} size={16} />
                    <span className="font-display text-xs font-bold">
                      {stars}/5 · {mood.caption}
                    </span>
                  </span>
                ) : null}
                {dishes.map((dish) => (
                  <span key={dish} className="rounded-xl bg-tint px-2.5 py-1 font-display text-xs font-bold">
                    🍽️ {dish}
                  </span>
                ))}
              </div>
            ) : null}

            <label className="sr-only" htmlFor="review-draft">
              Edit your review
            </label>
            <textarea
              id="review-draft"
              value={text}
              onChange={(event) => onChange(event.target.value)}
              disabled={loading}
              rows={8}
              className="field min-h-48 resize-none rounded-2xl p-3.5 leading-relaxed disabled:opacity-60"
            />
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <span aria-hidden>✨</span>
              AI helped phrase this from your inputs. Edit freely.
            </p>
          </article>
        </>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
        >
          <Icon name="warning" size={18} className="shrink-0" />
          {error}
        </p>
      ) : null}

      {lowRating ? (
        <p className="mt-4 rounded-2xl bg-tint px-4 py-3 text-sm font-medium">
          Sorry it wasn&apos;t a great visit. Want the owner to hear it directly so they can fix it?
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3">
        {lowRating ? (
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => {
              tapFeedback();
              onPrivateFeedback();
            }}
          >
            Tell the owner directly
          </button>
        ) : null}
        <button
          type="button"
          className={`btn w-full ${lowRating ? "btn-secondary" : "btn-primary"}`}
          onClick={() => {
            tapFeedback();
            onCopyAndOpen();
          }}
          disabled={loading || copying || !text.trim()}
        >
          <Icon name="copy" />
          Copy and open Google
        </button>
        <button
          type="button"
          className="btn btn-secondary w-full"
          onClick={() => {
            tapFeedback();
            onTryAgain();
          }}
          disabled={loading || draftsLeft === 0}
        >
          {retrying ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/40 border-t-transparent" />
          ) : (
            <Icon name="refresh" />
          )}
          {draftsLeft === 0 ? "No rewrites left" : draftsLeft != null ? `Try again (${draftsLeft} left)` : "Try again"}
        </button>
        <p className="text-center text-sm text-muted">Tap Submit on Google yourself – we never post for you.</p>
        {lowRating ? null : (
          <button
            type="button"
            className="link-quiet self-center py-1"
            onClick={() => {
              tapFeedback();
              onPrivateFeedback();
            }}
          >
            Send private feedback instead
          </button>
        )}
      </div>
    </div>
  );
}
