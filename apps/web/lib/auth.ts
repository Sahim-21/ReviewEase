export type AuthUser = {
  email: string;
  role: "admin" | "owner";
  restaurant_id: number | null;
  token: string;
};

const KEY = "reviewease_auth";

export function readAuth(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function writeAuth(user: AuthUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(KEY);
}
