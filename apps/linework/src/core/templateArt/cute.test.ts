// Cute & chibi template art: count, ids, levels, category, tags, bounds and the per-template size budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cute } from './cute.ts';
import { clip, region, samplePath, stack, union } from './occlude.ts';
import { circle } from './draw.ts';
import { CATEGORIES, TEMPLATES, templatesIn } from '../templates.ts';

test('cute: 20 templates, all in the Cute & chibi category and registered', () => {
  assert.equal(cute.length, 20);
  assert.ok(CATEGORIES.some((c) => c.id === 'cute' && c.label === 'Cute & chibi'));
  assert.equal(templatesIn('cute').filter((t) => t.id.startsWith('cute-')).length, 20);
  // the Cute & chibi shelf also holds the fb-1022b kawaii batches (kawaiiFood, kawaiiFriends)
  assert.ok(templatesIn('cute').length >= 80);
  for (const t of cute) {
    assert.equal(t.category, 'cute', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('cute: levels set explicitly, mostly beginner with some intermediate', () => {
  for (const t of cute) assert.ok(t.level === 'beginner' || t.level === 'intermediate', `${t.id}: level ${t.level}`);
  const beginners = cute.filter((t) => t.level === 'beginner').length;
  assert.ok(beginners >= 12, `${beginners} beginner templates`);
  assert.ok(cute.some((t) => t.level === 'intermediate'));
  for (const t of cute.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
});

test('cute: ids are prefixed, unique and kebab-case; names unique', () => {
  const ids = cute.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^cute-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = cute.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  const all = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
});

test('cute: tags are lower-case words, include "cute" and are searchable', () => {
  for (const t of cute) {
    assert.ok((t.tags ?? []).length >= 5, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('cute'), `${t.id}: cute tag`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('cute: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of cute) {
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
      // every drawn point (curves and arcs sampled) stays on the canvas
      for (const sub of samplePath(d, 4)) {
        for (const [x, y] of sub.pts) {
          assert.ok(x >= -2 && x <= 402 && y >= -2 && y <= 402, `${t.id}: point ${x},${y} off the canvas`);
        }
      }
    }
  }
});

test('cute: no competitor, brand or franchise names in names, ids or tags', () => {
  const banned = ['ar drawing', 'artrace', 'pictrace', 'sketchar', 'kitty', 'sanrio', 'pokemon', 'pikachu', 'totoro', 'ghibli', 'disney', 'molang', 'sumikko', 'rilakkuma', 'pusheen'];
  for (const t of cute) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});

test('occlude: a shape behind another loses exactly the hidden part', () => {
  const front = circle(100, 100, 50);
  const back = circle(160, 100, 50);
  const [f, b] = stack([front, back]);
  assert.equal(f, front, 'front shape keeps its exact curves');
  assert.notEqual(b, back);
  for (const sub of samplePath(b, 1)) {
    for (const [x, y] of sub.pts) assert.ok(Math.hypot(x - 100, y - 100) >= 49.5, `hidden point ${x},${y} drawn`);
  }
  // keeping the inside instead
  const inside = clip(back, [region(front)], 'inside');
  for (const sub of samplePath(inside, 1)) {
    for (const [x, y] of sub.pts) assert.ok(Math.hypot(x - 100, y - 100) <= 50.5);
  }
  // a merged outline has no point inside either circle
  for (const sub of samplePath(union([front, back]), 1)) {
    for (const [x, y] of sub.pts) {
      assert.ok(Math.hypot(x - 100, y - 100) >= 49.5 && Math.hypot(x - 160, y - 100) >= 49.5);
    }
  }
  assert.equal(clip(circle(300, 300, 10), [region(front)]), circle(300, 300, 10), 'untouched shapes stay exact');
  assert.equal(clip(circle(100, 100, 10), [region(front)]), '', 'fully hidden shapes vanish');
});
