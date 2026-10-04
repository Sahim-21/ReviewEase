"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminQrBlock } from "@/components/admin/AdminQrBlock";
import { formatAdded, groupMenu, groupTags } from "@/lib/adminFormat";
import type { AdminRestaurantDetail, OwnerMetrics } from "@/lib/types";

type RestaurantCardProps = {
  token: string;
  detail: AdminRestaurantDetail;
  metrics: OwnerMetrics | null;
  onAuthFailure: () => void;
};

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-3">
      <p className="text-xl font-semibold tabular-nums">{value == null ? "—" : value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

export function RestaurantCard({ token, detail, metrics, onAuthFailure }: RestaurantCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const menuGroups = useMemo(() => groupMenu(detail.menu), [detail.menu]);
  const tagGroups = useMemo(() => groupTags(detail.tags), [detail.tags]);

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{detail.name}</h2>
        <div className="flex items-center gap-2">
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
        <button className="w-full text-left text-sm font-medium" type="button" onClick={() => setMenuOpen((open) => !open)}>
          Menu Items ({detail.menu.length})
        </button>
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
        <button className="w-full text-left text-sm font-medium" type="button" onClick={() => setTagsOpen((open) => !open)}>
          Tag Bank ({detail.tags.length} tags)
        </button>
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
    </article>
  );
}
