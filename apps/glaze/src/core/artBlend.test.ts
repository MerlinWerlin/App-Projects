// T251 (owner-1101h #2): widget art blends with the wallpaper. Core decision + pixel maths, the
// constants mirrored in Swift (GlazeArtBlend) and the pack audit (blend-audit.py), and source guards
// that the art paths draw no frame, box, halo, border, shadow or blur panel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLEND_FEATHER_SHARE,
  BLEND_KEY_BG_ALPHA,
  BLEND_KEY_HOLD_HI,
  BLEND_KEY_HOLD_LO,
  BLEND_KEY_RIM_SHARE,
  BLEND_KEY_EDGE_FEATHER_SHARE,
  BLEND_KEY_LO_BASE,
  BLEND_KEY_MAX_SPREAD,
  BLEND_KEY_MIN_UNIFORM,
  BLEND_KEY_NEAR,
  BLEND_KEY_SOFT,
  BLEND_MIN_SUBJECT,
  BLEND_RING_MIN_PX,
  BLEND_RING_SHARE,
  BLEND_TRANSPARENT_SHARE,
  KNOWN_ART_BLEND,
  applyArtBlend,
  chamferDistance,
  heldKeyAlpha,
  keyBackground,
  rgbDistance,
  decideArtBlend,
  featherAlpha,
  featherStops,
  keyAlpha,
  keyThresholds,
  measureArtEdges,
  previewBlend,
  previewBlendFor,
  ringWidth,
  smoothstep,
  unmix,
  type Rgb,
} from './artBlend.ts';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (s: string) => s.replace(/\/\/.*$/gm, '');

/** A w×h straight-RGBA image: `bg` everywhere, `fg` in a centred disc of radius r (a moon). */
function moon(w: number, h: number, bg: [number, number, number, number], fg: [number, number, number, number], r: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) <= r;
      px.set(inside ? fg : bg, (y * w + x) * 4);
    }
  }
  return px;
}

/** Deterministic busy "painting": a gradient with pseudo-random texture to the edges. */
function painting(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      px[i] = (x * 255) / w + rnd() * 60;
      px[i + 1] = (y * 200) / h + rnd() * 60;
      px[i + 2] = 80 + rnd() * 90;
      px[i + 3] = 255;
    }
  }
  return px;
}

test('smoothstep / keyAlpha / featherAlpha: soft, monotone, clamped', () => {
  assert.equal(smoothstep(0, 10, -1), 0);
  assert.equal(smoothstep(0, 10, 11), 1);
  assert.equal(smoothstep(0, 10, 5), 0.5);
  assert.equal(smoothstep(5, 5, 4), 0);
  assert.equal(smoothstep(5, 5, 5), 1);
  const { lo, hi } = keyThresholds(4);
  assert.equal(lo, BLEND_KEY_LO_BASE + 4);
  assert.equal(hi, lo + BLEND_KEY_SOFT);
  assert.equal(keyAlpha(lo, lo, hi), 0);
  assert.equal(keyAlpha(hi, lo, hi), 1);
  let prev = -1;
  for (let d = 0; d <= 120; d += 4) {
    const a = keyAlpha(d, lo, hi);
    assert.ok(a >= prev);
    prev = a;
  }
  assert.ok(featherAlpha(0, 50, 100, 100, 14) < 0.02, 'edge pixel nearly transparent');
  assert.equal(featherAlpha(50, 50, 100, 100, 14), 1, 'centre opaque');
  assert.ok(featherAlpha(7, 50, 100, 100, 14) > 0.3 && featherAlpha(7, 50, 100, 100, 14) < 0.7);
  assert.equal(featherAlpha(0, 0, 100, 100, Number.NaN) >= 0, true);
});

test('unmix removes the key from a half-covered pixel (no dark fringe)', () => {
  const key: Rgb = [0, 0, 0];
  // 50 % of pure red over black reads (128, 0, 0): the foreground is red at full strength.
  assert.deepEqual(unmix([128, 0, 0], key, 0.5), [255, 0, 0]);
  assert.deepEqual(unmix([200, 100, 50], [200, 100, 50], 0.3), [200, 100, 50]);
  assert.deepEqual(unmix([10, 10, 10], key, 0), [0, 0, 0]);
  // Clamped, never out of range.
  for (const v of unmix([255, 0, 255], [0, 255, 0], 0.1)) assert.ok(v >= 0 && v <= 255);
});

