"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { ApiError, sendFeedback } from "@/lib/api";

type PrivateFeedbackModalProps = {
  slug: string;
  sessionId: number | null;
  token: string | null;
  /** The diner's overall star rating, passed along so the owner sees it with the note. */
  rating?: number | null;
  onClose: () => void;
  onSent: () => void;
};

export function PrivateFeedbackModal({
  slug,
  sessionId,
  token,
  rating,
  onClose,
  onSent,
}: PrivateFeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError(null);
    if (!message.trim()) {
      setError("Write a short note for the restaurant.");
      return;
    }
    setSending(true);
    try {
      await sendFeedback(
        {
          slug,
          message: message.trim(),
          session_id: sessionId ?? undefined,
          rating: rating ?? undefined,
        },
        token ?? undefined,
      );
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex animate-fade-in items-end justify-center bg-ink/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="private-feedback-title"
        className="w-full max-w-[480px] animate-sheet-up rounded-t-[2rem] border-2 border-b-0 border-line bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_0_0_var(--pop)] sm:rounded-[2rem] sm:border-b-2 sm:shadow-pop-lg"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-ink/20" aria-hidden />
        <h2 id="private-feedback-title" className="font-display text-2xl font-extrabold tracking-tight">
          Private feedback
        </h2>
        <p className="mt-1 text-sm text-muted">Only the restaurant sees this. It is not posted anywhere.</p>
        <textarea
          value={message}
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={rating != null && rating <= 2 ? "What went wrong? It goes straight to the owner." : "What should they know?"}
          className="field mt-4 min-h-28 resize-none rounded-2xl"
          autoFocus
        />
        {error ? (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-medium text-danger">
            <Icon name="warning" size={16} />
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm flex-1 !min-h-12">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending}
            className="btn btn-primary flex-[2] !min-h-12"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
