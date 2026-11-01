// Every scene must be colourable: paths parse, regions are closed and sized for a finger, each level has a
// full background, portals keep the child's aspect ratio, and colour links point at real regions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bboxOf, flatten, ringArea } from '../core/geom.ts';
import { PALETTES } from '../core/palettes.ts';
import { fillableCount, layout } from '../core/scene.ts';
import { SCENES } from './index.ts';

test('scene ids are unique and the deep scenes go at least six and five levels down', () => {
  assert.equal(new Set(SCENES.map((s) => s.id)).size, SCENES.length);
  assert.equal(SCENES[0]!.id, 'bookshop');
  assert.ok(SCENES[0]!.levels.length >= 6);
  assert.ok(SCENES.find((s) => s.id === 'mandala')!.levels.length >= 5);
  assert.ok(SCENES.length >= 3);
});

for (const scene of SCENES) {
  test(`${scene.id}: levels lay out and portals keep their aspect`, () => {
    const L = layout(scene);
    assert.equal(L.order.length, scene.levels.length, 'every level reachable from the root');
    for (const lv of scene.levels) {
      if (!lv.parent) continue;
      const par = scene.levels.find((x) => x.id === lv.parent)!;
      const p = lv.portal!;
      assert.ok(Math.abs(p.w / p.h - lv.w / lv.h) < 0.01, `${lv.id} portal aspect`);
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= par.w && p.y + p.h <= par.h, `${lv.id} portal inside parent`);
    }
    assert.ok(PALETTES.some((p) => p.id === scene.palette));
  });

  test(`${scene.id}: regions parse, are unique and big enough to tap`, () => {
    const all = new Set(scene.levels.flatMap((l) => l.regions.map((r) => `${l.id}/${r.id}`)));
    for (const lv of scene.levels) {
      const ids = lv.regions.map((r) => r.id);
      assert.equal(new Set(ids).size, ids.length, `${lv.id} duplicate region ids`);
      const bg = lv.regions[0]!;
      const b = bboxOf(flatten(bg.d));
      assert.ok(!bg.line && b.x <= 0 && b.y <= 0 && b.w >= lv.w && b.h >= lv.h, `${lv.id} first region must cover the level`);
      for (const r of lv.regions) {
        const rings = flatten(r.d);
        assert.ok(rings.length > 0, `${lv.id}/${r.id} has no shape`);
        if (r.line) continue;
        const area = Math.max(...rings.map(ringArea));
        assert.ok(area >= 25, `${lv.id}/${r.id} too small to tap (${area.toFixed(1)})`);
        if (r.from) assert.ok(all.has(r.from), `${lv.id}/${r.id} links to missing ${r.from}`);
      }
    }
    assert.ok(fillableCount(scene) >= 60, 'enough to colour');
  });
}
