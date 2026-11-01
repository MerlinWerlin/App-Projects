// T125 travel games core: seeded shuffle, card build, line check, deck draw without repeats, score keeper, state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  addPlayer,
  addPoints,
  ALL_LINES,
  BINGO_CELLS,
  bingoFor,
  bingoLines,
  buildCard,
  cellsOnLines,
  cleanGames,
  cleanMarks,
  cleanPlayers,
  cleanTicks,
  drawCard,
  FREE,
  FREE_INDEX,
  GAMES_KEY,
  isFullCard,
  leaders,
  MAX_PLAYERS,
  MAX_SCORE,
  memoryNote,
  missingPlayers,
  modeForKind,
  newLines,
  newSeed,
  playersFor,
  putBingo,
  setBingoMarks,
  showBingo,
  removePlayer,
  resetScores,
  rng,
  seedFrom,
  shuffle,
  toggleMark,
  toggleTick,
  type BingoTile,
  type DeckCard,
} from './games.ts';

const tiles = (n: number): BingoTile[] => Array.from({ length: n }, (_, i) => ({ id: `t${String(i).padStart(2, '0')}`, label: `Tile ${i}`, icon: 'sun' }));

test('seedFrom is stable and spreads; rng is deterministic in [0,1)', () => {
  assert.equal(seedFrom('abc'), seedFrom('abc'));
  assert.notEqual(seedFrom('abc'), seedFrom('abd'));
  const a = rng(42);
  const b = rng(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(rng(1)(), rng(2)());
  assert.equal(newSeed(1000), newSeed(1000));
});

test('shuffle: same seed same order, a permutation, input untouched, different seeds differ', () => {
  const list = Array.from({ length: 30 }, (_, i) => i);
  const copy = list.slice();
  const s1 = shuffle(list, 7);
  assert.deepEqual(shuffle(list, 7), s1);
  assert.deepEqual(list, copy);
  assert.deepEqual(s1.slice().sort((a, b) => a - b), list);
  assert.notDeepEqual(shuffle(list, 8), s1);
  assert.deepEqual(shuffle([], 1), []);
});

test('buildCard: 25 squares, free centre, 24 distinct tiles, deterministic by mode + seed, input order ignored', () => {
  const t = tiles(30);
  const card = buildCard(t, 'air', 123);
  assert.ok(card);
  assert.equal(card.cells.length, BINGO_CELLS);
  assert.equal(card.cells[FREE_INDEX], FREE);
  const ids = card.cells.filter((c) => c !== FREE);
  assert.equal(new Set(ids).size, 24);
  assert.deepEqual(buildCard(t.slice().reverse(), 'air', 123), card);
  assert.notDeepEqual(buildCard(t, 'air', 124)?.cells, card.cells);
  assert.notDeepEqual(buildCard(t, 'road', 123)?.cells, card.cells);
  assert.equal(buildCard(tiles(23), 'air', 1), null);
  assert.ok(buildCard(tiles(24), 'air', 1));
});

test('lines: 12 lines; marks cleaned with free always in; toggle never unmarks free', () => {
  assert.equal(ALL_LINES.length, 12);
  assert.deepEqual(cleanMarks([]), [FREE_INDEX]);
  assert.deepEqual(cleanMarks([3, 3, -1, 25, 1.5, 'x', 0]), [0, 3, FREE_INDEX]);
  assert.deepEqual(toggleMark([FREE_INDEX], FREE_INDEX), [FREE_INDEX]);
  assert.deepEqual(toggleMark([FREE_INDEX], 4), [4, FREE_INDEX]);
  assert.deepEqual(toggleMark([4, FREE_INDEX], 4), [FREE_INDEX]);
});

test('bingoLines: a row, a column, both diagonals (centre counts as free)', () => {
  assert.deepEqual(bingoLines([0, 1, 2, 3]), []);
  assert.deepEqual(bingoLines([0, 1, 2, 3, 4]).map((l) => l.id), ['row0']);
  assert.deepEqual(bingoLines([10, 11, 13, 14]).map((l) => l.id), ['row2']);
  assert.deepEqual(bingoLines([2, 7, 17, 22]).map((l) => l.id), ['col2']);
  assert.deepEqual(bingoLines([0, 6, 18, 24]).map((l) => l.id), ['diag0']);
  assert.deepEqual(bingoLines([4, 8, 16, 20]).map((l) => l.id), ['diag1']);
  const all = Array.from({ length: 25 }, (_, i) => i);
  assert.equal(bingoLines(all).length, 12);
  assert.ok(isFullCard(all));
  assert.ok(!isFullCard([0]));
});

test('newLines: only the lines a change completed', () => {
  const before = [0, 1, 2, 3];
  const after = toggleMark(before, 4);
  assert.deepEqual(newLines(before, after).map((l) => l.id), ['row0']);
  assert.deepEqual(newLines(after, after), []);
  // Completing a row and a diagonal with one tap.
  const b2 = [1, 2, 3, 4, 6, 18, 24];
  assert.deepEqual(newLines(b2, toggleMark(b2, 0)).map((l) => l.id).sort(), ['diag0', 'row0']);
  assert.deepEqual([...cellsOnLines(bingoLines([0, 1, 2, 3, 4]))].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
});

test('modeForKind', () => {
  assert.equal(modeForKind('flight'), 'air');
  assert.equal(modeForKind('train'), 'train');
  assert.equal(modeForKind('car'), 'road');
  assert.equal(modeForKind('bus'), 'road');
  assert.equal(modeForKind('hotel'), 'city');
  assert.equal(modeForKind(undefined), 'city');
});

test('drawCard: no repeats until the deck is through, then a new round with a moved seed; deterministic', () => {
  const deck: DeckCard[] = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, text: `Card ${i}` }));
  let seen: string[] = [];
  let seed = 5;
  const firstRound: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = drawCard(deck, seen, seed);
    assert.ok(d);
    assert.equal(d.newRound, false);
    assert.ok(!seen.includes(d.card.id));
    firstRound.push(d.card.id);
    seen = d.seen;
    seed = d.seed;
  }
  assert.equal(new Set(firstRound).size, 8);
  const next = drawCard(deck, seen, seed);
  assert.ok(next);
  assert.equal(next.newRound, true);
  assert.equal(next.seed, 6);
  assert.deepEqual(next.seen, [next.card.id]);
  assert.deepEqual(drawCard(deck, [], 5), drawCard(deck, [], 5));
  assert.equal(drawCard([], [], 1), null);
  // Stale ids (a card removed from the content) are ignored.
  const d = drawCard(deck, ['gone', 'c1'], 5);
  assert.ok(d && !d.seen.includes('gone') && d.card.id !== 'c1');
});

