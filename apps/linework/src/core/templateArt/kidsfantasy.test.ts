// kidsfantasy (fb-1023): original Kids and Fantasy & gothic batch: counts, ids, levels, categories, subject words,
// bounds, size budget and no franchise, character or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kidsfantasy } from './kidsfantasy.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

const kids = kidsfantasy.filter((t) => t.category === 'kids');
const fantasy = kidsfantasy.filter((t) => t.category === 'fantasy');

test('kidsfantasy: 20+ kids and 18+ fantasy templates, registered on their shelves', () => {
  assert.ok(kids.length >= 20, `${kids.length} kids`);
  assert.ok(fantasy.length >= 18, `${fantasy.length} fantasy`);
  assert.equal(kids.length + fantasy.length, kidsfantasy.length, 'only kids and fantasy pieces');
  for (const t of kidsfantasy) {
    assert.ok(templatesIn(t.category).some((x) => x.id === t.id), `${t.id} missing from the shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), []);
  }
});

test('kidsfantasy: kids mostly beginner; fantasy mixes all three levels; beginners stay simple', () => {
  const count = (set: typeof kidsfantasy, l: string) => set.filter((t) => t.level === l).length;
  for (const t of kidsfantasy) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count(kids, 'beginner') > kids.length / 2, 'kids mostly beginner');
  assert.ok(count(fantasy, 'beginner') >= 5, `${count(fantasy, 'beginner')} fantasy beginner`);
  assert.ok(count(fantasy, 'intermediate') >= 4, `${count(fantasy, 'intermediate')} fantasy intermediate`);
  assert.ok(count(fantasy, 'advanced') >= 4, `${count(fantasy, 'advanced')} fantasy advanced`);
  for (const t of kidsfantasy.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of kidsfantasy.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('kidsfantasy: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = kidsfantasy.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of kids) assert.match(t.id, /^kid-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  for (const t of fantasy) assert.match(t.id, /^fan-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of kidsfantasy) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('kidsfantasy: 4+ lower-case tags each, no duplicates; kids pieces carry the kids tag', () => {
  for (const t of kidsfantasy) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
  for (const t of kids) assert.ok(t.tags?.includes('kids'), `${t.id}: kids tag`);
});

test('kidsfantasy: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of kidsfantasy) {
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

test('kidsfantasy: no franchise, character, landmark, brand or competitor names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'disney', 'pixar', 'marvel', 'pokemon', 'hogwarts', 'potter', 'hobbit',
    'mordor', 'narnia', 'zelda', 'minecraft', 'ghibli', 'totoro', 'smaug', 'toothless', 'gandalf', 'merlin', 'excalibur',
    'arthur', 'fawkes', 'buckbeak', 'pooh', 'paddington', 'thomas', 'peppa', 'bluey', 'barney', 'lego', 'duplo', 'fisher',
    'tonka', 'jcb', 'cat', 'godzilla', 'dumbo', 'nemo', 'elsa', 'frozen', 'oz', 'wonderland', 'addams', 'munster', 'starbucks',
  ];
  for (const t of kidsfantasy) {
    const hay = ` ${t.name} ${t.id.replace(/-/g, ' ')} ${(t.tags ?? []).join(' ')} `.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(` ${b} `), `${t.id} mentions ${b}`);
  }
});
