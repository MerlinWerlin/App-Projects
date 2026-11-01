import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWidgetOptions, OPTION_SIZE_POINTS } from './widgetOptions.ts';
import { liveArtPlan, liveArtSpec, parseLiveArtSpec } from './liveArt.ts';

const assets = [{ path: 'clean-face.png', role: 'widget-art', width: 1024, height: 1024 }];
const frame = { rect: [0.18, 0.18, 0.64, 0.64], shape: 'circle' };
const option = { id: 'live-clock', kind: 'clock', image: 'clean-face.png', sizes: ['small', 'medium', 'large'], numberFree: true, liveFrame: frame };

test('a clean source face carries its safe live area through every widget composition', () => {
  const parsed = parseWidgetOptions([option], assets);
  assert.deepEqual(parsed.errors, []);
  const plan = liveArtPlan('any-reviewed-theme', parsed.options[0]);
  assert.ok(plan);
  assert.deepEqual(plan.rect, { x: .18, y: .18, w: .64, h: .64 });
  assert.equal(plan.cover, false);
  for (const size of Object.values(OPTION_SIZE_POINTS)) {
    for (const fit of ['fit', 'fill', 'bleed'] as const) {
      const spec = liveArtSpec(plan, { w: 1024, h: 1024 }, size, fit, { bg: '#102030', ink: '#F0E0D0' });
      assert.ok(spec);
      assert.deepEqual(parseLiveArtSpec(spec), spec);
      assert.equal(spec.cleanFace, true);
      const [x, y, w, h] = spec.rect;
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1 && y + h <= 1);
    }
  }
  frame.rect[0] = .99;
  assert.equal(parsed.options[0].liveFrame?.rect[0], .18, 'parsed frame must not alias the manifest');
  frame.rect[0] = .18;
});

test('painted, malformed, empty and off-canvas source areas never become live options', () => {
  const bad = [
    { ...option, numberFree: false },
    { ...option, liveFrame: { rect: [.8, .1, .4, .4], shape: 'circle' } },
    { ...option, liveFrame: { rect: [.1, .9, .4, .4], shape: 'plate' } },
    { ...option, liveFrame: { rect: [.1, .1, 0, .4], shape: 'circle' } },
    { ...option, liveFrame: { rect: [NaN, .1, .4, .4], shape: 'circle' } },
    { ...option, liveFrame: { rect: [.1, .1, .4], shape: 'circle' } },
    { ...option, liveFrame: { rect: [.1, .1, .4, .4], shape: 'triangle' } },
  ];
  for (const item of bad) {
    const parsed = parseWidgetOptions([item], assets);
    assert.equal(parsed.options.length, 0);
    assert.equal(parsed.errors.length, 1);
  }
  assert.equal(liveArtPlan('unknown', { id: 'unreviewed-clock', kind: 'clock' }), null);
});

test('painted value covers cannot opt out of their background with a cleanFace flag', () => {
  const painted = parseLiveArtSpec({ kind: 'clock', rect: [.1,.1,.8,.8], shape: 'circle', cover: true, cleanFace: true, plate: '#102030', ink: '#FFFFFF' });
  assert.ok(painted);
  assert.equal(painted.cleanFace, undefined);
  assert.equal(painted.cover, true);
});
