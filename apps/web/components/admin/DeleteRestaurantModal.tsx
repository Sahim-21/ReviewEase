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
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]">
      <div className="sticker w-full max-w-md animate-pop-in p-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Permanently delete {restaurantName}?</h2>
        <p className="mt-3 text-sm text-muted">
          This will delete all sessions, feedback, menu items and tags for this restaurant. This cannot be undone.
        </p>
        <label className="mt-4 block text-sm">
          Type the restaurant name to confirm
          <input
            className="field mt-1"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>
        {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-danger btn-sm"
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
