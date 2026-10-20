import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { restaurantTag } from "@/lib/api";
import { AUTH_COOKIE } from "@/lib/authCookie";

const API_ORIGIN = (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

/**
 * Drop the cached public page for a restaurant so a pause/resume takes effect right away.
 * Only admins may call it: the staff cookie is checked against the API before revalidating.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("x-requested-with") !== "ReviewEase") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = request.cookies.get(AUTH_COOKIE)?.value;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const me = await fetch(`${API_ORIGIN}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session}` },
    cache: "no-store",
  });
  if (!me.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = (await me.json()) as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { slug?: unknown };
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  revalidateTag(restaurantTag(slug));
  return NextResponse.json({ revalidated: slug });
}