test('measureArtEdges: ring, median key, spread, uniform and subject shares', () => {
  const w = 100;
  const h = 100;
  assert.equal(ringWidth(w, h), Math.max(BLEND_RING_MIN_PX, Math.round(100 * BLEND_RING_SHARE)));
  const s = measureArtEdges(moon(w, h, [3, 3, 5, 255], [230, 230, 225, 255], 35), w, h);
  assert.deepEqual(s.key, [3, 3, 5]);
  assert.equal(s.spread, 0);
  assert.equal(s.uniformShare, 1);
  assert.equal(s.transparentShare, 0);
  assert.ok(Math.abs(s.subjectShare - (Math.PI * 35 * 35) / (w * h)) < 0.02);
  const t = measureArtEdges(moon(w, h, [0, 0, 0, 0], [230, 230, 225, 255], 35), w, h);
  assert.equal(t.transparentShare, 1);
  const e = measureArtEdges(new Uint8ClampedArray(0), 0, 0);
  assert.equal(e.transparentShare, 1);
});

test('decideArtBlend: Alpine Starlight moons on black are KEYED (owner-1101h #2)', () => {
  // White full moon on a black square, and the red blood moon on a near-black one.
  for (const fg of [[235, 235, 230, 255], [150, 45, 20, 255]] as [number, number, number, number][]) {
    const s = measureArtEdges(moon(120, 120, [6, 6, 8, 255], fg, 42), 120, 120);
    const d = decideArtBlend(s, [20, 24, 40]);
    assert.equal(d.mode, 'key');
    if (d.mode !== 'key') continue;
    assert.deepEqual(d.key, [6, 6, 8]);
    assert.equal(d.band, BLEND_KEY_EDGE_FEATHER_SHARE);
    assert.ok(d.boxDistance !== null && d.boxDistance > 0);
    assert.equal(previewBlend(d), 'screen');
  }
  // A flat LIGHT background is keyed too (multiply in the preview).
  const light = decideArtBlend(measureArtEdges(moon(120, 120, [244, 240, 232, 255], [40, 60, 120, 255], 40), 120, 120));
  assert.equal(light.mode, 'key');
  assert.equal(previewBlend(light), 'multiply');
});

test('decideArtBlend: transparent edges stay as they are; busy paintings are FEATHERED; subject = background colour feathers', () => {
  assert.deepEqual(decideArtBlend(measureArtEdges(moon(80, 80, [0, 0, 0, 0], [200, 50, 50, 255], 30), 80, 80)), { mode: 'transparent' });
  const busy = decideArtBlend(measureArtEdges(painting(90, 90), 90, 90), null);
  assert.equal(busy.mode, 'feather');
  if (busy.mode === 'feather') {
    assert.equal(busy.band, BLEND_FEATHER_SHARE);
    assert.equal(busy.boxDistance, null);
  }
  assert.equal(previewBlend(busy), 'feather');
  // Plain edge but the "subject" is (almost) the same colour: keying would eat it, so feather.
  const ghost = decideArtBlend(measureArtEdges(moon(100, 100, [10, 10, 10, 255], [14, 12, 10, 255], 40), 100, 100));
  assert.equal(ghost.mode, 'feather');
  // Exactly at the transparent threshold counts as transparent.
  const s = { ...measureArtEdges(painting(40, 40), 40, 40), transparentShare: BLEND_TRANSPARENT_SHARE };
  assert.equal(decideArtBlend(s).mode, 'transparent');
});

