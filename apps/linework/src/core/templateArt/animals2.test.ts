// Animals & pets batch (fb-1022b T120): count, ids, levels, category, subjects, bounds, size budget, names in every
// locale and no franchise or brand names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { animals2 } from './animals2.ts';
import { samplePath } from './occlude.ts';
import { TEMPLATES, templatesIn } from '../templates.ts';
import { categoryProblems } from '../templateSubjects.ts';
import { CATALOGS } from '../../i18n/catalogs.ts';
import { LOCALES } from '../../i18n/core.ts';

test('animals2: at least 30 templates, all in the Animals category and registered', () => {
  assert.ok(animals2.length >= 30, `${animals2.length} templates`);
  const shelf = templatesIn('animals').map((t) => t.id);
  for (const t of animals2) {
    assert.equal(t.category, 'animals', t.id);
    assert.ok(shelf.includes(t.id), `${t.id} missing from the Animals shelf`);
    assert.equal(t.viewBox, '0 0 400 400');
    assert.deepEqual(categoryProblems(t), [], t.id);
  }
});

test('animals2: levels set explicitly, a mix of beginner, intermediate and advanced', () => {
  const count = (l: string) => animals2.filter((t) => t.level === l).length;
  for (const t of animals2) assert.ok(t.level, `${t.id}: level set explicitly`);
  assert.ok(count('beginner') >= 12, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 10, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 6, `${count('advanced')} advanced`);
  for (const t of animals2.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of animals2.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 6, `${t.id}: advanced has detail`);
});

test('animals2: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = animals2.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^ani-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const t of animals2) assert.equal(all.filter((n) => n === t.name.toLowerCase()).length, 1, `${t.name} is not unique`);
  const allIds = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(allIds).size, allIds.length, 'ids unique across the catalogue');
});

test('animals2: tags are lower-case and unique, at least 3 per piece', () => {
  for (const t of animals2) {
    const tags = t.tags ?? [];
    assert.ok(tags.length >= 3, `${t.id}: needs 3+ tags`);
    for (const tag of tags) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
    assert.equal(new Set(tags).size, tags.length, `${t.id}: duplicate tags`);
  }
});

test('animals2: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of animals2) {
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

test('animals2: every piece has a non-empty name in every locale', () => {
  for (const l of LOCALES) {
    const cat = CATALOGS[l.code] as Readonly<Record<string, unknown>>;
    const bad = animals2.map((t) => t.id).filter((id) => {
      const v = cat[`templates.name.${id}`];
      return typeof v !== 'string' || v.trim() === '';
    });
    assert.deepEqual(bad, [], `${l.code}: missing names`);
  }
});

test('animals2: no birds or sea creatures, and no competitor, brand, franchise or character names', () => {
  const banned = [
    'ar drawing', 'artrace', 'pictrace', 'sketchar', 'disney', 'pixar', 'dreamworks', 'ghibli', 'pokemon', 'pikachu', 'eevee',
    'sonic', 'nintendo', 'simba', 'nala', 'mufasa', 'bambi', 'thumper', 'dumbo', 'pooh', 'tigger', 'eeyore', 'piglet', 'garfield',
    'snoopy', 'scooby', 'pluto', 'goofy', 'mickey', 'minnie', 'babe', 'shaun', 'peppa', 'bluey', 'clifford', 'lassie', 'marley',
    'paddington', 'baloo', 'bagheera', 'shere', 'kung fu', 'madagascar', 'zootopia', 'nemo', 'rocket', 'sid', 'manny', 'puss',
    'totoro', 'hello kitty', 'sanrio', 'miffy', 'felix', 'tom and jerry', 'stitch', 'zazu', 'pumbaa', 'timon', 'chip', 'dale',
  ];
  const offShelf = ['bird', 'owl', 'parrot', 'duck', 'hen', 'fish', 'whale', 'dolphin', 'shark', 'seal', 'otter', 'penguin', 'turtle'];
  for (const t of animals2) {
    const hay = ` ${`${t.name} ${t.id.replace(/-/g, ' ')} ${(t.tags ?? []).join(' ')}`.toLowerCase()} `;
    for (const b of banned) assert.ok(!hay.includes(` ${b}`), `${t.id} mentions ${b}`);
    for (const w of offShelf) assert.ok(!hay.includes(` ${w} `), `${t.id} names ${w}`);
  }
});
