"use client";

import { useState } from "react";

export interface DeleteRestaurantModalProps {
  restaurantName: string;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteRestaurantModal({
  restaurantName,
  error,
  busy,
  onCancel,
  onConfirm,
}: DeleteRestaurantModalProps) {
  const [typed, setTyped] = useState("");
  const matches = typed === restaurantName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Permanently delete {restaurantName}?</h2>
        <p className="mt-3 text-sm text-neutral-600">
          This will delete all sessions, feedback, menu items and tags for this restaurant. This cannot be undone.
        </p>
        <label className="mt-4 block text-sm">
          Type the restaurant name to confirm
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-full px-4 py-2 text-sm text-neutral-700" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="rounded-full bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-40"
            disabled={!matches || busy}
            type="button"
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
