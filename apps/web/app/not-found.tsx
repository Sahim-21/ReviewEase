import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-neutral-600">That link does not match a restaurant or staff page.</p>
      <Link href="/" className="text-sm underline">
        Home
      </Link>
    </main>
  );
}
