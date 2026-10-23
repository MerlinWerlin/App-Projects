/**
 * Names that must never appear in a store screenshot (TV makers, platforms, streaming services).
 * Kept apart from render.mjs so the renderer's own source stays free of them (tests/store-kit.test.ts).
 * render.mjs checks the visible text of every prototype screen against this before it is used.
 */
export const BRAND_WORDS = [
  'Roku', 'Samsung', 'LG', 'Sony', 'Bravia', 'TCL', 'Hisense', 'Panasonic', 'Philips', 'Vizio',
  'Netflix', 'YouTube', 'Disney', 'Prime', 'Hulu', 'Spotify', 'Plex', 'Stan', 'iview', 'SBS',
  'Apple', 'Google', 'Fire TV', 'Android TV', 'webOS', 'Tizen', 'Xiaomi', 'Chromecast',
];

export const BRAND_RE = new RegExp(`\\b(${BRAND_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

/** Throws if `text` names a brand. `where` says which screen, for the error. */
export function assertNoBrands(text, where) {
  const m = BRAND_RE.exec(text);
  if (m) throw new Error(`brand name "${m[1]}" visible in ${where}; store screenshots must not show brand names`);
}
