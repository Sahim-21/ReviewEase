"use client";

import { FormEvent, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { changePassword } from "@/lib/staffApi";

type ChangePasswordModalProps = {
  onClose: () => void;
};

const MIN_LENGTH = 10;

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (next !== repeat) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="sticker w-full max-w-md animate-pop-in p-6">
        <h2 id="change-password-title" className="font-display text-2xl font-extrabold tracking-tight">
          Change password
        </h2>
        {done ? (
          <>
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-pine">
              <Icon name="check" size={18} />
              Password changed. Use the new one next time you sign in.
            </p>
            <div className="mt-5 flex justify-end">
              <button className="btn btn-primary btn-sm" type="button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
            <label className="font-display text-sm font-bold">
              Current password
              <input
                className="field mt-1 font-sans font-normal"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </label>
            <label className="font-display text-sm font-bold">
              New password
              <input
                className="field mt-1 font-sans font-normal"
                type="password"
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </label>
            <label className="font-display text-sm font-bold">
              Repeat new password
              <input
                className="field mt-1 font-sans font-normal"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
              />
            </label>
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Change password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
