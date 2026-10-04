import type { AdminRestaurantDetail, Aspect } from "@/lib/types";

export const ASPECT_ORDER: Aspect[] = ["food", "service", "ambience", "value"];

export function formatAdded(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function groupMenu(items: AdminRestaurantDetail["menu"]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const key = item.category?.trim() || "Other";
    const list = groups.get(key) ?? [];
    list.push(item.name);
    groups.set(key, list);
  }
  return groups;
}

export function groupTags(tags: AdminRestaurantDetail["tags"]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const aspect of ASPECT_ORDER) {
    groups.set(aspect, []);
  }
  for (const tag of tags) {
    const key = ASPECT_ORDER.includes(tag.aspect as Aspect) ? tag.aspect : "other";
    const list = groups.get(key) ?? [];
    list.push(tag.label);
    groups.set(key, list);
  }
  return groups;
}
