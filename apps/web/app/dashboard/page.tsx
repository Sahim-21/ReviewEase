"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { clearAuth, readAuth, writeAuth, type AuthUser } from "@/lib/auth";
import { fetchMe, fetchOwnerMetrics, isAuthFailure } from "@/lib/staffApi";
import type { OwnerMetrics } from "@/lib/types";

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-sm">
      <span>{label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${width}%` }} />
      </div>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [metrics, setMetrics] = useState<OwnerMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminRestaurantId, setAdminRestaurantId] = useState("");

  useEffect(() => {
    const auth = readAuth();
    if (!auth) {
      router.replace("/login");
      return;
    }
    setUser(auth);
    const rid = auth.role === "admin" ? Number(adminRestaurantId) || undefined : undefined;
    if (auth.role === "admin" && rid == null) {
      fetchMe(auth.token)
        .then((fresh) => {
          writeAuth(fresh);
          setUser(fresh);
        })
        .catch((err: unknown) => {
          if (isAuthFailure(err)) {
            clearAuth();
            router.replace("/login");
            return;
          }
          setError(err instanceof Error ? err.message : "Could not load metrics");
        });
      return;
    }
    fetchOwnerMetrics(auth.token, rid)
      .then(setMetrics)
      .catch((err: unknown) => {
        if (isAuthFailure(err)) {
          clearAuth();
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load metrics");
      });
  }, [router, adminRestaurantId]);

  const maxFunnel = useMemo(() => {
    if (!metrics) {
      return 0;
    }
    return Math.max(
      metrics.funnel.scans,
      metrics.funnel.started,
      metrics.funnel.drafts,
      metrics.funnel.copied,
      metrics.funnel.opened_google,
      1,
    );
  }, [metrics]);

  const chartMax = useMemo(() => {
    if (!metrics) {
      return 1;
    }
    return Math.max(1, ...metrics.daily.map((d) => Math.max(d.scans, d.drafts, d.opened_google)));
  }, [metrics]);

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Owner dashboard</h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <div className="flex gap-3 text-sm">
          {user.role === "admin" ? (
            <Link className="underline" href="/admin">
              Admin
            </Link>
          ) : null}
          <button
            className="underline"
            type="button"
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {user.role === "admin" ? (
        <label className="text-sm">
          Restaurant ID
          <input
            className="mt-1 w-32 rounded-lg border px-3 py-2"
            inputMode="numeric"
            value={adminRestaurantId}
            onChange={(e) => setAdminRestaurantId(e.target.value)}
            placeholder="1"
          />
        </label>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {metrics ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-medium">{metrics.restaurant_name} funnel</h2>
            <p className="text-xs text-neutral-500">Counts from diner events, scoped to this restaurant.</p>
            <FunnelBar label="Scans" value={metrics.funnel.scans} max={maxFunnel} />
            <FunnelBar label="Started" value={metrics.funnel.started} max={maxFunnel} />
            <FunnelBar label="Drafts" value={metrics.funnel.drafts} max={maxFunnel} />
            <FunnelBar label="Copied" value={metrics.funnel.copied} max={maxFunnel} />
            <FunnelBar label="Opened Google" value={metrics.funnel.opened_google} max={maxFunnel} />
          </section>

          <section>
            <h2 className="mb-2 font-medium">Last 14 days</h2>
            <svg className="h-40 w-full" viewBox={`0 0 ${metrics.daily.length * 18} 100`} role="img">
              <title>Daily scans, drafts, and Google opens</title>
              {metrics.daily.map((day, index) => {
                const x = index * 18 + 2;
                const scansH = (day.scans / chartMax) * 90;
                const draftsH = (day.drafts / chartMax) * 90;
                const googleH = (day.opened_google / chartMax) * 90;
                return (
                  <g key={day.day}>
                    <rect x={x} y={100 - scansH} width="4" height={scansH} fill="#c45c26" />
                    <rect x={x + 5} y={100 - draftsH} width="4" height={draftsH} fill="#171717" />
                    <rect x={x + 10} y={100 - googleH} width="4" height={googleH} fill="#6b7280" />
                  </g>
                );
              })}
            </svg>
            <p className="text-xs text-neutral-500">Orange scans · black drafts · grey opened Google</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-medium">Private feedback</h2>
            {metrics.feedback.length === 0 ? (
              <p className="text-sm text-neutral-600">No private notes yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {metrics.feedback.map((item) => (
                  <li className="rounded-xl border border-neutral-200 p-3 text-sm" key={item.id}>
                    <p>{item.message}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {item.rating != null ? `Rating ${item.rating} · ` : null}
                      {item.contact ? `${item.contact} · ` : null}
                      {item.created_at}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : user.role === "admin" && !adminRestaurantId ? (
        <p className="text-sm text-neutral-600">Enter a restaurant ID to view scoped metrics.</p>
      ) : (
        <p className="text-sm text-neutral-600">Loading…</p>
      )}
    </main>
  );
}
