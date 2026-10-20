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
import type { AdminRestaurantDetail, MenuItemPublic, RestaurantStats, TagPublic } from "@/lib/types";

interface RestaurantCardProps {
  detail: AdminRestaurantDetail;
  stats: RestaurantStats | null;
  onAuthFailure: () => void;
  onUpdated: (detail: AdminRestaurantDetail) => void;
  onDeleted: (restaurantId: number) => void;
}

function StatBox({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-2xl bg-tint px-3 py-3">
      <p className="font-display text-2xl font-extrabold tabular-nums">{value == null ? "—" : value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

export function RestaurantCard({
  detail,
  stats,
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
      const result = await setRestaurantStatus(detail.id, nextActive, detail.slug);
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
      await deleteRestaurant(detail.id);
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
    <article className="sticker p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">{detail.name}</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              active ? "bg-pine/15 text-pine" : "bg-marigold/25 text-ink"
            }`}
          >
            {active ? "Active" : "Suspended"}
          </span>
          {active ? (
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => setSuspendOpen(true)}
            >
              Suspend Service
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              disabled={statusBusy}
              type="button"
              onClick={() => void applyStatus(true)}
            >
              Reactivate Service
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm !text-danger"
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            Delete Restaurant
          </button>
          <span
            className="h-5 w-5 shrink-0 rounded-full border-2 border-line"
            style={{ background: detail.brand_color || "#c45c26" }}
          />
          <a className="font-mono text-sm font-semibold underline decoration-dotted underline-offset-4" href={`/r/${detail.slug}`} rel="noreferrer" target="_blank">
            /r/{detail.slug}
          </a>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        {detail.google_place_id} | {formatAdded(detail.created_at)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatBox label="Total Scans" value={stats ? stats.scans : null} />
        <StatBox label="Started" value={stats ? stats.started : null} />
        <StatBox label="Google Click-throughs" value={stats ? stats.opened_google : null} />
        <StatBox label="Private Feedback" value={stats ? stats.feedback : null} />
        <StatBox
          label="Avg. Stars"
          value={stats?.average_stars != null ? `${stats.average_stars.toFixed(1)} ★` : null}
        />
      </div>

      <div className="mt-4 border-t border-hairline pt-3">
        <div className="flex items-center justify-between gap-2">
          <button className="text-left font-display text-base font-bold" type="button" onClick={() => setMenuOpen((open) => !open)}>
            Menu Items ({detail.menu.length})
          </button>
          <button className="link-quiet text-sm" type="button" onClick={() => setEditMenu(true)}>
            Edit
          </button>
        </div>
        {menuOpen ? (
          detail.menu.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No menu items added</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[...menuGroups.entries()].map(([category, names]: [string, string[]]) => (
                <div key={category}>
                  <p className="eyebrow">{category}</p>
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

      <div className="mt-3 border-t border-hairline pt-3">
        <div className="flex items-center justify-between gap-2">
          <button className="text-left font-display text-base font-bold" type="button" onClick={() => setTagsOpen((open) => !open)}>
            Tag Bank ({detail.tags.length} tags)
          </button>
          <button className="link-quiet text-sm" type="button" onClick={() => setEditTags(true)}>
            Edit
          </button>
        </div>
        {tagsOpen ? (
          detail.tags.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No tags added</p>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {[...tagGroups.entries()]
                .filter((entry: [string, string[]]) => entry[1].length > 0)
                .map(([aspect, labels]: [string, string[]]) => (
                  <div key={aspect}>
                    <p className="eyebrow !normal-case">{aspect}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {labels.map((label: string) => (
                        <span
                          key={`${aspect}-${label}`}
                          className="rounded-full border-2 border-hairline bg-white px-3 py-1 text-sm font-semibold"
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

      <div className="mt-3 border-t border-hairline pt-3">
        <button className="w-full text-left font-display text-base font-bold" type="button" onClick={() => setQrOpen((open) => !open)}>
          QR Code
        </button>
        {qrOpen ? (
          <AdminQrBlock
            restaurantId={detail.id}
            slug={detail.slug}
            restaurantName={detail.name}
            imageClassName="h-[180px] w-[180px]"
            onAuthFailure={onAuthFailure}
          />
        ) : null}
      </div>

      <Link className="mt-4 inline-block link-quiet text-sm" href={`/admin/restaurants/${detail.id}`}>
        View full details →
      </Link>

      {editMenu ? (
        <EditMenuModal
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
