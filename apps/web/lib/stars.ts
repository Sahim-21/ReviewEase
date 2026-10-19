import type { Aspect, Ratings } from "@/lib/types";

export const ASPECTS: { id: Aspect; label: string; emoji: string }[] = [
  { id: "food", label: "Food", emoji: "🍛" },
  { id: "service", label: "Service", emoji: "🙋" },
  { id: "ambience", label: "Ambience", emoji: "✨" },
  { id: "value", label: "Value", emoji: "💸" },
];

export const STAR_MOODS: Record<number, { emoji: string; caption: string }> = {
  0: { emoji: "🤔", caption: "Tap a star to rate" },
  1: { emoji: "😡", caption: "Really bad" },
  2: { emoji: "😕", caption: "Not great" },
  3: { emoji: "😐", caption: "It was okay" },
  4: { emoji: "😊", caption: "Pretty good" },
  5: { emoji: "😍", caption: "Loved it!" },
};

export function starMood(stars: number | null): { emoji: string; caption: string } {
  return STAR_MOODS[stars ?? 0] ?? STAR_MOODS[0];
}

/** Every aspect follows the overall stars unless the diner rated it separately. */
export function ratingsFromStars(overall: number, details: Ratings): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { id } of ASPECTS) {
    out[id] = details[id] ?? overall;
  }
  return out;
}

export type RatingTone = "good" | "neutral" | "low";

export function ratingTone(stars: number): RatingTone {
  if (stars >= 4) return "good";
  if (stars === 3) return "neutral";
  return "low";
}
