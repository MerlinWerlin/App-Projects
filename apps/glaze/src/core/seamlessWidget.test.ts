// T131: seamless widget maths (src/core/seamlessWidget.ts) plus source guards for the native
// pieces (bridge setSeamless, SeamlessWidget.swift, the JS adapter's no-op path).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MAX_NUDGE_PT,
  SEAMLESS_DEVICES,
  SEAMLESS_MAX_EDGE_PX,
  SEAMLESS_SIZES,
  SEAMLESS_TABLE_NOTE,
  SEAMLESS_WIDGET_KIND,
  clampNudge,
  clampRect,
  deviceById,
  heroRect,
  lookupDevice,
  normaliseSlot,
  screenToWallpaper,
  seamlessCrop,
  seamlessFileName,
  slotsFor,
  stepNudge,
  wallpaperFill,
  wallpaperToScreen,
  widgetScreenRect,
  widgetTableRect,
  type SeamlessDevice,
} from './seamlessWidget.ts';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const dev = (id: string): SeamlessDevice => {
  const d = deviceById(id);
  assert.ok(d, `device ${id}`);
  return d;
};

test('device table: every row is self-consistent and generic', () => {
  assert.match(SEAMLESS_TABLE_NOTE, /verify on device/);
  const ids = new Set<string>();
  for (const d of SEAMLESS_DEVICES) {
    assert.ok(!ids.has(d.id), `duplicate ${d.id}`);
    ids.add(d.id);
    assert.equal(d.id, String(d.px.h));
    assert.match(d.label, /^\d\.\d-inch \d{4}$/, 'generic label, no product names');
    assert.equal(d.px.w < d.px.h, true);
    // Columns and rows keep every widget on the screen.
    assert.ok(d.right + d.small <= d.px.w, `${d.id} right column fits`);
    assert.ok(d.left + d.medium.w <= d.px.w, `${d.id} medium fits`);
    assert.ok(d.bottom + d.small <= d.px.h, `${d.id} bottom row fits`);
    assert.ok(d.middle + d.large.h <= d.px.h, `${d.id} large at bottom fits`);
    assert.ok(d.left < d.right && d.top < d.middle && d.middle < d.bottom);
    assert.equal(d.medium.h, d.small);
    assert.equal(d.large.w, d.medium.w);
    // Points × scale is the pixel size except where iOS downsamples (5.4-inch).
    if (d.id !== '2340') {
      assert.equal(d.pt.w * d.scale, d.px.w, `${d.id} width`);
      assert.equal(d.pt.h * d.scale, d.px.h, `${d.id} height`);
    }
  }
  for (const id of ['2868', '2796', '2778', '2688', '2622', '2556', '2532', '2436', '2340', '1792', '1334']) assert.ok(ids.has(id), id);
  assert.deepEqual(SEAMLESS_DEVICES.filter((d) => d.estimated).map((d) => d.id).sort(), ['2622', '2868']);
});

test('measured values for the 6.7-inch 2796 row', () => {
  const d = dev('2796');
  assert.deepEqual(
    [d.small, d.medium.w, d.medium.h, d.large.w, d.large.h, d.left, d.right, d.top, d.middle, d.bottom],
    [510, 1092, 510, 1092, 1146, 99, 681, 282, 918, 1554],
  );
  const e = dev('1334');
  assert.deepEqual([e.small, e.medium.w, e.large.h, e.left, e.right, e.top, e.middle, e.bottom], [296, 642, 648, 54, 400, 60, 412, 764]);
});

test('slots per size and fallback', () => {
  assert.equal(slotsFor('small').length, 6);
  assert.deepEqual(slotsFor('medium'), ['top', 'middle', 'bottom']);
  assert.deepEqual(slotsFor('large'), ['top', 'bottom']);
  assert.equal(normaliseSlot('large', 'middle'), 'top');
  assert.equal(normaliseSlot('small', 'top'), 'top-left');
  assert.equal(normaliseSlot('medium', 'bottom'), 'bottom');
  assert.equal(normaliseSlot('small', undefined), 'top-left');
  assert.deepEqual([...SEAMLESS_SIZES], ['small', 'medium', 'large']);
});

