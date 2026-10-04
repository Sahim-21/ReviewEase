"use client";

import { useState } from "react";

import { ApiError, sendFeedback } from "@/lib/api";

type PrivateFeedbackModalProps = {
  slug: string;
  sessionId: number | null;
  token: string | null;
  onClose: () => void;
};

export function PrivateFeedbackModal({ slug, sessionId, token, onClose }: PrivateFeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | undefined>();
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

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
          rating,
          contact: contact.trim() || undefined,
          session_id: sessionId ?? undefined,
        },
        token ?? undefined,
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="private-feedback-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
      >
        {done ? (
          <>
            <h2 id="private-feedback-title" className="text-lg font-semibold">
              Sent privately
            </h2>
            <p className="mt-2 text-sm text-neutral-600">The restaurant can see this. It is not posted to Google.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-full bg-[var(--brand)] py-3 text-sm font-semibold text-white"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 id="private-feedback-title" className="text-lg font-semibold">
              Private feedback
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Available at every rating. This stays with the owner; we do not post it to Google.
            </p>
            <textarea
              value={message}
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should they know?"
              className="mt-4 min-h-28 w-full rounded-2xl border border-black/10 p-3 text-sm outline-none focus:border-[var(--brand)]"
            />
            <p className="mt-3 text-xs font-medium text-neutral-500">Optional rating</p>
            <div className="mt-1 flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setRating(score)}
                  className={`h-9 w-9 rounded-full text-sm ${
                    rating === score ? "bg-[var(--brand)] text-white" : "bg-neutral-100"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <input
              value={contact}
              maxLength={200}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Contact (optional)"
              className="mt-3 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
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
                {sending ? "Sending…" : "Send privately"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
