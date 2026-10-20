"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminQrBlock } from "@/components/admin/AdminQrBlock";
import { formatAdded, groupMenu, groupTags } from "@/lib/adminFormat";
import { clearAuth, readAuth, writeAuth } from "@/lib/auth";
import { fetchAdminRestaurant, fetchMe, fetchOwnerMetrics, isAuthFailure } from "@/lib/staffApi";
import type { AdminRestaurantDetail, OwnerMetrics } from "@/lib/types";

export default function AdminRestaurantDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const restaurantId = Number(params.id);

  // True once the staff session has been confirmed with the API.
  const [signedIn, setSignedIn] = useState(false);
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const [metrics, setMetrics] = useState<OwnerMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    const auth = readAuth();
    if (!auth || auth.role !== "admin") {
      router.replace("/login");
      return;
    }
    if (!Number.isInteger(restaurantId) || restaurantId < 1) {
      setDetailLoading(false);
      setDetailError("Could not load restaurant info. Refresh to try again.");
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((fresh) => {
        if (cancelled) {
          return false;
        }
        writeAuth(fresh);
        setSignedIn(true);
        return true;
      })
      .then((ok) => {
        if (!ok || cancelled) {
          return;
        }
        return fetchAdminRestaurant(restaurantId).then((row) => {
          if (!cancelled) {
            setDetail(row);
          }
        });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthFailure(err)) {
          clearAuth();
          router.replace("/login");
          return;
        }
        setDetailError("Could not load restaurant info. Refresh to try again.");
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, router]);

  useEffect(() => {
    if (!signedIn || !Number.isInteger(restaurantId) || restaurantId < 1) {
      return;
    }
    let cancelled = false;
    setMetricsLoading(true);
    setMetricsError(null);
    fetchOwnerMetrics(restaurantId)
      .then((row) => {
        if (!cancelled) {
          setMetrics(row);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthFailure(err)) {
          clearAuth();
          router.replace("/login");
          return;
        }
        setMetricsError("Could not load activity snapshot. Refresh to try again.");
      })
      .finally(() => {
        if (!cancelled) {
          setMetricsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, router, signedIn]);

  const menuGroups = useMemo(() => (detail ? groupMenu(detail.menu) : new Map<string, string[]>()), [detail]);
  const tagGroups = useMemo(() => (detail ? groupTags(detail.tags) : new Map<string, string[]>()), [detail]);

  if (!Number.isInteger(restaurantId) || restaurantId < 1) {
    return (
      <main className="mx-auto max-w-4xl p-5 sm:p-8">
        <p className="text-sm font-medium text-danger">Could not load restaurant info. Refresh to try again.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-5 sm:gap-8 sm:p-8">
      <div>
        <Link className="link-quiet text-sm" href="/admin">
          Back
        </Link>
        <p className="mt-3 text-sm text-muted">
          <Link className="link-quiet" href="/admin">
            Admin
          </Link>
          {" → "}
          <Link className="link-quiet" href="/admin">
            Restaurants
          </Link>
          {" → "}
          {detail?.name ?? "…"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{detail?.name ?? "Restaurant"}</h1>
      </div>

      <section className="sticker-flat p-5">
        <h2 className="font-display text-lg font-bold">Restaurant info</h2>
        {detailLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : detailError || !detail ? (
          <p className="mt-3 text-sm font-medium text-danger">{detailError ?? "Could not load restaurant info. Refresh to try again."}</p>
        ) : (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="font-display text-lg font-bold">{detail.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Slug</dt>
              <dd className="font-mono text-xs">reviewease.com/r/{detail.slug}</dd>
            </div>
            <div>
              <dt className="text-muted">Google Place ID</dt>
              <dd className="break-all font-mono text-xs">{detail.google_place_id}</dd>
            </div>
            <div>
              <dt className="text-muted">Brand colour</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span
                  className="h-6 w-6 rounded-lg border-2 border-line"
                  style={{ background: detail.brand_color || "#c45c26" }}
                />
                <span className="font-mono text-xs">{detail.brand_color || "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Date added</dt>
              <dd>{formatAdded(detail.created_at)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="sticker-flat p-5">
        <h2 className="font-display text-lg font-bold">Menu Items ({detail?.menu.length ?? 0})</h2>
        {detailLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : detailError || !detail ? (
          <p className="mt-3 text-sm font-medium text-danger">Could not load menu items. Refresh to try again.</p>
        ) : detail.menu.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No menu items added yet</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        )}
      </section>

      <section className="sticker-flat p-5">
        <h2 className="font-display text-lg font-bold">Tag Bank ({detail?.tags.length ?? 0} tags)</h2>
        {detailLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : detailError || !detail ? (
          <p className="mt-3 text-sm font-medium text-danger">Could not load tag bank. Refresh to try again.</p>
        ) : detail.tags.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No tags added yet</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        )}
      </section>

      <section className="sticker-flat p-5">
        <h2 className="font-display text-lg font-bold">QR code</h2>
        {signedIn ? (
          <AdminQrBlock
            restaurantId={restaurantId}
            slug={detail?.slug ?? "restaurant"}
            restaurantName={detail?.name ?? "Restaurant"}
            imageClassName="h-64 w-64"
            onAuthFailure={() => router.replace("/login")}
          />
        ) : (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        )}
      </section>

      <section className="sticker-flat p-5">
        <h2 className="font-display text-lg font-bold">Activity snapshot</h2>
        {metricsLoading ? (
          <p className="mt-3 text-sm text-muted">Loading…</p>
        ) : metricsError || !metrics ? (
          <p className="mt-3 text-sm font-medium text-danger">
            {metricsError ?? "Could not load activity snapshot. Refresh to try again."}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Total scans" value={metrics.funnel.scans} />
            <StatCard label="Total completed sessions" value={metrics.funnel.started} />
            <StatCard label="Total Google click-throughs" value={metrics.funnel.opened_google} />
            <StatCard label="Total private feedback received" value={metrics.feedback.length} />
            <StatCard
              label="Average star rating"
              value={metrics.ratings?.average != null ? `${metrics.ratings.average.toFixed(1)} ★` : "—"}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-tint px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
