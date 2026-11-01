import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hatch, newGame } from './game.ts';
import { applyTaps, imageKeyFor, parseTaps, widgetState } from './widget.ts';

const T0 = Date.UTC(2026, 10, 1, 0, 0, 0);
const DAY = '2026-11-01';
const labels = { feed: 'Feed', pet: 'Pet', egg: 'Next egg', eggsReady: 'eggs ready', spark: 'Spark', hatch: 'Hatch' };

test('widget state reflects the buddy and the egg meter', () => {
  const empty = widgetState(newGame(T0, DAY, 'wilds'), '', labels);
  assert.equal(empty.hasPet, false);
  assert.equal(empty.imageKey, 'none');
  assert.equal(empty.eggsReady, 1);
  const g = hatch(newGame(T0, DAY, 'wilds'), T0, DAY).state;
  const w = widgetState(g, 'Biscuit', labels);
  assert.equal(w.hasPet, true);
  assert.equal(w.name, 'Biscuit');
  assert.equal(w.imageKey, imageKeyFor(g));
  assert.equal(w.eggCost, 100);
  assert.ok(JSON.stringify(w).length < 4000);
});

test('image key changes when the buddy grows', () => {
  const g = hatch(newGame(T0, DAY, 'wilds'), T0, DAY).state;
  const grown = { ...g, pets: g.pets.map((p) => ({ ...p, stage: 1 as const })) };
  assert.notEqual(imageKeyFor(g), imageKeyFor(grown));
});

test('taps parse defensively and sort by time', () => {
  assert.deepEqual(parseTaps(null), []);
  assert.deepEqual(parseTaps('not json'), []);
  assert.deepEqual(parseTaps('{"a":1}'), []);
  const t = parseTaps(JSON.stringify([{ action: 'pet', at: 5 }, { action: 'dance', at: 1 }, { action: 'feed', at: 2 }, null]));
  assert.deepEqual(t.map((x) => x.action), ['feed', 'pet']);
});

test('widget taps go through the normal care rules', () => {
  let g = hatch(newGame(T0, DAY, 'wilds'), T0, DAY).state;
  g = { ...g, happiness: 40, happinessAt: T0 };
  const day = () => DAY;
  const s = applyTaps(g, [{ action: 'feed', at: T0 + 1000 }, { action: 'feed', at: T0 + 2000 }, { action: 'pet', at: T0 + 3000 }], day);
  assert.equal(s.totals.care, 2, 'second feed is inside the cooldown');
  assert.ok(s.happiness > 70);
  // A tap dated before the last update is moved forward, not applied in the past.
  const late = applyTaps(s, [{ action: 'pet', at: T0 }], day);
  assert.ok(late.happinessAt >= s.happinessAt);
});
