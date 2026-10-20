import { ApiError } from "./api";
import type { AuthUser } from "./auth";
import type {
  AdminOverviewItem,
  AdminRestaurantDetail,
  MenuItemPublic,
  OwnerMetrics,
  RestaurantDeletedResponse,
  RestaurantStatusResponse,
  RestaurantSummary,
  TagPublic,
} from "./types";

/**
 * Staff calls go through the same-origin `/backend` proxy (see next.config.ts) so the API's
 * HttpOnly session cookie is first-party. No token is ever readable from JavaScript.
 */
export const STAFF_API = "/backend";

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

async function call<T>(path: string, init: RequestInit = {}, parse: "json" | "blob" = "json"): Promise<T> {
  const res = await fetch(`${STAFF_API}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      // Required by the API for cookie-authenticated writes (CSRF guard).
      "X-Requested-With": "ReviewEase",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (parse === "blob" ? res.blob() : res.json()) as Promise<T>;
}

export function isAuthFailure(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.status === 401 || err.code === "AUTH_INVALID" || err.code === "AUTH_REQUIRED")
  );
}

export function fetchMe(): Promise<AuthUser> {
  return call<AuthUser>("/api/auth/me");
}

export function login(email: string, password: string): Promise<AuthUser> {
  return call<AuthUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function logout(): Promise<void> {
  try {
    await call<{ signed_out: boolean }>("/api/auth/logout", { method: "POST" });
  } catch {
    /* the local sign-out still happens */
  }
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ changed: boolean }> {
  return call("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function listRestaurants(): Promise<RestaurantSummary[]> {
  return call<RestaurantSummary[]>("/api/admin/restaurants");
}

export function fetchAdminOverview(): Promise<AdminOverviewItem[]> {
  return call<AdminOverviewItem[]>("/api/admin/overview");
}

export function createRestaurant(body: {
  name: string;
  google_place_id: string;
  brand_color?: string;
  menu: { name: string; category?: string }[];
  tags: { label: string; aspect: "food" | "service" | "ambience" | "value" }[];
  owner_email?: string;
  owner_password?: string;
}): Promise<RestaurantSummary> {
  return call<RestaurantSummary>("/api/admin/restaurants", { method: "POST", body: JSON.stringify(body) });
}

export function fetchAdminRestaurant(restaurantId: number): Promise<AdminRestaurantDetail> {
  return call<AdminRestaurantDetail>(`/api/admin/restaurants/${restaurantId}`);
}

export function fetchQr(
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
  return call<Blob>(`/api/admin/restaurants/${restaurantId}/qr?${params}`, { cache: "no-store" }, "blob");
}

export function fetchOwnerMetrics(restaurantId?: number): Promise<OwnerMetrics> {
  const params = restaurantId != null ? `?restaurant_id=${restaurantId}` : "";
  return call<OwnerMetrics>(`/api/owner/metrics${params}`);
}

export function replaceMenuItems(
  restaurantId: number,
  items: { name: string; category: string }[],
): Promise<MenuItemPublic[]> {
  return call<MenuItemPublic[]>(`/api/admin/restaurants/${restaurantId}/menu-items`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

export function replaceTags(restaurantId: number, tags: { aspect: string; label: string }[]): Promise<TagPublic[]> {
  return call<TagPublic[]>(`/api/admin/restaurants/${restaurantId}/tags`, {
    method: "PATCH",
    body: JSON.stringify({ tags }),
  });
}

export async function setRestaurantStatus(
  restaurantId: number,
  active: boolean,
  slug?: string,
): Promise<RestaurantStatusResponse> {
  const result = await call<RestaurantStatusResponse>(`/api/admin/restaurants/${restaurantId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  if (slug) {
    // Refresh the cached public page so diners see the change right away.
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "ReviewEase" },
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);
  }
  return result;
}

export function deleteRestaurant(restaurantId: number): Promise<RestaurantDeletedResponse> {
  return call<RestaurantDeletedResponse>(`/api/admin/restaurants/${restaurantId}`, { method: "DELETE" });
}
