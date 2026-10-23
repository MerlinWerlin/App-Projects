// Shape-practice batch (T123, fb-1022b): count, ids, levels, category, tags, bounds, size budget and no off-limits names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shapes2 } from './shapes2.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';

test('shapes2: at least 15 templates, all in the shapes category and registered', () => {
  assert.ok(shapes2.length >= 15, `${shapes2.length} templates`);
  const shelf = templatesIn('shapes').map((t) => t.id);
  for (const t of shapes2) {
    assert.equal(t.category, 'shapes', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('shapes2: levels set explicitly, about 40% beginner, 35% intermediate, 25% advanced', () => {
  const count = (l: string) => shapes2.filter((t) => t.level === l).length;
  for (const t of shapes2) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 6, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 5, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of shapes2.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of shapes2.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('shapes2: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = shapes2.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^shape-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of shapes2) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('shapes2: tags are lower-case, unique, 4 or more, including shape', () => {
  for (const t of shapes2) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const need of ['shape']) assert.ok(tags.includes(need), `${t.id}: tag ${need}`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('shapes2: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of shapes2) {
    const all = [...t.paths, ...(t.detail ?? [])];
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    const chars = all.reduce((n, d) => n + d.length, 0);
    assert.ok(chars <= 30000, `${t.id}: ${chars} characters`);
    for (const d of all) {
      assert.ok(d.trim().length > 0, `${t.id}: empty path`);
      assert.match(d, /^M[MLCQAZ0-9. -]*$/, `${t.id}: absolute M L C Q A Z commands only`);
      for (const num of d.match(/-?\d*\.?\d+/g) ?? []) assert.ok(!/\.\d\d/.test(num), `${t.id}: ${num} has more than one decimal`);
      for (const sub of samplePath(d, 4)) {
        for (const [x, y] of sub.pts) assert.ok(x >= 16 && x <= 384 && y >= 16 && y <= 384, `${t.id}: point ${x},${y} outside the art area`);
      }
    }
  }
});

test('shapes2: no competitor, brand or off-limits subject in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'skull', 'dagger', 'knife', 'sword', 'gun', 'pistol', 'blade', 'weapon',
    'swallow', 'bird', 'snake', 'devil', 'coffin', 'death', 'blood', 'olympic', 'rubik', 'lego', 'escher',
  ];
  for (const t of shapes2) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