test('table rects for each size and slot', () => {
  const d = dev('2796');
  assert.deepEqual(widgetTableRect(d, 'small', 'top-left'), { x: 99, y: 282, w: 510, h: 510 });
  assert.deepEqual(widgetTableRect(d, 'small', 'middle-right'), { x: 681, y: 918, w: 510, h: 510 });
  assert.deepEqual(widgetTableRect(d, 'small', 'bottom-right'), { x: 681, y: 1554, w: 510, h: 510 });
  assert.deepEqual(widgetTableRect(d, 'medium', 'middle'), { x: 99, y: 918, w: 1092, h: 510 });
  assert.deepEqual(widgetTableRect(d, 'medium', 'bottom'), { x: 99, y: 1554, w: 1092, h: 510 });
  assert.deepEqual(widgetTableRect(d, 'large', 'top'), { x: 99, y: 282, w: 1092, h: 1146 });
  assert.deepEqual(widgetTableRect(d, 'large', 'bottom'), { x: 99, y: 918, w: 1092, h: 1146 });
  // Invalid slot for the size → the first slot.
  assert.deepEqual(widgetTableRect(d, 'large', 'middle'), widgetTableRect(d, 'large', 'top'));
});

test('exact crop on the native 1290 x 2796 device equals the table rect', () => {
  const d = dev('2796');
  for (const size of SEAMLESS_SIZES) {
    for (const slot of slotsFor(size)) {
      const c = seamlessCrop({ device: d, wallpaper: { w: 1290, h: 2796 }, size, slot });
      assert.deepEqual(c.cropPx, widgetTableRect(d, size, slot), `${size} ${slot}`);
      assert.equal(c.fill.scale, 1);
      assert.equal(c.fill.offsetX, 0);
      assert.equal(c.fill.offsetY, 0);
      assert.equal(c.clamped, false);
    }
  }
});

test('aspect fill: the same art on a different device', () => {
  // A 1290 x 2796 wallpaper on the 6.1-inch 2556 screen (1179 wide): scale = max(1179/1290, 2556/2796).
  const d = dev('2556');
  const fill = wallpaperFill({ w: 1290, h: 2796 }, d.px);
  const s = Math.max(1179 / 1290, 2556 / 2796);
  assert.ok(Math.abs(fill.scale - s) < 1e-12);
  // Width-bound (1179/1290 = 0.91395 > 2556/2796 = 0.91416? no: height-bound); check both offsets.
  assert.ok(fill.offsetX <= 0.0001 && fill.offsetY <= 0.0001);
  assert.ok(Math.abs(fill.offsetX) < 1 || Math.abs(fill.offsetY) < 1, 'one axis fits exactly');
  const c = seamlessCrop({ device: d, wallpaper: { w: 1290, h: 2796 }, size: 'small', slot: 'top-left' });
  const want = { x: (82 - fill.offsetX) / s, y: (270 - fill.offsetY) / s, w: 474 / s, h: 474 / s };
  assert.ok(Math.abs(c.cropPx.x - want.x) <= 0.5 && Math.abs(c.cropPx.y - want.y) <= 0.5);
  assert.ok(Math.abs(c.cropPx.w - want.w) <= 0.5 && Math.abs(c.cropPx.h - want.h) <= 0.5);
  // Mapping back lands on the widget within a pixel.
  const back = wallpaperToScreen(c.cropPx, fill);
  assert.ok(Math.abs(back.x - 82) < 1.5 && Math.abs(back.y - 270) < 1.5 && Math.abs(back.w - 474) < 1.5);
});

