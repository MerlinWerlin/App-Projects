// Fairy tales template art (fb-1022): count, ids, levels, category, tags, bounds, budget and banned franchise words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fairytales } from './fairytales.ts';
import { samplePath } from './occlude.ts';
import { CATEGORIES, TEMPLATES, templatesIn } from '../templates.ts';

test('fairytales: at least 40 templates, all in the Fairy tales category and registered', () => {
  assert.ok(fairytales.length >= 40, `${fairytales.length} templates`);
  assert.ok(CATEGORIES.some((c) => c.id === 'fairytales' && c.label === 'Fairy tales'));
  assert.equal(templatesIn('fairytales').length, fairytales.length);
  for (const t of fairytales) {
    assert.equal(t.category, 'fairytales', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('fairytales: levels mix beginner, intermediate and advanced', () => {
  const count = (l: string) => fairytales.filter((t) => t.level === l).length;
  for (const t of fairytales) assert.ok(['beginner', 'intermediate', 'advanced'].includes(t.level ?? ''), `${t.id}: level ${t.level}`);
  assert.ok(count('beginner') >= 12, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 12, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 8, `${count('advanced')} advanced`);
  for (const t of fairytales.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of fairytales.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 10, `${t.id}: advanced has detail`);
});

test('fairytales: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = fairytales.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^fairy-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = fairytales.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  const all = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
});

test('fairytales: tags are lower-case words and include "fairytale"', () => {
  for (const t of fairytales) {
    assert.ok((t.tags ?? []).length >= 5, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('fairytale'), `${t.id}: fairytale tag`);
    assert.equal(new Set(t.tags).size, t.tags?.length, `${t.id}: duplicate tag`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('fairytales: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of fairytales) {
    const all = [...t.paths, ...(t.detail ?? [])];
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    const chars = all.reduce((n, d) => n + d.length, 0);
    assert.ok(chars <= 30000, `${t.id}: ${chars} characters`);
    for (const d of all) {
      assert.ok(d.trim().length > 0, `${t.id}: empty path`);
      assert.match(d, /^M[MLCQAZ0-9. -]*$/, `${t.id}: absolute M L C Q A Z commands only`);
      for (const num of d.match(/-?\d*\.?\d+/g) ?? []) {
        assert.ok(!/\.\d\d/.test(num), `${t.id}: ${num} has more than one decimal`);
      }
      for (const sub of samplePath(d, 4)) {
        for (const [x, y] of sub.pts) {
          assert.ok(x >= -2 && x <= 402 && y >= -2 && y <= 402, `${t.id}: point ${x},${y} off the canvas`);
        }
      }
    }
  }
});

test('fairytales: no studio, brand or franchise names in names, ids or tags', () => {
  const banned = [
    'disney', 'pixar', 'dreamworks', 'frozen', 'elsa', 'anna', 'ariel', 'cinderella', 'rapunzel', 'belle', 'aurora',
    'moana', 'shrek', 'barbie', 'my little pony', 'pony', 'tangled', 'snow white', 'jasmine', 'mulan', 'tiana', 'merida',
    'tinker', 'sofia', 'fiona', 'arendelle', 'olaf', 'ar drawing', 'sketchar', 'puss', 'maleficent', 'smaug',
    'toothless', 'spyro', 'gingy', 'pooh', 'paddington', 'zelda',
  ];
  for (const t of fairytales) {
    const words = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) {
      const hit = b.includes(' ') ? words.includes(b) : words.split(/[^a-z]+/).includes(b);
      assert.ok(!hit, `${t.id} mentions ${b}`);
    }
  }
});

test('fairytales: cast pieces stay on-model (tags cast + the name, name in the title)', () => {
  const cast = ['bramble', 'fern', 'mossy'];
  for (const t of fairytales.filter((x) => x.tags?.includes('cast'))) {
    const who = cast.filter((c) => t.tags?.includes(c));
    assert.ok(who.length >= 1, `${t.id}: cast piece names its character in the tags`);
    for (const c of who) assert.ok(t.name.toLowerCase().includes(c), `${t.id}: ${c} in the name`);
  }
  for (const c of cast) {
    const n = fairytales.filter((x) => x.tags?.includes('cast') && x.tags.includes(c)).length;
    assert.ok(n >= 2, `${c}: ${n} pieces`);
  }
});
