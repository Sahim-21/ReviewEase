import { API_URL, ApiError } from "./api";
import type { AuthUser } from "./auth";
import type { OwnerMetrics, RestaurantSummary } from "./types";

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { detail?: { code?: string; message?: string } | string };
    if (typeof body.detail === "string") {
      return new ApiError(body.detail, res.status);
    }
    if (body.detail && typeof body.detail === "object") {
      return new ApiError(body.detail.message ?? res.statusText, res.status, body.detail.code);
    }
  } catch {
    /* ignore */
  }
  return new ApiError(res.statusText || "Request failed", res.status);
}

function authHeader(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function isAuthFailure(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 401 || err.code === "AUTH_INVALID" || err.code === "AUTH_REQUIRED")
  );
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: authHeader(token) });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<AuthUser>;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<AuthUser>;
}

export async function listRestaurants(token: string): Promise<RestaurantSummary[]> {
  const res = await fetch(`${API_URL}/api/admin/restaurants`, { headers: authHeader(token) });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<RestaurantSummary[]>;
}

export async function createRestaurant(
  token: string,
  body: {
    name: string;
    google_place_id: string;
    brand_color?: string;
    menu: { name: string; category?: string }[];
    tags: { label: string; aspect: "food" | "service" | "ambience" | "value" }[];
    owner_email?: string;
    owner_password?: string;
  },
): Promise<RestaurantSummary> {
  const res = await fetch(`${API_URL}/api/admin/restaurants`, {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<RestaurantSummary>;
}

export async function fetchQr(
  token: string,
  restaurantId: number,
  format: "svg" | "png",
  table?: string,
): Promise<Blob> {
  const params = new URLSearchParams({ format });
  if (table) {
    params.set("table", table);
  }
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}/qr?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.blob();
}

export async function fetchOwnerMetrics(token: string, restaurantId?: number): Promise<OwnerMetrics> {
  const params = restaurantId != null ? `?restaurant_id=${restaurantId}` : "";
  const res = await fetch(`${API_URL}/api/owner/metrics${params}`, {
    headers: authHeader(token),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<OwnerMetrics>;
}
