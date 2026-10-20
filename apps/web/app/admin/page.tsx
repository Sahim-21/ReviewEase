"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { RestaurantCard } from "@/components/admin/RestaurantCard";
import { StaffAccountActions } from "@/components/admin/StaffAccountActions";
import { clearAuth, readAuth, writeAuth, type AuthUser } from "@/lib/auth";
import { createRestaurant, fetchAdminOverview, fetchMe, isAuthFailure } from "@/lib/staffApi";
import type { AdminOverviewItem, AdminRestaurantDetail, Aspect } from "@/lib/types";

const ASPECTS = new Set(["food", "service", "ambience", "value"]);

type RestaurantCardData = AdminOverviewItem;

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

  // One request for every restaurant's details and numbers (it used to be two per restaurant).
  const loadCards = useCallback(async (): Promise<RestaurantCardData[]> => fetchAdminOverview(), []);

  useEffect(() => {
    const auth = readAuth();
    if (!auth || auth.role !== "admin") {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchMe()
      .then(async (fresh) => {
        writeAuth(fresh);
        if (cancelled) {
          return;
        }
        setUser(fresh);
        const next = await loadCards();
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
      await createRestaurant({
        name,
        google_place_id: placeId,
        brand_color: colour,
        menu,
        tags,
        owner_email: ownerEmail || undefined,
        owner_password: ownerPassword || undefined,
      });
      const next = await loadCards();
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
      <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-4 p-5 sm:p-8">
        <div className="h-8 w-48 animate-shimmer rounded-full bg-tint-strong" />
        <div className="h-40 animate-shimmer rounded-3xl bg-tint-strong" />
        <div className="h-40 animate-shimmer rounded-3xl bg-tint-strong" />
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center p-5 sm:p-8">
        <p className="text-sm font-medium text-danger">{loadError}</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-5 sm:gap-8 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted">{cards.length} restaurants</p>
        </div>
        <div className="flex items-center gap-2">
          <StaffAccountActions />
        </div>
      </header>

      <form className="sticker grid gap-3 p-5" onSubmit={onCreate}>
        <h2 className="font-display text-lg font-bold">New restaurant</h2>
        <label className="text-sm">
          Name
          <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm">
          Google Place ID
          <input
            className="field mt-1 font-mono text-sm"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          Brand colour
          <input className="mt-1 block h-11 w-24 cursor-pointer rounded-xl border-2 border-hairline bg-white p-1" type="color" value={colour} onChange={(e) => setColour(e.target.value)} />
        </label>
        <label className="text-sm">
          Menu items (one per line, optional <code>|category</code>)
          <textarea className="field mt-1 font-mono text-sm" rows={5} value={menuText} onChange={(e) => setMenuText(e.target.value)} />
        </label>
        <label className="text-sm">
          Tag bank (one per line: <code>label|food</code>)
          <textarea className="field mt-1 font-mono text-sm" rows={4} value={tagText} onChange={(e) => setTagText(e.target.value)} />
        </label>
        <label className="text-sm">
          Owner email (optional)
          <input className="field mt-1" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        </label>
        <label className="text-sm">
          Owner password (optional)
          <input className="field mt-1" type="password" minLength={8} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
        </label>
        {formError ? <p className="text-sm font-medium text-danger">{formError}</p> : null}
        <button className="btn btn-primary btn-sm w-fit" disabled={busy} type="submit">
          {busy ? "Saving…" : "Create restaurant"}
        </button>
      </form>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-48 animate-shimmer rounded-3xl bg-tint-strong" />
          <div className="h-48 animate-shimmer rounded-3xl bg-tint-strong" />
        </div>
      ) : (
        <section className="flex flex-col gap-6">
          {cards.map((card: RestaurantCardData) => (
            <RestaurantCard
              key={card.detail.id}
              detail={card.detail}
              stats={card.stats}
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
