import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { browseScenes } from '../core/catalog.ts';
import { apply, emptyProgress, restoreProgress } from '../core/progress.ts';
import { BLEND_HIT, cameraFor, cameraInto, clampCamera, fitCamera, focusAt, hitTest, layout, toLocal, visibleLevels, zoomLimits } from '../core/scene.ts';
import { SINGLE_SCENES, ZOOM_SCENES, SHIPPED_ART_SCENES, LEGACY_SCENES, SCENES } from './index.ts';
import { ARTWORK } from './art/catalog-art.ts';
import { nestedData } from './nested-data.ts';

test('42 approved pictures are independent; six nested editions have six discoveries and Mega has twenty', () => {
  assert.equal(SINGLE_SCENES.length, 42);
  assert.ok(SINGLE_SCENES.every((s) => s.levels.length === 1 && s.collection === 'single'));
  assert.equal(ZOOM_SCENES.filter((s) => !s.mega).length, 6);
  for (const scene of ZOOM_SCENES) {
    const L = layout(scene);
    assert.equal(scene.levels.length - 1, scene.mega ? 20 : 6, scene.id);
    assert.equal(Math.max(...L.order.map((p) => p.depth)), scene.mega ? 20 : 6);
    assert.ok(scene.difficulty);
    const source = nestedData.find((s) => s.id === scene.id)!;
    const art = source.levels.map((l) => l.art);
    assert.equal(new Set(art).size, art.length, 'each zoom reveals a different illustration');
    for (let i = 1; i < source.levels.length; i++) {
      const parent = source.levels[i - 1]!;
      const child = source.levels[i]!;
      assert.ok('relation' in child && child.relation.length > 15, 'record why this detail belongs inside its parent');
      assert.ok('next' in parent);
      const portal = parent.next!;
      assert.ok(portal.x >= 0 && portal.y >= 0 && portal.w > 0 && portal.w === portal.h);
      assert.ok(portal.x + portal.w <= 1200 && portal.y + portal.h <= 1200);
    }
  }
});

test('every Mega stop is focusable and paintable through the deepest permitted zoom', () => {
  const scene = ZOOM_SCENES.find((s) => s.mega)!;
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

test('every nested discovery is reachable without skipping in portrait, landscape and tablet viewports', () => {
  for (const scene of ZOOM_SCENES) for (const screen of [{ w: 378, h: 330 }, { w: 780, h: 290 }, { w: 820, h: 900 }]) {
    const L = layout(scene);
    for (const level of L.order) {
      const cam = clampCamera(L, screen, cameraFor(level, screen));
      const vis = visibleLevels(L, cam, screen);
      assert.equal(focusAt(vis, cam.cx, cam.cy)?.id, level.id, `${scene.id}/${level.id} in ${screen.w}x${screen.h}`);
    }
  }
});

test('topic, difficulty, Mega and saved filters compose without losing existing colouring', () => {
  const empty = () => false;
  assert.equal(browseScenes(SCENES, 'single', 'all', 'all', empty).length, 42);
  assert.equal(browseScenes(SCENES, 'single', 'all', 'beginner', empty).length, 7);
  assert.equal(browseScenes(SCENES, 'single', 'flowers', 'beginner', empty).length, 7);
  assert.deepEqual(browseScenes(SCENES, 'zoom', 'places', 'advanced', empty).map((s) => s.id), ['zoom-cottage']);
  assert.deepEqual(browseScenes(SCENES, 'mega', 'all', 'all', empty).map((s) => s.id), ['mega-rose']);
  assert.equal(browseScenes(SCENES, 'mega', 'all', 'beginner', empty).length, 0);
  assert.deepEqual(browseScenes(SCENES, 'saved', 'all', 'all', (s) => s.id === 'library').map((s) => s.id), ['library']);
  assert.deepEqual(browseScenes(SCENES, 'saved', 'all', 'all', (s) => s.id === 'storybook-places').map((s) => s.id), ['storybook-places']);
});

test('all 42 approved illustrations and the seven shipped chains retain their exact geometry and save IDs', () => {
  const baseline = JSON.parse(readFileSync(new URL('../../scripts/art/released-geometry.json', import.meta.url), 'utf8'));
  const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  for (const [id, expected] of Object.entries(baseline.perArt)) assert.equal(sha(ARTWORK[id]), expected, id);
  const keys = ['id', 'w', 'h', 'regions', 'stroke', 'parent', 'round', 'portal'] as const;
  const old = SHIPPED_ART_SCENES.map(({ id, version, levels, palette }) => ({ id, version,
    levels: levels.map((l) => Object.fromEntries(keys.filter((k) => k in l).map((k) => [k, l[k]]))), palette }));
  assert.equal(sha(old), baseline.scenes);
});

test('all previously shipped scene shapes, region IDs, versions and palettes are unchanged', () => {
  const digest = createHash('sha256').update(JSON.stringify(LEGACY_SCENES.map(({ id, version, levels, palette }) => ({ id, version, levels, palette })))).digest('hex');
  assert.equal(digest, 'd623f1f6d99f24244a74b24c5a900462e51041a491a82e4516306596bbd567dc');
});

test('nested details blend in: hidden on the whole picture, soft while small, solid once they fill the screen', () => {
  for (const scene of ZOOM_SCENES) for (const screen of [{ w: 554, h: 705 }, { w: 780, h: 290 }, { w: 820, h: 900 }]) {
    const L = layout(scene);
    // Opening an artwork shows the picture alone: no inset square on top of it.
    const fit = visibleLevels(L, clampCamera(L, screen, fitCamera(L, screen)), screen);
    assert.deepEqual(fit.map((v) => v.level.id), [L.root.id], `${scene.id} fit shows no nested square`);
    for (const level of L.order.slice(1)) {
      // Look closer goes right into the detail: it fills the screen and nothing of the parent is drawn.
      const into = clampCamera(L, screen, cameraInto(L, level, screen));
      const vis = visibleLevels(L, into, screen);
      const me = vis.find((v) => v.level.id === level.id)!;
      assert.equal(me.blend, 1, `${scene.id}/${level.id} solid in ${screen.w}x${screen.h}`);
      assert.ok(into.z >= cameraFor(level, screen).z, 'closer than the old framing');
      if (!level.round && into.z * level.world.w >= Math.max(screen.w, screen.h)) {
        assert.equal(vis[0]!.level.id, level.id, 'a square detail that fills the screen hides its parent');
        assert.equal(me.edge, 1);
      }
      assert.equal(focusAt(vis, into.cx, into.cy)?.id, level.id, `${scene.id}/${level.id} focus in ${screen.w}x${screen.h}`);
      // Half way there the detail is still blending: soft edges, and taps on a faint detail colour the parent.
      const parent = L.byId.get(level.parent!)!;
      const half = clampCamera(L, screen, { ...cameraFor(level, screen), z: cameraFor(level, screen).z * 0.45 });
      const mid = visibleLevels(L, half, screen).find((v) => v.level.id === level.id);
      if (mid) {
        assert.ok(mid.edge < 1, `${scene.id}/${level.id} soft edge while small`);
        const hit = hitTest(visibleLevels(L, half, screen), half.cx, half.cy);
        if (mid.blend < BLEND_HIT) assert.notEqual(hit?.level, level.id);
      }
      void parent;
    }
  }
});
