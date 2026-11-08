/** Colour maths shared by the picker and the persisted recent-colour list. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.trim().replace(/^#/, '');
  if (/^[\da-f]{3}$/i.test(hex)) return `#${[...hex].map((c) => c + c).join('').toUpperCase()}`;
  return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

const unit = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export type HSV = { h: number; s: number; v: number };

export function hsvToHex({ h, s, v }: HSV): string {
  h = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360 / 60;
  s = unit(s); v = unit(v);
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(h % 2 - 1));
  const rgb = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][Math.floor(h)]!;
  return `#${rgb.map((n) => Math.round((n + v - chroma) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function hexToHsv(hex: string): HSV {
  const value = normalizeHex(hex) ?? '#000000';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: max === 0 ? 0 : d / max, v: max };
}

export function recentColors(value: unknown, newest?: string): string[] {
  const items: unknown[] = Array.isArray(value) ? value : [];
  return [...new Set((newest ? [newest, ...items] : items).map(normalizeHex).filter((c): c is string => c !== null))].slice(0, 10);
}
