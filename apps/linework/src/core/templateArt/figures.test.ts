// Faces & figures batch (fb-1022b T121): count, ids, levels, category, tags, bounds, size budget and no celebrity,
// character, franchise or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { figures } from './figures.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

test('figures: at least 18 templates, all in the Faces category and registered', () => {
  assert.ok(figures.length >= 18, `${figures.length} templates`);
  const faces = templatesIn('faces').map((t) => t.id);
  for (const t of figures) {
    assert.equal(t.category, 'faces', t.id);
    assert.ok(faces.includes(t.id), `${t.id} missing from the Faces shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), [], t.id);
  }
});

test('figures: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => figures.filter((t) => t.level === l).length;
  for (const t of figures) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 7, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 6, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of figures.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of figures.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('figures: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = figures.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^fig-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of figures) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('figures: at least 4 lower-case tags, no duplicates', () => {
  for (const t of figures) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('figures: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of figures) {
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

test('figures: no competitor, celebrity, character, franchise or brand names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'mona lisa', 'elvis', 'marilyn', 'einstein', 'audrey', 'frida', 'beatles', 'disney',
    'marvel', 'pixar', 'ghibli', 'anime', 'manga', 'naruto', 'sailor', 'barbie', 'elsa', 'princess', 'harry', 'potter', 'hermione', 'sherlock',
    'batman', 'superman', 'spider', 'mario', 'zelda', 'lara', 'nike', 'adidas', 'ballerina',
  ];
  for (const t of figures) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
