import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { browseScenes } from '../core/catalog.ts';
import { apply, emptyProgress, restoreProgress } from '../core/progress.ts';
import { cameraFor, clampCamera, focusAt, hitTest, layout, toLocal, visibleLevels, zoomLimits } from '../core/scene.ts';
import { CATALOG_SCENES, LEGACY_SCENES, SCENES } from './index.ts';
import { catalogData } from './catalog-data.ts';

test('standard worlds have six actual transitions; Mega has twenty different transitions', () => {
  assert.equal(CATALOG_SCENES.filter((s) => !s.mega).length, 6);
  for (const scene of CATALOG_SCENES) {
    const L = layout(scene);
    assert.equal(scene.levels.length - 1, scene.mega ? 20 : 6, scene.id);
    assert.equal(Math.max(...L.order.map((p) => p.depth)), scene.mega ? 20 : 6);
    assert.ok(scene.difficulty);
    const art = catalogData.find((s) => s.id === scene.id)!.art;
    assert.equal(new Set(art).size, art.length, 'each zoom reveals a different illustration');
  }
});

test('every Mega stop is focusable and paintable through the deepest permitted zoom', () => {
  const scene = CATALOG_SCENES.find((s) => s.mega)!;
  const L = layout(scene), screen = { w: 378, h: 330 };
  let p = emptyProgress(scene);
  let h = { past: [], future: [] } as Parameters<typeof apply>[1];
  for (const level of L.order) {
    const cam = clampCamera(L, screen, cameraFor(level, screen));
    const vis = visibleLevels(L, cam, screen);
    assert.equal(focusAt(vis, cam.cx, cam.cy)?.id, level.id, `zoom${level.depth} must not skip a stop`);
    // This point is within the current illustration and outside the next central portal.
    const wx = level.ox + 240 * level.s, wy = level.oy + 600 * level.s;
    const local = toLocal(level, wx, wy);
    assert.ok(Math.abs(local.x - 240) * level.s * cam.z < .2, `zoom${level.depth} x precision`);
    const hit = hitTest(vis, wx, wy);
    assert.equal(hit?.level, level.id, `paint targets zoom${level.depth}`);
    const edit = apply(p, h, { kind: 'fill', level: hit!.level, region: hit!.region, color: '#3388DD' }, level.depth + 1);
    p = edit.p; h = edit.h;
  }
  assert.deepEqual(restoreProgress(scene, JSON.parse(JSON.stringify(p))).fills, p.fills, 'deep fills persist');
  const last = L.order.at(-1)!;
  const max = zoomLimits(L, screen).max;
  const cam = clampCamera(L, screen, { ...cameraFor(last, screen), z: max });
  assert.ok(Number.isFinite(cam.z));
  assert.equal(hitTest(visibleLevels(L, cam, screen), cam.cx, cam.cy)?.level, last.id);
});

test('topic, difficulty, Mega and saved filters compose without losing existing colouring', () => {
  const empty = () => false;
  assert.equal(browseScenes(SCENES, 'all', 'all', empty).length, 7);
  assert.equal(browseScenes(SCENES, 'all', 'beginner', empty).length, 1);
  assert.deepEqual(browseScenes(SCENES, 'flowers', 'beginner', empty).map((s) => s.id), ['garden-blooms']);
  assert.deepEqual(browseScenes(SCENES, 'mega', 'all', empty).map((s) => s.id), ['mega-ornament']);
  assert.equal(browseScenes(SCENES, 'mega', 'beginner', empty).length, 0);
  assert.deepEqual(browseScenes(SCENES, 'saved', 'all', (s) => s.id === 'library').map((s) => s.id), ['library']);
});

test('all previously shipped scene shapes, region IDs, versions and palettes are unchanged', () => {
  const digest = createHash('sha256').update(JSON.stringify(LEGACY_SCENES.map(({ id, version, levels, palette }) => ({ id, version, levels, palette })))).digest('hex');
  assert.equal(digest, 'd623f1f6d99f24244a74b24c5a900462e51041a491a82e4516306596bbd567dc');
});
