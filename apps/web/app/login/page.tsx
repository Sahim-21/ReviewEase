"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { writeAuth } from "@/lib/auth";
import { login } from "@/lib/staffApi";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      writeAuth(user);
      router.push(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Staff sign in</h1>
        <p className="mt-1 text-sm text-neutral-600">Owners and admins only. Diners stay anonymous.</p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="text-sm">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
            type="password"
            autoComplete="current-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          className="rounded-full bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
          disabled={busy}
          type="submit"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link className="text-sm text-neutral-600 underline" href="/">
        Home
      </Link>
    </main>
  );
}
