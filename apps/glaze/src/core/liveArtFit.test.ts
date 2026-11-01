// T246: live values in the Fit layout (map the plate rect onto the inset raw art).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KNOWN_LIVE_PIECES, liveArtPlan, liveArtSpec, parseLiveArtSpec } from './liveArt.ts';
import {
  FIT_LAYOUT_INSET,
  FIT_LAYOUT_LIVE_IN_WIDGET,
  fitLayoutArtRect,
  fitLayoutPlate,
  fitLayoutPlateForSpec,
  liveValueShowsIn,
} from './liveArtFit.ts';
import { OPTION_SIZE_POINTS, placeArt, type Box } from './widgetOptions.ts';

const near = (a: number, b: number, eps = 0.001) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const SQUARE: Box = { w: 1024, h: 1024 };
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('the Fit inset is the widget Swift value (6 % of the short side)', () => {
  assert.equal(FIT_LAYOUT_INSET, 0.06);
  assert.match(read('targets', 'widget', 'SeamlessWidget.swift'), /min\(size\.width, size\.height\) \* 0\.06/);
});

test('square art in small / medium / large widgets: contained in the inset box, centred', () => {
  // small: the art fills the inset box exactly.
  const s = fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.small)!;
  near(s.x, 170 * 0.06);
  near(s.y, 170 * 0.06);
  near(s.w, 170 * 0.88);
  near(s.h, 170 * 0.88);
  // medium: height-bound, centred horizontally.
  const m = fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.medium)!;
  near(m.h, 170 - 2 * 170 * 0.06);
  near(m.w, m.h);
  near(m.y, 170 * 0.06);
  near(m.x, (364 - m.w) / 2);
  // large: width-bound (364 < 382), centred vertically.
  const l = fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.large)!;
  near(l.w, 364 - 2 * 364 * 0.06);
  near(l.h, l.w);
  near(l.x, 364 * 0.06);
  near(l.y, (382 - l.h) / 2);
  // Same as the app's own fit placement (placeArt) so previews and the widget agree.
  for (const size of ['small', 'medium', 'large'] as const) {
    const box = OPTION_SIZE_POINTS[size];
    const a = fitLayoutArtRect(SQUARE, box)!;
    const b = placeArt(SQUARE, box, 'fit').rect;
    near(a.x, b.x);
    near(a.y, b.y);
    near(a.w, b.w);
    near(a.h, b.h);
  }
});

test('a plate maps onto the contained art (0..1 of the widget)', () => {
  const plate = KNOWN_LIVE_PIECES['indigo-current/harbour-focus'].rect;
  for (const size of ['small', 'medium', 'large'] as const) {
    const box = OPTION_SIZE_POINTS[size];
    const place = fitLayoutArtRect(SQUARE, box)!;
    const r = fitLayoutPlate(plate, SQUARE, box)!;
    near(r.x * box.w, place.x + plate.x * place.w, 0.05);
    near(r.y * box.h, place.y + plate.y * place.h, 0.05);
    near(r.w * box.w, plate.w * place.w, 0.05);
    near(r.h * box.h, plate.h * place.h, 0.05);
    // Square art keeps a square plate square in points (circle plates stay round).
    near(r.w * box.w, r.h * box.h, 0.05);
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1);
  }
  // Whole art = the contained rect itself.
  const whole = fitLayoutPlate({ x: 0, y: 0, w: 1, h: 1 }, SQUARE, OPTION_SIZE_POINTS.medium)!;
  const place = fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.medium)!;
  near(whole.x, place.x / 364);
  near(whole.w, place.w / 364);
  near(whole.h, place.h / 170);
});

test('non-square art: wide art letterboxes top/bottom, tall art pillarboxes', () => {
  const wide: Box = { w: 2000, h: 1000 };
  const s = fitLayoutArtRect(wide, OPTION_SIZE_POINTS.small)!;
  near(s.w, 170 * 0.88);
  near(s.h, s.w / 2);
  near(s.y, (170 - s.h) / 2);
  const centre = fitLayoutPlate({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, wide, OPTION_SIZE_POINTS.small)!;
  near(centre.x + centre.w / 2, 0.5);
  near(centre.y + centre.h / 2, 0.5);
  near(centre.w * 170, 0.5 * s.w, 0.05);
  near(centre.h * 170, 0.5 * s.h, 0.05);
  const tall: Box = { w: 600, h: 1200 };
  const m = fitLayoutArtRect(tall, OPTION_SIZE_POINTS.medium)!;
  near(m.h, 170 * 0.88);
  near(m.w, m.h / 2);
  near(m.x, (364 - m.w) / 2);
  // A wide medium widget with wide art of the same aspect: art fills the inset box on both axes.
  const same = fitLayoutArtRect({ w: 364, h: 170 }, OPTION_SIZE_POINTS.medium)!;
  assert.ok(same.w <= 364 - 2 * 170 * 0.06 + 1e-9 && same.h <= 170 - 2 * 170 * 0.06 + 1e-9);
});

test('edge cases: empty sizes, NaN, plates outside the art, inset too big', () => {
  assert.equal(fitLayoutArtRect({ w: 0, h: 100 }, OPTION_SIZE_POINTS.small), null);
  assert.equal(fitLayoutArtRect(SQUARE, { w: 0, h: 0 }), null);
  assert.equal(fitLayoutArtRect(SQUARE, { w: Number.NaN, h: 10 }), null);
  assert.equal(fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.small, 0.5), null);
  assert.ok(fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.small, 0));
  assert.equal(fitLayoutPlate({ x: 0.2, y: 0.2, w: 0, h: 0.3 }, SQUARE, OPTION_SIZE_POINTS.small), null);
  assert.equal(fitLayoutPlate({ x: 1.2, y: 0.2, w: 0.3, h: 0.3 }, SQUARE, OPTION_SIZE_POINTS.small), null);
  assert.equal(fitLayoutPlate({ x: Number.NaN, y: 0, w: 0.3, h: 0.3 }, SQUARE, OPTION_SIZE_POINTS.small), null);
  // Partly outside: clipped to the art, never past the inset.
  const clipped = fitLayoutPlate({ x: 0.8, y: -0.1, w: 0.5, h: 0.4 }, SQUARE, OPTION_SIZE_POINTS.small)!;
  const place = fitLayoutArtRect(SQUARE, OPTION_SIZE_POINTS.small)!;
  near(clipped.y, place.y / 170);
  near(clipped.x + clipped.w, (place.x + place.w) / 170);
  near(clipped.h * 170, 0.3 * place.h, 0.05);
});

