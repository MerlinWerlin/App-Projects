// Still life batch 3 (fb-1023): count, ids, levels, category, tags, bounds, size budget and no brand names
// (cameras, record players, instruments, bags and shoes stay unbranded).
import test from 'node:test';
import assert from 'node:assert/strict';
import { stilllife3 } from './stilllife3.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';

test('stilllife3: at least 36 templates, all in the Still life category and registered', () => {
  assert.ok(stilllife3.length >= 36, `${stilllife3.length} templates`);
  const shelf = templatesIn('stilllife').map((t) => t.id);
  for (const t of stilllife3) {
    assert.equal(t.category, 'stilllife', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the Still life shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), [], t.id);
  }
});

test('stilllife3: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => stilllife3.filter((t) => t.level === l).length;
  for (const t of stilllife3) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 12, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 10, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 8, `${count('advanced')} advanced`);
  for (const t of stilllife3.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of stilllife3.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('stilllife3: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = stilllife3.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^obj-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of stilllife3) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('stilllife3: at least 4 lower-case tags, no duplicates', () => {
  for (const t of stilllife3) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 4, `${t.id}: needs 4+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('stilllife3: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of stilllife3) {
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

test('stilllife3: no competitor, brand or maker names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'leica', 'nikon', 'canon', 'kodak', 'polaroid', 'sony', 'fuji', 'olympus', 'hasselblad',
    'rolleiflex', 'philips', 'grundig', 'roberts', 'marconi', 'olivetti', 'remington', 'underwood', 'smith-corona', 'royal', 'nike', 'adidas',
    'converse', 'vans', 'puma', 'reebok', 'starbucks', 'ikea', 'pixar', 'luxo', 'wine', 'beer', 'whisky', 'singer', 'bialetti', 'technics',
    'fender', 'gibson', 'yamaha', 'stradivari', 'rolex', 'casio', 'ray-ban', 'gucci', 'chanel', 'brompton', 'raleigh', 'hermes', 'beats', 'bose',
  ];
  for (const t of stilllife3) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
