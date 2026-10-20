"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/Icon";

type CopyFallbackSheetProps = {
  text: string;
  onOpenGoogle: () => void;
  onClose: () => void;
};

/**
 * Shown when copying failed (common in in-app browsers). The review is pre-selected so the
 * diner can long-press → Copy themselves before going to Google, instead of landing on an
 * empty Google box.
 */
export function CopyFallbackSheet({ text, onOpenGoogle, onClose }: CopyFallbackSheetProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    areaRef.current?.select();
  }, []);

  return (
    <div className="fixed inset-0 z-30 flex animate-fade-in items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-fallback-title"
        className="w-full max-w-[480px] animate-sheet-up rounded-t-[2rem] border-2 border-b-0 border-line bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_0_0_var(--pop)] sm:rounded-[2rem] sm:border-b-2 sm:shadow-pop-lg"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/20" aria-hidden />
        <h2 id="copy-fallback-title" className="font-display text-2xl font-extrabold tracking-tight">
          Copy your review first
        </h2>
        <p className="mt-1 text-sm text-muted">
          This browser blocked automatic copying. Press and hold the text below, choose <strong>Copy</strong>, then
          open Google and paste it.
        </p>
        <textarea
          ref={areaRef}
          readOnly
          value={text}
          rows={7}
          className="field mt-4 resize-none rounded-2xl leading-relaxed"
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="mt-4 flex flex-col gap-3">
          <button type="button" className="btn btn-primary w-full" onClick={onOpenGoogle}>
            <Icon name="openInNew" />
            I&apos;ve copied it – open Google
          </button>
          <button type="button" className="link-quiet self-center py-1" onClick={onClose}>
            Back to my review
          </button>
        </div>
      </div>
    </div>
  );
}
