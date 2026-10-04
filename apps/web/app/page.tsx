import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">ReviewEase</h1>
      <p className="max-w-md text-center text-sm text-neutral-600">
        A review assistant, not a review generator. Scan a restaurant QR to phrase
        your own experience, then post on Google yourself.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
        >
          Staff sign in
        </Link>
        <Link href="/dashboard" className="rounded-full border border-neutral-300 px-4 py-2 text-sm">
          Dashboard
        </Link>
      </div>
    </main>
  );
}