test('applyArtBlend: keyed moon has transparent corners, an opaque centre, and no dark fringe', () => {
  const w = 120;
  const src = moon(w, w, [5, 5, 7, 255], [230, 228, 220, 255], 40);
  const d = decideArtBlend(measureArtEdges(src, w, w));
  const out = applyArtBlend(src, w, w, d);
  const at = (x: number, y: number) => Array.from(out.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
  assert.equal(at(0, 0)[3], 0, 'corner keyed out');
  assert.equal(at(10, 60)[3], 0, 'background beside the moon keyed out');
  assert.deepEqual(at(60, 60), [230, 228, 220, 255], 'centre untouched');
  // Every visible pixel keeps the moon colour (un-mixed), never a dark rim.
  for (let i = 0; i < out.length; i += 4) if (out[i + 3] > 8) assert.ok(out[i] > 150, `no dark fringe at ${i / 4}`);
  // A feathered painting: edges transparent, middle opaque, colours untouched.
  const p = painting(100, 100);
  const f = applyArtBlend(p, 100, 100, decideArtBlend(measureArtEdges(p, 100, 100)));
  assert.ok(f[3] < 5);
  const mid = (50 * 100 + 50) * 4;
  assert.equal(f[mid + 3], 255);
  assert.deepEqual(Array.from(f.slice(mid, mid + 3)), Array.from(p.slice(mid, mid + 3)));
  // Transparent decision: a copy, unchanged.
  const t = applyArtBlend(p, 100, 100, { mode: 'transparent' });
  assert.deepEqual(Array.from(t), Array.from(p));
});

test('keyBackground + chamferDistance: only the key region reaching the border is background', () => {
  // 7x7: a ring of t=1 (subject) round a t=0 hole, t=0 outside.
  const w = 7;
  const t = new Float64Array(49);
  for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) if (y === 1 || y === 5 || x === 1 || x === 5) t[y * w + x] = 1;
  const bg = keyBackground(t, w, w);
  assert.equal(bg[0], 1);
  assert.equal(bg[3 * w + 3], 0, 'enclosed hole is not background');
  assert.equal(bg[1 * w + 1], 0, 'subject is not background');
  const d = chamferDistance(bg, w, w);
  assert.equal(d[0], 0);
  assert.equal(d[1 * w + 3], 1);
  assert.ok(Math.abs(d[3 * w + 3] - 3) < 1e-9, 'hole centre 3 px from the outside');
  assert.ok(chamferDistance(new Uint8Array(4), 2, 2).every((v) => v === Infinity));
  // Hold: deep inside, a dim subject pixel is opaque; a pure-key hole stays transparent; near the rim, t.
  assert.equal(heldKeyAlpha(0.4, 50, 20), 1);
  assert.equal(heldKeyAlpha(0, 50, 20), 0);
  assert.equal(heldKeyAlpha(0.4, 2, 20), 0.4);
});

test('applyArtBlend: the blood moon dark limb stays opaque (no stars through it); a dial hole of pure black stays clear', () => {
  const w = 160;
  const src = moon(w, w, [6, 6, 8, 255], [170, 50, 22, 255], 60);
  // A dim (dark red) patch inside the moon, and a pure-black hole in the middle (like a dial centre).
  for (let y = 40; y < 70; y++) for (let x = 60; x < 100; x++) src.set([45, 16, 12, 255], (y * w + x) * 4);
  for (let y = 75; y < 85; y++) for (let x = 75; x < 85; x++) src.set([6, 6, 8, 255], (y * w + x) * 4);
  const d = decideArtBlend(measureArtEdges(src, w, w));
  assert.equal(d.mode, 'key');
  if (d.mode !== 'key') return;
  assert.ok(keyAlpha(rgbDistance([45, 16, 12], d.key), d.lo, d.hi) < 0.9, 'the patch alone would be see-through');
  const out = applyArtBlend(src, w, w, d);
  const a = (x: number, y: number) => out[(y * w + x) * 4 + 3];
  assert.equal(a(80, 55), 255, 'dim patch held opaque');
  assert.deepEqual(Array.from(out.slice((55 * w + 80) * 4, (55 * w + 80) * 4 + 3)), [45, 16, 12], 'its colour untouched');
  assert.equal(a(80, 80), 0, 'enclosed pure-key hole keyed out');
  assert.equal(a(5, 80), 0, 'outside keyed out');
});

