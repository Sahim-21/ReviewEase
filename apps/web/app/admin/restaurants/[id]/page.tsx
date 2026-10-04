"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { clearAuth, readAuth, writeAuth } from "@/lib/auth";
import {
  fetchAdminRestaurant,
  fetchMe,
  fetchOwnerMetrics,
  fetchQr,
  isAuthFailure,
} from "@/lib/staffApi";
import type { AdminRestaurantDetail, Aspect, OwnerMetrics } from "@/lib/types";

const ASPECT_ORDER: Aspect[] = ["food", "service", "ambience", "value"];

function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function groupMenu(items: AdminRestaurantDetail["menu"]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = item.category?.trim() || "Other";
    const list = groups.get(key) ?? [];
    list.push(item.name);
    groups.set(key, list);
  }
  return groups;
}

function groupTags(tags: AdminRestaurantDetail["tags"]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const aspect of ASPECT_ORDER) {
    groups.set(aspect, []);
  }
  for (const tag of tags) {
    const key = ASPECT_ORDER.includes(tag.aspect as Aspect) ? tag.aspect : "other";
    const list = groups.get(key) ?? [];
    list.push(tag.label);
    groups.set(key, list);
  }
  return groups;
}

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

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrBlob, setQrBlob] = useState<Blob | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);

  const [confirmRegen, setConfirmRegen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

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

  const loadQr = useCallback(
    async (staffToken: string, regen: boolean) => {
      setQrLoading(true);
      setQrError(null);
      try {
        const blob = await fetchQr(staffToken, restaurantId, "png", undefined, {
          regen,
          bust: Date.now(),
        });
        setQrUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return URL.createObjectURL(blob);
        });
        setQrBlob(blob);
        return true;
      } catch (err) {
        if (isAuthFailure(err)) {
          clearAuth();
          router.replace("/login");
          return false;
        }
        setQrError("Could not load QR code. Refresh to try again.");
        return false;
      } finally {
        setQrLoading(false);
      }
    },
    [restaurantId, router],
  );

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
    void loadQr(token, false);
    return () => {
      cancelled = true;
    };
  }, [loadQr, restaurantId, router, token]);

  useEffect(() => {
    return () => {
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
      }
    };
  }, [qrUrl]);

  const menuGroups = useMemo(() => (detail ? groupMenu(detail.menu) : new Map()), [detail]);
  const tagGroups = useMemo(() => (detail ? groupTags(detail.tags) : new Map()), [detail]);

  function downloadQr() {
    if (!qrBlob || !detail) {
      return;
    }
    const href = URL.createObjectURL(qrBlob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${detail.slug}-qr.png`;
    link.click();
    URL.revokeObjectURL(href);
  }

  async function confirmRegenerate() {
    if (!token) {
      return;
    }
    setConfirmRegen(false);
    const ok = await loadQr(token, true);
    showToast(ok ? "QR refreshed" : "Could not regenerate. Try again.");
  }

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
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
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
            {[...menuGroups.entries()].map(([category, names]) => (
              <div key={category}>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{category}</p>
                <ul className="mt-1 list-disc pl-4 text-sm">
                  {names.map((name) => (
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
              .filter(([, labels]) => labels.length > 0)
              .map(([aspect, labels]) => (
                <div key={aspect}>
                  <p className="text-xs font-medium capitalize text-neutral-500">{aspect}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {labels.map((label) => (
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
        {qrLoading ? (
          <p className="mt-3 text-sm text-neutral-500">Loading…</p>
        ) : qrError || !qrUrl ? (
          <p className="mt-3 text-sm text-red-700">{qrError ?? "Could not load QR code. Refresh to try again."}</p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`${detail?.name ?? "Restaurant"} QR`} className="mt-4 h-64 w-64 bg-white object-contain" src={qrUrl} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
                type="button"
                onClick={downloadQr}
              >
                Download QR
              </button>
              <button
                className="rounded-full border px-4 py-2 text-sm"
                type="button"
                onClick={() => setConfirmRegen(true)}
              >
                Regenerate QR
              </button>
            </div>
          </>
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
            {/* GET /api/owner/metrics returns at most 50 feedback rows, not a dedicated total. */}
            <StatCard label="Total private feedback received" value={metrics.feedback.length} />
          </div>
        )}
      </section>

      {confirmRegen ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div role="dialog" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Regenerate QR code?</h2>
            <p className="mt-2 text-sm text-neutral-600">
              This will create a new QR image for this restaurant. The old printed QR codes will still work — only
              the image file changes.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-full border py-2 text-sm" type="button" onClick={() => setConfirmRegen(false)}>
                Cancel
              </button>
              <button
                className="flex-[2] rounded-full bg-foreground py-2 text-sm text-background"
                type="button"
                onClick={() => void confirmRegenerate()}
              >
                Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <p className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white">
          {toast}
        </p>
      ) : null}
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
