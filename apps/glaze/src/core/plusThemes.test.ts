import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, isHex, mix } from './colour.ts';
import { isKnownGlyph } from './glyphnames.ts';
import { GLYPH_SETS, getGlyphSet } from './glyphsets.ts';
import { MIN_GLYPH_CONTRAST, contrastWarnings, type IconBackground } from './iconspec.ts';
import {
  ALL_THEMES,
  PLUS_PACKS,
  PLUS_THEMES,
  getAnyTheme,
  packOf,
  wallpaperMakerSwatches,
  wallpaperMakerTheme,
} from './plusThemes.ts';
import { SHAPES } from './shapes.ts';
import { THEMES, previewSpecs } from './themes.ts';
import { STORYPLAY_PACK_ID } from './themesStoryPlay.ts';
import { averageColour, editorParamsFor, layoutWallpaper, wallpaperErrors } from './wallpaper.ts';

const COMPETITORS = /themify|icon themer|myscreen|screenkit|widgetsmith|intolive|loopy|lockio/i;

function iconBgColours(bg: IconBackground, wallpaperAverage: string): string[] {
  if (bg.kind === 'solid') return [bg.colour];
  if (bg.kind === 'gradient') return [bg.from, bg.to];
  return [bg.tint, mix(wallpaperAverage, bg.tint, bg.opacity)];
}

test('five Plus packs, all marked plus (T46 added the downloadable Aurora pack, T104 Story & Play)', () => {
  assert.equal(PLUS_PACKS.length, 5);
  for (const p of PLUS_PACKS) {
    assert.equal(p.themes.length, p.id === STORYPLAY_PACK_ID ? 7 : 8, p.id);
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.ok(!COMPETITORS.test(`${p.id} ${p.name} ${p.tagline}`), p.id);
    for (const t of p.themes) {
      assert.equal(t.plus, true, t.id);
      assert.equal(packOf(t.id)?.id, p.id);
    }
  }
  assert.equal(new Set(PLUS_PACKS.map((p) => p.name)).size, 5);
  assert.equal(PLUS_THEMES.length, 39);
});

test('ALL_THEMES is the free starters then the 39 Plus themes', () => {
  assert.equal(ALL_THEMES.length, THEMES.length + 39);
  assert.deepEqual(ALL_THEMES.slice(0, THEMES.length), [...THEMES]);
  assert.equal(ALL_THEMES.filter((t) => !t.plus).length, THEMES.length);
  assert.equal(getAnyTheme('strawberry-dessert')?.plus, false);
  assert.equal(getAnyTheme('porcelain')?.id, 'cloud-nine');
  assert.equal(getAnyTheme('tenmoku')?.plus, true);
  assert.equal(getAnyTheme('nope'), undefined);
  assert.equal(getAnyTheme(undefined), undefined);
  assert.equal(packOf('porcelain'), undefined);
});

test('T81: Plus themes open directly in the wallpaper maker once unlocked', () => {
  // Unlocked: any theme starts the maker, Plus included.
  assert.equal(wallpaperMakerTheme('tenmoku', false).id, 'tenmoku');
  assert.equal(wallpaperMakerTheme('strawberry-dessert', false).id, 'strawberry-dessert');
  // Locked Plus falls back to a free starter, so Plus artwork isn't handed out.
  assert.equal(wallpaperMakerTheme('tenmoku', true).id, THEMES[0].id);
  assert.equal(wallpaperMakerTheme('tenmoku', true).plus, false);
  // Free themes ignore the lock; retired ids and unknown ids behave as before.
  assert.equal(wallpaperMakerTheme('strawberry-dessert', true).id, 'strawberry-dessert');
  assert.equal(wallpaperMakerTheme('porcelain', true).id, 'cloud-nine');
  assert.equal(wallpaperMakerTheme('nope', false).id, THEMES[0].id);
  assert.equal(wallpaperMakerTheme(undefined, false).id, THEMES[0].id);
  // Swatches: the starters, with a Plus start theme first so its colours show as selected.
  const plus = wallpaperMakerTheme('tenmoku', false);
  const sw = wallpaperMakerSwatches(plus);
  assert.equal(sw[0].id, 'tenmoku');
  assert.equal(sw.length, THEMES.length + 1);
  assert.equal(wallpaperMakerSwatches(THEMES[2]), THEMES);
});

