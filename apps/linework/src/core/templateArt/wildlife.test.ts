// Wildlife template art: ids, levels, categories and the per-template size budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wildlife } from './wildlife.ts';

test('wildlife: a curated set with every level represented', () => {
  assert.ok(wildlife.length >= 16, `expected at least 16 templates, got ${wildlife.length}`);
  const levels = new Set(wildlife.map((t) => t.level));
  for (const level of ['beginner', 'intermediate', 'advanced']) assert.ok(levels.has(level as never), level);
  for (const t of wildlife) {
    assert.ok(t.level, `${t.id}: level is set explicitly`);
    assert.ok(['wildlife', 'animals', 'sealife'].includes(t.category), `${t.id}: category ${t.category}`);
  }
});

test('wildlife: ids are prefixed, unique and kebab-case; names unique', () => {
  const ids = wildlife.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^wild-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = wildlife.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
});

test('wildlife: tags are lower-case words and every template has some', () => {
  for (const t of wildlife) {
    assert.ok((t.tags ?? []).length >= 3, `${t.id}: needs tags`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('wildlife: path budget (<= 30000 characters, <= 300 path strings, 1-decimal coordinates)', () => {
  for (const t of wildlife) {
    const all = [...t.paths, ...(t.detail ?? [])];
    assert.ok(all.length <= 300, `${t.id}: ${all.length} paths`);
    const chars = all.reduce((n, d) => n + d.length, 0);
    assert.ok(chars <= 30000, `${t.id}: ${chars} characters`);
    for (const d of all) {
      assert.match(d, /^M[MLCQAZ0-9. -]*$/, `${t.id}: absolute M L C Q A Z commands only`);
      for (const num of d.match(/-?\d*\.?\d+/g) ?? []) {
        assert.ok(!/\.\d\d/.test(num), `${t.id}: ${num} has more than one decimal`);
      }
    }
  }
});

test('wildlife: advanced templates are genuinely detailed', () => {
  for (const t of wildlife.filter((x) => x.level === 'advanced')) {
    const subpaths = [...t.paths, ...(t.detail ?? [])].join(' ').split('M').length - 1;
    assert.ok(subpaths >= 150, `${t.id}: only ${subpaths} strokes for an advanced template`);
  }
  for (const t of wildlife.filter((x) => x.level === 'beginner')) {
    assert.ok(t.paths.length <= 40, `${t.id}: beginner templates stay simple`);
  }
});
