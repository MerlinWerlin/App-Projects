// D104-1 (oversight cycle 104): guard the fb-1022 template import. Every template in the five new categories
// (Heroes, Game world, Movie night, Fairy tales, Kids) has a non-empty name in all 11 locales, names are unique
// per locale, and the New bubble lists exactly those sets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGS } from './catalogs.ts';
import { LOCALES } from './core.ts';
import { TEMPLATES, type TemplateCategory } from '../core/templates.ts';
import { NEW_SETS, shelfPool, shelfBubbles } from '../core/templateShelf.ts';

const FB_1022_SETS: readonly TemplateCategory[] = ['heroes', 'game', 'movies', 'fairytales', 'kids'];
const FB_1022_COUNTS: Readonly<Record<string, number>> = { heroes: 13, game: 15, movies: 40, fairytales: 40, kids: 25 };

const newOnes = TEMPLATES.filter((t) => FB_1022_SETS.includes(t.category));

test('fb-1022 sets hold at least the imported templates (minimums; fb-1022b batches grow them)', () => {
  assert.ok(newOnes.length >= 133, `${newOnes.length}`);
  for (const c of FB_1022_SETS) {
    const count = newOnes.filter((t) => t.category === c).length;
    assert.ok(count >= FB_1022_COUNTS[c], `${c}: ${count}`);
  }
});

test('all 11 locales ship', () => {
  assert.equal(LOCALES.length, 11);
  for (const l of LOCALES) assert.ok(CATALOGS[l.code], l.code);
});

test('every fb-1022 template has a non-empty name in every locale', () => {
  for (const l of LOCALES) {
    const cat = CATALOGS[l.code] as Readonly<Record<string, unknown>>;
    const bad = newOnes
      .map((t) => t.id)
      .filter((id) => {
        const v = cat[`templates.name.${id}`];
        return typeof v !== 'string' || v.trim() === '';
      });
    assert.deepEqual(bad, [], `${l.code}: missing or empty names`);
  }
});

test('template names are unique per locale (whole catalogue)', () => {
  for (const l of LOCALES) {
    const cat = CATALOGS[l.code] as Readonly<Record<string, unknown>>;
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const t of TEMPLATES) {
      const v = cat[`templates.name.${t.id}`];
      if (typeof v !== 'string') continue;
      const key = v.trim().toLocaleLowerCase(l.code);
      const prev = seen.get(key);
      if (prev) dupes.push(`${prev} / ${t.id} = "${v}"`);
      else seen.set(key, t.id);
    }
    assert.deepEqual(dupes, [], `${l.code}: duplicate names`);
  }
});

test('the New bubble lists the fb-1022 sets plus Sea life and the kawaii batches (D110-2)', () => {
  assert.deepEqual([...NEW_SETS].sort(), [...FB_1022_SETS, 'sealife'].sort());
  const pool = shelfPool(TEMPLATES, 'new');
  assert.deepEqual([...new Set(pool.map((t) => t.category))].sort(), [...FB_1022_SETS, 'cute', 'sealife'].sort());
  const expected = TEMPLATES.filter((t) => NEW_SETS.includes(t.category) || t.id.startsWith('kawaii-'));
  assert.deepEqual(pool.map((t) => t.id), expected.map((t) => t.id));
  assert.ok(pool.filter((t) => t.category === 'sealife').length >= 30);
  assert.ok(pool.filter((t) => t.id.startsWith('kawaii-')).length >= 60);
  assert.ok(shelfBubbles(TEMPLATES).includes('new'));
});
