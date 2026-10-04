"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { RestaurantCard } from "@/components/admin/RestaurantCard";
import { clearAuth, readAuth, writeAuth, type AuthUser } from "@/lib/auth";
import {
  createRestaurant,
  fetchAdminRestaurant,
  fetchMe,
  fetchOwnerMetrics,
  isAuthFailure,
  listRestaurants,
} from "@/lib/staffApi";
import type { AdminRestaurantDetail, Aspect, OwnerMetrics, RestaurantSummary } from "@/lib/types";

const ASPECTS = new Set(["food", "service", "ambience", "value"]);

type RestaurantCardData = {
  detail: AdminRestaurantDetail;
  metrics: OwnerMetrics | null;
};

function fallbackDetail(row: RestaurantSummary): AdminRestaurantDetail {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    google_place_id: row.google_place_id,
    brand_color: row.brand_color,
    created_at: "",
    menu: [],
    tags: [],
    active: row.active !== false,
  };
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cards, setCards] = useState<RestaurantCardData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [colour, setColour] = useState("#c45c26");
  const [menuText, setMenuText] = useState("Butter chicken\nNaan");
  const [tagText, setTagText] = useState("Flavourful|food\nFriendly|service");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const onAuthFailure = useCallback(() => {
    clearAuth();
    router.replace("/login");
  }, [router]);

  const loadCards = useCallback(
    async (token: string) => {
      const summaries = await listRestaurants(token);
      const [details, metricsList] = await Promise.all([
        Promise.all(
          summaries.map((row: RestaurantSummary) =>
            fetchAdminRestaurant(token, row.id).catch((err: unknown) => {
              if (isAuthFailure(err)) {
                throw err;
              }
              return fallbackDetail(row);
            }),
          ),
        ),
        Promise.all(
          summaries.map((row: RestaurantSummary) =>
            fetchOwnerMetrics(token, row.id).catch((err: unknown) => {
              if (isAuthFailure(err)) {
                throw err;
              }
              return null;
            }),
          ),
        ),
      ]);
      return details.map((detail: AdminRestaurantDetail, index: number) => ({
        detail,
        metrics: metricsList[index] ?? null,
      }));
    },
    [],
  );

  useEffect(() => {
    const auth = readAuth();
    if (!auth || auth.role !== "admin") {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMe(auth.token)
      .then(async (fresh) => {
        writeAuth(fresh);
        if (cancelled) {
          return;
        }
        setUser(fresh);
        const next = await loadCards(fresh.token);
        if (!cancelled) {
          setCards(next);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthFailure(err)) {
          onAuthFailure();
          return;
        }
        setLoadError("Could not load restaurants. Refresh to try again.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadCards, onAuthFailure, router]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const menu = menuText
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => Boolean(line))
        .map((line: string) => {
          const [itemName, category] = line.split("|").map((part: string) => part.trim());
          return { name: itemName, category: category || undefined };
        });
      const tags = tagText
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => Boolean(line))
        .map((line: string) => {
          const [label, aspectRaw] = line.split("|").map((part: string) => part.trim());
          const aspect = (aspectRaw || "food").toLowerCase();
          if (!ASPECTS.has(aspect)) {
            throw new Error(`Tag aspect must be food, service, ambience, or value: ${line}`);
          }
          return { label, aspect: aspect as Aspect };
        });
      await createRestaurant(user.token, {
        name,
        google_place_id: placeId,
        brand_color: colour,
        menu,
        tags,
        owner_email: ownerEmail || undefined,
        owner_password: ownerPassword || undefined,
      });
      const next = await loadCards(user.token);
      setCards(next);
      setName("");
      setPlaceId("");
    } catch (err: unknown) {
      if (isAuthFailure(err)) {
        onAuthFailure();
        return;
      }
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user && loading) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center p-6">
        <p className="text-sm text-red-700">{loadError}</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <p className="text-sm text-neutral-600">{cards.length} restaurants</p>
        </div>
        <button
          className="text-sm underline"
          type="button"
          onClick={() => {
            clearAuth();
            router.push("/login");
          }}
        >
          Sign out
        </button>
      </header>

      <form className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4" onSubmit={onCreate}>
        <h2 className="font-medium">New restaurant</h2>
        <label className="text-sm">
          Name
          <input className="mt-1 w-full rounded-lg border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm">
          Google Place ID
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          Brand colour
          <input className="mt-1 block h-10 w-24" type="color" value={colour} onChange={(e) => setColour(e.target.value)} />
        </label>
        <label className="text-sm">
          Menu items (one per line, optional <code>|category</code>)
          <textarea className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" rows={5} value={menuText} onChange={(e) => setMenuText(e.target.value)} />
        </label>
        <label className="text-sm">
          Tag bank (one per line: <code>label|food</code>)
          <textarea className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" rows={4} value={tagText} onChange={(e) => setTagText(e.target.value)} />
        </label>
        <label className="text-sm">
          Owner email (optional)
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        </label>
        <label className="text-sm">
          Owner password (optional)
          <input className="mt-1 w-full rounded-lg border px-3 py-2" type="password" minLength={8} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
        </label>
        {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        <button className="w-fit rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "Saving…" : "Create restaurant"}
        </button>
      </form>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-48 animate-pulse rounded-2xl bg-neutral-100" />
          <div className="h-48 animate-pulse rounded-2xl bg-neutral-100" />
        </div>
      ) : (
        <section className="flex flex-col gap-6">
          {cards.map((card: RestaurantCardData) => (
            <RestaurantCard
              key={card.detail.id}
              token={user.token}
              detail={card.detail}
              metrics={card.metrics}
              onAuthFailure={onAuthFailure}
              onUpdated={(detail: AdminRestaurantDetail) => {
                setCards((current: RestaurantCardData[]) =>
                  current.map((card: RestaurantCardData) =>
                    card.detail.id === detail.id ? { ...card, detail } : card,
                  ),
                );
              }}
              onDeleted={(restaurantId: number) => {
                setCards((current: RestaurantCardData[]) =>
                  current.filter((card: RestaurantCardData) => card.detail.id !== restaurantId),
                );
              }}
            />
          ))}
        </section>
      )}
    </main>
  );
}
