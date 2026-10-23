// Sea life template art (fb-1022b B1/B4): count, ids, levels, category, tags, bounds, size budget, no franchise names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sealife } from './sealife.ts';
import { samplePath } from './occlude.ts';
import { CATEGORIES, TEMPLATES } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

test('sealife: the Sea life shelf holds at least 29 pieces, 25+ from this set, all registered', () => {
  assert.ok(CATEGORIES.some((c) => c.id === 'sealife' && c.label === 'Sea life'));
  const shelf = TEMPLATES.filter((t) => t.category === 'sealife');
  assert.ok(shelf.length >= 29, `${shelf.length} in Sea life`);
  assert.ok(sealife.length >= 25, `${sealife.length} templates`);
  for (const t of sealife) {
    assert.equal(t.category, 'sealife', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), [], t.id);
  }
});

test('sealife: beginner, intermediate and advanced pieces', () => {
  const count = (l: string) => sealife.filter((t) => t.level === l).length;
  assert.ok(count('beginner') >= 8, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 9, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 5, `${count('advanced')} advanced`);
  for (const t of sealife) assert.ok(t.level, `${t.id}: level set explicitly`);
  for (const t of sealife.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of sealife.filter((x) => x.level === 'advanced')) {
    const strokes = [...t.paths, ...(t.detail ?? [])].join(' ').split('M').length - 1;
    assert.ok((t.detail ?? []).length >= 8, `${t.id}: advanced has detail`);
    assert.ok(strokes >= 70, `${t.id}: only ${strokes} strokes for an advanced piece`);
  }
});

test('sealife: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = sealife.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^sea-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
});

test('sealife: tags are lower-case words and include sea or ocean', () => {
  for (const t of sealife) {
    assert.ok((t.tags ?? []).length >= 4, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('sea') || t.tags?.includes('ocean'), `${t.id}: sea/ocean tag`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('sealife: paths are valid absolute commands inside the art area, within budget', () => {
  for (const t of sealife) {
    const all = [...t.paths, ...(t.detail ?? [])];
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    const chars = all.reduce((n, d) => n + d.length, 0);
    assert.ok(chars <= 30000, `${t.id}: ${chars} characters`);
    for (const d of all) {
      assert.ok(d.trim().length > 0, `${t.id}: empty path`);
      assert.match(d, /^M[MLCQAZ0-9. -]*$/, `${t.id}: absolute M L C Q A Z commands only`);
      for (const num of d.match(/-?\d*\.?\d+/g) ?? []) assert.ok(!/\.\d\d/.test(num), `${t.id}: ${num} has more than one decimal`);
      for (const sub of samplePath(d, 4)) {
        for (const [x, y] of sub.pts) assert.ok(x >= 14 && x <= 386 && y >= 14 && y <= 390, `${t.id}: point ${x},${y} off the art area`);
      }
    }
  }
});

test('sealife: no brand, franchise or character names in names, ids or tags', () => {
  const banned = [
    'disney', 'pixar', 'nemo', 'dory', 'finding', 'marlin', 'gill', 'bruce', 'crush', 'squirt', 'spongebob', 'squarepants', 'squidward',
    'patrick', 'krabs', 'plankton', 'ariel', 'mermaid', 'flounder', 'sebastian', 'ursula', 'moana', 'maui', 'shamu', 'willy', 'jaws',
    'baby shark', 'octonauts', 'luca', 'ponyo', 'sharkboy', 'aquaman', 'lilo', 'pokemon', 'magikarp', 'ar drawing',
  ];
  for (const t of sealife) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!new RegExp(`\\b${b}\\b`).test(hay), `${t.id} mentions ${b}`);
  }
});
