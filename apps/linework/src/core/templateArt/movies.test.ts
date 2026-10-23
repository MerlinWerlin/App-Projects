// Movie night template art: count, ids, levels, category, tags, bounds, the per-template size budget and
// a guard against franchise / studio names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { movies } from './movies.ts';
import { samplePath } from './occlude.ts';
import { CATEGORIES, TEMPLATES, templatesIn } from '../templates.ts';

test('movies: at least 40 templates, all in the Movie night category and registered', () => {
  assert.ok(movies.length >= 40, `${movies.length} templates`);
  assert.ok(CATEGORIES.some((c) => c.id === 'movies' && c.label === 'Movie night'));
  assert.equal(templatesIn('movies').length, movies.length);
  for (const t of movies) {
    assert.equal(t.category, 'movies', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('movies: levels set explicitly with a beginner / intermediate / advanced mix', () => {
  for (const t of movies) assert.ok(t.level === 'beginner' || t.level === 'intermediate' || t.level === 'advanced', `${t.id}: level ${t.level}`);
  const count = (l: string) => movies.filter((t) => t.level === l).length;
  assert.ok(count('beginner') >= 12, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 12, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 8, `${count('advanced')} advanced`);
  for (const t of movies.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length + (t.detail?.length ?? 0) <= 40, `${t.id}: beginner stays simple`);
  for (const t of movies.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length >= 8, `${t.id}: advanced has detail strokes`);
});

test('movies: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = movies.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^movie-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = movies.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  const all = TEMPLATES.map((t) => t.name.toLowerCase());
  for (const n of names) assert.equal(all.filter((x) => x === n.toLowerCase()).length, 1, `${n} used twice in the catalogue`);
});

test('movies: tags are lower-case words, include "movies" and are searchable', () => {
  for (const t of movies) {
    assert.ok((t.tags ?? []).length >= 5, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('movies'), `${t.id}: movies tag`);
    assert.equal(new Set(t.tags).size, t.tags?.length, `${t.id}: duplicate tags`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('movies: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of movies) {
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

test('movies: no studio, franchise or character names in names, ids or tags', () => {
  const banned = [
    'disney', 'pixar', 'dreamworks', 'lucasfilm', 'star wars', 'star-wars', 'jedi', 'sith', 'lightsaber', 'harry potter', 'potter',
    'hogwarts', 'jurassic', 'marvel', 'dc comics', 'e.t.', 'toy story', 'buzz', 'woody', 'wall-e', 'walle', 'shrek', 'frozen',
    'minion', 'avatar', 'lord of the rings', 'gandalf', 'hobbit', 'godzilla', 'king kong', 'indiana', 'jones', 'jack sparrow',
    'caribbean', 'trek', 'enterprise', 'r2', 'c-3po', 'yoda', 'toothless', 'smaug', 'universal', 'warner', 'paramount', 'netflix',
    'sherlock', 'holmes', 'poirot', 'marple', 'scooby', 'sully', 'monsters inc', 'swamp thing', 'nessie', 'loch ness', 'kong',
    'kaiju', 'lone ranger', 'woody', 'spielberg', 'ghostbusters', 'alien vs', 'xenomorph', 'baby yoda', 'grogu', 'mandalorian',
    'stitch', 'lilo', 'gru', 'bond', '007', 'mission impossible', 'tintin', 'pirates of', 'barbossa', 'hook', 'blackbeard',
    'iron giant', 'sesame', 'muppet', 'elmo', 'cookie monster', 'gruffalo', 'wild things',
  ];
  const words = ['et'];
  for (const t of movies) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
    const tokens = hay.split(/[^a-z0-9]+/);
    for (const w of words) assert.ok(!tokens.includes(w), `${t.id} mentions ${w}`);
  }
});

test('movies: the Linework cast appears on-model by name and tag (docs/CAST.md)', () => {
  const cast: Record<string, string> = { nova: 'Nova', quill: 'Inspector Quill', ottoline: 'Captain Ottoline', sage: 'Sheriff Sage' };
  for (const [tag, name] of Object.entries(cast)) {
    const pieces = movies.filter((t) => t.tags?.includes(tag));
    assert.ok(pieces.length >= 2, `${name}: ${pieces.length} pieces`);
    for (const t of pieces) {
      assert.ok(t.tags?.includes('cast'), `${t.id}: cast tag`);
      assert.ok(t.name.startsWith(name), `${t.id}: name starts with ${name}`);
    }
  }
  for (const t of movies.filter((x) => x.tags?.includes('cast'))) assert.ok(Object.keys(cast).some((k) => t.tags?.includes(k)), `${t.id}: names its character`);
  for (const t of movies) assert.ok(!/skull|crossbones/.test(`${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase()) || !t.tags?.includes('cast'), `${t.id}: no skulls on the cast`);
});
