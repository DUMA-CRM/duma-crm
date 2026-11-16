/**
 * The ink for text drawn on a form's accent colour — the submit button, a
 * chosen answer, the thank-you mark. A workspace picks any accent, so white
 * text on a pale one (yellow, mint) would fail WCAG AA; this picks whichever
 * of white or near-black reads better on it, by the WCAG contrast ratio.
 */

const WHITE = '#ffffff';
const INK = '#141412';

/** `#rgb` or `#rrggbb` → [r, g, b] in 0–255, or null for anything else (a CSS variable, a name). */
export function parseHex(colour: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(colour.trim());
  if (!match) return null;
  const hex = match[1]!.length === 3 ? [...match[1]!].map((digit) => digit + digit).join('') : match[1]!;
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
}

/** WCAG 2 relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio between two luminances, 1–21. */
export function contrastRatio(a: number, b: number): number {
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * White or near-black, whichever contrasts more with the accent. No accent, or
 * one that isn't a hex colour, means the brand green — white on it.
 */
export function accentInk(accent: string | null | undefined): string {
  const rgb = accent ? parseHex(accent) : null;
  if (!rgb) return WHITE;
  const background = relativeLuminance(rgb);
  const onWhite = contrastRatio(background, 1);
  const onInk = contrastRatio(background, relativeLuminance(parseHex(INK)!));
  return onWhite >= onInk ? WHITE : INK;
}