test('aspect fill: a wide wallpaper is cropped at the sides, centred', () => {
  const d = dev('2796');
  // Square 2000 x 2000 art: scale = max(1290/2000, 2796/2000) = 1.398, overflows horizontally.
  const fill = wallpaperFill({ w: 2000, h: 2000 }, d.px);
  assert.equal(fill.scale, 1.398);
  assert.equal(fill.offsetY, 0);
  assert.ok(Math.abs(fill.offsetX - (1290 - 2796) / 2) < 1e-9);
  const c = seamlessCrop({ device: d, wallpaper: { w: 2000, h: 2000 }, size: 'medium', slot: 'top' });
  const raw = screenToWallpaper(widgetTableRect(d, 'medium', 'top'), fill);
  assert.deepEqual(c.cropPx, { x: Math.round(raw.x), y: Math.round(raw.y), w: Math.round(raw.w), h: Math.round(raw.h) });
  // Centred: the left and right margins of the visible band are equal.
  const visibleLeft = -fill.offsetX / fill.scale;
  assert.ok(Math.abs(visibleLeft - (2000 - 1290 / 1.398) / 2) < 1e-6);
  // A half-size wallpaper (645 x 1398) gives a half-size crop.
  const half = seamlessCrop({ device: d, wallpaper: { w: 645, h: 1398 }, size: 'small', slot: 'bottom-right' });
  assert.deepEqual(half.cropPx, { x: Math.round(681 / 2), y: 777, w: 255, h: 255 });
});

test('nudge: points × scale, clamped to ±40 pt', () => {
  const d = dev('2796');
  assert.deepEqual(widgetScreenRect(d, 'small', 'top-left', { dx: 2, dy: -1 }), { x: 105, y: 279, w: 510, h: 510 });
  const c = seamlessCrop({ device: d, wallpaper: { w: 1290, h: 2796 }, size: 'small', slot: 'top-left', nudge: { dx: 5, dy: 5 } });
  assert.deepEqual(c.cropPx, { x: 114, y: 297, w: 510, h: 510 });
  assert.deepEqual(clampNudge({ dx: 100, dy: -100 }), { dx: MAX_NUDGE_PT, dy: -MAX_NUDGE_PT });
  assert.deepEqual(clampNudge({ dx: Number.NaN }), { dx: 0, dy: 0 });
  assert.deepEqual(clampNudge(null), { dx: 0, dy: 0 });
  const far = seamlessCrop({ device: d, wallpaper: { w: 1290, h: 2796 }, size: 'small', slot: 'top-left', nudge: { dx: 999, dy: 0 } });
  assert.deepEqual(far.nudge, { dx: 40, dy: 0 });
  assert.equal(far.cropPx.x, 99 + 120);
  // A 2x device moves 2 px per point.
  assert.equal(widgetScreenRect(dev('1792'), 'small', 'top-left', { dx: 3, dy: 0 }).x, 54 + 6);
  // Arrow steps.
  let n = { dx: 0, dy: 0 };
  n = stepNudge(n, 'right', 5);
  n = stepNudge(n, 'up', 1);
  assert.deepEqual(n, { dx: 5, dy: -1 });
  for (let i = 0; i < 20; i++) n = stepNudge(n, 'left', 5);
  assert.deepEqual(n, { dx: -40, dy: -1 });
  assert.deepEqual(stepNudge(n, 'down', -1), { dx: -40, dy: 0 });
});

test('clamping keeps the crop inside the wallpaper', () => {
  const d = dev('1334');
  // Nudged up past the top of the screen: y clamps to 0, size kept.
  const c = seamlessCrop({ device: d, wallpaper: { w: 750, h: 1334 }, size: 'small', slot: 'top-left', nudge: { dx: -40, dy: -40 } });
  assert.equal(c.cropPx.y, 0);
  assert.equal(c.cropPx.x, 0);
  assert.equal(c.cropPx.w, 296);
  assert.equal(c.clamped, true);
  // Bottom-right pushed off the edge.
  const e = seamlessCrop({ device: dev('2796'), wallpaper: { w: 1290, h: 2796 }, size: 'small', slot: 'bottom-right', nudge: { dx: 40, dy: 40 } });
  assert.equal(e.cropPx.x + e.cropPx.w <= 1290, true);
  assert.equal(e.cropPx.x, 1290 - 510);
  assert.equal(e.clamped, true);
  // clampRect: larger than the bounds shrinks; fractional values round.
  assert.deepEqual(clampRect({ x: -5, y: 10.4, w: 2000, h: 50.6 }, { w: 100, h: 100 }), { x: 0, y: 10, w: 100, h: 51 });
  assert.deepEqual(clampRect({ x: 90, y: 90, w: 20, h: 20 }, { w: 100, h: 100 }), { x: 80, y: 80, w: 20, h: 20 });
});

