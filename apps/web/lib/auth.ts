/**
 * Who is signed in, for the UI only. The session itself is the API's HttpOnly cookie
 * (set through the /backend proxy), so no token is stored where page scripts can read it.
 */
export type AuthUser = {
  email: string;
  role: "admin" | "owner";
  restaurant_id: number | null;
};

const KEY = "reviewease_auth";
const LEGACY_COOKIE = "reviewease_staff";

export function readAuth(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthUser & { token?: string };
    if (parsed.token) {
      // Written by the old token-in-localStorage version: drop it and sign in again.
      clearAuth();
      return null;
    }
    return { email: parsed.email, role: parsed.role, restaurant_id: parsed.restaurant_id };
  } catch {
    return null;
  }
}

export function writeAuth(user: AuthUser): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({ email: user.email, role: user.role, restaurant_id: user.restaurant_id }),
  );
}

export function clearAuth(): void {
  localStorage.removeItem(KEY);
  // Remove the readable cookie the previous version used to mirror the token.
  document.cookie = `${LEGACY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
