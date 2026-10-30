// T170: theme-designed monograms. A theme with artwork gives its monograms the theme's face,
// colours and a background treatment (disc, gradient, ring, glow); the result is deterministic and
// the letters stay readable on whatever they sit on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IconArt } from './artwork.ts';
import { contrastRatio } from './colour.ts';
import { resolveSpec, specContrast, withMonogram } from './iconspec.ts';
import {
  MONOGRAM_MIN_CONTRAST,
  MONOGRAM_TREATMENTS,
  buildMonogram,
  graphemes,
  monogramFontFor,
  monogramSurfaces,
  themedMonogram,
} from './monogram.ts';
import { THEMES } from './themes.ts';

const ART: IconArt = {
  colours: { primary: '#F7B6C2', secondary: '#FBE3E8', accent: '#D9668A', ink: '#3D1A24', light: '#FFFFFF' },
  frame: 'none',
  frameRole: 'accent',
  texture: 'none',
  textureRole: 'light',
  stickers: [],
  displayFont: 'serif',
};

const NAMES = ['Bike Club', 'myBank', '1Password', '微信', 'カメラ', '카카오톡', 'بنك الرياض', '🚲', '👩‍💻 Dev', 'Ölçü app', 'x'];

test('every theme designs its monograms: font token, theme colours, a treatment', () => {
  const seen = new Set<string>();
  for (const t of THEMES) {
    const s = resolveSpec({ id: 'custom-a', name: 'Bike Club', urlScheme: null, glyph: 'monogram' }, t.iconStyle);
    const look = s.monogram?.look;
    assert.ok(look, `${t.id}: no look`);
    assert.ok(MONOGRAM_TREATMENTS.includes(look.treatment), t.id);
    assert.equal(look.font, t.art.displayFont, `${t.id}: theme font`);
    seen.add(look.treatment);
  }
  // The starter themes between them use more than one treatment (not one look for everything).
  assert.ok(seen.size >= 3, [...seen].join(','));
});

test('deterministic: same input, same monogram', () => {
  for (const t of THEMES) {
    const a = buildMonogram('Bike Club', t.iconStyle.glyphColour, ['#123456'], 0.55, null, t.iconStyle.art);
    const b = buildMonogram('Bike Club', t.iconStyle.glyphColour, ['#123456'], 0.55, null, t.iconStyle.art);
    assert.deepEqual(a, b, t.id);
  }
});

test('letters are readable on what they sit on (≥ 3:1), across themes and names', () => {
  for (const t of THEMES) {
    for (const name of NAMES) {
      const s = resolveSpec({ id: 'custom-a', name, urlScheme: null, glyph: 'monogram' }, t.iconStyle);
      const m = s.monogram;
      assert.ok(m, `${t.id} ${name}`);
      const bgs = t.iconStyle.background.kind === 'solid'
        ? [t.iconStyle.background.colour]
        : t.iconStyle.background.kind === 'gradient'
          ? [t.iconStyle.background.from, t.iconStyle.background.to]
          : [t.iconStyle.background.tint];
      for (const under of monogramSurfaces(m, bgs)) {
        assert.ok(contrastRatio(m.colour, under) >= MONOGRAM_MIN_CONTRAST, `${t.id} ${name}: ${m.colour} on ${under}`);
      }
      // The contrast warning (Icons tab) measures the same surfaces, so it agrees.
      const r = specContrast(s);
      assert.ok(r !== null && r >= MONOGRAM_MIN_CONTRAST, `${t.id} ${name}: specContrast ${r}`);
    }
  }
});

test('plates stand off the icon background and letters reach text contrast on them when possible', () => {
  // (Very dark backgrounds with a bright accent glow instead; see the treatment test.)
  for (const bg of ['#FFFFFF', '#F7B6C2', '#D9668A', '#7A2E6B', '#5A5A7A']) {
    const m = buildMonogram('Bike Club', '#FFFFFF', [bg], 0.55, null, { ...ART, texture: 'polka' });
    assert.equal(m?.look?.treatment, 'disc');
    assert.ok(contrastRatio(m.look.plate, bg) >= 1.35, `plate ${m.look.plate} on ${bg}`);
    assert.ok(contrastRatio(m.colour, m.look.plate) >= 4.5, `${m.colour} on ${m.look.plate}`);
  }
});

