// T241 (owner-1101g #3): icons carry the theme's texture (stars / grain / the theme's own) behind
// the glyph by default, seeded per theme + app, drawn by the normal IconCanvas art pipeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconArtLayout, TEXTURE_TINT } from './artwork.ts';
import { contrastRatio, mix } from './colour.ts';
import { DEFAULT_ICON_LOOK, ICON_LOOKS, LOOK_GLYPH_CONTRAST, iconStyleForLook, themedMotif, themedTextureSpec } from './iconLook.ts';
import { resolveSpec } from './iconspec.ts';
import { ALL_THEMES, getAnyTheme } from './plusThemes.ts';
import { SPACE_THEMES } from './spacePack.ts';
import {
  applyThemeStyle,
  defaultStudioState,
  migrateThemedLook,
  parseStudioState,
  serializeStudioState,
  setOverride,
  setThemeShape,
  themeIconStyle,
  themeLookFor,
} from './studio.ts';
import { getById } from './catalogue.ts';

const night = getAnyTheme('celestial-night')!;

test('the default icon look is themed (textured)', () => {
  assert.equal(DEFAULT_ICON_LOOK, 'themed');
  assert.deepEqual([...ICON_LOOKS], ['themed', 'tinted', 'glass', 'dark']);
  assert.equal(themeLookFor(defaultStudioState(), 'celestial-night'), 'themed');
});

test('night / space themes get stars; themes with their own texture keep it; flat themes get grain', () => {
  assert.equal(themedMotif(night), 'stars');
  for (const t of SPACE_THEMES) assert.equal(themedMotif(t), 'stars', t.id);
  assert.equal(themedMotif(getAnyTheme('strawberry-dessert')!), 'own');
  for (const t of ALL_THEMES) {
    const style = iconStyleForLook(t, 'themed');
    assert.ok(style.art, t.id);
    assert.notEqual(style.art!.texture, 'none', `${t.id}: themed icons are never flat`);
  }
});

test('themed texture spec is deterministic, differs per app and per theme', () => {
  const a = themedTextureSpec(night, 'camera');
  assert.deepEqual(themedTextureSpec(night, 'camera'), a);
  const b = themedTextureSpec(night, 'music');
  assert.notEqual(a.seed, b.seed);
  assert.deepEqual(a.background, b.background, 'one background per theme');
  const other = themedTextureSpec(getAnyTheme('moon-phase')!, 'camera');
  assert.notEqual(a.seed, other.seed);
  // The seed is what the renderer scatters with: same layout for the same app, different per app.
  const style = iconStyleForLook(night, 'themed');
  const l1 = iconArtLayout(style.art!, 'squircle', 180, 'camera');
  assert.deepEqual(iconArtLayout(style.art!, 'squircle', 180, 'camera'), l1);
  assert.notDeepEqual(iconArtLayout(style.art!, 'squircle', 180, 'music').texture, l1.texture);
  assert.ok(l1.texture.length >= 2 && l1.texture.length <= 3);
});

test('themed background is a gradient from the wallpaper for stars / grain themes', () => {
  for (const t of ALL_THEMES) {
    const spec = themedTextureSpec(t, 'camera');
    if (spec.motif === 'own') continue;
    assert.equal(spec.background.kind, 'gradient', t.id);
  }
});

test('themed glyphs stay legible over the background and the textured average', () => {
  for (const t of ALL_THEMES) {
    const spec = themedTextureSpec(t, 'camera');
    // The theme's own designed textures were already held to 3:1 (artwork.test.ts); new ones to 4.5.
    const min = spec.motif === 'own' ? 3 : LOOK_GLYPH_CONTRAST;
    assert.ok(spec.contrast >= min - 0.01, `${t.id}: ${spec.contrast.toFixed(2)}`);
    if (spec.background.kind === 'gradient') {
      for (const c of [spec.background.from, spec.background.to]) {
        const worst = mix(c, spec.markColour, TEXTURE_TINT[spec.texture]);
        assert.ok(contrastRatio(spec.glyphColour, worst) >= min - 0.01, `${t.id} on ${worst}`);
      }
    }
  }
});

test('the themed texture reaches the exported spec (same IconSpec feeds the PNG capture)', () => {
  const app = getById('camera')!;
  const s = applyThemeStyle(defaultStudioState(), themeIconStyle(defaultStudioState(), night), night.id);
  const spec = resolveSpec(app, s.style);
  assert.equal(spec.art?.texture, 'stars');
  assert.equal(typeof spec.art?.textureSeed, 'number');
  // ...and survives the stored-state round trip (the install flow reads the saved state).
  const back = parseStudioState(serializeStudioState(s));
  assert.deepEqual(back.style.art, s.style.art);
});

test('migration: an untouched pre-T241 theme style moves to themed; an explicit pick is kept', () => {
  // Stored before looks: the theme's own flat style, no flag.
  const old = parseStudioState(JSON.stringify({ version: 2, themeId: night.id, style: night.iconStyle }));
  assert.equal(old.looksMigrated, false);
  const moved = migrateThemedLook(old, night);
  assert.equal(moved.looksMigrated, true);
  assert.equal(moved.style.art?.texture, 'stars');
  assert.deepEqual(moved.style.background, iconStyleForLook(night, 'themed').background);
  // Shape choice survives.
  const shaped = migrateThemedLook(setThemeShape(old, night.id, 'circle'), night);
  assert.equal(shaped.style.shape, 'circle');
  // The user had changed the background in Icon Studio: kept as is.
  const custom = parseStudioState(
    JSON.stringify({ version: 2, themeId: night.id, style: { ...night.iconStyle, background: { kind: 'solid', colour: '#123456' } } }),
  );
  const kept = migrateThemedLook(custom, night);
  assert.deepEqual(kept.style.background, { kind: 'solid', colour: '#123456' });
  assert.equal(kept.looksMigrated, true);
  // Theme not available yet: unchanged, retried later.
  assert.equal(migrateThemedLook(old, undefined), old);
  // New installs start migrated; no theme = nothing to do.
  assert.equal(defaultStudioState().looksMigrated, true);
  const noTheme = parseStudioState(JSON.stringify({ version: 2, style: night.iconStyle }));
  assert.equal(migrateThemedLook(noTheme, undefined).looksMigrated, true);
  // Overrides and selection are untouched.
  const withO = setOverride(old, 'camera', { glyph: 'star' });
  assert.deepEqual(migrateThemedLook(withO, night).themeOverrides, withO.themeOverrides);
});
