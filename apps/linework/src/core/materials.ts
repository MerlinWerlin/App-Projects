// Glass material decisions (docs/DESIGN_V2.md §4, oversight D72-2). Pure so node can test it.

/** Real blur only on iOS (Android blur is experimental and costly), only when expo-blur loaded, never under Reduce Transparency. */
export function shouldBlur(opts: { os: string; hasModule: boolean; reduceTransparency: boolean }): boolean {
  return opts.os === 'ios' && opts.hasModule && !opts.reduceTransparency;
}

/** expo-blur tint + intensity for bars and sheets in each scheme. */
export function blurMaterial(isDark: boolean): { tint: string; intensity: number } {
  return isDark ? { tint: 'systemChromeMaterialDark', intensity: 60 } : { tint: 'systemChromeMaterialLight', intensity: 60 };
}

/**
 * Background drawn over the blur: a light wash so text keeps contrast over busy content; the solid 92% fallback
 * (AA-checked in contrast.test.ts) when no blur is drawn.
 */
export function glassBackground(blur: boolean, isDark: boolean, fallback: string): string {
  if (!blur) return fallback;
  return isDark ? 'rgba(30,28,26,0.55)' : 'rgba(255,255,255,0.55)';
}
