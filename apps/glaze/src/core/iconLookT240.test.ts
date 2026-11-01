// T240 (owner-1101g #5): an always-visible icon look selector on the theme's Icons step, and a
// glass look that is dark, palette-tinted and lightly frosted so it sits in the wallpaper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, mix, relativeLuminance } from './colour.ts';
import {
  GLASS_FROST,
  GLASS_MAX_OPACITY,
  GLASS_TINT_OPACITY,
  ICON_LOOKS,
  LOOK_GLYPH_CONTRAST,
  glassBackgroundFor,
  glassOver,
  iconStyleForLook,
} from './iconLook.ts';
import { ALL_THEMES, getAnyTheme } from './plusThemes.ts';
import { defaultStudioState, setThemeLook, applyThemeStyle, themeIconStyle, themeLookFor, parseStudioState, serializeStudioState } from './studio.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/.*$/gm, '$1');

function avgWall(cols: string[]): string {
  let acc = cols[0];
  for (let i = 1; i < cols.length; i++) acc = mix(acc, cols[i], 1 / (i + 1));
  return acc;
}

test('glass is dark, tinted with the theme palette and only lightly frosted', () => {
  assert.ok(GLASS_FROST.shineTop <= 0.2 && GLASS_FROST.shineMid <= 0.05 && GLASS_FROST.edge <= 0.25, 'low frost');
  assert.ok(GLASS_TINT_OPACITY <= 0.5 && GLASS_MAX_OPACITY <= 0.75, 'still see-through');
  for (const t of ALL_THEMES) {
    const bg = glassBackgroundFor(t);
    assert.equal(bg.kind, 'glass');
    if (bg.kind !== 'glass') continue;
    const wall = avgWall(t.wallpaper.colours);
    // Darker than the wallpaper it sits on (and than the old white pane).
    assert.ok(relativeLuminance(bg.tint) < relativeLuminance(wall) || relativeLuminance(bg.tint) < 0.03, `${t.id}: tint ${bg.tint} vs ${wall}`);
    assert.ok(relativeLuminance(bg.tint) < 0.12, `${t.id}: dark tint ${bg.tint}`);
    assert.ok(bg.opacity >= GLASS_TINT_OPACITY && bg.opacity <= GLASS_MAX_OPACITY, `${t.id}: opacity ${bg.opacity}`);
    // Glyph reads on the pane over the wallpaper (graphics: 3:1).
    const style = iconStyleForLook(t, 'glass');
    assert.ok(contrastRatio(style.glyphColour, glassOver(bg, wall)) >= 3 - 0.01, `${t.id}: glass glyph`);
  }
});

test('glass tint follows the palette: themes with different accents get different panes', () => {
  const a = glassBackgroundFor(getAnyTheme('celestial-night')!);
  const b = glassBackgroundFor(getAnyTheme('matcha-cafe')!);
  assert.ok(a.kind === 'glass' && b.kind === 'glass');
  assert.notEqual(a.tint, b.tint);
  // Not a neutral grey: the tint keeps some hue from the palette.
  const night = getAnyTheme('celestial-night')!;
  const pane = glassBackgroundFor(night);
  if (pane.kind === 'glass') {
    const r = parseInt(pane.tint.slice(1, 3), 16);
    const g = parseInt(pane.tint.slice(3, 5), 16);
    const bl = parseInt(pane.tint.slice(5, 7), 16);
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) >= 4, pane.tint);
  }
});

test('tinted and dark looks keep glyphs legible and carry no texture', () => {
  for (const t of ALL_THEMES) {
    for (const look of ['tinted', 'dark'] as const) {
      const s = iconStyleForLook(t, look);
      const cols = s.background.kind === 'gradient' ? [s.background.from, s.background.to] : s.background.kind === 'solid' ? [s.background.colour] : [];
      for (const c of cols) assert.ok(contrastRatio(s.glyphColour, c) >= LOOK_GLYPH_CONTRAST - 0.01, `${t.id}/${look}`);
      assert.ok(!s.art || s.art.texture === 'none', `${t.id}/${look}`);
    }
    assert.equal(iconStyleForLook(t, 'dark').background.kind, 'solid');
    assert.ok(relativeLuminance((iconStyleForLook(t, 'dark').background as { colour: string }).colour) < 0.03, t.id);
  }
});

test('the look a person picks is kept per theme, applied to the exported style and stored', () => {
  const night = getAnyTheme('celestial-night')!;
  let s = applyThemeStyle(defaultStudioState(), themeIconStyle(defaultStudioState(), night), night.id);
  s = setThemeLook(s, night, 'glass');
  assert.equal(themeLookFor(s, night.id), 'glass');
  assert.equal(s.style.background.kind, 'glass', 'applied theme: the exported style follows');
  const back = parseStudioState(serializeStudioState(s));
  assert.equal(back.themeLooks[night.id], 'glass');
  assert.equal(back.style.background.kind, 'glass');
  // Another theme's pick does not touch the applied style.
  const other = setThemeLook(s, getAnyTheme('matcha-cafe')!, 'dark');
  assert.deepEqual(other.style, s.style);
  // Junk is dropped on load.
  const junk = parseStudioState(JSON.stringify({ version: 2, themeLooks: { a: 'tinted', b: 'neon', '*': 'dark' } }));
  assert.deepEqual(junk.themeLooks, { a: 'tinted' });
  assert.equal(ICON_LOOKS.length, 4);
});

test('the Icons step renders the look selector always (not behind a menu or collapsed row)', () => {
  const src = strip(read('app', 'theme', '[id].tsx'));
  const step = /\{step === 'icons' \? \(\s*<SquircleCard[^]*?<\/SquircleCard>/.exec(src)?.[0] ?? '';
  assert.ok(step.length > 0, 'icons step card');
  assert.match(step, /<IconLookPicker/);
  // First thing in the card, not conditional on any open/expanded state.
  const before = step.slice(0, step.indexOf('<IconLookPicker'));
  assert.doesNotMatch(before, /Open|open \?|Menu|&&/);
  assert.doesNotMatch(step.slice(0, step.indexOf('<IconLookPicker') + 200), /shapeOpen/);
  const picker = strip(read('src', 'ui', 'IconLookPicker.tsx'));
  assert.match(picker, /ICON_LOOKS\.map/);
  assert.match(picker, /accessibilityRole="radiogroup"/);
  assert.match(picker, /accessibilityRole="radio"/);
  assert.match(picker, /minHeight: sizeV2\.touch/);
  assert.doesNotMatch(picker, /<Modal|<Menu|<Sheet|ActionSheet/);
  // Live previews of the person's own apps.
  assert.match(src, /studioApps\(studio\.state\)/);
  assert.match(picker, /<IconCanvas/);
});

test('the renderer draws glass with the low-frost values', () => {
  const canvas = strip(read('src', 'render', 'IconCanvas.tsx'));
  assert.match(canvas, /GLASS_FROST\.shineTop/);
  assert.match(canvas, /GLASS_FROST\.edge/);
  assert.doesNotMatch(canvas, /stopOpacity=\{0\.55\}/);
});