test('device lookup: exact, orientation, nearest match, garbage', () => {
  assert.equal(lookupDevice({ width: 430, height: 932, scale: 3 }).device.id, '2796');
  assert.equal(lookupDevice({ width: 932, height: 430, scale: 3 }).device.id, '2796', 'landscape');
  assert.equal(lookupDevice({ width: 430, height: 932, scale: 3 }).exact, true);
  // Same points, different scale.
  assert.equal(lookupDevice({ width: 414, height: 896, scale: 3 }).device.id, '2688');
  assert.equal(lookupDevice({ width: 414, height: 896, scale: 2 }).device.id, '1792');
  // 5.4-inch reports 2436's points; the native pixel size picks it.
  assert.equal(lookupDevice({ width: 375, height: 812, scale: 3 }).device.id, '2436');
  assert.equal(lookupDevice({ width: 375, height: 812, scale: 3 }, { width: 1080, height: 2340 }).device.id, '2340');
  assert.equal(lookupDevice(null, { width: 2796, height: 1290 }).device.id, '2796');
  // Estimated rows still match exactly when nothing measured does.
  assert.equal(lookupDevice({ width: 402, height: 874, scale: 3 }).device.id, '2622');
  assert.equal(lookupDevice({ width: 440, height: 956, scale: 3 }).device.id, '2868');
  // Unknown device → nearest by pixel size, flagged inexact.
  const u = lookupDevice({ width: 431, height: 935, scale: 3 });
  assert.equal(u.exact, false);
  assert.equal(u.device.id, '2796');
  const v = lookupDevice({ width: 380, height: 700, scale: 2 });
  assert.equal(v.device.id, '1334');
  // A tablet-sized screen still gets a phone row, never null.
  assert.ok(lookupDevice({ width: 820, height: 1180, scale: 2 }).device);
  assert.equal(lookupDevice(undefined).device.id, '2796');
  assert.equal(lookupDevice({ width: Number.NaN, height: 0, scale: 3 }).device.id, '2796');
  assert.equal(lookupDevice({ width: 393, height: 852, scale: 0 }).device.id, '2556', 'bad scale treated as 3');
});

test('hero placement: contained, centred, padded', () => {
  const r = heroRect({ w: 510, h: 510 }, { w: 1000, h: 1000 }, 0.1);
  assert.deepEqual(r, { x: 51, y: 51, w: 408, h: 408 });
  const m = heroRect({ w: 1092, h: 510 }, { w: 1000, h: 1000 }, 0);
  assert.deepEqual(m, { x: (1092 - 510) / 2, y: 0, w: 510, h: 510 });
  const wide = heroRect({ w: 510, h: 510 }, { w: 2000, h: 1000 }, 0);
  assert.deepEqual(wide, { x: 0, y: 127.5, w: 510, h: 255 });
  // Padding is capped at 40 % of the short side; bad input never throws or goes negative.
  const capped = heroRect({ w: 100, h: 100 }, { w: 1, h: 1 }, 5);
  assert.deepEqual(capped, { x: 40, y: 40, w: 20, h: 20 });
  const bad = heroRect({ w: Number.NaN, h: 100 }, { w: 0, h: -1 });
  assert.ok(bad.w >= 0 && bad.h >= 0);
});

test('file names, kind and edge cap', () => {
  assert.equal(seamlessFileName('small'), 'seamless-small.png');
  assert.equal(seamlessFileName('large'), 'seamless-large.png');
  assert.equal(SEAMLESS_WIDGET_KIND, 'GlazeSeamless');
  assert.equal(SEAMLESS_MAX_EDGE_PX, 1200);
});