test('preview: measured production pieces, bundled heroes transparent, unknown opaque pieces feather', () => {
  for (const id of ['constellation-clock', 'copper-eclipse', 'jupiter-polar', 'saturn-rings', 'silver-moon', 'spiral-galaxy']) {
    assert.equal(previewBlendFor('alpine-starlight', id, false), 'screen', id);
  }
  assert.equal(Object.keys(KNOWN_ART_BLEND).length, 6);
  assert.equal(previewBlendFor('firefly-grove', 'sleeping-fox', false), 'feather');
  assert.equal(previewBlendFor('deep-sea', 'hero-small', true), 'none');
  assert.deepEqual(featherStops(), [0, BLEND_FEATHER_SHARE, 1 - BLEND_FEATHER_SHARE, 1]);
  assert.deepEqual(featherStops(0.9), [0, 0.5, 0.5, 1]);
});

test('constants mirrored in GlazeArtBlend (Swift) and blend-audit.py', () => {
  const swift = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  const py = read('scripts', 'packs', 'blend-audit.py');
  const pairs: [string, string, number][] = [
    ['ringShare', 'BLEND_RING_SHARE', BLEND_RING_SHARE],
    ['ringMinPx', 'BLEND_RING_MIN_PX', BLEND_RING_MIN_PX],
    ['transparentShare', 'BLEND_TRANSPARENT_SHARE', BLEND_TRANSPARENT_SHARE],
    ['keyNear', 'BLEND_KEY_NEAR', BLEND_KEY_NEAR],
    ['keyMinUniform', 'BLEND_KEY_MIN_UNIFORM', BLEND_KEY_MIN_UNIFORM],
    ['keyMaxSpread', 'BLEND_KEY_MAX_SPREAD', BLEND_KEY_MAX_SPREAD],
    ['keyLoBase', 'BLEND_KEY_LO_BASE', BLEND_KEY_LO_BASE],
    ['keySoft', 'BLEND_KEY_SOFT', BLEND_KEY_SOFT],
    ['minSubject', 'BLEND_MIN_SUBJECT', BLEND_MIN_SUBJECT],
    ['featherShare', 'BLEND_FEATHER_SHARE', BLEND_FEATHER_SHARE],
    ['keyEdgeFeatherShare', 'BLEND_KEY_EDGE_FEATHER_SHARE', BLEND_KEY_EDGE_FEATHER_SHARE],
    ['keyBgAlpha', 'BLEND_KEY_BG_ALPHA', BLEND_KEY_BG_ALPHA],
    ['keyRimShare', 'BLEND_KEY_RIM_SHARE', BLEND_KEY_RIM_SHARE],
    ['keyHoldLo', 'BLEND_KEY_HOLD_LO', BLEND_KEY_HOLD_LO],
    ['keyHoldHi', 'BLEND_KEY_HOLD_HI', BLEND_KEY_HOLD_HI],
  ];
  for (const [sw, pyName, v] of pairs) {
    const ms = swift.match(new RegExp(`static let ${sw}: (?:Double|Int) = ([0-9.]+)`));
    assert.ok(ms, `Swift ${sw}`);
    assert.equal(Number(ms[1]), v, `Swift ${sw}`);
    const mp = py.match(new RegExp(`^${pyName} = ([0-9.]+)`, 'm'));
    assert.ok(mp, `python ${pyName}`);
    assert.equal(Number(mp[1]), v, `python ${pyName}`);
  }
  // Same decision shape in all three.
  assert.match(swift, /spread <= keyMaxSpread && uniform >= keyMinUniform && subjectShare >= minSubject/);
  assert.match(py, /stats\['spread'\] <= BLEND_KEY_MAX_SPREAD and stats\['uniformShare'\] >= BLEND_KEY_MIN_UNIFORM and stats\['subjectShare'\] >= BLEND_MIN_SUBJECT/);
  // Swift un-mixes, holds the interior and feathers like applyArtBlend.
  assert.match(swift, /key\.0 \+ \(c\.0 - key\.0\) \/ t/);
  assert.match(swift, /a \*= smoothstep\(0, band, e\)/);
  assert.match(swift, /smoothstep\(rim \* 0\.5, rim, toBg\[y \* w \+ x\] \/ 3\) \* smoothstep\(keyHoldLo, keyHoldHi, raw\)/);
  assert.match(swift, /v = min\(v, toBg\[i - w - 1\] \+ 4\)/, 'chamfer 3-4');
  assert.match(py, /smoothstep\(rim \* 0\.5, rim, to_bg\) \* smoothstep\(BLEND_KEY_HOLD_LO, BLEND_KEY_HOLD_HI, t\)/);
});

