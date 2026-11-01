// T203: the widget render check's placement plan (src/core/widgetSnapshot.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceById } from './seamlessWidget.ts';
import {
  capTarget,
  cornerOutsideMask,
  edgeFlags,
  fitRect,
  overreach,
  pixelFlags,
  snapshotPlan,
  worstSeverity,
  type SnapshotInput,
} from './widgetSnapshot.ts';
import type { WidgetOption } from './widgetOptions.ts';

const device = deviceById('2796')!;
const opt = (o: Partial<WidgetOption>): SnapshotInput['option'] => ({
  id: 'a',
  sizes: ['small', 'medium', 'large'],
  fit: 'fit',
  background: 'theme',
  width: 1024,
  height: 1024,
  ...o,
});
const codes = (p: { flags: { code: string }[] }) => p.flags.map((f) => f.code).sort();

test('fitted square art in every size stays inside the widget, centred, never filled', () => {
  for (const size of ['small', 'medium', 'large'] as const) {
    const p = snapshotPlan({ option: opt({}), size, device, artPx: { w: 1024, h: 1024 }, wallpaperPx: null });
    assert.equal(p.path, 'widgetArt');
    assert.equal(p.mode, 'fit');
    assert.equal(overreach(p.artRectPt, p.widgetPt), 0);
    assert.ok(Math.abs(p.artRectPt.x + p.artRectPt.w / 2 - p.widgetPt.w / 2) < 0.01);
    assert.ok(!codes(p).includes('crop'));
    assert.ok(!codes(p).includes('fill'));
  }
  // Square art in a wide medium widget covers well under half: letterbox (info only).
  const m = snapshotPlan({ option: opt({}), size: 'medium', device, artPx: { w: 1024, h: 1024 }, wallpaperPx: null });
  assert.ok(codes(m).includes('letterbox'));
  assert.equal(worstSeverity(m.flags), 'info');
});

test('fill is used only when the declared aspect matches, and a stretch is an error', () => {
  const ok = snapshotPlan({ option: opt({ fit: 'fill', width: 1092, height: 510 }), size: 'medium', device, artPx: { w: 1092, h: 510 }, wallpaperPx: null });
  assert.equal(ok.mode, 'fill');
  assert.deepEqual(codes(ok), ['fill']);
  const square = snapshotPlan({ option: opt({ fit: 'fill' }), size: 'medium', device, artPx: { w: 1024, h: 1024 }, wallpaperPx: null });
  assert.equal(square.mode, 'fit');
  // The manifest says wide, the real image is square: the app asks for fill, but since T223 the
  // bridge checks the real aspect and fits the art (no stretch, no crop); the lying size is flagged.
  const lie = snapshotPlan({ option: opt({ fit: 'fill', width: 1092, height: 510 }), size: 'medium', device, artPx: { w: 1024, h: 1024 }, wallpaperPx: null });
  assert.equal(lie.mode, 'fit');
  assert.ok(codes(lie).includes('metaAspect'));
  assert.ok(!codes(lie).includes('stretch'));
  assert.ok(!codes(lie).includes('crop'));
});

test('wallpaper background takes the seamless path with the default slot crop', () => {
  const p = snapshotPlan({ option: opt({ background: 'wallpaper' }), size: 'small', device, artPx: { w: 510, h: 510 }, wallpaperPx: { w: 1290, h: 2796 } });
  assert.equal(p.path, 'seamless');
  assert.deepEqual(p.crop, { x: 99, y: 282, w: 510, h: 510 });
  assert.deepEqual(p.targetPx, { w: 510, h: 510 });
  const none = snapshotPlan({ option: opt({ background: 'wallpaper' }), size: 'small', device, artPx: { w: 510, h: 510 }, wallpaperPx: null });
  assert.ok(codes(none).includes('noWallpaper'));
});

test('sizes not listed by the option are marked notOffered', () => {
  const p = snapshotPlan({ option: opt({ sizes: ['small'] }), size: 'large', device, artPx: { w: 1024, h: 1024 }, wallpaperPx: null });
  assert.equal(p.offered, false);
  assert.ok(codes(p).includes('notOffered'));
});

test('geometry helpers', () => {
  assert.deepEqual(capTarget({ w: 1092, h: 1146 }), { w: 1092, h: 1146 });
  assert.deepEqual(capTarget({ w: 2400, h: 1200 }), { w: 1200, h: 600 });
  assert.deepEqual(fitRect({ w: 2, h: 1 }, { w: 100, h: 100 }), { x: 0, y: 25, w: 100, h: 50 });
  assert.equal(overreach({ x: -3, y: 0, w: 10, h: 10 }, { w: 10, h: 10 }), 3);
  assert.equal(cornerOutsideMask({ x: 0, y: 0, w: 170, h: 170 }, { w: 170, h: 170 }, 22), true);
  assert.equal(cornerOutsideMask({ x: 10.2, y: 10.2, w: 149.6, h: 149.6 }, { w: 170, h: 170 }, 22), false);
});

test('pixel and edge flags', () => {
  assert.deepEqual(pixelFlags({ mean: 0.99, std: 0 }).map((f) => f.code), ['white']);
  assert.deepEqual(pixelFlags({ mean: 0.2, std: 0.001 }).map((f) => f.code), ['empty']);
  assert.deepEqual(pixelFlags({ mean: 0.4, std: 0.2 }), []);
  assert.deepEqual(edgeFlags({ transparent: true, edgeOpaque: 0.3, worstSide: 'bottom' }).map((f) => f.code), ['edgeCut']);
  assert.deepEqual(edgeFlags({ transparent: false, edgeOpaque: 1, worstSide: 'top' }), []);
  assert.equal(worstSeverity([]), null);
});
