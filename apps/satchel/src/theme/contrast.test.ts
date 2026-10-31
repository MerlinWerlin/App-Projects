// T91 (owner-1031 D): every light and dark token pair the screens use meets WCAG AA: 4.5:1 for normal text, 3:1 for
// large text and icons. A failing pair names the theme, the two tokens and the ratio. Fix the token (keep the brand
// palette's character), not this list; add a pair here when a screen starts putting a new colour on a new surface.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AA_LARGE, AA_TEXT, contrast, over, parseColour } from './contrast.ts';
import { STAMP_INKS } from '../core/stamps.ts';
import { coverScrim, dark, essentials, light, stampInks, stampPapers, type HeroTone, type Theme } from './tokens.ts';

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