test('treatment follows the theme character', () => {
  const t = (art: Partial<IconArt>, bg = '#FBE3E8') => themedMonogram('BC', { ...ART, ...art }, '#FFFFFF', [bg])?.look.treatment;
  assert.equal(t({ frame: 'stitched' }), 'ring');
  assert.equal(t({ frame: 'double' }), 'ring');
  assert.equal(t({ frame: 'scalloped' }), 'disc');
  assert.equal(t({ texture: 'gingham' }), 'disc');
  assert.equal(t({ texture: 'starfield' }), 'glow');
  assert.equal(t({ colours: { ...ART.colours, accent: '#F5C96B' } }, '#05060F'), 'glow');
  assert.equal(t({ frame: 'ribbon' }), 'gradient');
  assert.equal(t({}), 'gradient');
});

test('1–2 graphemes, and the letters fit inside the plate', () => {
  for (const name of NAMES) {
    for (const tex of ['none', 'polka', 'starfield'] as const) {
      const m = buildMonogram(name, '#FFFFFF', ['#FBE3E8'], 0.9, null, { ...ART, texture: tex });
      assert.ok(m && m.look, name);
      const n = graphemes(m.text).length;
      assert.ok(n >= 1 && n <= 2, `${name} -> ${m.text}`);
      assert.ok(m.fontScale >= 0.18 && m.fontScale <= (n <= 1 ? 1.4 : 1) * m.look.radius, `${name}: ${m.fontScale}`);
    }
  }
});

test('non-Latin letters and emoji use the system face; Latin keeps the theme face', () => {
  assert.equal(monogramFontFor('BC', 'script'), 'script');
  assert.equal(monogramFontFor('1P', 'mono'), 'mono');
  assert.equal(monogramFontFor('ÖA', 'serif'), 'serif');
  assert.equal(monogramFontFor('微', 'script'), 'display');
  assert.equal(monogramFontFor('카', 'serif'), 'display');
  assert.equal(monogramFontFor('با', 'serif'), 'display');
  assert.equal(monogramFontFor('🚲', 'rounded'), 'display');
  assert.equal(monogramFontFor('BC', undefined), 'display');
  assert.equal(buildMonogram('微信', '#FFFFFF', ['#000000'], 0.55, null, { ...ART, displayFont: 'script' })?.look?.font, 'display');
});

test('no artwork (the user\'s own style) keeps plain lettering; bad theme colours fall back too', () => {
  assert.equal(buildMonogram('Bike Club', '#FFFFFF', ['#000000'])?.look, undefined);
  assert.equal(buildMonogram('Bike Club', '#FFFFFF', ['#000000'], 0.55, null, null)?.look, undefined);
  const bad = { ...ART, colours: { ...ART.colours, accent: 'nope' } };
  assert.equal(themedMonogram('BC', bad, '#FFFFFF', ['#000000']), null);
  assert.equal(themedMonogram('', ART, '#FFFFFF', ['#000000']), null);
  // The user's own letters still win, with the theme look.
  const m = buildMonogram('Bike Club', '#FFFFFF', ['#000000'], 0.55, 'zz', ART);
  assert.equal(m?.text, 'ZZ');
  assert.ok(m?.look);
});

test('withMonogram (previews) gives the same themed monogram as resolveSpec (install)', () => {
  for (const t of THEMES.slice(0, 6)) {
    const s = resolveSpec({ id: 'custom-a', name: 'Bike Club', urlScheme: null, glyph: 'monogram' }, t.iconStyle);
    const bare = { ...s };
    delete bare.monogram;
    assert.deepEqual(withMonogram(bare).monogram, s.monogram, t.id);
  }
});

test('theme display font survives the icon style round trip (iconArtOf / sanitize)', () => {
  for (const t of THEMES) assert.equal(t.iconStyle.art?.displayFont, t.art.displayFont, t.id);
});
