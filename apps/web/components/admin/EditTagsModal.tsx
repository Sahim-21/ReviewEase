"use client";

import { useMemo, useState } from "react";

import { isAuthFailure, replaceTags } from "@/lib/staffApi";
import type { TagPublic } from "@/lib/types";

const ASPECT_HINTS = ["food", "service", "ambience", "value"];

export interface EditTagsModalProps {
  token: string;
  restaurantId: number;
  restaurantName: string;
  tags: TagPublic[];
  onClose: () => void;
  onSaved: (tags: TagPublic[]) => void;
  onAuthFailure: () => void;
}

interface TagEditRow {
  key: string;
  aspect: string;
  label: string;
}

function toRows(tags: TagPublic[]): TagEditRow[] {
  return tags.map((tag: TagPublic, index: number) => ({
    key: `existing-${tag.id}-${index}`,
    aspect: tag.aspect,
    label: tag.label,
  }));
}

export function EditTagsModal({
  token,
  restaurantId,
  restaurantName,
  tags,
  onClose,
  onSaved,
  onAuthFailure,
}: EditTagsModalProps) {
  const [rows, setRows] = useState<TagEditRow[]>(() => toRows(tags));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const listId = `tag-aspects-${restaurantId}`;

  const grouped = useMemo(() => {
    const groups = new Map<string, TagEditRow[]>();
    for (const row of rows) {
      const aspect = row.aspect.trim() || "food";
      const list = groups.get(aspect) ?? [];
      list.push(row);
      groups.set(aspect, list);
    }
    return [...groups.entries()];
  }, [rows]);

  const aspectOptions = useMemo(() => {
    const unique = new Set<string>(ASPECT_HINTS);
    for (const row of rows) {
      if (row.aspect.trim()) {
        unique.add(row.aspect.trim());
      }
    }
    return [...unique];
  }, [rows]);

  function updateRow(key: string, field: "aspect" | "label", value: string) {
    setRows((current: TagEditRow[]) =>
      current.map((row: TagEditRow) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    const payload = rows
      .map((row: TagEditRow) => ({ aspect: row.aspect.trim(), label: row.label.trim() }))
      .filter((tag: { aspect: string; label: string }) => tag.aspect.length > 0 || tag.label.length > 0);
    try {
      const next = await replaceTags(token, restaurantId, payload);
      onSaved(next);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        onAuthFailure();
        return;
      }
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Edit Tag Bank — {restaurantName}</h2>
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {grouped.map(([aspect, aspectRows]: [string, TagEditRow[]]) => (
            <section key={aspect}>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{aspect}</p>
              <div className="mt-2 space-y-2">
                {aspectRows.map((row: TagEditRow) => (
                  <div key={row.key} className="flex gap-2">
                    <input
                      className="w-1/3 rounded-lg border px-2 py-2 text-sm"
                      list={listId}
                      placeholder="Aspect"
                      value={row.aspect}
                      onChange={(event) => updateRow(row.key, "aspect", event.target.value)}
                    />
                    <input
                      className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-sm"
                      placeholder="Label"
                      value={row.label}
                      onChange={(event) => updateRow(row.key, "label", event.target.value)}
                    />
                    <button
                      className="shrink-0 rounded-lg border px-2 text-sm text-neutral-600"
                      type="button"
                      onClick={() =>
                        setRows((current: TagEditRow[]) => current.filter((item: TagEditRow) => item.key !== row.key))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <datalist id={listId}>
            {aspectOptions.map((aspect: string) => (
              <option key={aspect} value={aspect} />
            ))}
          </datalist>
          <button
            className="text-sm font-medium underline"
            type="button"
            onClick={() =>
              setRows((current: TagEditRow[]) => [
                ...current,
                { key: `new-${current.length}-${Date.now()}`, aspect: "food", label: "" },
              ])
            }
          >
            + Add tag
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-full px-4 py-2 text-sm text-neutral-700" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
            disabled={saving}
            type="button"
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
