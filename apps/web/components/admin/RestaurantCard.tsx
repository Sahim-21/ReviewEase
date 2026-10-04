"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminQrBlock } from "@/components/admin/AdminQrBlock";
import { DeleteRestaurantModal } from "@/components/admin/DeleteRestaurantModal";
import { EditMenuModal } from "@/components/admin/EditMenuModal";
import { EditTagsModal } from "@/components/admin/EditTagsModal";
import { SuspendServiceModal } from "@/components/admin/SuspendServiceModal";
import { formatAdded, groupMenu, groupTags } from "@/lib/adminFormat";
import { deleteRestaurant, isAuthFailure, setRestaurantStatus } from "@/lib/staffApi";
import type { AdminRestaurantDetail, MenuItemPublic, OwnerMetrics, TagPublic } from "@/lib/types";

interface RestaurantCardProps {
  token: string;
  detail: AdminRestaurantDetail;
  metrics: OwnerMetrics | null;
  onAuthFailure: () => void;
  onUpdated: (detail: AdminRestaurantDetail) => void;
  onDeleted: (restaurantId: number) => void;
}

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-3">
      <p className="text-xl font-semibold tabular-nums">{value == null ? "—" : value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

export function RestaurantCard({
  token,
  detail,
  metrics,
  onAuthFailure,
  onUpdated,
  onDeleted,
}: RestaurantCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [editMenu, setEditMenu] = useState(false);
  const [editTags, setEditTags] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuGroups = useMemo(() => groupMenu(detail.menu), [detail.menu]);
  const tagGroups = useMemo(() => groupTags(detail.tags), [detail.tags]);
  const active = detail.active !== false;

  async function applyStatus(nextActive: boolean) {
    setStatusBusy(true);
    try {
      const result = await setRestaurantStatus(token, detail.id, nextActive);
      onUpdated({ ...detail, active: result.active });
      setSuspendOpen(false);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        onAuthFailure();
        return;
      }
    } finally {
      setStatusBusy(false);
    }
  }

  async function confirmDelete() {
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await deleteRestaurant(token, detail.id);
      onDeleted(detail.id);
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        onAuthFailure();
        return;
      }
      setDeleteError("Could not delete. Try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{detail.name}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
            }`}
          >
            {active ? "Active" : "Suspended"}
          </span>
          {active ? (
            <button
              className="rounded-full border px-3 py-1 text-xs"
              type="button"
              onClick={() => setSuspendOpen(true)}
            >
              Suspend Service
            </button>
          ) : (
            <button
              className="rounded-full border px-3 py-1 text-xs"
              disabled={statusBusy}
              type="button"
              onClick={() => void applyStatus(true)}
            >
              Reactivate Service
            </button>
          )}
          <button
            className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-700"
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            Delete Restaurant
          </button>
          <span
            className="h-5 w-5 shrink-0 rounded-full border border-black/10"
            style={{ background: detail.brand_color || "#c45c26" }}
          />
          <a className="font-mono text-sm underline" href={`/r/${detail.slug}`} rel="noreferrer" target="_blank">
            /r/{detail.slug}
          </a>
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-600">
        {detail.google_place_id} | {formatAdded(detail.created_at)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox label="Total Scans" value={metrics ? metrics.funnel.scans : null} />
        <StatBox label="Completed" value={metrics ? metrics.funnel.started : null} />
        <StatBox label="Google Click-throughs" value={metrics ? metrics.funnel.opened_google : null} />
        <StatBox label="Private Feedback" value={metrics ? metrics.feedback.length : null} />
      </div>

      <div className="mt-4 border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between gap-2">
          <button className="text-left text-sm font-medium" type="button" onClick={() => setMenuOpen((open) => !open)}>
            Menu Items ({detail.menu.length})
          </button>
          <button className="text-sm underline" type="button" onClick={() => setEditMenu(true)}>
            Edit
          </button>
        </div>
        {menuOpen ? (
          detail.menu.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">No menu items added</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[...menuGroups.entries()].map(([category, names]: [string, string[]]) => (
                <div key={category}>
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{category}</p>
                  <ul className="mt-1 list-disc pl-4 text-sm">
                    {names.map((name: string) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3">
        <div className="flex items-center justify-between gap-2">
          <button className="text-left text-sm font-medium" type="button" onClick={() => setTagsOpen((open) => !open)}>
            Tag Bank ({detail.tags.length} tags)
          </button>
          <button className="text-sm underline" type="button" onClick={() => setEditTags(true)}>
            Edit
          </button>
        </div>
        {tagsOpen ? (
          detail.tags.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-600">No tags added</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[...tagGroups.entries()]
                .filter((entry: [string, string[]]) => entry[1].length > 0)
                .map(([aspect, labels]: [string, string[]]) => (
                  <div key={aspect}>
                    <p className="text-xs font-medium capitalize text-neutral-500">{aspect}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {labels.map((label: string) => (
                        <span
                          key={`${aspect}-${label}`}
                          className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )
        ) : null}
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3">
        <button className="w-full text-left text-sm font-medium" type="button" onClick={() => setQrOpen((open) => !open)}>
          QR Code
        </button>
        {qrOpen ? (
          <AdminQrBlock
            token={token}
            restaurantId={detail.id}
            slug={detail.slug}
            restaurantName={detail.name}
            imageClassName="h-[180px] w-[180px]"
            onAuthFailure={onAuthFailure}
          />
        ) : null}
      </div>

      <Link className="mt-4 inline-block text-sm underline" href={`/admin/restaurants/${detail.id}`}>
        View full details →
      </Link>

      {editMenu ? (
        <EditMenuModal
          token={token}
          restaurantId={detail.id}
          restaurantName={detail.name}
          items={detail.menu}
          onClose={() => setEditMenu(false)}
          onSaved={(items: MenuItemPublic[]) => {
            onUpdated({ ...detail, menu: items });
            setEditMenu(false);
          }}
          onAuthFailure={onAuthFailure}
        />
      ) : null}
      {editTags ? (
        <EditTagsModal
          token={token}
          restaurantId={detail.id}
          restaurantName={detail.name}
          tags={detail.tags}
          onClose={() => setEditTags(false)}
          onSaved={(tags: TagPublic[]) => {
            onUpdated({ ...detail, tags });
            setEditTags(false);
          }}
          onAuthFailure={onAuthFailure}
        />
      ) : null}
      {suspendOpen ? (
        <SuspendServiceModal
          busy={statusBusy}
          onCancel={() => setSuspendOpen(false)}
          onConfirm={() => void applyStatus(false)}
        />
      ) : null}
      {deleteOpen ? (
        <DeleteRestaurantModal
          restaurantName={detail.name}
          error={deleteError}
          busy={deleteBusy}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </article>
  );
}
