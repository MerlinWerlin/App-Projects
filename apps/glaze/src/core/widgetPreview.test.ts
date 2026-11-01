// T207 / T208: menu preview maths (native parity), stable menu names, caption layout, and the
// source wiring in WidgetArtMenu / ThemeWidgetArt / the theme page Seamless card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seamlessCrop, deviceById, normaliseSlot } from './seamlessWidget.ts';
import { FILL_ASPECT_TOLERANCE, OPTION_SIZE_POINTS, parseWidgetOptions, widgetOptionsFromV1 } from './widgetOptions.ts';
import {
  NATIVE_BLUR_MIN_RADIUS,
  NATIVE_BLUR_RADIUS_SHARE,
  NATIVE_BLUR_VEIL_ALPHA,
  NATIVE_FILL_MIN_ASPECT_MATCH,
  blurBackdrop,
  coverRect,
  menuCaptionLayout,
  nativeBlurRadiusPx,
  optionMenuName,
  remoteHeroPx,
  stableArtNumbers,
  wallpaperUnderSlot,
} from './widgetPreview.ts';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('native blur constants match GlazeWidgetBridgeModule.setWidgetArt', () => {
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  assert.match(bridge, /CIGaussianBlur/);
  assert.match(bridge, /max\(12, min\(input\.extent\.width, input\.extent\.height\) \* 0\.06\)/);
  assert.match(bridge, /base\.withAlphaComponent\(0\.25\)\.setFill\(\)/);
  assert.equal(NATIVE_BLUR_MIN_RADIUS, 12);
  assert.equal(NATIVE_BLUR_RADIUS_SHARE, 0.06);
  assert.equal(NATIVE_BLUR_VEIL_ALPHA, 0.25);
});

test('nativeBlurRadiusPx: max(12, 6 % of the short side)', () => {
  assert.equal(nativeBlurRadiusPx({ w: 1000, h: 500 }), 30);
  assert.equal(nativeBlurRadiusPx({ w: 100, h: 100 }), 12);
  assert.equal(nativeBlurRadiusPx({ w: 0, h: Number.NaN }), 12);
});

test('coverRect: aspect-fill, centred', () => {
  const r = coverRect({ w: 100, h: 50 }, { w: 50, h: 50 });
  assert.deepEqual(r, { x: -25, y: 0, w: 100, h: 50, scale: 1 });
  const s = coverRect({ w: 510, h: 510 }, { w: 364, h: 170 });
  close(s.w, 364);
  close(s.y, (170 - 364) / 2);
});

test('blurBackdrop: native radius scaled with the art; 25 % veil', () => {
  const art = { w: 1092, h: 1146 };
  const box = { w: 150, h: 150 };
  const b = blurBackdrop(art, box);
  const scale = 150 / 1092;
  close(b.radius, Math.round(1092 * 0.06 * scale * 100) / 100, 0.01);
  close(b.radius, 9, 0.01); // 6 % of the short side of the box the art covers
  assert.equal(b.veil, 0.25);
  close(b.rect.w, 150);
  assert.ok(b.rect.h >= 150);
  // A tiny piece: the 12 px floor, scaled.
  const tiny = blurBackdrop({ w: 100, h: 100 }, { w: 200, h: 200 });
  assert.equal(tiny.radius, 24);
});

