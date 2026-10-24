// places3 (fb-1023b T140): original Buildings & landscapes batch: count, ids, levels, category, subject words, bounds, size budget
// and no landmark, franchise or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { places3 } from './places3.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

test('places3: at least 17 templates, all in the Buildings & landscapes category and registered', () => {
  assert.ok(places3.length >= 17 /* merge-art review dropped one */, `${places3.length} templates`);
  const shelf = templatesIn('places').map((t) => t.id);
  for (const t of places3) {
    assert.equal(t.category, 'places', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), []);
  }
});

test('places3: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => places3.filter((t) => t.level === l).length;
  for (const t of places3) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 7, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 5, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of places3.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of places3.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('places3: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = places3.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^place3-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of places3) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('places3: 3+ lower-case tags each, no duplicates', () => {
  for (const t of places3) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 3, `${t.id}: needs 3+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('places3: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of places3) {
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

test('places3: no landmark, franchise, brand or competitor names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'disney', 'hogwarts', 'potter', 'hobbit', 'shire', 'mordor', 'narnia', 'zelda',
    'hyrule', 'minecraft', 'ghibli', 'totoro', 'howl', 'laputa', 'smaug', 'gandalf', 'merlin', 'oz', 'wonderland', 'frozen', 'elsa',
    'eiffel', 'big ben', 'golden gate', 'brooklyn', 'tower bridge', 'empire state', 'chrysler', 'taj', 'colosseum', 'pisa', 'kyoto',
    'amsterdam', 'santorini', 'neuschwanstein', 'notre', 'paris', 'london', 'venice', 'new york', 'starbucks', 'mcdonald', 'ikea',
    'monument valley', 'niagara', 'yosemite', 'grand canyon', 'brighton', 'orient express', 'hollywood', 'marvel', 'pokemon',
  ];
  for (const t of places3) {
    const hay = ` ${t.name} ${t.id.replace(/-/g, ' ')} ${(t.tags ?? []).join(' ')} `.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(` ${b}`), `${t.id} mentions ${b}`);
  }
});
