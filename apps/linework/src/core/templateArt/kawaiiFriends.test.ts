// Kawaii friends template art (fb-1022b B2): count, ids, levels, category, tags, bounds, size budget, Pip pieces and
// no franchise or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kawaiiFriends } from './kawaiiFriends.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES } from '../templates.ts';

const CUTE_WORDS = ['cute', 'kawaii', 'chibi', 'chubby', 'round', 'happy', 'smiling', 'sleepy', 'little', 'baby', 'tiny', 'sweet'];

test('kawaiiFriends: at least 30 templates, all in the Cute & chibi category and registered', () => {
  assert.ok(kawaiiFriends.length >= 30, `${kawaiiFriends.length} templates`);
  for (const t of kawaiiFriends) {
    assert.equal(t.category, 'cute', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('kawaiiFriends: levels set explicitly, mostly beginner with intermediate and advanced pieces', () => {
  const count = (l: string) => kawaiiFriends.filter((t) => t.level === l).length;
  for (const t of kawaiiFriends) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 12, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 9, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 4, `${count('advanced')} advanced`);
  for (const t of kawaiiFriends.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of kawaiiFriends.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 8, `${t.id}: advanced has detail`);
});

test('kawaiiFriends: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = kawaiiFriends.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^kawaii-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the whole catalogue');
  const all = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
});

test('kawaiiFriends: tags are lower-case words, include cute and kawaii, and name a cute word', () => {
  for (const t of kawaiiFriends) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 5, `${t.id}: needs tags`);
    assert.ok(tags.includes('cute') && tags.includes('kawaii'), `${t.id}: cute + kawaii tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    const hay = `${t.name} ${tags.join(' ')}`.toLowerCase();
    assert.ok(CUTE_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(hay)), `${t.id}: cute word`);
  }
});

test('kawaiiFriends: Pip the pencil sprite appears at least three times, tagged cast and pip', () => {
  const pips = kawaiiFriends.filter((t) => t.tags?.includes('pip'));
  assert.ok(pips.length >= 3, `${pips.length} Pip pieces`);
  for (const t of pips) {
    assert.ok(t.tags?.includes('cast'), `${t.id}: cast tag`);
    assert.match(t.name, /\bPip\b/, `${t.id}: named after Pip`);
  }
});

test('kawaiiFriends: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of kawaiiFriends) {
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
          assert.ok(x >= 16 && x <= 384 && y >= 16 && y <= 384, `${t.id}: point ${x},${y} outside the art area`);
        }
      }
    }
  }
});

test('kawaiiFriends: no competitor, brand or franchise names in names, ids or tags', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'kitty', 'sanrio', 'pokemon', 'pikachu', 'totoro', 'ghibli', 'disney',
    'pixar', 'molang', 'sumikko', 'rilakkuma', 'pusheen', 'snoopy', 'miffy', 'kirby', 'cinnamoroll', 'kuromi', 'pompompurin',
    'gudetama', 'tamagotchi', 'polaroid', 'casper', 'stitch', 'marvel', 'nintendo', 'mario', 'sonic', 'bluey', 'peppa',
    'paddington', 'pooh', 'moomin', 'barbapapa', 'crayola',
  ];
  for (const t of kawaiiFriends) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
