import assert from 'node:assert/strict';
import { test } from 'node:test';
import lines from '../content/lines.json' with { type: 'json' };
import quips from '../content/quips.json' with { type: 'json' };
import {
  buildPacks, canPlayLine, freeGoesLeft, hasAccess, canSaveMore, dailyLine, dailyShareText, dareFor, finishTurn, guessMatches, liveStreak,
  newParty, NO_STREAK, partyLine, partyOver, playDaily, standings, titleFor, verdict, type Line, type Quips,
} from './game.ts';

const packs = buildPacks(lines as unknown as Record<string, Line[]>);
const q = quips as unknown as Quips;

test('content: every pack has lines, ids are unique, lines are short', () => {
  const ids = new Set<string>();
  let total = 0;
  for (const p of packs) {
    assert.ok(p.lines.length >= 50, `${p.id} has ${p.lines.length}`);
    for (const l of p.lines) {
      assert.ok(!ids.has(l.id), `dup ${l.id}`);
      ids.add(l.id);
      assert.ok(l.t.split(' ').length <= 14);
      assert.ok([1, 2, 3].includes(l.d));
    }
    total += p.lines.length;
  }
  assert.ok(total >= 900, `total ${total}`);
});

test('10 free goes, then the lifetime unlock', () => {
  const party = packs.find((p) => p.id === 'party')!;
  assert.ok(canPlayLine(party, 100, false));
  assert.ok(hasAccess(false, 0));
  assert.ok(hasAccess(false, 9));
  assert.ok(!hasAccess(false, 10));
  assert.ok(hasAccess(true, 500));
  assert.equal(freeGoesLeft(false, 3), 7);
  assert.equal(freeGoesLeft(false, 30), 0);
  assert.equal(freeGoesLeft(true, 3), null);
  assert.ok(canSaveMore(3, false));
  assert.ok(!canSaveMore(12, false));
});

test('daily line is stable and free', () => {
  const a = dailyLine(packs, '2026-10-24');
  const b = dailyLine(packs, '2026-10-24');
  assert.deepEqual(a, b);
  const c = dailyLine(packs, '2026-10-25');
  assert.ok(a && c);
});

test('streaks', () => {
  let s = playDaily(NO_STREAK, '2026-10-24');
  s = playDaily(s, '2026-10-24');
  assert.equal(s.current, 1);
  s = playDaily(s, '2026-10-25');
  assert.equal(s.current, 2);
  assert.equal(liveStreak(s, '2026-10-26'), 2);
  assert.equal(liveStreak(s, '2026-10-27'), 0);
  s = playDaily(s, '2026-10-28');
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
  assert.match(dailyShareText('2026-10-24', 80, 3), /🟩🟩🟩🟩⬜ 80\/100/);
});

test('party flow', () => {
  let p = newParty(['Ann', ' Bo ', ''], 2, 'copy', 5);
  assert.equal(p.players.length, 2);
  const l1 = partyLine(packs, p, false);
  p = finishTurn(p, 50);
  const l2 = partyLine(packs, p, false);
  assert.notDeepEqual(l1, l2);
  p = finishTurn(p, 70);
  assert.equal(p.round, 2);
  p = finishTurn(finishTurn(p, 10), 0);
  assert.ok(partyOver(p));
  assert.equal(standings(p)[0].name, 'Bo');
  assert.ok(dareFor(q, 1).length > 0);
});

test('guess matching is forgiving', () => {
  assert.ok(guessMatches('twinkle twinkle little star', 'Twinkle, twinkle, little star'));
  assert.ok(guessMatches('little star twinkle', 'Twinkle, twinkle, little star'));
  assert.ok(!guessMatches('happy birthday', 'Twinkle, twinkle, little star'));
});

test('verdicts and titles', () => {
  for (const s of [0, 19, 20, 55, 79, 80, 100]) assert.ok(verdict(q, s, 3).length > 0, String(s));
  assert.equal(titleFor(q, 0, 0), q.titles[0]);
  assert.equal(titleFor(q, 1000, 100), q.titles[q.titles.length - 1]);
});
