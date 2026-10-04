"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-neutral-600">The app hit an unexpected error. Try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-2 w-fit rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
