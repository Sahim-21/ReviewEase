import { API_URL, ApiError } from "./api";
import type { AuthUser } from "./auth";
import type {
  AdminRestaurantDetail,
  MenuItemPublic,
  OwnerMetrics,
  RestaurantDeletedResponse,
  RestaurantStatusResponse,
  RestaurantSummary,
  TagPublic,
} from "./types";

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

export async function fetchAdminRestaurant(token: string, restaurantId: number): Promise<AdminRestaurantDetail> {
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}`, {
    headers: authHeader(token),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<AdminRestaurantDetail>;
}

export async function fetchQr(
  token: string,
  restaurantId: number,
  format: "svg" | "png",
  table?: string,
  extras?: { regen?: boolean; bust?: number },
): Promise<Blob> {
  const params = new URLSearchParams({ format });
  if (table) {
    params.set("table", table);
  }
  if (extras?.regen) {
    params.set("regen", "true");
  }
  if (extras?.bust != null) {
    params.set("t", String(extras.bust));
  }
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}/qr?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
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

export async function replaceMenuItems(
  token: string,
  restaurantId: number,
  items: { name: string; category: string }[],
): Promise<MenuItemPublic[]> {
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}/menu-items`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<MenuItemPublic[]>;
}

export async function replaceTags(
  token: string,
  restaurantId: number,
  tags: { aspect: string; label: string }[],
): Promise<TagPublic[]> {
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}/tags`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<TagPublic[]>;
}

export async function setRestaurantStatus(
  token: string,
  restaurantId: number,
  active: boolean,
): Promise<RestaurantStatusResponse> {
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}/status`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ active }),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<RestaurantStatusResponse>;
}

export async function deleteRestaurant(
  token: string,
  restaurantId: number,
): Promise<RestaurantDeletedResponse> {
  const res = await fetch(`${API_URL}/api/admin/restaurants/${restaurantId}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<RestaurantDeletedResponse>;
}