test('T81: editorParamsFor fills every knob and copies the colours', () => {
  const w = PLUS_THEMES[0].wallpaper;
  const p = editorParamsFor(w);
  assert.notEqual(p.colours, w.colours);
  assert.deepEqual(p.colours, [...w.colours]);
  assert.equal(p.pattern, w.pattern ?? 'dots');
  assert.equal(p.angle, w.angle ?? 180);
  assert.equal(p.grain, w.grain ?? 0);
  assert.deepEqual(editorParamsFor({ kind: 'mesh', colours: ['#000000'], seed: 1 }), {
    kind: 'mesh',
    colours: ['#000000'],
    seed: 1,
    pattern: 'dots',
    angle: 180,
    grain: 0,
  });
});

test('ids, names and seeds are unique across every theme; names are original', () => {
  const ids = new Set<string>();
  const names = new Set<string>();
  const seeds = new Set<number>();
  for (const t of ALL_THEMES) {
    assert.match(t.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    assert.ok(!names.has(t.name), `duplicate name ${t.name}`);
    assert.ok(!seeds.has(t.wallpaper.seed), `duplicate seed ${t.id}`);
    ids.add(t.id);
    names.add(t.name);
    seeds.add(t.wallpaper.seed);
    assert.ok(t.tagline.length > 0 && t.tagline.length <= 60, t.id);
    assert.ok(!COMPETITORS.test(`${t.id} ${t.name} ${t.tagline}`), t.id);
  }
});

test('Plus colours are hex and the palette glyph matches the icon style', () => {
  for (const t of PLUS_THEMES) {
    for (const [k, v] of Object.entries(t.palette)) assert.ok(isHex(v), `${t.id}.palette.${k}`);
    assert.ok(isHex(t.widget.accent), t.id);
    assert.ok(['glass', 'solid', 'outline'].includes(t.widget.style));
    assert.ok(['display', 'body'].includes(t.widget.font));
    assert.equal(t.palette.glyph, t.iconStyle.glyphColour, t.id);
  }
});

test('Plus glyph contrast is at least 3:1 (gradient ends, glass tint and over wallpaper)', () => {
  for (const t of PLUS_THEMES) {
    const avg = averageColour(t.wallpaper);
    for (const bg of iconBgColours(t.iconStyle.background, avg)) {
      const r = contrastRatio(t.iconStyle.glyphColour, bg);
      assert.ok(r >= MIN_GLYPH_CONTRAST, `${t.id}: glyph ${t.iconStyle.glyphColour} on ${bg} = ${r.toFixed(2)}`);
    }
    assert.deepEqual(contrastWarnings(previewSpecs(t)), [], t.id);
  }
});

test('Plus ink is readable on its background (4.5:1)', () => {
  for (const t of PLUS_THEMES) {
    const r = contrastRatio(t.palette.ink, t.palette.bg);
    assert.ok(r >= 4.5, `${t.id}: ink on bg ${r.toFixed(2)}`);
  }
});

test('Plus icon styles and wallpapers are valid', () => {
  for (const t of PLUS_THEMES) {
    const s = t.iconStyle;
    assert.ok(SHAPES.includes(s.shape), t.id);
    assert.ok(['feather', 'glaze'].includes(s.glyphSet), t.id);
    assert.ok(s.glyphScale >= 0.2 && s.glyphScale <= 0.9, t.id);
    if (s.background.kind === 'glass') assert.ok(s.background.opacity > 0 && s.background.opacity <= 1);
    assert.deepEqual(wallpaperErrors(t.wallpaper), [], t.id);
    const l = layoutWallpaper(t.wallpaper, 390, 844);
    assert.ok(l.gradient !== null || l.blobs.length > 0, t.id);
  }
  assert.equal(new Set(PLUS_THEMES.map((t) => t.wallpaper.kind)).size, 4);
});

test('glyph sets: the full library is free, the curated Plus set uses known names', () => {
  const free = getGlyphSet('everything');
  assert.ok(free && !free.plus);
  const plus = GLYPH_SETS.filter((s) => s.plus);
  assert.ok(plus.length >= 1);
  for (const s of GLYPH_SETS) {
    assert.ok(s.names.length > 0, s.id);
    assert.equal(new Set(s.names).size, s.names.length, `${s.id} has duplicates`);
    for (const n of s.names) assert.ok(isKnownGlyph(n), `${s.id}: ${n}`);
    assert.ok(!COMPETITORS.test(`${s.name} ${s.description}`), s.id);
  }
  // Every Plus glyph is also in the free library: Plus is a curation, never a lock on a symbol.
  for (const s of plus) for (const n of s.names) assert.ok(free.names.includes(n), n);
});
