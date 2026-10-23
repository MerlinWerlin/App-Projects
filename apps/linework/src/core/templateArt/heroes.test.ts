// Heroes template art: count, ids, levels, category, tags, bounds, the per-template size budget and no franchise names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { heroes } from './heroes.ts';
import { samplePath } from './occlude.ts';
import { CATEGORIES, TEMPLATES, templatesIn } from '../templates.ts';

test('heroes: at least 13 templates, all in the Heroes category and registered', () => {
  assert.ok(heroes.length >= 13, `${heroes.length} templates`);
  assert.ok(CATEGORIES.some((c) => c.id === 'heroes' && c.label === 'Heroes'));
  assert.ok(templatesIn('heroes').length >= heroes.length);
  for (const t of heroes) {
    assert.equal(t.category, 'heroes', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('heroes: a mix of beginner, intermediate and advanced levels', () => {
  const count = (l: string) => heroes.filter((t) => t.level === l).length;
  assert.ok(count('beginner') >= 4, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 4, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 3, `${count('advanced')} advanced`);
  for (const t of heroes) assert.ok(t.level, `${t.id}: level set explicitly`);
  for (const t of heroes.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of heroes.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 8, `${t.id}: advanced has detail`);
});

test('heroes: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = heroes.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^hero-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = heroes.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  const all = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
});

test('heroes: tags are lower-case words and include "heroes"', () => {
  for (const t of heroes) {
    assert.ok((t.tags ?? []).length >= 5, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('heroes'), `${t.id}: heroes tag`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
  assert.ok(heroes.filter((t) => t.tags?.includes('kids')).length >= 4, 'some pieces in the For kids collection');
});

test('heroes: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of heroes) {
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

test('heroes: no brand or franchise names in names, ids or tags', () => {
  const banned = [
    'marvel', 'dc comics', 'avenger', 'batman', 'superman', 'spider', 'wonder woman', 'hulk', 'iron man', 'captain',
    'x-men', 'justice league', 'incredibles', 'power ranger', 'ninja turtle', 'naruto', 'disney', 'pixar', 'thor',
    'flash', 'robin', 'krypton', 'gotham', 'wolverine', 'deadpool', 'shazam', 'aquaman', 'lantern', 'joker', 'ar drawing',
  ];
  for (const t of heroes) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
    assert.ok(!/\bdc\b/.test(hay), `${t.id} mentions dc`);
  }
});
