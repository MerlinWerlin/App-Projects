// Destination themes (src/core/countrytheme.ts): the base theme with a country's accent family (accent, accentSoft,
// accentInk, accentStrong) and its Trips, Map and Wallet hero gradients. Emergency and Toilets keep their own tones.
// Every colour is walked in lightness from the country's seed hue until it passes the same WCAG pairs the base theme
// is checked for (src/theme/contrast.test.ts runs every country in light and dark). Pure TS, memoised per theme.
import type { CountryThemeSpec } from '../core/countrytheme.ts';
import { contrast, over } from './contrast.ts';
import { surfaces, type HeroTone, type Theme } from './tokens.ts';
import { accentFromHue, passes, walk } from './tripAccent.ts';

/** The hero tones a destination theme repaints. */
export const THEMED_TONES: readonly HeroTone[] = ['trips', 'map', 'wallet'];

const M = 0.1;
const ok = (a: string | readonly [number, number, number], b: string | readonly [number, number, number], min: number) => contrast(a, b) >= min + M;

/** A hero gradient stop is safe: the hero text, chip, wash and paper pairs all hold on it (and, for the deep stop, on the paper). */
export function heroStopOk(theme: Theme, stop: string, deep: boolean): boolean {
  if (!ok(theme.heroInk, stop, 4.5) || !ok(theme.heroMuted, stop, 4.5) || !ok(theme.heroAccent, stop, 3)) return false;
  const chip = over(theme.heroChip, stop);
  if (!ok(theme.heroInk, chip, 4.5) || !ok(theme.heroMuted, chip, 4.5)) return false;
  if (!ok(theme.heroInk, over(theme.heroWash, stop), 3)) return false;
  if (!ok(theme.heroPaper, stop, 3)) return false;
  if (deep && (!ok(stop, theme.heroPaper, 3) || !ok(stop, over(theme.heroChip, theme.heroPaper), 3))) return false;
  return true;
}

function heroPair(theme: Theme, hues: readonly [number, number], sat: number, tone: HeroTone): readonly [string, string] {
  const s = Math.min(0.7, Math.max(0.3, sat));
  // Start as light as a banner might go and darken until every pair holds; dark mode starts lower (night banners).
  const [deepFrom, brightFrom] = theme.dark ? [0.16, 0.24] : [0.26, 0.4];
  const deep = walk(hues[0], s, deepFrom, -0.01, (c) => heroStopOk(theme, c, true));
  const bright = walk(hues[1], s, brightFrom, -0.01, (c) => heroStopOk(theme, c, false));
  // Design pass 3: tab heads are solid ticket stock, so the country's deep colour fills the whole head (no gradient).
  return deep && bright ? [deep, deep] : theme.hero[tone];
}

function derive(base: Theme, spec: CountryThemeSpec): Theme {
  const set = accentFromHue(spec.accent.h, spec.accent.s, base);
  const s = Math.min(0.72, Math.max(0.38, spec.accent.s));
  const raised = base.dark ? Object.values(surfaces.dark) : [base.cardRaised];
  const pages = [base.paper, base.card, base.cardRaised, ...raised, set.soft];
  // Icons and selection borders (3:1 on the page, cards and the tint): as bright as allowed.
  const accent = base.dark
    ? walk(spec.accent.h, s, 0.56, 0.01, (c) => passes(c, pages, 3))
    : walk(spec.accent.h, s, 0.52, -0.01, (c) => passes(c, pages, 3));
  const hero = { ...base.hero };
  for (const tone of THEMED_TONES) hero[tone] = heroPair(base, spec.hero[tone as 'trips' | 'map' | 'wallet'], spec.hero.s, tone);
  return {
    ...base,
    accent: accent ?? base.accent,
    accentSoft: set.soft,
    accentInk: set.ink,
    accentStrong: set.strong,
    hero,
  };
}

const cache = new WeakMap<Theme, Map<string, Theme>>();

/** The base theme repainted for a country (same object for the same theme and country, so consumers stay memoised). */
export function countryTheme(base: Theme, spec: CountryThemeSpec | null): Theme {
  if (!spec) return base;
  let byCountry = cache.get(base);
  if (!byCountry) cache.set(base, (byCountry = new Map()));
  let th = byCountry.get(spec.iso2);
  if (!th) byCountry.set(spec.iso2, (th = derive(base, spec)));
  return th;
}

