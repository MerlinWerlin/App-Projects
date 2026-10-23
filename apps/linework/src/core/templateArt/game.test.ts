// Game world template art: count, ids, levels, category, tags, bounds, the per-template size budget and
// the no-franchise rule (genre tropes only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from './game.ts';
import { samplePath } from './occlude.ts';
import { CATEGORIES, TEMPLATES, templatesIn } from '../templates.ts';

test('game: at least 13 templates, all in the Game world category and registered', () => {
  assert.ok(game.length >= 13, `${game.length} templates`);
  assert.ok(CATEGORIES.some((c) => c.id === 'game' && c.label === 'Game world'));
  assert.ok(templatesIn('game').length >= game.length);
  for (const t of game) {
    assert.equal(t.category, 'game', t.id);
    assert.ok(TEMPLATES.some((x) => x.id === t.id), `${t.id} missing from TEMPLATES`);
    assert.equal(t.viewBox, '0 0 400 400');
  }
});

test('game: levels set explicitly with a beginner / intermediate / advanced mix', () => {
  const count = (l: string) => game.filter((t) => t.level === l).length;
  for (const t of game) assert.ok(['beginner', 'intermediate', 'advanced'].includes(t.level ?? ''), `${t.id}: level ${t.level}`);
  assert.ok(count('beginner') >= 4, `${count('beginner')} beginner`);
  assert.ok(count('intermediate') >= 4, `${count('intermediate')} intermediate`);
  assert.ok(count('advanced') >= 3, `${count('advanced')} advanced`);
  for (const t of game.filter((x) => x.level === 'beginner')) assert.ok(t.paths.length <= 40, `${t.id}: beginner stays simple`);
  for (const t of game.filter((x) => x.level === 'advanced')) assert.ok((t.detail ?? []).length > 0, `${t.id}: advanced has detail`);
});

test('game: ids are prefixed, unique and kebab-case; names unique across the catalogue', () => {
  const ids = game.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^game-[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const names = game.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  const all = TEMPLATES.map((t) => t.name);
  assert.equal(new Set(all).size, all.length, 'names unique across the whole catalogue');
});

test('game: tags are lower-case words, include "game" and are searchable', () => {
  for (const t of game) {
    assert.ok((t.tags ?? []).length >= 5, `${t.id}: needs tags`);
    assert.ok(t.tags?.includes('game'), `${t.id}: game tag`);
    for (const tag of t.tags ?? []) assert.match(tag, /^[a-z][a-z-]*$/, `${t.id}: tag ${tag}`);
  }
});

test('game: paths are valid absolute commands inside the viewBox, within budget', () => {
  for (const t of game) {
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

test('game: no game, console, studio or franchise names in names, ids or tags', () => {
  const banned = [
    'nintendo', 'mario', 'luigi', 'zelda', 'link', 'pokemon', 'pikachu', 'sonic', 'sega', 'minecraft', 'creeper',
    'fortnite', 'roblox', 'among us', 'amogus', 'pac-man', 'pacman', 'tetris', 'playstation', 'xbox', 'gundam',
    'transformers', 'kirby', 'halo', 'yoshi', 'metroid', 'megaman', 'mega man', 'donkey kong', 'space invader',
    'dragon quest', 'final fantasy', 'switch', 'gameboy', 'game boy', 'atari', 'steam', 'ar drawing',
  ];
  for (const t of game) {
    const hay = `${t.name} ${t.id} ${(t.tags ?? []).join(' ')}`.toLowerCase();
    for (const b of banned) assert.ok(!hay.includes(b), `${t.id} mentions ${b}`);
  }
});
