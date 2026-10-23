// Kawaii food, sweets, plants and weather (fb-1022b B2): count, ids, levels, category, tags, bounds, size budget and
// no franchise or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kawaiiFood } from './kawaiiFood.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';

const CUTE_WORDS = ['cute', 'kawaii', 'chibi', 'chubby', 'round', 'happy', 'smiling', 'sleepy', 'little', 'baby', 'tiny', 'sweet'];

test('kawaiiFood: at least 30 templates, all in the Cute category and registered', () => {
  assert.ok(kawaiiFood.length >= 30, `${kawaiiFood.length} templates`);
  const cute = templatesIn('cute').map((t) => t.id);
  for (const t of kawaiiFood) {
    assert.equal(t.category, 'cute', t.id);
    assert.ok(cute.includes(t.id), `${t.id} missing from the Cute shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('kawaiiFood: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => kawaiiFood.filter((t) => t.level === l).length;
  for (const t of kawaiiFood) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 12, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 9, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of kawaiiFood.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of kawaiiFood.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('kawaiiFood: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = kawaiiFood.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^kawaii-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of kawaiiFood) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('kawaiiFood: tags include cute and kawaii plus 3 more, lower-case; a cute word in the name or tags', () => {
  for (const t of kawaiiFood) {
    const tags = t.tags ?? [];
    assert.ok(tags.includes('cute') && tags.includes('kawaii'), `${t.id}: cute + kawaii tags`);
    assert.ok(tags.filter((x) => x !== 'cute' && x !== 'kawaii').length >= 3, `${t.id}: needs 3+ more tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
    const words = ` ${t.name.toLowerCase()} `;
    assert.ok(CUTE_WORDS.some((w) => words.includes(` ${w} `)), `${t.id}: name needs a cute word`);
  }
});

test('kawaiiFood: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of kawaiiFood) {
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

test('kawaiiFood: no competitor, brand, franchise or character names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'kitty', 'sanrio', 'pokemon', 'pikachu', 'totoro', 'ghibli', 'disney',
    'molang', 'sumikko', 'rilakkuma', 'pusheen', 'gudetama', 'pompompurin', 'cinnamoroll', 'kuromi', 'melody', 'kirby',
    'nintendo', 'mario', 'anpanman', 'doraemon', 'shopkins', 'squishmallow', 'oreo', 'nutella', 'kitkat', 'pocky', 'hershey',
    'mcdonald', 'starbucks', 'haribo', 'chupa', 'smarties', 'peppa', 'bluey', 'barbapapa', 'moomin', 'miffy', 'snoopy',
  ];
  for (const t of kawaiiFood) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
