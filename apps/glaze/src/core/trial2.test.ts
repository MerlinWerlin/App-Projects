// TRIAL2 integration (T31): applying a theme with a chosen shape keeps its artwork, per-theme and
// "all themes" overrides combine with it, restore goes back to the art, and the resolver
// (iconFor) and the install plan agree with the exported specs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconFor } from './appIcons.ts';
import { planInstall, withoutMissingImages } from './install.ts';
import {
  ALL_THEMES_KEY,
  addApps,
  addCustomApp,
  applyThemeStyle,
  applyToAllThemes,
  defaultStudioState,
  parseStudioState,
  restoreThemeArtwork,
  serializeStudioState,
  setThemeOverride,
  setThemeShape,
  specsForTheme,
  studioSpecs,
  themeStyleWithShape,
  type StudioState,
} from './studio.ts';
import { THEMES } from './themes.ts';

const theme = THEMES.find((t) => t.iconStyle.art) ?? THEMES[0];
const other = THEMES.find((t) => t.id !== theme.id) ?? THEMES[1];
const SHAPE = theme.iconStyle.shape === 'circle' ? 'square' : 'circle';
const IMG_THEME = 'file:///docs/icons/spotify-1.png';
const IMG_ALL = 'file:///docs/icons/maps-2.png';

function build(): StudioState {
  let s = addApps(defaultStudioState(), ['messages', 'spotify', 'maps']);
  // The shape is picked on the theme page before the theme is applied.
  s = setThemeShape(s, theme.id, SHAPE);
  s = applyThemeStyle(s, theme.iconStyle, theme.id, '#223344');
  s = setThemeOverride(s, theme.id, 'spotify', { overrideImage: IMG_THEME }, 1);
  s = applyToAllThemes(s, 'maps', { overrideImage: IMG_ALL }, 2);
  return s;
}

const byId = (s: StudioState) => Object.fromEntries(studioSpecs(s).map((x) => [x.appId, x]));

test('theme exists with artwork for the integration checks', () => {
  assert.ok(theme.iconStyle.art, 'at least one starter theme has icon artwork');
});

test('applying a theme uses its chosen shape and keeps the artwork', () => {
  const s = build();
  assert.equal(s.themeId, theme.id);
  assert.equal(s.style.shape, SHAPE);
  assert.ok(s.style.art);
  for (const spec of studioSpecs(s)) {
    assert.equal(spec.shape, SHAPE, `${spec.appId} uses the chosen shape`);
    assert.deepEqual(spec.art, s.style.art, `${spec.appId} keeps the art (an image just draws over it)`);
  }
  // The theme page / override row previews agree with the export.
  const preview = specsForTheme(s, theme.id, themeStyleWithShape(s, theme.id, theme.iconStyle));
  assert.deepEqual(preview.map((p) => p.shape), studioSpecs(s).map((p) => p.shape));
});

test('state survives a save/load round trip (art, shape, overrides)', () => {
  const s = build();
  const back = parseStudioState(serializeStudioState(s));
  assert.deepEqual(studioSpecs(back), studioSpecs(s));
  assert.equal(back.themeShapes[theme.id], SHAPE);
});

test('override images: theme override and all-themes override both reach the export', () => {
  const specs = byId(build());
  assert.equal(specs.spotify.overrideImage, IMG_THEME);
  assert.equal(specs.maps.overrideImage, IMG_ALL);
  assert.equal(specs.messages.overrideImage, undefined);
  assert.equal(specs.spotify.shape, SHAPE, 'an override image keeps the theme shape');
});

test('a theme override wins over the all-themes one; other themes see only the all-themes one', () => {
  let s = build();
  const mine = 'file:///docs/icons/maps-3.png';
  s = setThemeOverride(s, theme.id, 'maps', { overrideImage: mine }, 3);
  assert.equal(byId(s).maps.overrideImage, mine);
  const elsewhere = Object.fromEntries(specsForTheme(s, other.id, other.iconStyle).map((x) => [x.appId, x]));
  assert.equal(elsewhere.maps.overrideImage, IMG_ALL);
  assert.equal(elsewhere.spotify.overrideImage, undefined, 'a theme override stays in its theme');
});

