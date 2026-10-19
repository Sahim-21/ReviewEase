"use client";

import Link from "next/link";

import { Icon } from "@/components/ui/Icon";

type ErrorScreenProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  emoji?: string;
  /** Optional link shown instead of / beside the retry button. */
  homeHref?: string;
};

export function ErrorScreen({ title, message, onRetry, emoji = "🍳", homeHref }: ErrorScreenProps) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
      <span className="blob -left-16 top-24 h-48 w-48" aria-hidden />
      <span className="blob -right-12 bottom-20 h-40 w-40" aria-hidden />
      <div
        className="sticker relative flex h-28 w-28 -rotate-3 animate-pop-in items-center justify-center text-6xl"
        aria-hidden
      >
        {emoji}
      </div>
      <h1 className="relative font-display text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="relative max-w-xs text-base text-muted">{message}</p>
      <div className="relative mt-2 flex flex-wrap justify-center gap-3">
        {onRetry ? (
          <button type="button" onClick={onRetry} className="btn btn-primary">
            <Icon name="refresh" />
            Try again
          </button>
        ) : null}
        {homeHref ? (
          <Link href={homeHref} className="btn btn-secondary">
            Home
          </Link>
        ) : null}
      </div>
    </main>
  );
}
