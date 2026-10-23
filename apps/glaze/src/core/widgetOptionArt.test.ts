import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WIDGET_TAB_SIZES } from './tabNav.ts';
import { CATALOGUE_SIZE_POINTS } from './widgetKinds.ts';
import { WIDGET_LOOKS, glowPalette } from './widgetLook.ts';
import { SIZE_ART_BOX, lookSwatch, sizeArt, themeSwatch, type ArtRect } from './widgetOptionArt.ts';
import { THEMES } from './themes.ts';
import { generateWidgetSet } from './widgetSets.ts';

const inBox = (r: ArtRect) =>
  r.x >= 0 && r.y >= 0 && r.x + r.width <= SIZE_ART_BOX.width + 0.05 && r.y + r.height <= SIZE_ART_BOX.height + 0.05;

test('every size tab has a picture that fits its box', () => {
  for (const s of WIDGET_TAB_SIZES) {
    const art = sizeArt(s);
    assert.ok(art.length > 0, s);
    for (const r of art) {
      assert.ok(inBox(r), `${s} ${JSON.stringify(r)}`);
      assert.ok(r.width >= 3 && r.height >= 3 && r.radius > 0, s);
      assert.ok(r.radius <= Math.min(r.width, r.height) / 2 + 0.05, s);
    }
  }
});

test('home sizes keep their real aspect and one shared scale (small < medium < large)', () => {
  const [small] = sizeArt('small');
  const [medium] = sizeArt('medium');
  const [large] = sizeArt('large');
  for (const [r, k] of [[small, 'small'], [medium, 'medium'], [large, 'large']] as const) {
    const pts = CATALOGUE_SIZE_POINTS[k];
    assert.ok(Math.abs(r.width / r.height - pts.width / pts.height) < 0.05, k);
  }
  assert.ok(Math.abs(small.height - medium.height) < 0.15, 'small and medium are equally tall');
  assert.ok(Math.abs(medium.width - large.width) < 0.15, 'medium and large are equally wide');
  assert.ok(small.width * small.height < medium.width * medium.height);
  assert.ok(medium.width * medium.height < large.width * large.height);
  // Large fills the box on one axis.
  assert.ok(Math.abs(large.height - SIZE_ART_BOX.height) < 0.15 || Math.abs(large.width - SIZE_ART_BOX.width) < 0.15);
});

test('lock picture: a clock line over a round and a wide accessory, not overlapping', () => {
  const art = sizeArt('lock');
  assert.equal(art.length, 3);
  const [line, round, wide] = art;
  assert.equal(line.role, 'line');
  assert.equal(round.role, 'widget');
  assert.ok(Math.abs(round.width - round.height) < 0.05 && Math.abs(round.radius - round.width / 2) < 0.05);
  assert.ok(wide.width > wide.height * 1.8);
  assert.ok(line.y + line.height <= Math.min(round.y, wide.y));
  assert.ok(round.x + round.width <= wide.x);
});

test('size pictures differ from each other and are deterministic', () => {
  const sigs = WIDGET_TAB_SIZES.map((s) => JSON.stringify(sizeArt(s)));
  assert.equal(new Set(sigs).size, WIDGET_TAB_SIZES.length);
  assert.deepEqual(sizeArt('medium'), sizeArt('medium'));
});

test('every look has a distinct swatch for every bundled theme', () => {
  for (const theme of THEMES) {
    const tokens = generateWidgetSet(theme).tokens;
    const sw = WIDGET_LOOKS.map((l) => lookSwatch(l, tokens));
    for (const s of sw) {
      for (const c of [...s.backdrop, s.pane, s.mark]) assert.match(c, /^#[0-9A-F]{6}$/i, theme.id);
      assert.ok(s.paneOpacity > 0 && s.paneOpacity <= 1);
    }
    assert.equal(new Set(sw.map((s) => JSON.stringify(s))).size, WIDGET_LOOKS.length, theme.id);
  }
});

test('look swatches follow the look: glass is see-through with an edge, glow is a neon halo, theme is opaque', () => {
  const tokens = generateWidgetSet(THEMES[0]).tokens;
  const theme = lookSwatch('theme', tokens);
  assert.equal(theme.paneOpacity, 1);
  assert.equal(theme.edge, null);
  assert.equal(theme.halo, 0);
  const tinted = lookSwatch('tinted', tokens);
  assert.equal(tinted.pane.toUpperCase(), tokens.accent.toUpperCase());
  const glow = lookSwatch('glow', tokens);
  assert.ok(glow.halo > 0);
  assert.equal(glow.mark, glowPalette(tokens.accent).neon);
  const clear = lookSwatch('clear', { bg: ['#203040'], surface: '#FFFFFF', accent: '#7A2E6B', wallpaper: ['#203040', '#405060'] });
  assert.ok(clear.paneOpacity < 1);
  assert.ok(clear.edge);
  assert.deepEqual(clear.backdrop, ['#203040', '#405060']);
});

test('swatches never throw on junk tokens', () => {
  for (const l of WIDGET_LOOKS) {
    const s = lookSwatch(l, { bg: [], surface: 'nope', accent: '', wallpaper: [] });
    assert.match(s.pane, /^#[0-9A-F]{6}$/i);
    assert.equal(s.backdrop[0], s.backdrop[1]);
  }
});

test('theme chips: a swatch per theme, from its palette', () => {
  for (const theme of THEMES) {
    const s = themeSwatch(theme.palette);
    assert.equal(s.backdrop[0].toUpperCase(), theme.palette.bg.toUpperCase());
    assert.equal(s.pane.toUpperCase(), theme.palette.surface.toUpperCase());
    assert.equal(s.mark.toUpperCase(), theme.palette.accent.toUpperCase());
  }
});
