import assert from 'node:assert/strict';
import { test } from 'node:test';
import { singleEditionProgress } from './artProgress.ts';
import { emptyProgress, restoreProgress } from './progress.ts';
import { type Region, type Scene, fillableCount, layout } from './scene.ts';

const single: Scene = { id: 'single', version: 1, theme: 'flowers', palette: 'garden', levels: [
  { id: 'z00', artworkId: 'flower', w: 1200, h: 1200, fillIds: ['paper', 'petal'],
    get regions(): Region[] { throw new Error('gallery/save loading must not decode art'); } },
] };
test('metadata handles gallery layout, counts and save restoration without decoding vectors', () => {
  assert.equal(layout(single).root.w, 1200);
  assert.equal(fillableCount(single), 2);
  assert.deepEqual(restoreProgress(single, { fills: { z00: { petal: '#3388DD', missing: '#FFFFFF' } } }).fills, { z00: { petal: '#3388DD' } });
});

test('copying a painted old level keeps fills, linked paper and clipped strokes, choosing the latest source', () => {
  const source: Scene = { ...single, id: 'old', levels: [{ w: 1200, h: 1200, artworkId: 'flower', fillIds: ['paper', 'petal'],
    get regions(): Region[] { throw new Error('migration must not decode art'); }, id: 'z02', colourLinks: { paper: 'z01/zoomGate' } }] };
  const p = { ...emptyProgress(source), updated: 3, fills: { z01: { zoomGate: '#ABCDEF' }, z02: { petal: '#3388DD', zoomGate: '#FFFFFF' } },
    strokes: [{ id: 's', level: 'z02', tool: 'pencil' as const, color: '#112233', width: 4, pts: [2, 3, 4, 5], clip: 'petal' }] };
  const before = JSON.stringify(p);
  const copy = singleEditionProgress(single, [{ scene: source, progress: p }, { scene: source, progress: { ...p, updated: 1 } }])!;
  assert.deepEqual(copy.fills, { z00: { petal: '#3388DD', paper: '#ABCDEF' } });
  assert.equal(copy.strokes[0]!.level, 'z00');
  assert.equal(copy.strokes[0]!.clip, 'petal');
  assert.equal(copy.updated, 3);
  assert.equal(JSON.stringify(p), before, 'original saved chain stays untouched');
  assert.equal(singleEditionProgress(single, [{ scene: source, progress: emptyProgress(source) }]), null);
});
