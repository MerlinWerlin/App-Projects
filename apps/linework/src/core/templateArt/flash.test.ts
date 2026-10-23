// Tattoo-flash batch (T123, fb-1022b + market-1018 T71): count, ids, levels, category, tags, bounds, size budget, friendly subjects only (no skulls, weapons or birds) and no artist or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flash } from './flash.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';

test('flash: at least 15 templates, all in the patterns category and registered', () => {
  assert.ok(flash.length >= 15, `${flash.length} templates`);
  const shelf = templatesIn('patterns').map((t) => t.id);
  for (const t of flash) {
    assert.equal(t.category, 'patterns', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('flash: levels set explicitly, about 40% beginner, 35% intermediate, 25% advanced', () => {
  const count = (l: string) => flash.filter((t) => t.level === l).length;
  for (const t of flash) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 6, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 5, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of flash.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of flash.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('flash: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = flash.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^flash-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of flash) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('flash: tags are lower-case, unique, 4 or more, including tattoo, flash', () => {
  for (const t of flash) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const need of ['tattoo', 'flash']) assert.ok(tags.includes(need), `${t.id}: tag ${need}`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('flash: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of flash) {
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

test('flash: no competitor, brand or off-limits subject in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'skull', 'dagger', 'knife', 'sword', 'gun', 'pistol', 'blade', 'weapon',
    'swallow', 'bird', 'snake', 'devil', 'coffin', 'death', 'blood', 'olympic', 'rubik', 'lego', 'escher',
    'sailor jerry', 'traditional by', 'ed hardy', 'hardy', 'collins', 'bowery', 'mcdonald', 'disney',
  ];
  for (const t of flash) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
