import Link from "next/link";

const FLOATERS = [
  { emoji: "⭐", className: "left-[8%] top-[14%] text-5xl", r: "-12deg", delay: "0s" },
  { emoji: "🍛", className: "right-[10%] top-[18%] text-5xl", r: "10deg", delay: "1.2s" },
  { emoji: "✨", className: "left-[14%] bottom-[22%] text-4xl", r: "8deg", delay: "2.1s" },
  { emoji: "🍜", className: "right-[12%] bottom-[16%] text-5xl", r: "-8deg", delay: "0.6s" },
  { emoji: "⭐", className: "right-[34%] top-[8%] text-3xl", r: "14deg", delay: "1.8s" },
];

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
      <span className="blob -left-24 top-1/3 h-72 w-72" aria-hidden />
      <span className="blob -right-20 bottom-10 h-64 w-64" aria-hidden />
      {FLOATERS.map((item, index) => (
        <span
          key={index}
          aria-hidden
          className={`pointer-events-none absolute animate-floaty select-none ${item.className}`}
          style={{ ["--r" as string]: item.r, animationDelay: item.delay }}
        >
          {item.emoji}
        </span>
      ))}

      <div className="relative flex max-w-md flex-col items-center gap-6">
        <div className="sticker flex -rotate-2 items-center gap-3 px-6 py-3">
          <span className="inline-block animate-wobble text-4xl" aria-hidden>
            ⭐
          </span>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">ReviewEase</h1>
        </div>
        <p className="text-lg leading-relaxed text-muted">
          A review assistant, not a review generator. Scan a restaurant QR to phrase your own experience, then
          post on Google yourself.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn btn-primary">
            Staff sign in
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