test('score keeper: You + companions, points clamp, reset, add/remove, leaders', () => {
  const p = playersFor(
    [
      { id: 'a', name: '  Ana  ' },
      { id: 'b', name: '' },
      { id: 'a', name: 'Dup' },
      { id: 'c', name: 'Sam' },
    ],
    'You',
  );
  assert.deepEqual(p.map((x) => [x.id, x.name, x.score]), [['me', 'You', 0], ['a', 'Ana', 0], ['c', 'Sam', 0]]);
  let s = addPoints(p, 'a', 3);
  s = addPoints(s, 'c', -2);
  assert.deepEqual(s.map((x) => x.score), [0, 3, 0]);
  assert.deepEqual(leaders(s).map((x) => x.id), ['a']);
  s = addPoints(s, 'me', 3);
  assert.deepEqual(leaders(s).map((x) => x.id), ['me', 'a']);
  assert.equal(addPoints(s, 'a', 5000)[1].score, MAX_SCORE);
  assert.deepEqual(resetScores(s).map((x) => x.score), [0, 0, 0]);
  assert.deepEqual(leaders(resetScores(s)), []);
  assert.equal(addPlayer(s, 'ana', 'x').length, 3, 'same name refused');
  assert.equal(addPlayer(s, '   ', 'x').length, 3);
  assert.equal(addPlayer(s, 'Grandad', 'g').at(-1)?.name, 'Grandad');
  assert.deepEqual(removePlayer(s, 'a').map((x) => x.id), ['me', 'c']);
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
  assert.equal(playersFor(many, 'You').length, MAX_PLAYERS);
  assert.deepEqual(missingPlayers(removePlayer(s, 'c'), [{ id: 'c', name: 'Sam' }, { id: 'a', name: 'Ana' }]).map((x) => x.id), ['c']);
});

test('memoryNote: prompt then answer; empty answer gives nothing', () => {
  assert.equal(memoryNote('Best moment?', '  The tram ride  '), 'Best moment?\nThe tram ride');
  assert.equal(memoryNote('Best moment?', '   '), '');
});

test('spot it ticks: cleaned against the list, toggled', () => {
  const items = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }];
  assert.deepEqual(cleanTicks(['b', 'b', 'zz', 3], items), ['b']);
  assert.deepEqual(toggleTick(['a'], 'a'), []);
  assert.deepEqual(toggleTick([], 'a'), ['a']);
});

