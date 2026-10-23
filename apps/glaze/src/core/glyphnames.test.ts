import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FEATHER_GLYPHS,
  FEATHER_BRAND_GLYPHS,
  INHOUSE_GLYPHS,
  INHOUSE_SET,
  FALLBACK_GLYPH,
  resolveGlyph,
  isKnownGlyph,
  allGlyphNames,
} from './glyphnames.ts';
import { CATALOGUE, GLYPHS } from './catalogue.ts';
// Pure data module (no React Native imports), checked here so `npm test` covers it.
import { INHOUSE_GLYPH_PATHS, INHOUSE_VIEWBOX, inhouseGlyph } from '../render/inhouse.ts';

test('every catalogue glyph resolves to a real (non-fallback) glyph', () => {
  for (const g of GLYPHS) {
    assert.ok(isKnownGlyph(g), `catalogue glyph "${g}" is not a known Feather or in-house glyph`);
    assert.equal(resolveGlyph(g).fallback, false, g);
  }
  for (const e of CATALOGUE) assert.equal(resolveGlyph(e.glyph).name, e.glyph);
});

test('no brand-logo glyphs are selectable or used by the catalogue', () => {
  for (const b of FEATHER_BRAND_GLYPHS) {
    assert.ok(!FEATHER_GLYPHS.includes(b), b);
    assert.ok(!INHOUSE_GLYPHS.includes(b), b);
    assert.ok(!GLYPHS.includes(b), b);
    const r = resolveGlyph(b);
    assert.equal(r.fallback, true);
    assert.equal(r.name, FALLBACK_GLYPH);
  }
});

test('name lists are unique, sorted, kebab-case and disjoint', () => {
  for (const list of [FEATHER_GLYPHS, INHOUSE_GLYPHS, FEATHER_BRAND_GLYPHS]) {
    assert.equal(new Set(list).size, list.length);
    assert.deepEqual([...list], [...list].sort());
    for (const n of list) assert.match(n, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  }
  for (const n of INHOUSE_GLYPHS) assert.ok(!FEATHER_GLYPHS.includes(n), `${n} duplicates Feather`);
  assert.ok(FEATHER_GLYPHS.includes(FALLBACK_GLYPH));
  assert.equal(allGlyphNames().length, FEATHER_GLYPHS.length + INHOUSE_GLYPHS.length);
});

test('resolveGlyph never throws and picks the right source', () => {
  assert.deepEqual(resolveGlyph('camera'), { source: 'feather', name: 'camera', fallback: false });
  assert.deepEqual(resolveGlyph('pizza'), { source: 'inhouse', name: 'pizza', fallback: false });
  assert.deepEqual(resolveGlyph('pizza', INHOUSE_SET), { source: 'inhouse', name: 'pizza', fallback: false });
  assert.deepEqual(resolveGlyph('  Camera '), { source: 'feather', name: 'camera', fallback: false });
  for (const bad of ['', 'nope', null, undefined, '__proto__', 'constructor']) {
    assert.deepEqual(resolveGlyph(bad), { source: 'feather', name: 'square', fallback: true });
  }
});

test('in-house glyph data matches the name list and is valid 24×24 path data', () => {
  assert.deepEqual(Object.keys(INHOUSE_GLYPH_PATHS).sort(), [...INHOUSE_GLYPHS]);
  assert.equal(INHOUSE_VIEWBOX, 24);
  assert.equal(inhouseGlyph('constructor'), null);
  for (const name of INHOUSE_GLYPHS) {
    const g = inhouseGlyph(name);
    assert.ok(g, name);
    const paths = [...g.strokes, ...(g.dots ?? [])];
    assert.ok(g.strokes.length > 0);
    for (const d of paths) {
      assert.match(d, /^M/, `${name}: ${d}`);
      assert.match(d, /^[MmLlHhVvCcSsAaZz0-9 .,\-]+$/, `${name}: ${d}`);
      const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      for (const n of nums) assert.ok(Number.isFinite(n) && n >= -24 && n <= 24, `${name}: ${n}`);
    }
  }
});
