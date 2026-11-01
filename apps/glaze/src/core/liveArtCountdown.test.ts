// T245: countdown art pieces (dune-countdown, rehearsal-countdown) go live with a person-chosen day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countdownArtDays,
  countdownArtKey,
  countdownArtTarget,
  isCountdownArtPiece,
  liveArtPlan,
  liveArtSpec,
  parseCountdownArtTargets,
  parseLiveArtSpec,
  withCountdownArtTarget,
  withLiveArt,
} from './liveArt.ts';

const dune = { id: 'dune-countdown', kind: 'art' as const };
const rehearsal = { id: 'rehearsal-countdown', kind: 'art' as const };

test('T245: both countdown art pieces are countdown pieces; others are not', () => {
  assert.equal(isCountdownArtPiece('desert-afterglow', dune), true);
  assert.equal(isCountdownArtPiece('rosewater-reverie', rehearsal), true);
  assert.equal(isCountdownArtPiece('opal-abyss', { id: 'abyss-battery', kind: 'art' }), false);
  assert.equal(isCountdownArtPiece('x', { id: 'y', kind: 'countdown', numberFree: true }), true);
  assert.equal(isCountdownArtPiece('x', { id: 'y', kind: 'countdown' }), false);
  assert.equal(isCountdownArtPiece('x', { id: 'y', kind: 'art', numberFree: true }), false);
});

test('T245: no day set = Art (no plan, no fake number); a set day makes them live with that target', () => {
  assert.equal(liveArtPlan('desert-afterglow', dune, { targets: {} }), null);
  assert.equal(withLiveArt('desert-afterglow', [dune], { targets: {} })[0], dune);
  const targets = withCountdownArtTarget({}, 'desert-afterglow', 'dune-countdown', '2026-12-25');
  const plan = liveArtPlan('desert-afterglow', dune, { targets });
  assert.equal(plan?.kind, 'countdown');
  assert.equal(plan?.cover, true);
  assert.equal(plan?.target, '2026-12-25');
  // Per piece: the other piece still has no day.
  assert.equal(liveArtPlan('rosewater-reverie', rehearsal, { targets }), null);
  const listed = withLiveArt('desert-afterglow', [dune], { targets })[0];
  assert.equal(listed.kind, 'countdown');
  assert.equal(listed.liveArt, true);
});

test('T245: the target day travels in the stored live spec the widget reads', () => {
  const targets = { [countdownArtKey('rosewater-reverie', 'rehearsal-countdown')]: '2027-03-01' };
  const plan = liveArtPlan('rosewater-reverie', rehearsal, { targets })!;
  const spec = liveArtSpec(plan, { w: 1024, h: 1024 }, { w: 340, h: 340 }, 'bleed', { bg: '#112233', ink: '#fafafa' })!;
  assert.equal(spec.target, '2027-03-01');
  const back = parseLiveArtSpec(JSON.parse(JSON.stringify(spec)));
  assert.equal(back?.kind, 'countdown');
  assert.equal(back?.target, '2027-03-01');
});

test('T245: setting, clearing and reading targets', () => {
  let t = withCountdownArtTarget({}, 'desert-afterglow', 'dune-countdown', '2026-12-25');
  assert.equal(countdownArtTarget(t, 'desert-afterglow', 'dune-countdown'), '2026-12-25');
  t = withCountdownArtTarget(t, 'desert-afterglow', 'dune-countdown', '2026-02-30');
  assert.equal(countdownArtTarget(t, 'desert-afterglow', 'dune-countdown'), null, 'an invalid day clears');
  t = withCountdownArtTarget({ 'a/b': '2026-01-01' }, 'desert-afterglow', 'dune-countdown', null);
  assert.deepEqual(t, { 'a/b': '2026-01-01' });
});

test('T245: tolerant parse of the stored map', () => {
  assert.deepEqual(parseCountdownArtTargets(null), {});
  assert.deepEqual(parseCountdownArtTargets([1]), {});
  assert.deepEqual(parseCountdownArtTargets('x'), {});
  assert.deepEqual(
    parseCountdownArtTargets({ 'desert-afterglow/dune-countdown': '2026-12-25', 'a/b': '2026-13-01', nokey: '2026-12-25', 'c/d': 5 }),
    { 'desert-afterglow/dune-countdown': '2026-12-25' },
  );
});

test('T245: days remaining in local calendar days, never negative, null without a day', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  assert.equal(countdownArtDays('2026-12-25', now, 0), 54);
  assert.equal(countdownArtDays('2026-11-02', now, 0), 1);
  assert.equal(countdownArtDays('2026-11-01', now, 0), 0);
  assert.equal(countdownArtDays('2026-10-01', now, 0), 0, 'past days show 0 like the widget');
  // 23:30 UTC on 1 Nov is already 2 Nov in Sydney (+11:00).
  assert.equal(countdownArtDays('2026-11-03', new Date('2026-11-01T23:30:00Z'), 660), 1);
  assert.equal(countdownArtDays(null, now, 0), null);
  assert.equal(countdownArtDays('', now, 0), null);
  assert.equal(countdownArtDays('2026-02-30', now, 0), null);
});