test('wallpaperUnderSlot: only the seamless crop shows in the box', () => {
  const device = deviceById('2796')!;
  const wall = { w: 1290, h: 2796 };
  for (const size of ['small', 'medium', 'large'] as const) {
    const crop = seamlessCrop({ device, wallpaper: wall, size, slot: normaliseSlot(size, null), nudge: { dx: 0, dy: 0 } }).cropPx;
    const box = { w: OPTION_SIZE_POINTS[size].w / 2, h: OPTION_SIZE_POINTS[size].h / 2 };
    const r = wallpaperUnderSlot(wall, crop, box);
    const s = r.w / wall.w;
    close(r.h / wall.h, s);
    // The crop's corners land on (or just past, for rounding) the box's corners.
    const x0 = r.x + crop.x * s;
    const y0 = r.y + crop.y * s;
    const x1 = x0 + crop.w * s;
    const y1 = y0 + crop.h * s;
    assert.ok(x0 <= 0.001 && y0 <= 0.001, `${size}: crop starts at the box origin`);
    assert.ok(x1 >= box.w - 0.001 && y1 >= box.h - 0.001, `${size}: crop covers the box`);
    assert.ok(Math.abs(x0 + x1 - box.w) < 0.01 && Math.abs(y0 + y1 - box.h) < 0.01, `${size}: centred`);
    // Far bigger than the box: the whole wallpaper is NOT squeezed into the card.
    assert.ok(r.h > box.h * 2);
  }
  // Exact numbers for a simple case.
  assert.deepEqual(wallpaperUnderSlot({ w: 1000, h: 2000 }, { x: 100, y: 200, w: 300, h: 300 }, { w: 150, h: 150 }), { x: -50, y: -100, w: 500, h: 1000 });
});

test('T207 stableArtNumbers: one number per unlabelled piece, the same in every size', () => {
  const assets = [
    { path: 's.png', role: 'widget-small', width: 510, height: 510 },
    { path: 'm.png', role: 'widget-medium', width: 1092, height: 510 },
    { path: 'l.png', role: 'widget-large', width: 1092, height: 1146 },
  ];
  const opts = widgetOptionsFromV1(assets);
  const n = stableArtNumbers(opts);
  assert.deepEqual([...n.entries()], [
    ['hero-small', 1],
    ['hero-medium', 2],
    ['hero-large', 3],
  ]);
  const named = (o: (typeof opts)[number]) => optionMenuName(o, n, (k) => `Art ${k}`);
  assert.deepEqual(opts.map(named), ['Art 1', 'Art 2', 'Art 3']);
  // Labelled options keep their label and take no number.
  const mixed = stableArtNumbers([
    { id: 'a', label: 'Fox' },
    { id: 'b', label: null },
    { id: 'c', label: null },
  ]);
  assert.deepEqual([...mixed.entries()], [
    ['b', 1],
    ['c', 2],
  ]);
  assert.equal(optionMenuName({ id: 'a', label: 'Fox' }, mixed, (k) => `Art ${k}`), 'Fox');
});

test('T207 menuCaptionLayout: small cards stack the Live badge under a two-line name', () => {
  assert.deepEqual(menuCaptionLayout('small'), { stacked: true, nameLines: 2 });
  assert.deepEqual(menuCaptionLayout('medium'), { stacked: false, nameLines: 1 });
  assert.deepEqual(menuCaptionLayout('large'), { stacked: false, nameLines: 1 });
});

test('T208 remoteHeroPx: the real size of the piece each size shows', () => {
  const assets = [
    { path: 'wallpaper-2796.aaaaaaaa.webp', role: 'wallpaper' as const, width: 1290, height: 2796 },
    { path: 'widget-medium.22222222.webp', role: 'widget-medium' as const, width: 1092, height: 510 },
    { path: 'widget-fox.11111111.webp', role: 'widget-art' as const, width: 900, height: 1200 },
  ].map((a) => ({ ...a, bytes: 1, sha256: 'a'.repeat(64), mime: 'image/webp' as const }));
  const widgets = parseWidgetOptions([{ id: 'fox', kind: 'art', image: 'widget-fox.11111111.webp', sizes: ['small', 'large'] }], assets).options;
  assert.deepEqual(remoteHeroPx({ assets, widgets }), { small: { w: 900, h: 1200 }, medium: { w: 1092, h: 510 }, large: { w: 900, h: 1200 } });
  assert.deepEqual(remoteHeroPx({ assets: assets.slice(0, 1) }), {});
});

