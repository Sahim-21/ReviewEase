const KEY = "reviewease-device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-placeholder";
  }
  const existing = window.localStorage.getItem(KEY);
  if (existing && existing.length >= 8) {
    return existing;
  }
  const id = crypto.randomUUID();
  window.localStorage.setItem(KEY, id);
  return id;
}
