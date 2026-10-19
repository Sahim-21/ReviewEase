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
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px]">
      <div className="sticker flex max-h-[90vh] w-full max-w-lg animate-pop-in flex-col p-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Edit Menu Items — {restaurantName}</h2>
        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {rows.map((row: MenuEditRow) => (
            <div key={row.key} className="flex gap-2">
              <input
                className="field w-1/3 !rounded-xl !px-2 !py-2 text-sm"
                list={listId}
                placeholder="Category"
                value={row.category}
                onChange={(event) => updateRow(row.key, "category", event.target.value)}
              />
              <input
                className="field min-w-0 flex-1 !rounded-xl !px-2 !py-2 text-sm"
                placeholder="Item name"
                value={row.name}
                onChange={(event) => updateRow(row.key, "name", event.target.value)}
              />
              <button
                className="shrink-0 rounded-xl border-2 border-hairline bg-white px-2.5 text-sm font-bold text-muted hover:text-danger"
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
            className="link-quiet text-sm"
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
        {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary btn-sm"
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
