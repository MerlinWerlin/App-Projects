import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appsNeedingIcons, iconFor } from './appIcons.ts';
import {
  ALL_THEMES_KEY,
  NO_THEME_KEY,
  addCustomApp,
  applyToAllThemes,
  defaultStudioState,
  effectiveOverride,
  restoreThemeArtwork,
  setThemeOverride,
} from './studio.ts';

const IMG_A = 'file:///docs/icons/spotify-1712345678901.png';
const IMG_B = 'file:///docs/icons/spotify-1712345679999.png';

test('theme artwork when nothing is overridden', () => {
  const s = defaultStudioState();
  const r = iconFor('spotify', 'strawberry-dessert', s);
  assert.equal(r.kind, 'theme-art');
  if (r.kind === 'theme-art') assert.equal(r.glyph, 'music');
  assert.equal(r.support, 'verified');
  assert.equal(iconFor('camera', null, s).support, 'shortcuts');
});

test('precedence: theme override > all-themes override > theme artwork', () => {
  let s = defaultStudioState();
  s = applyToAllThemes(s, 'spotify', { overrideImage: IMG_A }, 1);
  const all = iconFor('spotify', 'cottage-garden', s);
  assert.equal(all.kind, 'override');
  if (all.kind === 'override') {
    assert.equal(all.scope, 'all-themes');
    assert.equal(all.image, IMG_A);
  }
  s = setThemeOverride(s, 'strawberry-dessert', 'spotify', { overrideImage: IMG_B }, 2);
  const own = iconFor('spotify', 'strawberry-dessert', s);
  assert.equal(own.kind, 'override');
  if (own.kind === 'override') {
    assert.equal(own.scope, 'theme');
    assert.equal(own.image, IMG_B);
  }
  // Other themes still use the all-themes image.
  const other = iconFor('spotify', 'cottage-garden', s);
  assert.ok(other.kind === 'override' && other.image === IMG_A);
  // Matches the studio's own precedence.
  for (const theme of ['strawberry-dessert', 'cottage-garden']) {
    const r = iconFor('spotify', theme, s);
    assert.ok(r.kind === 'override');
    if (r.kind === 'override') assert.deepEqual(r.override, effectiveOverride(s, theme, 'spotify'));
  }
  // Restore in one theme: back to the theme's artwork there (and the all-themes one is removed).
  s = restoreThemeArtwork(s, 'strawberry-dessert', 'spotify');
  assert.equal(iconFor('spotify', 'strawberry-dessert', s).kind, 'theme-art');
});

test('an image is saved for one app in one theme only', () => {
  const s = setThemeOverride(defaultStudioState(), 'celestial-night', 'roblox', { overrideImage: IMG_A }, 1);
  assert.equal(iconFor('roblox', 'celestial-night', s).kind, 'override');
  assert.equal(iconFor('roblox', 'strawberry-dessert', s).kind, 'theme-art');
  assert.equal(iconFor('minecraft', 'celestial-night', s).kind, 'theme-art');
});

test('no theme applied uses NO_THEME_KEY; a glyph-only override has no image', () => {
  const s = setThemeOverride(defaultStudioState(), NO_THEME_KEY, 'notes', { glyph: 'heart' }, 1);
  const r = iconFor('notes', null, s);
  assert.equal(r.kind, 'override');
  if (r.kind === 'override') {
    assert.equal(r.image, null);
    assert.equal(r.override.glyph, 'heart');
  }
  assert.equal(iconFor('notes', '  ', s).kind, 'override');
  assert.equal(iconFor('notes', 'strawberry-dessert', s).kind, 'theme-art');
});

test('custom apps need an icon until an image is uploaded; unknown apps need one too', () => {
  const added = addCustomApp(defaultStudioState(), { name: 'Corner Bakery', urlScheme: '' });
  assert.ok(added.ok);
  if (!added.ok) return;
  let s = added.state;
  const before = iconFor(added.id, 'strawberry-dessert', s);
  assert.equal(before.kind, 'needs-icon');
  if (before.kind === 'needs-icon') assert.equal(before.reason, 'custom-app');
  assert.equal(before.support, 'shortcuts');
  // A glyph change alone is not an image.
  s = setThemeOverride(s, 'strawberry-dessert', added.id, { glyph: 'coffee' }, 1);
  assert.equal(iconFor(added.id, 'strawberry-dessert', s).kind, 'needs-icon');
  s = setThemeOverride(s, 'strawberry-dessert', added.id, { overrideImage: IMG_A }, 2);
  assert.equal(iconFor(added.id, 'strawberry-dessert', s).kind, 'override');
  assert.equal(iconFor(added.id, 'cottage-garden', s).kind, 'needs-icon');

  const unknown = iconFor('not-an-app', 'strawberry-dessert', s);
  assert.ok(unknown.kind === 'needs-icon' && unknown.reason === 'unknown-app' && unknown.glyph === null);

  const withScheme = addCustomApp(defaultStudioState(), { name: 'Club', urlScheme: 'club' });
  assert.ok(withScheme.ok);
  if (withScheme.ok) assert.equal(iconFor(withScheme.id, null, withScheme.state).support, 'unverified');

  assert.deepEqual(appsNeedingIcons(['spotify', added.id, 'nope'], 'cottage-garden', s), [added.id, 'nope']);
});

test('the all-themes key itself resolves to the all-themes override', () => {
  const s = applyToAllThemes(defaultStudioState(), 'spotify', { overrideImage: IMG_A }, 1);
  const r = iconFor('spotify', ALL_THEMES_KEY, s);
  assert.ok(r.kind === 'override' && r.scope === 'all-themes');
});