test('WidgetArtMenu: stable names, stacked small caption, native-like backgrounds', () => {
  const menu = read('src', 'ui', 'WidgetArtMenu.tsx');
    assert.match(menu, /optionName\(o, all\)/); // T209 naming supersedes optionMenuName in the UI
  assert.doesNotMatch(menu, /n: index \+ 1/, 'no per-size numbering');
  assert.match(menu, /menuCaptionLayout\(size\)/);
  assert.match(menu, /numberOfLines=\{caption\.nameLines\}/);
  assert.match(menu, /wallpaperUnderSlot\(/);
  assert.match(menu, /blurBackdrop\(/);
  assert.match(menu, /blurRadius=\{blur\.radius\}/);
  assert.match(menu, /opacity: blur\.veil/);
  assert.doesNotMatch(menu, /blurRadius=\{24\}|\? 24 :/);
  const art = read('src', 'ui', 'ThemeWidgetArt.tsx');
  assert.match(art, /seamlessCrop\(/);
  assert.match(art, /wallpaper=\{menuWallpaper\}/);
});

test('theme page Seamless card sizes the hero from the downloaded piece (remoteHeroPx), reference size only as fallback', () => {
  const page = read('app', 'theme', '[id].tsx');
  assert.match(page, /heroPx=\{heroPx\}/);
  assert.match(page, /heroSrc\.kind === 'file' \? remoteHeroSizes\?\.\[size\]/);
  const hook = read('src', 'native', 'useRemoteCatalog.ts');
  assert.match(hook, /remoteHeroPx\(local\)/);
});

test('T223: setWidgetArt fills edge to edge only when the real aspect matches (else fits); value mirrored', () => {
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  const setArt = bridge.slice(bridge.indexOf('AsyncFunction("setWidgetArt")'), bridge.indexOf('AsyncFunction("linkStatus")'));
  assert.match(setArt, /let aspectsMatch = min\(artAspect, outAspect\) \/ max\(artAspect, outAspect\) >= 0\.98/);
  assert.match(setArt, /if fit == "fill" && aspectsMatch \{/);
  assert.doesNotMatch(setArt, /if fit == "fill" \{/);
  assert.equal(NATIVE_FILL_MIN_ASPECT_MATCH, 0.98);
  close(NATIVE_FILL_MIN_ASPECT_MATCH, 1 - FILL_ASPECT_TOLERANCE);
});

test('T223: every Seamless family and every image source goes through the one fitted view', () => {
  const widget = read('targets', 'widget', 'SeamlessWidget.swift');
  // One image for the view: the chosen library piece, else the last applied file for the family.
  assert.equal((widget.match(/Image\(uiImage: image\)/g) ?? []).length, 2, 'blurred backdrop + fitted art, nothing else');
  assert.equal((widget.match(/\.scaledToFit\(\)/g) ?? []).length, 1);
  assert.equal((widget.match(/\.scaledToFill\(\)/g) ?? []).length, 1, 'only the blurred backdrop fills');
  for (const fam of ['.systemSmall', '.systemMedium', '.systemLarge', '.systemExtraLarge']) assert.ok(widget.includes(`case ${fam}:`), fam);
  // No per-family view branches that could skip the fit: the view never switches on the family.
  const view = widget.slice(widget.indexOf('struct SeamlessWidgetView'), widget.indexOf('struct SeamlessWidget: Widget'));
  assert.doesNotMatch(view, /switch family|if family ==/);
  // Both bridge writers fit the art with min scale (6 % inset) before the widget fits the file again.
  const bridge = read('modules', 'glaze-widget-bridge', 'ios', 'GlazeWidgetBridgeModule.swift');
  assert.match(bridge, /let s = min\(box\.width \/ hero\.size\.width, box\.height \/ hero\.size\.height\)/);
  assert.match(bridge, /let s = min\(box\.width \/ art\.size\.width, box\.height \/ art\.size\.height\)/);
  // Library copies are downscaled whole (aspect kept), never cropped.
  const save = bridge.slice(bridge.indexOf('AsyncFunction("saveWidgetArtPiece")'), bridge.indexOf('AsyncFunction("getWidgetArtLibrary")'));
  assert.match(save, /downscale\(image, maxEdge: 1200\)/);
  assert.doesNotMatch(save, /cropping\(to:/);
});
