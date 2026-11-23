import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DARK, LIGHT, type Palette } from './palette.ts';

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function ratio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const PAIRS: [keyof Palette, keyof Palette][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface2'], ['text2', 'surface'], ['text2', 'surface2'], ['text3', 'surface'], ['text3', 'bg'],
  ['low', 'surface'], ['low', 'surface2'], ['high', 'surface'], ['high', 'surface2'], ['low', 'lowSoft'], ['high', 'highSoft'],
  ['onLow', 'low'], ['onHigh', 'high'], ['onAccent', 'accent'], ['onWarnSoft', 'warnSoft'], ['ok', 'okSoft'], ['ok', 'surface'], ['warn', 'surface'],
];

for (const [name, pal] of [['light', LIGHT], ['dark', DARK]] as const) {
  test(`WCAG AA text contrast in ${name} mode`, () => {
    for (const [fg, bg] of PAIRS) {
      const r = ratio(pal[fg], pal[bg]);
      assert.ok(r >= 4.5, `${name} ${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  });
}
