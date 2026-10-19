"use client";

import { motion, useReducedMotion } from "framer-motion";

type DraftLoadingProps = {
  label?: string;
};

export function DraftLoading({ label }: DraftLoadingProps) {
  const reduce = useReducedMotion();
  return (
    <div className="mt-4 flex flex-1 flex-col items-center gap-5 text-center" role="status" aria-live="polite">
      <div className="relative mt-4 flex h-32 w-32 items-center justify-center">
        <span className="absolute right-3 top-2 h-3.5 w-3.5 animate-ping rounded-full bg-marigold" />
        <span className="absolute bottom-3 left-3 h-2.5 w-2.5 animate-dot-bounce rounded-full bg-pine" />
        <span className="absolute left-1 top-8 text-lg font-bold text-brand/70">✦</span>
        <span className="absolute bottom-6 right-1 text-sm text-marigold">★</span>
        <motion.div
          className="flex h-24 w-20 -rotate-3 flex-col justify-between rounded-2xl border-2 border-line bg-white p-2.5 shadow-pop-sm"
          animate={reduce ? undefined : { rotate: [-3, 2, -3] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex justify-between">
            <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-4/5 rounded-full bg-brand/60" />
            <div className="h-2 w-full rounded-full bg-tint-strong" />
            <div className="h-2 w-3/4 rounded-full bg-tint-strong" />
          </div>
          <span className="self-end text-xl" aria-hidden>
            ✏️
          </span>
        </motion.div>
      </div>
      <div>
        <p className="font-display text-2xl font-bold tracking-tight">{label ?? "Writing your review..."}</p>
        <p className="mx-auto mt-1 max-w-[18rem] text-sm text-muted">
          Turning your dishes, stars and notes into a few honest lines.
        </p>
      </div>
      <div className="flex gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 animate-dot-bounce rounded-full bg-brand"
            style={{ animationDelay: `${i * 0.14}s` }}
          />
        ))}
      </div>
      <div className="sticker-flat w-full space-y-2.5 p-5" aria-hidden>
        {["w-full", "w-11/12", "w-full", "w-9/12"].map((w, i) => (
          <div key={i} className={`h-3.5 animate-shimmer rounded-full bg-tint-strong ${w}`} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    </div>
  );
}
