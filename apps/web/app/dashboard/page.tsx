"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { StarsDisplay } from "@/components/ui/StarRating";
import { formatAdded } from "@/lib/adminFormat";
import { clearAuth, readAuth, writeAuth, type AuthUser } from "@/lib/auth";
import { fetchMe, fetchOwnerMetrics, isAuthFailure } from "@/lib/staffApi";
import type { OwnerMetrics } from "@/lib/types";

function FunnelBar({ label, value, max, delay }: { label: string; value: number; max: number; delay: number }) {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_3rem]">
      <span className="font-display font-bold">{label}</span>
      <div className="h-4 overflow-hidden rounded-full border-2 border-hairline bg-white p-0.5">
        <div
          className="h-full origin-left animate-[bar-grow_0.8s_var(--spring)_both] rounded-full bg-brand"
          style={{ width: `${width}%`, animationDelay: `${delay}ms` }}
        />
      </div>
      <span className="text-right font-display font-bold tabular-nums">{value}</span>
    </div>
  );
}

function RatingBars({ distribution, count }: { distribution: number[]; count: number }) {
  return (
    <ul className="flex flex-1 flex-col gap-1.5" aria-label="Star rating breakdown">
      {[5, 4, 3, 2, 1].map((stars) => {
        const total = distribution[stars - 1] ?? 0;
        const pct = count === 0 ? 0 : Math.round((total / count) * 100);
        return (
          <li key={stars} className="grid grid-cols-[2.25rem_1fr_2rem] items-center gap-2 text-xs font-bold">
            <span className="flex items-center gap-0.5">
              {stars}
              <span className="text-marigold">
                <Icon name="star" size={14} />
              </span>
            </span>
            <span className="h-3 overflow-hidden rounded-full border-2 border-hairline bg-white">
              <span
                className="block h-full origin-left animate-[bar-grow_0.8s_var(--spring)_both] rounded-full bg-marigold"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-right tabular-nums text-muted">{total}</span>
          </li>
        );
      })}
    </ul>
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
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-5 sm:gap-8 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Owner dashboard</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "admin" ? (
            <Link className="btn btn-secondary btn-sm" href="/admin">
              Admin
            </Link>
          ) : null}
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
          >
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </div>
      </header>

      {user.role === "admin" ? (
        <label className="flex items-center gap-3 font-display text-sm font-bold">
          Restaurant ID
          <input
            className="field w-32 font-sans font-normal"
            inputMode="numeric"
            value={adminRestaurantId}
            onChange={(e) => setAdminRestaurantId(e.target.value)}
            placeholder="1"
          />
        </label>
      ) : null}

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      {metrics ? (
        <>
          {metrics.attention && metrics.attention.length > 0 ? (
            <section className="sticker border-danger/50 flex flex-col gap-3 p-5" aria-labelledby="attention-title">
              <div className="flex items-center justify-between gap-3">
                <h2 id="attention-title" className="font-display text-xl font-extrabold">
                  Needs attention
                </h2>
                <span className="rounded-full bg-danger px-2.5 py-0.5 font-display text-xs font-bold text-white">
                  {metrics.attention.length}
                </span>
              </div>
              <p className="text-xs text-muted">Visits rated 1–2 stars, newest first.</p>
              <ul className="flex flex-col gap-3">
                {metrics.attention.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="rounded-2xl bg-tint p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      {item.rating != null ? <StarsDisplay value={item.rating} size={16} /> : <span />}
                      <span className="text-xs text-muted">{formatAdded(item.created_at)}</span>
                    </div>
                    {item.kind === "feedback" ? (
                      <p className="mt-1">{item.message}</p>
                    ) : (
                      <>
                        <p className="mt-1 text-muted">
                          No private note left{item.items.length ? ` · had ${item.items.join(", ")}` : ""}
                        </p>
                        {item.note ? <p className="mt-1">{item.note}</p> : null}
                      </>
                    )}
                    {item.contact ? <p className="mt-1 text-xs text-muted">{item.contact}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="sticker flex flex-col gap-3 p-5">
            <div>
              <h2 className="font-display text-xl font-extrabold">{metrics.restaurant_name} funnel</h2>
              <p className="text-xs text-muted">Counts from diner events, scoped to this restaurant.</p>
            </div>
            <FunnelBar label="Scans" value={metrics.funnel.scans} max={maxFunnel} delay={0} />
            <FunnelBar label="Started" value={metrics.funnel.started} max={maxFunnel} delay={80} />
            <FunnelBar label="Drafts" value={metrics.funnel.drafts} max={maxFunnel} delay={160} />
            <FunnelBar label="Copied" value={metrics.funnel.copied} max={maxFunnel} delay={240} />
            <FunnelBar label="Opened Google" value={metrics.funnel.opened_google} max={maxFunnel} delay={320} />
          </section>

          <section className="sticker flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-1 sm:w-48">
              <h2 className="eyebrow">Diner star rating</h2>
              {metrics.ratings && metrics.ratings.count > 0 && metrics.ratings.average != null ? (
                <>
                  <p className="font-display text-6xl font-extrabold leading-none tabular-nums">
                    {metrics.ratings.average.toFixed(1)}
                  </p>
                  <StarsDisplay value={Math.round(metrics.ratings.average)} size={22} />
                  <p className="text-xs text-muted">
                    from {metrics.ratings.count} rating{metrics.ratings.count === 1 ? "" : "s"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">No star ratings yet.</p>
              )}
            </div>
            {metrics.ratings && metrics.ratings.count > 0 ? (
              <RatingBars distribution={metrics.ratings.distribution} count={metrics.ratings.count} />
            ) : null}
          </section>

          <section className="sticker-flat p-5">
            <h2 className="mb-2 font-display text-xl font-extrabold">Last 14 days</h2>
            <svg className="h-40 w-full" viewBox={`0 0 ${metrics.daily.length * 18} 100`} role="img">
              <title>Daily scans, drafts, and Google opens</title>
              {metrics.daily.map((day, index) => {
                const x = index * 18 + 2;
                const scansH = (day.scans / chartMax) * 90;
                const draftsH = (day.drafts / chartMax) * 90;
                const googleH = (day.opened_google / chartMax) * 90;
                return (
                  <g key={day.day}>
                    <rect x={x} y={100 - scansH} width="4" height={scansH} rx="1.5" fill="var(--brand)" />
                    <rect x={x + 5} y={100 - draftsH} width="4" height={draftsH} rx="1.5" fill="var(--ink)" />
                    <rect x={x + 10} y={100 - googleH} width="4" height={googleH} rx="1.5" fill="var(--pine)" />
                  </g>
                );
              })}
            </svg>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Scans
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-ink" /> Drafts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-pine" /> Opened Google
              </span>
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-extrabold">Private feedback</h2>
            {metrics.feedback.length === 0 ? (
              <p className="sticker-flat p-5 text-sm text-muted">No private notes yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {metrics.feedback.map((item) => (
                  <li className="sticker-flat p-4 text-sm" key={item.id}>
                    {item.rating != null ? <StarsDisplay value={item.rating} size={16} /> : null}
                    <p className={item.rating != null ? "mt-1" : ""}>{item.message}</p>
                    <p className="mt-2 text-xs text-muted">
                      {item.contact ? `${item.contact} · ` : null}
                      {formatAdded(item.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : user.role === "admin" && !adminRestaurantId ? (
        <p className="text-sm text-muted">Enter a restaurant ID to view scoped metrics.</p>
      ) : (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading">
          <div className="h-48 animate-shimmer rounded-3xl bg-tint-strong" />
          <div className="h-32 animate-shimmer rounded-3xl bg-tint-strong" />
        </div>
      )}
    </main>
  );
}
