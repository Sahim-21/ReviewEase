"use client";

export interface SuspendServiceModalProps {
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}

export function SuspendServiceModal({ onCancel, onConfirm, busy }: SuspendServiceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Suspend QR review service?</h2>
        <p className="mt-3 text-sm text-neutral-600">
          Diners who scan the QR will see a &apos;service unavailable&apos; message. You can reactivate anytime.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-full px-4 py-2 text-sm text-neutral-700" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="rounded-full bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50"
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
