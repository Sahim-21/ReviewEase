"use client";

export interface SuspendServiceModalProps {
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}

export function SuspendServiceModal({ onCancel, onConfirm, busy }: SuspendServiceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]">
      <div className="sticker w-full max-w-md animate-pop-in p-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Suspend QR review service?</h2>
        <p className="mt-3 text-sm text-muted">
          Diners who scan the QR will see a &apos;service unavailable&apos; message. You can reactivate anytime.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            type="button"
            onClick={onConfirm}
          >
            {busy ? "Saving…" : "Yes, suspend"}
          </button>
        </div>
      </div>
    </div>
  );
}
