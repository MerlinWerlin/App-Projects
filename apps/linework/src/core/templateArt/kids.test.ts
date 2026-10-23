// Kids template art: count, ids, levels, category, tags, bounds, the per-template size budget and originality guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kids } from './kids.ts';
import { samplePath } from './occlude.ts';
import { CATEGORIES, TEMPLATES, templatesIn } from '../templates.ts';

test('kids: at least 14 templates, all in the Kids category and registered', () => {
  assert.ok(kids.length >= 14, `${kids.length} templates`);
  assert.ok(CATEGORIES.some((c) => c.id === 'kids' && c.label === 'Kids'));
  assert.equal(templatesIn('kids').filter((t) => t.id.startsWith('kids-')).length, kids.length);
  for (const t of kids) {
    assert.equal(t.category, 'kids', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('kids: mostly beginner, some intermediate, a few advanced scenes', () => {
  const by = (l: string) => kids.filter((t) => t.level === l);
  for (const t of kids) assert.ok(['beginner', 'intermediate', 'advanced'].includes(t.level ?? ''), `${t.id}: level ${t.level}`);
  assert.ok(by('beginner').length >= 7, `${by('beginner').length} beginner`);
  assert.ok(by('intermediate').length >= 3, `${by('intermediate').length} intermediate`);
  assert.ok(by('advanced').length >= 2, `${by('advanced').length} advanced`);
  assert.ok(by('beginner').length > kids.length / 2, 'mostly beginner');
  for (const t of by('beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple (${t.paths.length} paths)`);
  const detailOf = (l: string) => Math.min(...by(l).map((t) => (t.detail ?? []).length));
  const maxBeginnerDetail = Math.max(...by('beginner').map((t) => (t.detail ?? []).length));
  assert.ok(detailOf('advanced') > maxBeginnerDetail, 'advanced pieces carry more detail strokes than any beginner piece');
});

test('kids: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = kids.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^kids-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = kids.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  const all = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
  const others = new Set(TEMPLATES.filter((t) => t.category !== 'kids').map((t) => t.name.toLowerCase()));
  for (const n of names) assert.ok(!others.has(n.toLowerCase()), `${n} clashes with another category`);
});

test('kids: tags are lower-case words, include "kids" and join the seasonal collections', () => {
  for (const t of kids) {
    assert.ok((t.tags ?? []).length >= 5, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('kids'), `${t.id}: kids tag`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
  const tagged = (tag: string) => kids.filter((t) => t.tags?.includes(tag)).map((t) => t.id);
  assert.ok(tagged('halloween').length >= 2, 'ghost and pumpkin are in the Halloween collection');
  assert.ok(tagged('christmas').length >= 2, 'tree and snowman are in the Christmas collection');
});

test('kids: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of kids) {
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

test('kids: no brand, character or franchise names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'disney', 'pixar', 'peppa', 'bluey', 'paw patrol', 'paw-patrol', 'thomas',
    'pooh', 'mickey', 'minnie', 'cocomelon', 'lego', 'sesame', 'barbie', 'elmo', 'spongebob', 'paddington', 'frozen', 'olaf',
    'pokemon', 'pikachu', 'hello kitty', 'sanrio', 'dora', 'barney', 'teletubb', 'shark family', 'baby shark', 'fireman sam',
  ];
  for (const t of kids) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