// ---------------------------------------------------------------- source guards (Swift + adapter)

test('Swift: SeamlessWidget.swift exists, kind GlazeSeamless, edge to edge, registered', () => {
  const p = 'targets/widget/SeamlessWidget.swift';
  assert.ok(existsSync(join(ROOT, p)));
  const src = read(p);
  assert.match(src, /let kind = "GlazeSeamless"/);
  assert.match(src, /\.contentMarginsDisabled\(\)/);
  assert.match(src, /\.containerBackground\(for: \.widget\)/);
  assert.match(src, /\.supportedFamilies\(\[\.systemSmall, \.systemMedium, \.systemLarge\]\)/);
  assert.match(src, /"seamless-\\\(/, 'file name built from the family (seamless-<family>.png)');
  for (const f of ['"small"', '"medium"', '"large"']) assert.ok(src.includes(f), `family name ${f}`);
  assert.match(src, /GlazeBackground\(theme:/, 'falls back to the theme background');
  assert.match(src, /@Environment\(\\\.widgetFamily\)/);
  const bundle = read('targets/widget/GlazeWidgetsBundle.swift');
  assert.match(bundle, /^\s*SeamlessWidget\(\)\s*$/m);
});

test('Swift bridge: setSeamless crops, composes, caps and reloads GlazeSeamless', () => {
  const src = read('modules/glaze-widget-bridge/ios/GlazeWidgetBridgeModule.swift');
  assert.match(src, /AsyncFunction\("setSeamless"\)/);
  assert.match(src, /\.cropping\(to:/);
  assert.match(src, /UIGraphicsImageRenderer/);
  assert.match(src, /reloadTimelines\(ofKind: "GlazeSeamless"\)/);
  assert.match(src, /"seamless-\\\(/);
  assert.match(src, /longest > 1200 \? 1200 \/ longest : 1/);
  assert.match(src, /reloadTimelines\(ofKind: "GlazeSeamless"\)\s*\n\s*\}\s*\n\s*return true/);
  assert.match(src, /pngData\(\)/);
  // Families accepted are exactly small / medium / large.
  assert.match(src, /\["small", "medium", "large"\]\.contains\(family\)/);
});

test('adapter: setSeamless is a no-op { available: false } without the bridge', () => {
  const src = read('src/native/widgets.ts');
  assert.match(src, /setSeamless\(input: SeamlessInput\): Promise<WidgetsResult>/);
  assert.match(src, /setSeamless\?\(\s*wallpaperUri: string/);
  // Older bridge without the function → not-built, never a throw.
  assert.match(src, /typeof mod\.setSeamless !== 'function'\) return \{ available: false, ok: false, reason: 'not-built' \}/);
  assert.match(src, /validSeamlessInput/);
  // Expo Go never loads the native module (isExpoGo checked before loadNative in isAvailable).
  assert.match(src, /if \(isExpoGo\(\)\) return \{ available: false, reason: 'expo-go' \}/);
});

test('UI: preview and controls exist and use only Expo Go libraries', () => {
  // expo-image ships in Expo Go and is the app's image view (T166, perfBudget.test.ts).
  const allowed = /^(react|react-native|expo-image|@expo\/vector-icons|\.{1,2}\/.*)$/;
  for (const f of ['src/ui/SeamlessWidgetPreview.tsx', 'src/ui/SeamlessWidgetControls.tsx']) {
    const src = read(f);
    for (const m of src.matchAll(/from '([^']+)'/g)) assert.match(m[1], allowed, `${f} imports ${m[1]}`);
    assert.doesNotMatch(src, /native\/widgets/, `${f} stays preview-only`);
  }
  const controls = read('src/ui/SeamlessWidgetControls.tsx');
  assert.match(controls, /<Segmented\b/);
  assert.match(controls, /sizeV2\.touch/);
  assert.match(controls, /accessibilityLabel=/);
});
