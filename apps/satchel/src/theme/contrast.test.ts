// T91 (owner-1031 D): every light and dark token pair the screens use meets WCAG AA: 4.5:1 for normal text, 3:1 for
// large text and icons. A failing pair names the theme, the two tokens and the ratio. Fix the token (keep the brand
// palette's character), not this list; add a pair here when a screen starts putting a new colour on a new surface.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AA_LARGE, AA_TEXT, contrast, over, parseColour } from './contrast.ts';
import { COVER_SCENES } from '../core/covers.ts';
import { STAMP_INKS } from '../core/stamps.ts';
import { coverScrim, dark, elevated, elevation, essentials, light, stampInks, stampPapers, surfaces, type HeroTone, type Theme } from './tokens.ts';
import { toHsl, tripAccent } from './tripAccent.ts';
import { LAYER_SPECS, MAP_LAYERS } from '../core/maplayers.ts';

type Pair = { fg: string; bg: string; min: number; what: string };
type ColourKey = { [K in keyof Theme]: Theme[K] extends string ? K : never }[keyof Theme];

const SURFACES: ColourKey[] = ['paper', 'card', 'cardRaised'];
const TINTS: ColourKey[] = ['accentSoft', 'seaSoft', 'okSoft', 'dangerSoft', 'warnSoft', 'tealSoft'];
const HERO_TONES: HeroTone[] = ['trips', 'wallet', 'map', 'emergency', 'toilets'];

/** The pairs the screens actually draw, for one theme. */
export function usedPairs(th: Theme): Pair[] {
  const out: Pair[] = [];
  const add = (fg: ColourKey, bg: ColourKey, min: number, what: string) => out.push({ fg, bg, min, what });
  // Body, muted, accent-ink and status text on the page, cards and raised cards (titles, captions, error and expiry lines).
  for (const bg of SURFACES) for (const fg of ['ink', 'muted', 'accentInk', 'sea', 'ok', 'warn', 'danger', 'teal'] as ColourKey[]) add(fg, bg, AA_TEXT, 'text on surface');
  // Text inside tinted panels (Warning, IconBadge rows, selected chips, banners): ink and muted on every tint.
  for (const bg of TINTS) for (const fg of ['ink', 'muted'] as ColourKey[]) add(fg, bg, AA_TEXT, 'text on tint');
  // Each status colour on its own tint (chip text, badge labels, danger / success notices).
  const own: [ColourKey, ColourKey][] = [['accentInk', 'accentSoft'], ['sea', 'seaSoft'], ['ok', 'okSoft'], ['danger', 'dangerSoft'], ['warn', 'warnSoft'], ['teal', 'tealSoft']];
  for (const [fg, bg] of own) add(fg, bg, AA_TEXT, 'status text on its tint');
  // Chips: unselected ink on raised card, selected accentInk on accentSoft (covered above).
  add('ink', 'cardRaised', AA_TEXT, 'chip text');
  // Filled buttons: primary (accentStrong), the emergency call buttons (danger) and the done tick (ok).
  for (const bg of ['accentStrong', 'danger', 'ok'] as ColourKey[]) add('onAccent', bg, AA_TEXT, 'on-accent text on fill');
  // Icons and selection borders: accent on the page, cards and the accent tint (chip icons); ink badge on line.
  for (const bg of [...SURFACES, 'accentSoft'] as ColourKey[]) add('accent', bg, AA_LARGE, 'accent icon');
  add('ink', 'line', AA_LARGE, 'ink icon badge');
  for (const bg of TINTS) add('ink', bg, AA_LARGE, 'icon on tint');
  return out;
}

