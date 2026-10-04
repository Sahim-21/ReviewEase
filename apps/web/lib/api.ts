import type {
  CompleteResponse,
  DraftResponse,
  FeedbackResponse,
  OutputLang,
  RestaurantPublic,
  SessionStart,
  Tone,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

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

export async function getRestaurant(slug: string): Promise<RestaurantPublic> {
  const res = await fetch(`${API_URL}/api/r/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) {
    throw new ApiError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");
  }
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<RestaurantPublic>;
}

export async function startSession(input: {
  slug: string;
  deviceId: string;
  table?: string;
}): Promise<SessionStart> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: input.slug,
      device_id: input.deviceId,
      table: input.table,
    }),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<SessionStart>;
}

export async function createDraft(
  sessionId: number,
  token: string,
  body: {
    items: string[];
    ratings: Record<string, number>;
    tags: string[];
    raw_text: string;
    tone: Tone;
    lang: OutputLang;
  },
): Promise<DraftResponse> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/draft`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<DraftResponse>;
}

export async function completeSession(
  sessionId: number,
  token: string,
  body: { final_text: string; clicked_google: boolean; copied: boolean },
): Promise<CompleteResponse> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<CompleteResponse>;
}

export async function sendFeedback(
  body: {
    slug: string;
    message: string;
    rating?: number;
    contact?: string;
    session_id?: number;
  },
  token?: string,
): Promise<FeedbackResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token && body.session_id != null) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}/api/feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return res.json() as Promise<FeedbackResponse>;
}
