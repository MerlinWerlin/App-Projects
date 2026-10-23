// Still life batch 2 (fb-1022b T121): count, ids, levels, category, tags, bounds, size budget and no brand names
// (cameras, radios, typewriters and shoes stay unbranded).
import test from 'node:test';
import assert from 'node:assert/strict';
import { stilllife2 } from './stilllife2.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

test('stilllife2: at least 17 templates, all in the Still life category and registered', () => {
  assert.ok(stilllife2.length >= 17, `${stilllife2.length} templates`);
  const shelf = templatesIn('stilllife').map((t) => t.id);
  for (const t of stilllife2) {
    assert.equal(t.category, 'stilllife', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the Still life shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), [], t.id);
  }
});

test('stilllife2: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => stilllife2.filter((t) => t.level === l).length;
  for (const t of stilllife2) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 6, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 5, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of stilllife2.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of stilllife2.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('stilllife2: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = stilllife2.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^still-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of stilllife2) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('stilllife2: at least 4 lower-case tags, no duplicates', () => {
  for (const t of stilllife2) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('stilllife2: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of stilllife2) {
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

test('stilllife2: no competitor, brand or maker names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'leica', 'nikon', 'canon', 'kodak', 'polaroid', 'sony', 'fuji', 'olympus', 'hasselblad',
    'rolleiflex', 'philips', 'grundig', 'roberts', 'marconi', 'olivetti', 'remington', 'underwood', 'smith-corona', 'royal', 'nike', 'adidas',
    'converse', 'vans', 'puma', 'reebok', 'starbucks', 'ikea', 'pixar', 'luxo', 'wine', 'beer', 'whisky',
  ];
  for (const t of stilllife2) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
