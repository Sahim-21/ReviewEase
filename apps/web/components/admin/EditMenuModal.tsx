"use client";

import { useMemo, useState } from "react";

import { isAuthFailure, replaceMenuItems } from "@/lib/staffApi";
import type { MenuItemPublic } from "@/lib/types";

export interface EditMenuModalProps {
  token: string;
  restaurantId: number;
  restaurantName: string;
  items: MenuItemPublic[];
  onClose: () => void;
  onSaved: (items: MenuItemPublic[]) => void;
  onAuthFailure: () => void;
}

interface MenuEditRow {
  key: string;
  category: string;
  name: string;
}

function toRows(items: MenuItemPublic[]): MenuEditRow[] {
  return items.map((item: MenuItemPublic, index: number) => ({
    key: `existing-${item.id}-${index}`,
    category: item.category ?? "",
    name: item.name,
  }));
}

export function EditMenuModal({
  token,
  restaurantId,
  restaurantName,
  items,
  onClose,
  onSaved,
  onAuthFailure,
}: EditMenuModalProps) {
  const [rows, setRows] = useState<MenuEditRow[]>(() => toRows(items));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const row of rows) {
      const category = row.category.trim();
      if (category) {
        unique.add(category);
      }
    }
    return [...unique];
  }, [rows]);

  const listId = `menu-categories-${restaurantId}`;

  function updateRow(key: string, field: "category" | "name", value: string) {
    setRows((current: MenuEditRow[]) =>
      current.map((row: MenuEditRow) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  async function onSave() {
    setError(null);
    setSaving(true);
    const payload = rows
      .map((row: MenuEditRow) => ({ name: row.name.trim(), category: row.category.trim() }))
      .filter((item: { name: string; category: string }) => item.name.length > 0 || item.category.length > 0);
    try {
      const next = await replaceMenuItems(token, restaurantId, payload);
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
        <h2 className="text-lg font-semibold">Edit Menu Items — {restaurantName}</h2>
        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {rows.map((row: MenuEditRow) => (
            <div key={row.key} className="flex gap-2">
              <input
                className="w-1/3 rounded-lg border px-2 py-2 text-sm"
                list={listId}
                placeholder="Category"
                value={row.category}
                onChange={(event) => updateRow(row.key, "category", event.target.value)}
              />
              <input
                className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-sm"
                placeholder="Item name"
                value={row.name}
                onChange={(event) => updateRow(row.key, "name", event.target.value)}
              />
              <button
                className="shrink-0 rounded-lg border px-2 text-sm text-neutral-600"
                type="button"
                onClick={() => setRows((current: MenuEditRow[]) => current.filter((item: MenuEditRow) => item.key !== row.key))}
              >
                ✕
              </button>
            </div>
          ))}
          <datalist id={listId}>
            {categories.map((category: string) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <button
            className="text-sm font-medium underline"
            type="button"
            onClick={() =>
              setRows((current: MenuEditRow[]) => [
                ...current,
                { key: `new-${current.length}-${Date.now()}`, category: "", name: "" },
              ])
            }
          >
            + Add item
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
