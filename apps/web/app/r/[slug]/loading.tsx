/**
 * Shown while the restaurant page loads. On Render's free tier the API can take ~50s to wake
 * up, so the diner sees a friendly screen instead of a blank one.
 */
export default function Loading() {
  return (
    <main
      className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <span className="blob -left-16 top-24 h-48 w-48" aria-hidden />
      <span className="blob -right-12 bottom-20 h-40 w-40" aria-hidden />
      <div className="sticker relative flex h-24 w-24 -rotate-3 animate-pop-in items-center justify-center text-5xl" aria-hidden>
        🍽️
      </div>
      <div className="relative">
        <p className="font-display text-2xl font-extrabold tracking-tight">Setting the table…</p>
        <p className="mt-1 text-sm text-muted">This can take a few seconds the first time.</p>
      </div>
      <div className="relative flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 animate-dot-bounce rounded-full bg-brand"
            style={{ animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </div>
    </main>
  );
}
