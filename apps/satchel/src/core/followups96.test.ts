// T108 (run-96 follow-ups): gift map spots as Map-tab pins, the tip total handed back to an open expense form,
// Italy's 4 October from 2026, and the round-up steps still marked to re-check.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { giftPins, giftPinTarget } from './gifts.ts';
import { holidaysBetween } from './holidays.ts';
import type { Trip } from './model.ts';
import { draftFromExpense } from './spending.ts';
import { applyTipFill, calcTip, ROUND_STEP_RECHECK, roundStep, roundStepNeedsRecheck, tipFill } from './tipping.ts';

const trip = (id: string, gifts: unknown): Trip => ({ id, gifts } as unknown as Trip);

test('giftPins: only gifts with a valid map spot, ids unique across trips, a tap leads back to the gift', () => {
  const people = [
    { id: 'p1', name: 'Mum', gifts: [
      { id: 'g1', what: 'Tea towel', status: 'idea', lat: 35.0, lon: 135.7 },
      { id: 'g2', what: 'Matcha', status: 'bought' },
      { id: 'g3', what: 'Fan', status: 'packed', lat: 999, lon: 0 },
    ] },
  ];
  const pins = giftPins([trip('t1', people), trip('t2', people), trip('t3', undefined)]);
  assert.equal(pins.length, 2);
  assert.deepEqual(pins.map((p) => p.what), ['Tea towel', 'Tea towel']);
  assert.notEqual(pins[0].id, pins[1].id);
  assert.ok(pins.every((p) => p.id.startsWith('g:')));
  assert.equal(pins[0].person, 'Mum');
  assert.deepEqual(giftPinTarget(pins, pins[1].id), { tripId: 't2', personId: 'p1', giftId: 'g1' });
  assert.equal(giftPinTarget(pins, 'g:nope'), null);
  assert.equal(giftPinTarget(pins, 's:g1'), null);
});

test('tipFill: the tip-included total (or my share) as amount text in the calculator currency', () => {
  const res = calcTip({ bill: 10000, currency: 'EUR', norm: { kind: 'percent', low: 10, high: 10 } as never, mode: 'custom', customPercent: 10, included: false, roundUp: false, people: 3 });
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.result.total, 11000);
  assert.deepEqual(tipFill(res.result, 'EUR'), { amount: '110.00', currency: 'EUR' });
  assert.deepEqual(tipFill(res.result, 'EUR', 'mine'), { amount: '36.67', currency: 'EUR' });
  assert.equal(tipFill(res.result, 'XX'), null);
  const yen = calcTip({ bill: 1200, currency: 'JPY', norm: { kind: 'none' } as never, mode: 'none', included: false, roundUp: false, people: 1 });
  assert.ok(yen.ok);
  if (yen.ok) assert.deepEqual(tipFill(yen.result, 'JPY'), { amount: '1200', currency: 'JPY' });
});

test('applyTipFill: fills amount and currency of the open draft, keeps category, day and note', () => {
  const draft = draftFromExpense({ id: 'e1', amount: 500, currency: 'USD', category: 'food', day: '2026-11-02', note: 'Lunch', createdAt: '' } as never);
  const next = applyTipFill(draft, { amount: '110.00', currency: 'EUR' });
  assert.deepEqual(next, { ...draft, amount: '110.00', currency: 'EUR' });
  assert.equal(draft.amount, '5.00'); // the original draft is untouched
});

test('Italy: 4 October (St Francis) is a national holiday from 2026, not before', () => {
  const day = (y: number) => holidaysBetween('IT', `${y}-10-04`, `${y}-10-04`).map((h) => h.name);
  assert.deepEqual(day(2025), []);
  assert.deepEqual(day(2026), ['Feast of St Francis of Assisi']);
  assert.deepEqual(day(2031), ['Feast of St Francis of Assisi']);
  // A Sunday in 2026: Italy moves nothing off weekends.
  assert.deepEqual(holidaysBetween('IT', '2026-10-05', '2026-10-05'), []);
});

test('round-up steps for BRL, HUF, IDR, VND are marked to re-check (and only those curated ones)', () => {
  assert.deepEqual([...ROUND_STEP_RECHECK].sort(), ['BRL', 'HUF', 'IDR', 'VND']);
  for (const c of ROUND_STEP_RECHECK) {
    assert.ok(roundStep(c) > 0, c);
    assert.equal(roundStepNeedsRecheck(c), true, c);
  }
  assert.equal(roundStepNeedsRecheck('EUR'), false);
  assert.equal(roundStepNeedsRecheck('USD'), false);
});

test('T108 strings are in the catalogue', () => {
  for (const k of ['f96.gift.pinSub', 'f96.gift.pinA11y', 'f96.gift.opened', 'f96.tip.fromExpenseHint', 'f96.tip.useTotal', 'f96.tip.useTotalHint', 'f96.tip.useMine', 'f96.tip.useMineHint', 'f96.tip.filled', 'f96.tip.stepRecheck']) {
    assert.ok(typeof (en as Record<string, string>)[k] === 'string', k);
  }
});
