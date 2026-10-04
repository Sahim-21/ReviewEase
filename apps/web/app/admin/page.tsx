"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { clearAuth, readAuth, writeAuth, type AuthUser } from "@/lib/auth";
import { createRestaurant, fetchMe, fetchQr, isAuthFailure, listRestaurants } from "@/lib/staffApi";
import type { RestaurantSummary } from "@/lib/types";

const ASPECTS = new Set(["food", "service", "ambience", "value"]);

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [table, setTable] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [colour, setColour] = useState("#c45c26");
  const [menuText, setMenuText] = useState("Butter chicken\nNaan");
  const [tagText, setTagText] = useState("Flavourful|food\nFriendly|service");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  useEffect(() => {
    const auth = readAuth();
    if (!auth || auth.role !== "admin") {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    fetchMe(auth.token)
      .then((fresh) => {
        if (cancelled) {
          return;
        }
        writeAuth(fresh);
        setUser(fresh);
        return listRestaurants(fresh.token);
      })
      .then((rows) => {
        if (!cancelled && rows) {
          setRestaurants(rows);
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
        setUser(auth);
        setError(err instanceof Error ? err.message : "Could not load");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
      }
    };
  }, [qrUrl]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const menu = menuText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [itemName, category] = line.split("|").map((part) => part.trim());
          return { name: itemName, category: category || undefined };
        });
      const tags = tagText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, aspectRaw] = line.split("|").map((part) => part.trim());
          const aspect = (aspectRaw || "food").toLowerCase();
          if (!ASPECTS.has(aspect)) {
            throw new Error(`Tag aspect must be food, service, ambience, or value: ${line}`);
          }
          return { label, aspect: aspect as "food" | "service" | "ambience" | "value" };
        });
      const created = await createRestaurant(user.token, {
        name,
        google_place_id: placeId,
        brand_color: colour,
        menu,
        tags,
        owner_email: ownerEmail || undefined,
        owner_password: ownerPassword || undefined,
      });
      setRestaurants((prev) => [...prev, created]);
      setSelectedId(created.id);
      setName("");
      setPlaceId("");
    } catch (err) {
      if (isAuthFailure(err)) {
        clearAuth();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadQr(restaurantId: number, format: "svg" | "png") {
    if (!user) {
      return;
    }
    setError(null);
    try {
      const blob = await fetchQr(user.token, restaurantId, format, table.trim() || undefined);
      if (qrUrl) {
        URL.revokeObjectURL(qrUrl);
      }
      const next = URL.createObjectURL(blob);
      setQrUrl(next);
      setSelectedId(restaurantId);
    } catch (err) {
      if (isAuthFailure(err)) {
        clearAuth();
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "QR failed");
    }
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link className="underline" href="/dashboard">
            Dashboard
          </Link>
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

      <form className="grid gap-3 rounded-2xl border border-neutral-200 p-4" onSubmit={onCreate}>
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
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="w-fit rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "Saving…" : "Create restaurant"}
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">QR codes</h2>
        <p className="text-xs text-neutral-600">
          Leave table blank for one restaurant-wide QR (/r/slug). Enter a table label to print a
          per-table QR (/r/slug?t=12) so scans can be tied to that table in the owner dashboard.
        </p>
        <label className="text-sm">
          Optional table
          <input className="mt-1 w-40 rounded-lg border px-3 py-2" value={table} onChange={(e) => setTable(e.target.value)} placeholder="12" />
        </label>
        <ul className="flex flex-col gap-2">
          {restaurants.map((row) => (
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2" key={row.id}>
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="font-mono text-xs text-neutral-600">/r/{row.slug}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-full border px-3 py-1 text-sm" type="button" onClick={() => void loadQr(row.id, "svg")}>
                  SVG
                </button>
                <button className="rounded-full border px-3 py-1 text-sm" type="button" onClick={() => void loadQr(row.id, "png")}>
                  PNG
                </button>
              </div>
            </li>
          ))}
        </ul>
        {qrUrl ? (
          <div className="rounded-2xl border p-4">
            <p className="mb-2 font-medium">
              {restaurants.find((row) => row.id === selectedId)?.name ?? "QR"}
              {table.trim() ? ` · table ${table.trim()}` : ""}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${restaurants.find((row) => row.id === selectedId)?.name ?? "Restaurant"} QR`}
              className="h-56 w-56 bg-white object-contain"
              src={qrUrl}
            />
            <a className="mt-2 inline-block text-sm underline" href={qrUrl} download={`qr-${selectedId ?? "restaurant"}.png`}>
              Download
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
