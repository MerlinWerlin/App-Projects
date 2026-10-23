// patterns2 batch (fb-1023c): frames, borders, labels, tiles, quilt blocks, lace and paisley for 'Frames & patterns' and
// original script / bubble lettering for 'Lettering'. Count, ids, levels, categories, tags, bounds, size budget, and
// no brand, font or competitor names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { patterns2 } from './patterns2.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

const pats = patterns2.filter((t) => t.category === 'patterns');
const letters = patterns2.filter((t) => t.category === 'lettering');

test('patterns2: at least 26 patterns and 10 lettering pieces, all registered on their shelves', () => {
  assert.ok(pats.length >= 26, `${pats.length} patterns`);
  assert.ok(letters.length >= 10, `${letters.length} lettering`);
  assert.equal(pats.length + letters.length, patterns2.length, 'only patterns and lettering');
  const shelf = new Set([...templatesIn('patterns'), ...templatesIn('lettering')].map((t) => t.id));
  for (const t of patterns2) {
    assert.ok(shelf.has(t.id), `${t.id} missing from the shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), []);
  }
});

test('patterns2: levels set explicitly, about 40% beginner, 35% intermediate, 25% advanced', () => {
  for (const t of patterns2) assert.ok(t.level, `${t.id}: level set explicitly`);
  const share = (l: string) => patterns2.filter((t) => t.level === l).length / patterns2.length;
  assert.ok(share('beginner') >= 0.33 && share('beginner') <= 0.47, `beginner ${share('beginner')}`);
  assert.ok(share('intermediate') >= 0.28 && share('intermediate') <= 0.42, `intermediate ${share('intermediate')}`);
  assert.ok(share('advanced') >= 0.18 && share('advanced') <= 0.32, `advanced ${share('advanced')}`);
  for (const t of patterns2.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of patterns2.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('patterns2: ids prefixed by category, unique and kebab-case; names unique across the catalogue', () => {
  const ids = patterns2.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of pats) assert.match(t.id, /^pat-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  for (const t of letters) assert.match(t.id, /^letter-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of patterns2) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('patterns2: tags are lower-case, unique, 4 or more; lettering is tagged lettering', () => {
  for (const t of patterns2) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
  for (const t of letters) assert.ok(t.tags?.includes('lettering'), `${t.id}: tag lettering`);
});

test('patterns2: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of patterns2) {
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

test('patterns2: no competitor, brand, font or off-limits subject in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'skull', 'dagger', 'knife', 'sword', 'gun', 'weapon', 'bird', 'snake',
    'disney', 'hallmark', 'cricut', 'helvetica', 'arial', 'times', 'comic sans', 'lobster', 'pacifico', 'brush script',
    'olympic', 'versace', 'chanel', 'gucci', 'louis', 'fish',
  ];
  for (const t of patterns2) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