const check = (name: string, th: Theme) => {
  const fails: string[] = [];
  for (const p of usedPairs(th)) {
    const r = contrast(th[p.fg as ColourKey] as string, th[p.bg as ColourKey] as string);
    if (r < p.min) fails.push(`${name} ${p.fg} on ${p.bg} (${p.what}): ${r.toFixed(2)} < ${p.min}`);
  }
  // Hero banners: title and subtitle are normal-size text on both gradient stops; heroAccent is for art and large numbers.
  for (const tone of HERO_TONES) {
    for (const stop of th.hero[tone]) {
      for (const [fg, min] of [['heroInk', AA_TEXT], ['heroMuted', AA_TEXT], ['heroAccent', AA_LARGE]] as const) {
        const r = contrast(th[fg], stop);
        if (r < min) fails.push(`${name} ${fg} on hero.${tone} ${stop}: ${r.toFixed(2)} < ${min}`);
      }
      // Text pills on a banner (countdown, score, privacy note) sit on heroChip glass; heroWash is art only, so
      // heroInk only has to read as an icon (3:1) on it.
      for (const fg of ['heroInk', 'heroMuted'] as const) {
        const r = contrast(th[fg], over(th.heroChip, stop));
        if (r < AA_TEXT) fails.push(`${name} ${fg} on heroChip over hero.${tone}: ${r.toFixed(2)}`);
      }
      const w = contrast(th.heroInk, over(th.heroWash, stop));
      if (w < AA_LARGE) fails.push(`${name} heroInk icon on heroWash over hero.${tone}: ${w.toFixed(2)}`);
    }
  }
  return fails;
};

test('light theme: every used token pair meets WCAG AA', () => {
  assert.deepEqual(check('light', light), []);
});

test('dark theme: every used token pair meets WCAG AA', () => {
  assert.deepEqual(check('dark', dark), []);
});

test('cover scrim: hero text on the deepest scrim stop is AA even over a white scene', () => {
  for (const mode of ['light', 'dark'] as const) {
    const th = mode === 'light' ? light : dark;
    for (const scene of ['#FFFFFF', '#000000']) {
      const bottom = over(coverScrim[mode].to, scene);
      assert.ok(contrast(th.heroInk, bottom) >= AA_TEXT, `${mode} heroInk over ${scene}`);
      assert.ok(contrast(th.heroMuted, bottom) >= AA_TEXT, `${mode} heroMuted over ${scene}`);
    }
  }
});

test('T103 passport stamps: every ink is AA on the stamp paper and its grain, in both themes; page text reads on paper', () => {
  const fails: string[] = [];
  for (const mode of ['light', 'dark'] as const) {
    const paper = stampPapers[mode];
    const th = mode === 'light' ? light : dark;
    for (const ink of STAMP_INKS) {
      const c = stampInks[mode][ink];
      assert.ok(c, `${mode} ${ink} missing`);
      for (const bg of ['paper', 'grain', 'fibre'] as const) {
        const r = contrast(c, paper[bg]);
        if (r < AA_TEXT) fails.push(`${mode} ink ${ink} on stamp ${bg}: ${r.toFixed(2)}`);
      }
    }
    // page captions (counts, page number) are ink / muted text on the paper
    for (const fg of ['ink', 'muted'] as const) {
      const r = contrast(th[fg], paper.paper);
      if (r < AA_TEXT) fails.push(`${mode} ${fg} on stamp paper: ${r.toFixed(2)}`);
    }
    // the page edge reads as a border (3:1 not needed for decoration, but it must differ from the paper)
    if (contrast(paper.edge, paper.paper) < 1.2) fails.push(`${mode} stamp edge too faint`);
  }
  assert.deepEqual(fails, []);
});