test('restore goes back to the theme artwork (and clears the all-themes override it was using)', () => {
  let s = build();
  s = restoreThemeArtwork(s, theme.id, 'spotify');
  s = restoreThemeArtwork(s, theme.id, 'maps');
  const specs = byId(s);
  assert.equal(specs.spotify.overrideImage, undefined);
  assert.equal(specs.maps.overrideImage, undefined);
  assert.ok(specs.spotify.art);
  assert.equal(s.themeOverrides[ALL_THEMES_KEY], undefined);
  // Images stay in the library for re-use.
  assert.ok(s.images.some((i) => i.uri === IMG_THEME));
  assert.ok(s.images.some((i) => i.uri === IMG_ALL));
  assert.equal(iconFor('spotify', theme.id, s).kind, 'theme-art');
});

test('iconFor agrees with the exported specs', () => {
  const s = build();
  for (const spec of studioSpecs(s)) {
    const src = iconFor(spec.appId, s.themeId, s);
    if (spec.overrideImage) {
      assert.equal(src.kind, 'override');
      if (src.kind === 'override') assert.equal(src.image, spec.overrideImage);
    } else {
      assert.notEqual(src.kind, 'override');
    }
  }
  const spotify = iconFor('spotify', theme.id, s);
  const maps = iconFor('maps', theme.id, s);
  assert.ok(spotify.kind === 'override' && spotify.scope === 'theme');
  assert.ok(maps.kind === 'override' && maps.scope === 'all-themes');
});

test('add-app upload: a user-added app gets its image in the applied theme and goes to the right install path', () => {
  let s = build();
  const r = addCustomApp(s, { name: 'Corner Bakery', urlScheme: 'cornerbakery://' });
  assert.ok(r.ok);
  if (!r.ok) return;
  const r2 = addCustomApp(r.state, { name: 'Garden Diary', urlScheme: '' });
  assert.ok(r2.ok);
  if (!r2.ok) return;
  s = r2.state;
  assert.equal(iconFor(r.id, s.themeId, s).kind, 'needs-icon');
  const img = 'file:///docs/icons/bakery-4.png';
  s = setThemeOverride(addApps(s, [r.id]), s.themeId ?? '', r.id, { overrideImage: img }, 4);
  const src = iconFor(r.id, s.themeId, s);
  assert.ok(src.kind === 'override' && src.image === img);
  const plan = planInstall(studioSpecs(s));
  const inProfile = plan.profile.find((x) => x.appId === r.id);
  assert.equal(inProfile?.overrideImage, img, 'the bulk profile renders the uploaded image');
  assert.ok(plan.profile.some((x) => x.appId === 'spotify' && x.overrideImage === IMG_THEME));
  assert.ok(plan.shortcuts.some((x) => x.appId === r2.id), 'no URL scheme: Photos + Shortcuts path');
});

test('install: an override image missing from disk falls back to the theme artwork', () => {
  const specs = studioSpecs(build());
  const { specs: out, fellBack } = withoutMissingImages(specs, new Set([IMG_THEME]));
  assert.deepEqual(fellBack, ['spotify']);
  const spotify = out.find((x) => x.appId === 'spotify');
  assert.equal(spotify?.overrideImage, undefined);
  assert.ok(spotify?.art);
  assert.equal(out.find((x) => x.appId === 'maps')?.overrideImage, IMG_ALL);
  // Input is not mutated.
  assert.equal(specs.find((x) => x.appId === 'spotify')?.overrideImage, IMG_THEME);
  assert.deepEqual(withoutMissingImages(specs, new Set()).fellBack, []);
});
