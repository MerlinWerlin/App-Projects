// Mandalas & geometric batch 2: count, ids, levels, category, subjects, bounds, size budget, names in every locale
// and no brand or organisational names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mandalas2 } from './mandalas2.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';
import { CATALOGS } from '../../i18n/catalogs.ts';
import { LOCALES } from '../../i18n/core.ts';

test('mandalas2: at least 36 templates, all in the Mandalas category and registered', () => {
  assert.ok(mandalas2.length >= 36, `${mandalas2.length} templates`);
  const shelf = templatesIn('mandalas').map((t) => t.id);
  for (const t of mandalas2) {
    assert.equal(t.category, 'mandalas', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the Mandalas shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), [], t.id);
  }
});

test('mandalas2: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => mandalas2.filter((t) => t.level === l).length;
  for (const t of mandalas2) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 14, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 12, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 8, `${count('advanced')} advanced`);
  for (const t of mandalas2.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of mandalas2.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('mandalas2: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = mandalas2.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^(?:mandala|geo)-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of mandalas2) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('mandalas2: tags are lower-case and unique, at least 4 per piece', () => {
  for (const t of mandalas2) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('mandalas2: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of mandalas2) {
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

test('mandalas2: every piece has a non-empty name in every locale', () => {
  for (const l of LOCALES) {
    const cat = CATALOGS[l.code] as Readonly<Record<string, unknown>>;
    const bad = mandalas2.map((t) => t.id).filter((id) => {
      const v = cat[`templates.name.${id}`];
      return typeof v !== 'string' || v.trim() === '';
    });
    assert.deepEqual(bad, [], `${l.code}: missing names`);
  }
});

test('mandalas2: no brand, franchise or organisational names', () => {
  const banned = ['ar drawing', 'artrace', 'pictrace', 'sketchar', 'disney', 'nike', 'apple', 'logo', 'church', 'temple', 'masonic', 'star of david', 'pentagram'];
  for (const t of mandalas2) {
    const hay = ` ${`${t.name} ${t.id.replace(/-/g, ' ')} ${(t.tags ?? []).join(' ')}`.toLowerCase()} `;
    for (const b of banned) assert.ok(!hay.includes(` ${b}`), `${t.id} mentions ${b}`);
  }
});
