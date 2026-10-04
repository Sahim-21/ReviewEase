import { AUTH_COOKIE } from "@/lib/authCookie";

export type AuthUser = {
  email: string;
  role: "admin" | "owner";
  restaurant_id: number | null;
  token: string;
};

const KEY = "reviewease_auth";

const COOKIE_MAX_AGE = 60 * 60 * 24;

function setAuthCookie(token: string): void {
  const secure = window.location.protocol === "https:";
  const parts = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  document.cookie = parts.join("; ");
}

function clearAuthCookie(): void {
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readAuth(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const user = JSON.parse(raw) as AuthUser;
    if (user.token) {
      setAuthCookie(user.token);
    }
    return user;
  } catch {
    return null;
  }
}

export function writeAuth(user: AuthUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
  setAuthCookie(user.token);
}

export function clearAuth(): void {
  localStorage.removeItem(KEY);
  clearAuthCookie();
}