test('cleanGames: bad input resets, good input kept, unknown fields dropped', () => {
  assert.deepEqual(cleanGames(null), { spy: {}, seen: {}, deckSeed: 1, players: [] });
  const g = cleanGames({
    bingo: { mode: 'train', seed: 99, marks: [1, 1, 40] },
    spy: { air: ['x', 'x', 2], moon: ['y'] },
    seen: { rather: ['wyr-1'], other: ['q'] },
    deckSeed: 4,
    players: [{ id: 'me', name: 'You', score: 2 }, { id: 'me', name: 'Again', score: 1 }, { id: 'z', name: '', score: 1 }, { id: 'k', name: 'Kai', score: -3 }],
    secret: 'drop me',
  });
  assert.deepEqual(g, {
    bingo: { mode: 'train', seed: 99, marks: [1, FREE_INDEX] },
    bingoCards: { train: { seed: 99, marks: [1, FREE_INDEX] } },
    spy: { air: ['x'] },
    seen: { rather: ['wyr-1'] },
    deckSeed: 4,
    players: [{ id: 'me', name: 'You', score: 2 }, { id: 'k', name: 'Kai', score: 0 }],
  });
  assert.equal(cleanGames({ bingo: { mode: 'boat', seed: 1, marks: [] } }).bingo, undefined);
  assert.deepEqual(cleanPlayers('nope'), []);
});

test('games state stays on the phone: no trip file, export or model code mentions it', () => {
  assert.equal(GAMES_KEY, 'satchel.games.v1');
  for (const f of ['./tripfile.ts', './model.ts', './tripcopy.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /games/i, f);
  }
});

// ---- T126 bingo marks per mode ----

test('T126 bingo keeps a card and marks per mode: switching mode and back restores them', () => {
  let g = cleanGames(null);
  g = showBingo(g, 'air', 11);
  g = setBingoMarks(g, 'air', toggleMark(toggleMark(bingoFor(g, 'air')!.marks, 0), 1));
  g = showBingo(g, 'train', 22);
  assert.equal(g.bingo?.mode, 'train');
  assert.deepEqual(bingoFor(g, 'train'), { mode: 'train', seed: 22, marks: [FREE_INDEX] }, 'a new mode gets a fresh card');
  g = setBingoMarks(g, 'train', [3, FREE_INDEX]);
  g = showBingo(g, 'road', 33);
  g = showBingo(g, 'city', 44);
  // Back to air: the same card (seed) and its marks; a later seed never replaces a saved card.
  g = showBingo(g, 'air', 99);
  assert.deepEqual(g.bingo, { mode: 'air', seed: 11, marks: [0, 1, FREE_INDEX] });
  assert.deepEqual(bingoFor(g, 'train'), { mode: 'train', seed: 22, marks: [3, FREE_INDEX] });
  assert.deepEqual(Object.keys(g.bingoCards ?? {}).sort(), ['air', 'city', 'road', 'train']);
  // Survives a save and read (cleaned on every read).
  const back = cleanGames(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(back, g);
  // A new card or clearing marks touches only that mode.
  g = putBingo(g, { mode: 'air', seed: 5, marks: [] });
  g = setBingoMarks(g, 'road', [24]);
  assert.deepEqual(bingoFor(g, 'air'), { mode: 'air', seed: 5, marks: [FREE_INDEX] });
  assert.deepEqual(bingoFor(g, 'train')?.marks, [3, FREE_INDEX]);
  assert.deepEqual(bingoFor(g, 'road')?.marks, [FREE_INDEX, 24]);
  assert.equal(g.bingo?.mode, 'road');
  // Marks for a mode with no card: unchanged.
  const empty = cleanGames(null);
  assert.equal(setBingoMarks(empty, 'air', [1]), empty);
});

test('T126 bingo state saved before per-mode cards: the one card becomes its mode\'s card; bad cards dropped', () => {
  const old = cleanGames({ bingo: { mode: 'road', seed: 7, marks: [2] } });
  assert.deepEqual(old.bingoCards, { road: { seed: 7, marks: [2, FREE_INDEX] } });
  assert.deepEqual(bingoFor(old, 'road'), { mode: 'road', seed: 7, marks: [2, FREE_INDEX] });
  assert.equal(bingoFor(old, 'air'), null);
  const g = cleanGames({ bingoCards: { air: { seed: 1, marks: [99, 4] }, boat: { seed: 2, marks: [] }, train: { seed: 'x' }, city: null } });
  assert.deepEqual(g.bingoCards, { air: { seed: 1, marks: [4, FREE_INDEX] } });
  assert.equal(g.bingo, undefined);
  // The current card is the newest copy of its mode.
  assert.deepEqual(cleanGames({ bingo: { mode: 'air', seed: 3, marks: [] }, bingoCards: { air: { seed: 1, marks: [] } } }).bingoCards?.air, { seed: 3, marks: [FREE_INDEX] });
  // Still phone-only: nothing about bingo is added to a trip (the store key is the same).
  assert.equal(GAMES_KEY, 'satchel.games.v1');
});
