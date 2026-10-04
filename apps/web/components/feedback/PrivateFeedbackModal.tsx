"use client";

import { useState } from "react";

import { ApiError, sendFeedback } from "@/lib/api";

type PrivateFeedbackModalProps = {
  slug: string;
  sessionId: number | null;
  token: string | null;
  onClose: () => void;
  onSent: () => void;
};

export function PrivateFeedbackModal({
  slug,
  sessionId,
  token,
  onClose,
  onSent,
}: PrivateFeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="private-feedback-title"
        className="mb-0 w-full max-w-md rounded-t-3xl bg-white p-5 shadow-xl sm:mb-4 sm:rounded-2xl"
      >
        <h2 id="private-feedback-title" className="text-lg font-semibold">
          Private feedback
        </h2>
        <textarea
          value={message}
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What should they know?"
          className="mt-4 min-h-28 w-full rounded-2xl bg-neutral-50 p-3 text-sm outline-none shadow-inner"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-black/15 py-3 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending}
            className="flex-[2] rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
