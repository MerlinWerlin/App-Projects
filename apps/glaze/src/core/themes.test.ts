import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, isHex, mix } from './colour.ts';
import { MIN_GLYPH_CONTRAST, contrastWarnings, type IconBackground } from './iconspec.ts';
import { SHAPES } from './shapes.ts';
import { isKnownGlyph } from './glyphnames.ts';
import { PREVIEW_APP_IDS, THEMES, getTheme, previewApps, previewSpecs } from './themes.ts';
import { averageColour, layoutWallpaper, wallpaperErrors } from './wallpaper.ts';

const COMPETITORS = /themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio/i;

function iconBgColours(bg: IconBackground, wallpaperAverage: string): string[] {
  if (bg.kind === 'solid') return [bg.colour];
  if (bg.kind === 'gradient') return [bg.from, bg.to];
  // Glass: the tint itself, and the tint laid over the wallpaper at its opacity.
  return [bg.tint, mix(wallpaperAverage, bg.tint, bg.opacity)];
}

test('there are at least 14 starter themes, all free', () => {
  assert.ok(THEMES.length >= 14, `${THEMES.length} starter themes`);
  for (const t of THEMES) assert.equal(t.plus, false, t.id);
});

test('theme ids and names are unique, slug-like and original', () => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const t of THEMES) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    assert.ok(!names.has(t.name), `duplicate name ${t.name}`);
    ids.add(t.id);
    names.add(t.name);
    assert.ok(t.tagline.length > 0 && t.tagline.length <= 60, t.id);
    assert.ok(!COMPETITORS.test(`${t.id} ${t.name} ${t.tagline}`), t.id);
  }
});

test('getTheme', () => {
  assert.equal(getTheme('strawberry-dessert')?.name, 'Strawberry Dessert');
  // Retired palette-only ids open their replacement.
  assert.equal(getTheme('porcelain')?.id, 'cloud-nine');
  assert.equal(getTheme('nope'), undefined);
  assert.equal(getTheme(undefined), undefined);
});

test('every palette and widget colour is hex', () => {
  for (const t of THEMES) {
    for (const [k, v] of Object.entries(t.palette)) assert.ok(isHex(v), `${t.id}.palette.${k}`);
    assert.ok(isHex(t.widget.accent), t.id);
    assert.ok(['glass', 'solid', 'outline'].includes(t.widget.style));
    assert.ok(['display', 'body'].includes(t.widget.font));
    assert.equal(t.palette.glyph, t.iconStyle.glyphColour, `${t.id}: palette.glyph matches icon style`);
  }
});

test('glyph vs icon background contrast is at least 3:1 (both gradient ends, glass tint)', () => {
  for (const t of THEMES) {
    const avg = averageColour(t.wallpaper);
    for (const bg of iconBgColours(t.iconStyle.background, avg)) {
      const r = contrastRatio(t.iconStyle.glyphColour, bg);
      assert.ok(r >= MIN_GLYPH_CONTRAST, `${t.id}: glyph ${t.iconStyle.glyphColour} on ${bg} = ${r.toFixed(2)}`);
    }
    assert.deepEqual(contrastWarnings(previewSpecs(t)), [], t.id);
  }
});

test('theme ink is readable on its background (4.5:1)', () => {
  for (const t of THEMES) {
    const r = contrastRatio(t.palette.ink, t.palette.bg);
    assert.ok(r >= 4.5, `${t.id}: ink on bg ${r.toFixed(2)}`);
  }
});

test('icon styles are valid', () => {
  for (const t of THEMES) {
    const s = t.iconStyle;
    assert.ok(SHAPES.includes(s.shape), t.id);
    assert.ok(['feather', 'glaze'].includes(s.glyphSet), t.id);
    assert.ok(s.glyphScale >= 0.2 && s.glyphScale <= 0.9, t.id);
    if (s.background.kind === 'glass') assert.ok(s.background.opacity > 0 && s.background.opacity <= 1);
    if (s.background.kind === 'gradient') assert.ok(Number.isFinite(s.background.angle));
  }
});

test('wallpaper params are valid and lay out', () => {
  const seeds = new Set<number>();
  for (const t of THEMES) {
    assert.deepEqual(wallpaperErrors(t.wallpaper), [], t.id);
    seeds.add(t.wallpaper.seed);
    const l = layoutWallpaper(t.wallpaper, 390, 844);
    assert.ok(l.gradient !== null || l.blobs.length > 0, t.id);
  }
  assert.equal(seeds.size, THEMES.length, 'each theme has its own seed');
  // The gallery should show a mix of wallpaper kinds.
  assert.ok(new Set(THEMES.map((t) => t.wallpaper.kind)).size >= 4);
});

test('preview apps exist in the catalogue and use known generic glyphs', () => {
  const apps = previewApps();
  assert.equal(apps.length, PREVIEW_APP_IDS.length);
  for (const a of apps) assert.ok(isKnownGlyph(a.glyph), a.id);
  const specs = previewSpecs(THEMES[0], 8);
  assert.equal(specs.length, 8);
  assert.equal(specs[0].glyphColour, THEMES[0].iconStyle.glyphColour);
});

test('previewSpecs can draw a theme in the user\'s chosen shape (T26)', () => {
  const t = THEMES[0];
  const own = previewSpecs(t, 4);
  assert.ok(own.every((x) => x.shape === t.iconStyle.shape));
  for (const shape of SHAPES) {
    const specs = previewSpecs(t, 4, shape);
    assert.equal(specs.length, 4);
    assert.ok(specs.every((x) => x.shape === shape && x.art !== undefined), shape);
  }
});
