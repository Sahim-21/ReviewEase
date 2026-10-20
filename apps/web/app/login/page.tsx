"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { clearAuth, readAuth, writeAuth, type AuthUser } from "@/lib/auth";
import { fetchMe, login } from "@/lib/staffApi";

function staffHome(role: AuthUser["role"]): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

function nextAfterLogin(role: AuthUser["role"]): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (
    raw &&
    (raw.startsWith("/admin") || raw.startsWith("/dashboard") || raw.startsWith("/owner")) &&
    !raw.startsWith("//")
  ) {
    return raw;
  }
  return staffHome(role);
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!readAuth()) {
      return;
    }
    // Only skip the form if the server-side session is still valid.
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (!cancelled) {
          writeAuth(user);
          router.replace(nextAfterLogin(user.role));
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      writeAuth(user);
      router.push(nextAfterLogin(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 overflow-hidden p-6">
      <span className="blob -right-16 top-10 h-56 w-56" aria-hidden />
      <span className="blob -bottom-10 -left-16 h-48 w-48" aria-hidden />
      <div className="sticker relative p-6 sm:p-8">
        <span
          className="mb-4 inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-line bg-brand px-3 py-1 font-display text-sm font-bold text-on-brand shadow-pop-sm"
        >
          <Icon name="lock" size={16} />
          ReviewEase Staff
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted">Owners and admins only. Diners stay anonymous.</p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="font-display text-sm font-bold">
            Email
            <input
              className="field mt-1 font-sans font-normal"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="font-display text-sm font-bold">
            Password
            <input
              className="field mt-1 font-sans font-normal"
              type="password"
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? (
            <p role="alert" className="flex items-center gap-2 rounded-2xl border-2 border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              <Icon name="warning" size={18} className="shrink-0" />
              {error}
            </p>
          ) : null}
          <button className="btn btn-primary w-full" disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
            {busy ? null : <Icon name="arrowForward" />}
          </button>
        </form>
      </div>
      <Link className="link-quiet relative inline-flex items-center justify-center gap-1 self-center text-sm" href="/">
        <Icon name="arrowBack" size={16} />
        Home
      </Link>
    </main>
  );
}
