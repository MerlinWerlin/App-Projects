/**
 * Script-aware typography (owner-1016 R3). Pure TS, tested in Node.
 * Sora / Manrope / JetBrains Mono only cover Latin, so CJK, Devanagari and Arabic UI text uses the
 * system font (undefined family = platform default with full glyph fallback) and gets taller lines.
 */
import type { Script } from '../i18n/locales';
import { fonts } from './tokens';

const BRAND_FAMILIES = new Set<string>([fonts.display, fonts.displayBold, fonts.text, fonts.textSemi, fonts.textBold]);

/** Line-height multiplier per script: Latin 1.3, CJK 1.45, Devanagari / Arabic 1.6 (tall marks). */
export const LINE_HEIGHT: Record<Script, number> = { latin: 1.3, cjk: 1.45, deva: 1.6, arab: 1.6 };

export function weightFor(family: string): '400' | '600' | '700' {
  if (/SemiBold/.test(family)) return '600';
  if (/Bold/.test(family)) return '700';
  return '400';
}

/**
 * Map a style's fontFamily for the active script. Latin keeps the brand fonts; other scripts swap
 * brand families for the system font at the same weight. The mono font (numbers) is kept everywhere.
 */
export function familyFor(script: Script, family: string | undefined): { fontFamily?: string; fontWeight?: '400' | '600' | '700' } {
  if (!family) return {};
  if (script === 'latin' || !BRAND_FAMILIES.has(family)) return { fontFamily: family };
  return { fontFamily: undefined, fontWeight: weightFor(family) };
}

/** Line height for a font size, never smaller than an explicit one already set. */
export function lineHeightFor(script: Script, fontSize: number, explicit?: number): number {
  const lh = Math.round(fontSize * LINE_HEIGHT[script]);
  return explicit !== undefined && explicit > lh ? explicit : lh;
}
