import type { OutputLang, Tone } from "@/lib/types";

const MAP: Record<string, OutputLang> = {
  en: "English",
  english: "English",
  hi: "Hindi",
  hindi: "Hindi",
  kn: "Kannada",
  kannada: "Kannada",
  hinglish: "Hinglish",
};

export function outputLang(defaultLang: string): OutputLang {
  return MAP[defaultLang.trim().toLowerCase()] ?? "English";
}

export const TONE_OPTIONS: { id: Tone; label: string; hint: string }[] = [
  { id: "casual", label: "Casual", hint: "Relaxed, like telling a friend" },
  { id: "detailed", label: "Detailed", hint: "A bit more about the meal" },
  { id: "short", label: "Short", hint: "A few lines only" },
];

export const LANG_OPTIONS: { id: OutputLang; label: string; hint: string }[] = [
  { id: "English", label: "English", hint: "Standard English" },
  { id: "Hinglish", label: "Hinglish", hint: "Hindi + English mix" },
  { id: "Hindi", label: "Hindi", hint: "हिन्दी" },
  { id: "Kannada", label: "Kannada", hint: "ಕನ್ನಡ" },
];

export function speechLocale(lang: string): string {
  switch (outputLang(lang)) {
    case "Hindi":
      return "hi-IN";
    case "Kannada":
      return "kn-IN";
    case "Hinglish":
    case "English":
    default:
      return "en-IN";
  }
}
