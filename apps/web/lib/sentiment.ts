export type Sentiment = "loved" | "okay" | "issues";

export const SENTIMENT_OPTIONS: { id: Sentiment; emoji: string; label: string }[] = [
  { id: "loved", emoji: "😍", label: "Loved it" },
  { id: "okay", emoji: "😐", label: "It was okay" },
  { id: "issues", emoji: "😕", label: "Had some issues" },
];

export function ratingsFromSentiment(sentiment: Sentiment): Record<string, number> {
  const score = sentiment === "loved" ? 5 : sentiment === "okay" ? 3 : 2;
  return { food: score, service: score, ambience: score, value: score };
}