test('T119 hero scenes: heroPaper reads on every gradient stop and each tone\'s deep stop reads on heroPaper (3:1)', () => {
  const fails: string[] = [];
  for (const th of [light, dark]) {
    const name = th.dark ? 'dark' : 'light';
    for (const tone of HERO_TONES) {
      for (const stop of th.hero[tone]) {
        const r = contrast(th.heroPaper, stop);
        if (r < AA_LARGE) fails.push(`${name} heroPaper on hero.${tone} ${stop}: ${r.toFixed(2)}`);
      }
      const deep = contrast(th.hero[tone][0], th.heroPaper);
      if (deep < AA_LARGE) fails.push(`${name} hero.${tone} deep stop on heroPaper: ${deep.toFixed(2)}`);
      // the shaded map panel (heroChip over heroPaper) still carries the deep route line
      const shaded = contrast(th.hero[tone][0], over(th.heroChip, th.heroPaper));
      if (shaded < AA_LARGE) fails.push(`${name} hero.${tone} deep stop on shaded heroPaper: ${shaded.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, []);
});

test('T119 elevation audit: every surface level carries the text pairs, and dark levels step up in lightness', () => {
  const fails: string[] = [];
  const levels = Object.keys(elevation) as (keyof typeof elevation)[];
  for (const th of [light, dark]) {
    const name = th.dark ? 'dark' : 'light';
    for (const level of levels) {
      const bg = elevated(th, level).backgroundColor;
      for (const fg of ['ink', 'muted', 'accentInk', 'sea', 'ok', 'warn', 'danger', 'teal'] as ColourKey[]) {
        const r = contrast(th[fg] as string, bg);
        if (r < AA_TEXT) fails.push(`${name} ${fg} on ${level} surface: ${r.toFixed(2)}`);
      }
      const s = elevated(th, level);
      // dark mode: the edge is what separates a card from the page; light mode: the shadow does, so no edge
      assert.equal(s.borderWidth, th.dark ? 1 : 0, `${name} ${level} edge`);
      assert.ok(s.shadowOpacity <= 0.4, `${name} ${level} shadow too heavy`);
    }
  }
  // dark: low < mid < high in luminance, all above the page, and the low level is the cardRaised token
  const lum = (c: string) => contrast(c, '#000000');
  const d = surfaces.dark;
  assert.ok(lum(dark.paper) < lum(d.low) && lum(d.low) < lum(d.mid) && lum(d.mid) < lum(d.high), 'dark levels must step up');
  assert.equal(d.low, dark.cardRaised);
  assert.equal(surfaces.light.low, light.cardRaised);
  assert.deepEqual(fails, []);
});

test('T119 per-trip accents: every cover scene in both themes meets AA on the page, cards, raised levels and its tint', () => {
  const fails: string[] = [];
  const inks = new Set<string>();
  for (const th of [light, dark]) {
    const name = th.dark ? 'dark' : 'light';
    const pages = [th.paper, th.card, th.cardRaised, ...Object.values(th.dark ? surfaces.dark : surfaces.light)];
    for (const scene of COVER_SCENES) {
      const a = tripAccent(scene, th);
      inks.add(`${name}:${a.ink}`);
      for (const bg of [...pages, a.soft]) {
        const r = contrast(a.ink, bg);
        if (r < AA_TEXT) fails.push(`${name} ${scene} accent ink on ${bg}: ${r.toFixed(2)}`);
      }
      for (const fg of [th.ink, th.muted]) {
        const r = contrast(fg, a.soft);
        if (r < AA_TEXT) fails.push(`${name} ${scene} ${fg} on accent soft: ${r.toFixed(2)}`);
      }
      const on = contrast(a.onStrong, a.strong);
      if (on < AA_TEXT) fails.push(`${name} ${scene} onStrong on strong: ${on.toFixed(2)}`);
      for (const bg of pages) {
        const r = contrast(a.strong, bg);
        if (r < AA_LARGE) fails.push(`${name} ${scene} strong stripe on ${bg}: ${r.toFixed(2)}`);
      }
      for (const c of Object.values(a)) assert.match(c, /^#[0-9A-F]{6}$/, `${name} ${scene} ${c}`);
    }
  }
  assert.deepEqual(fails, []);
  // the accents are the trip's own: most scenes get a distinct colour (8 scenes, at least 6 different per theme)
  assert.ok([...inks].filter((k) => k.startsWith('light:')).length >= 6, [...inks].join());
  assert.ok([...inks].filter((k) => k.startsWith('dark:')).length >= 6, [...inks].join());
});

test('T119 per-trip accent: the same scene always gives the same accent; an unknown scene falls back safely', () => {
  assert.deepEqual(tripAccent('coast', light), tripAccent('coast', light));
  assert.notDeepEqual(tripAccent('coast', light), tripAccent('coast', dark));
  const odd = tripAccent('nowhere' as never, dark);
  assert.ok(contrast(odd.ink, dark.paper) >= AA_TEXT);
});

// A typical map ground under the pins (system map paper in light and dark mode), approximated.
const MAP_GROUND = { light: ['#F5F2EC', '#FFFFFF', '#E8E4DA'], dark: ['#242733', '#1B1E27', '#30333D'] } as const;

test('T120 map pin tokens: plan stops and way-back pins read on every surface and the map, carry card text, and stand apart', () => {
  const fails: string[] = [];
  const hueGap = (a: string, b: string) => {
    const d = Math.abs(toHsl(a).h - toHsl(b).h) % 360;
    return Math.min(d, 360 - d);
  };
  for (const th of [light, dark]) {
    const name = th.dark ? 'dark' : 'light';
    const grounds = [th.paper, th.card, th.cardRaised, ...Object.values(th.dark ? surfaces.dark : surfaces.light), ...MAP_GROUND[name]];
    for (const key of ['mapPlan', 'mapWayback'] as const) {
      const c = th[key];
      assert.match(c, /^#[0-9A-F]{6}$/, `${name} ${key}`);
      for (const bg of grounds) {
        const r = contrast(c, bg);
        if (r < AA_LARGE) fails.push(`${name} ${key} pin on ${bg}: ${r.toFixed(2)}`);
      }
      // the numbered badge and the legend swatch glyph are card-coloured on the pin colour
      const on = contrast(th.card, c);
      if (on < AA_TEXT) fails.push(`${name} card text on ${key}: ${on.toFixed(2)}`);
      // its hue stands apart from every other layer's colour (route takes day colours, so its day-1 tone is checked)
      for (const id of MAP_LAYERS) {
        const other = th[LAYER_SPECS[id].tone];
        if (LAYER_SPECS[id].tone === key) continue;
        // a near-grey (ink) has no real hue: it only has to differ in lightness
        if (toHsl(other).s < 0.25) continue;
        const gap = hueGap(c, other);
        if (gap < 25) fails.push(`${name} ${key} hue too close to ${id} (${LAYER_SPECS[id].tone}): ${gap.toFixed(0)}°`);
      }
    }
    assert.notEqual(th.mapPlan, th.mapWayback);
  }
  assert.equal(LAYER_SPECS.dayplan.tone, 'mapPlan');
  assert.equal(LAYER_SPECS.wayback.tone, 'mapWayback');
  assert.deepEqual(fails, []);
});

test('low-battery essentials: white and grey text on pure black', () => {
  assert.equal(contrast(essentials.ink, essentials.bg), 21);
  assert.ok(contrast(essentials.muted, essentials.bg) >= AA_TEXT);
});

test('contrast helper: known WCAG values and rgba compositing', () => {
  assert.equal(contrast('#000', '#fff'), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  assert.equal(Number(contrast('#767676', '#FFFFFF').toFixed(2)), 4.54);
  assert.deepEqual(parseColour('rgba(20, 33, 61, 0.45)'), { rgb: [20, 33, 61], a: 0.45 });
  assert.deepEqual(over('rgba(0, 0, 0, 0.5)', '#FFFFFF'), [127.5, 127.5, 127.5]);
  assert.throws(() => parseColour('red'));
});

test('no screen fills with plain accent (text on it is only 3:1); filled controls use accentStrong', () => {
  const root = new URL('../..', import.meta.url).pathname;
  const bad: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(f) && /backgroundColor:\s*theme\.accent\b(?!\w)/.test(readFileSync(p, 'utf8'))) bad.push(p.replace(root, ''));
    }
  };
  walk(join(root, 'app'));
  walk(join(root, 'src'));
  assert.deepEqual(bad, []);
});

test('pair list covers every surface and tint in both themes', () => {
  const n = usedPairs(light).length;
  assert.ok(n >= 50, String(n));
  assert.equal(usedPairs(dark).length, n);
});
