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

  const [token, setToken] = useState<string | null>(null);
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
    fetchMe(auth.token)
      .then((fresh) => {
        if (cancelled) {
          return null;
        }
        writeAuth(fresh);
        setToken(fresh.token);
        return fresh.token;
      })
      .then((staffToken) => {
        if (!staffToken || cancelled) {
          return;
        }
        return fetchAdminRestaurant(staffToken, restaurantId).then((row) => {
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
    if (!token || !Number.isInteger(restaurantId) || restaurantId < 1) {
      return;
    }
    let cancelled = false;
    setMetricsLoading(true);
    setMetricsError(null);
    fetchOwnerMetrics(token, restaurantId)
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
  }, [restaurantId, router, token]);

  const menuGroups = useMemo(() => (detail ? groupMenu(detail.menu) : new Map<string, string[]>()), [detail]);
  const tagGroups = useMemo(() => (detail ? groupTags(detail.tags) : new Map<string, string[]>()), [detail]);

  if (!Number.isInteger(restaurantId) || restaurantId < 1) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-700">Could not load restaurant info. Refresh to try again.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6">
      <div>
        <Link className="text-sm underline" href="/admin">
          Back
        </Link>
        <p className="mt-3 text-sm text-neutral-600">
          <Link className="underline" href="/admin">
            Admin
          </Link>
          {" → "}
          <Link className="underline" href="/admin">
            Restaurants
          </Link>
          {" → "}
          {detail?.name ?? "…"}
        </p>
        <h1 className="mt-2 text-xl font-semibold">{detail?.name ?? "Restaurant"}</h1>
      </div>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="font-medium">Restaurant info</h2>
        {detailLoading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : detailError || !detail ? (
          <p className="mt-3 text-sm text-red-700">{detailError ?? "Could not load restaurant info. Refresh to try again."}</p>
        ) : (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Name</dt>
              <dd className="font-medium">{detail.name}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Slug</dt>
              <dd className="font-mono text-xs">reviewease.com/r/{detail.slug}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Google Place ID</dt>
              <dd className="break-all font-mono text-xs">{detail.google_place_id}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Brand colour</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span
                  className="h-6 w-6 rounded-md border border-black/10"
                  style={{ background: detail.brand_color || "#c45c26" }}
                />
                <span className="font-mono text-xs">{detail.brand_color || "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Date added</dt>
              <dd>{formatAdded(detail.created_at)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="font-medium">Menu Items ({detail?.menu.length ?? 0})</h2>
        {detailLoading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : detailError || !detail ? (
          <p className="mt-3 text-sm text-red-700">Could not load menu items. Refresh to try again.</p>
        ) : detail.menu.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">No menu items added yet</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="font-medium">Tag Bank ({detail?.tags.length ?? 0} tags)</h2>
        {detailLoading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : detailError || !detail ? (
          <p className="mt-3 text-sm text-red-700">Could not load tag bank. Refresh to try again.</p>
        ) : detail.tags.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">No tags added yet</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="font-medium">QR code</h2>
        {token ? (
          <AdminQrBlock
            token={token}
            restaurantId={restaurantId}
            slug={detail?.slug ?? "restaurant"}
            restaurantName={detail?.name ?? "Restaurant"}
            imageClassName="h-64 w-64"
            onAuthFailure={() => router.replace("/login")}
          />
        ) : (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="font-medium">Activity snapshot</h2>
        {metricsLoading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : metricsError || !metrics ? (
          <p className="mt-3 text-sm text-red-700">
            {metricsError ?? "Could not load activity snapshot. Refresh to try again."}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total scans" value={metrics.funnel.scans} />
            <StatCard label="Total completed sessions" value={metrics.funnel.started} />
            <StatCard label="Total Google click-throughs" value={metrics.funnel.opened_google} />
            <StatCard label="Total private feedback received" value={metrics.feedback.length} />
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