test('liveArtSpec stores the art rect; parse keeps it and drops a broken one alone', () => {
  const plan = liveArtPlan('opal-abyss', { id: 'abyss-battery', kind: 'battery' })!;
  const spec = liveArtSpec(plan, SQUARE, { w: 510, h: 510 }, 'bleed', { bg: '#101820', ink: '#ffffff' })!;
  assert.deepEqual(spec.art, [plan.rect.x, plan.rect.y, plan.rect.w, plan.rect.h]);
  assert.deepEqual(parseLiveArtSpec(JSON.parse(JSON.stringify(spec))), spec);
  const broken = parseLiveArtSpec({ ...spec, art: [0.9, 0, 0.5, 0.5] })!;
  assert.equal(broken.art, undefined);
  assert.deepEqual(broken.rect, spec.rect);
  const old = parseLiveArtSpec({ ...spec, art: undefined })!;
  assert.equal(old.art, undefined);
});

test('fitLayoutPlateForSpec: raw art uses the art rect; no raw art fits the composed image; old records over raw art get none', () => {
  const plan = liveArtPlan('alpine-starlight', { id: 'constellation-clock', kind: 'clock' })!;
  const composed = { w: 1092, h: 510 };
  const widget = OPTION_SIZE_POINTS.medium;
  const spec = liveArtSpec(plan, SQUARE, composed, 'fit', { bg: '#000000', ink: '#ffffff' })!;
  const force = { ignoreWidgetSupport: true };
  const onRaw = fitLayoutPlateForSpec(spec, { rawArt: SQUARE, composed, widget }, force)!;
  assert.deepEqual(onRaw, fitLayoutPlate(plan.rect, SQUARE, widget));
  const onComposed = fitLayoutPlateForSpec(spec, { rawArt: null, composed, widget }, force)!;
  assert.deepEqual(onComposed, fitLayoutPlate({ x: spec.rect[0], y: spec.rect[1], w: spec.rect[2], h: spec.rect[3] }, composed, widget));
  // The composed image of the same aspect as the widget, fitted: the plate sits inside the onRaw one's
  // neighbourhood (both are the same painted value, the composed path adds the bridge's own inset).
  assert.ok(Math.abs(onComposed.x + onComposed.w / 2 - (onRaw.x + onRaw.w / 2)) < 0.05);
  const { art: _drop, ...old } = spec;
  assert.equal(fitLayoutPlateForSpec(old, { rawArt: SQUARE, composed, widget }, force), null);
});

test('the widget does not draw live values in Fit yet, so the app must not claim it', () => {
  // SeamlessWidget.swift skips LiveArtLayer in Fit (D225-3: no new Swift). If a native change lands,
  // flip FIT_LAYOUT_LIVE_IN_WIDGET together with it.
  const swift = read('targets', 'widget', 'SeamlessWidget.swift');
  const fitSkipped = /if let image = image, !fit \{/.test(swift);
  assert.equal(FIT_LAYOUT_LIVE_IN_WIDGET, !fitSkipped);
  assert.equal(liveValueShowsIn('fill'), true);
  assert.equal(liveValueShowsIn('fit'), FIT_LAYOUT_LIVE_IN_WIDGET);
  const plan = liveArtPlan('rainlight', { id: 'rainlight-date', kind: 'date' })!;
  const spec = liveArtSpec(plan, SQUARE, { w: 510, h: 510 }, 'bleed', { bg: '#000000', ink: '#ffffff' })!;
  if (!FIT_LAYOUT_LIVE_IN_WIDGET) {
    assert.equal(fitLayoutPlateForSpec(spec, { rawArt: SQUARE, composed: { w: 510, h: 510 }, widget: OPTION_SIZE_POINTS.small }), null);
  }
  // The theme art screen says live values show in Fill only while the widget skips Fit.
  const ui = read('src', 'ui', 'ThemeWidgetArt.tsx');
  assert.match(ui, /liveValueShowsIn\('fit'\)/);
  assert.match(ui, /tabs\.widgetsTab\.art\.liveFillOnly/);
});