test('guard: Swift art paths draw no border, shadow, blur, material panel or outline (no frame, no box, no halo)', () => {
  const widget = strip(read('targets', 'widget', 'SeamlessWidget.swift'));
  const view = widget.slice(widget.indexOf('struct SeamlessWidgetView'), widget.indexOf('struct SeamlessWidget: Widget'));
  assert.ok(view.length > 500);
  // The art background (containerBackground with an image) and the ArtBackdrop.
  const art = view.slice(view.indexOf('.containerBackground(for: .widget)'), view.indexOf('} else {\n        GlazeBackground'));
  assert.ok(art.length > 200, 'art background found');
  for (const bad of [/\.border\(/, /\.shadow\(/, /\.blur\(/, /strokeBorder/, /\.stroke\(/, /Material/, /GlazeBackground/, /\.opacity\(/, /\.padding\(inset\)[\s\S]*\.background\(/]) {
    assert.doesNotMatch(art, bad, `art path: ${bad}`);
  }
  const backdrop = view.slice(view.indexOf('struct ArtBackdrop'));
  assert.match(backdrop, /LinearGradient\(colors: theme\.backgroundColors/);
  assert.doesNotMatch(backdrop, /Material|stroke|blur|shadow|border/);
  // The bridge composes art with no blurred copy, veil or inset frame.
  const bridge = strip(read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift'));
  // T252 merge: the drawing lives in shared helpers (also used by the library compose calls).
  const artHelper = bridge.slice(bridge.indexOf('private static func composeArtImage('), bridge.indexOf('private static func reloadWidgets()'));
  const seamHelper = bridge.slice(bridge.indexOf('private static func composeSeamlessImage('), bridge.indexOf('private static func composeArtImage('));
  const setArt = bridge.slice(bridge.indexOf('AsyncFunction("setWidgetArt")'), bridge.indexOf('AsyncFunction("linkStatus")'));
  assert.doesNotMatch(setArt + artHelper, /CIGaussianBlur|clampedToExtent|withAlphaComponent|insetBy|shadow|stroke/);
  assert.match(setArt, /GlazeArtBlend\.blended\(/);
  const piece = bridge.slice(bridge.indexOf('AsyncFunction("composeWidgetArtPiece")'), bridge.indexOf('AsyncFunction("composeSeamlessPiece")'));
  assert.match(piece, /GlazeArtBlend\.blended\(/, 'library pieces blend the same way');
  const setSeam = bridge.slice(bridge.indexOf('AsyncFunction("setSeamless")'), bridge.indexOf('AsyncFunction("setWidgetArt")')) + seamHelper;
  assert.match(seamHelper, /GlazeArtBlend\.blended\(/);
  assert.doesNotMatch(setSeam, /CIGaussianBlur|shadow|stroke/);
});

test('guard: in-app preview blends art on the wallpaper crop, never on a blurred copy or a box', () => {
  const menu = read('src', 'ui', 'WidgetArtMenu.tsx');
  assert.doesNotMatch(strip(menu), /blurRadius|blurBackdrop\(|shadow|borderWidth: 1/);
  assert.match(menu, /const wall = wallpaper \? wallpaperUnderSlot\(/, 'every option over the wallpaper crop when there is one');
  const blended = read('src', 'ui', 'BlendedArt.tsx');
  assert.match(blended, /mixBlendMode: 'screen'/);
  assert.match(blended, /mixBlendMode: 'multiply'/);
  assert.match(blended, /<Mask id=/);
  assert.doesNotMatch(strip(blended), /blurRadius|shadow|borderWidth/);
  const art = read('src', 'ui', 'ThemeWidgetArt.tsx');
  assert.match(art, /themeId=\{theme\.id\}/);
  assert.match(art, /artTransparent=\{!remoteTheme\}/);
});
