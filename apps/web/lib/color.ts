export const DEFAULT_BRAND = "#C45C26";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts only #rgb / #rrggbb so a restaurant's brand colour can never inject CSS. */
export function safeBrand(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return HEX.test(trimmed) ? trimmed : DEFAULT_BRAND;
}

function channels(hex: string): [number, number, number] {
  const raw = hex.slice(1);
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour that stays readable on top of the brand colour (white on dark, ink on light). */
export function onBrand(hex: string): string {
  return luminance(hex) > 0.5 ? "#241E1C" : "#FFFFFF";
}

export function brandVars(value: string | null | undefined): Record<string, string> {
  const brand = safeBrand(value);
  return { "--brand": brand, "--on-brand": onBrand(brand) };
}
