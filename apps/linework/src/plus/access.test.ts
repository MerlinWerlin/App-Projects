import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../core/templates.ts';
import { STARTER_TEMPLATE_COUNT } from './entitlement.ts';
import {
  LOADING_ACCESS,
  accessFor,
  canStartTrial,
  isPaidOnly,
  outlineLocked,
  parseTrialStart,
  starterIds,
  templateLocked,
  trialStartFromPurchase,
  TRIAL_DAYS,
} from './access.ts';

const DAY = 24 * 60 * 60 * 1000;

test('not started (guideline 3.1.1): free tier only until the trial is started or Plus is owned', () => {
  const none = accessFor(false, null, 5_000 * DAY);
  assert.deepEqual(none, { full: false, reason: 'none', daysLeft: 0 });
  assert.equal(canStartTrial(none), true);
  assert.equal(outlineLocked(none), true);
  const s = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);
  const starter = TEMPLATES.find((t) => s.has(t.id))!.id;
  const other = TEMPLATES.find((t) => !s.has(t.id))!.id;
  assert.equal(templateLocked(none, s, starter), false, 'starters are free before the trial too');
  assert.equal(templateLocked(none, s, other), true, 'the rest of the library is locked before the trial');
  // Owning Plus without ever starting the trial unlocks everything.
  assert.deepEqual(accessFor(true, null, 5_000 * DAY), { full: true, reason: 'owned', daysLeft: 0 });
});

test('trial: 14 days full access from the start, then expired', () => {
  const start = 1_000 * DAY;
  assert.deepEqual(accessFor(false, start, start), { full: true, reason: 'trial', daysLeft: TRIAL_DAYS });
  assert.equal(accessFor(false, start, start + 13.5 * DAY).daysLeft, 1);
  assert.deepEqual(accessFor(false, start, start + 14 * DAY), { full: false, reason: 'expired', daysLeft: 0 });
  assert.deepEqual(accessFor(true, start, start + 400 * DAY), { full: true, reason: 'owned', daysLeft: 0 });
  for (const a of [accessFor(false, start, start), accessFor(false, start, start + 20 * DAY), accessFor(true, start, start)]) {
    assert.equal(canStartTrial(a), false, a.reason);
  }
});

test('loading looks unlocked (no lock flash) but never claims a trial or offers one', () => {
  assert.equal(LOADING_ACCESS.full, true);
  assert.equal(LOADING_ACCESS.reason, 'loading');
  assert.equal(canStartTrial(LOADING_ACCESS), false);
});

test('trial start: missing or garbage means not started; a valid stored start is honoured (grandfathered)', () => {
  const now = 5_000 * DAY;
  assert.deepEqual(parseTrialStart(null, now), { start: null, fixed: false });
  assert.deepEqual(parseTrialStart('', now), { start: null, fixed: false });
  assert.deepEqual(parseTrialStart('x', now), { start: null, fixed: false });
  assert.deepEqual(parseTrialStart('-5', now), { start: null, fixed: false });
  // Old builds wrote the first-launch time to the same key: it keeps counting from then, nobody loses days.
  assert.deepEqual(parseTrialStart(String(now - DAY), now), { start: now - DAY, fixed: false });
  assert.equal(accessFor(false, parseTrialStart(String(now - 3 * DAY), now).start, now).daysLeft, 11);
  assert.equal(accessFor(false, parseTrialStart(String(now - 30 * DAY), now).start, now).reason, 'expired');
  // A start far in the future (clock changed) is pulled back to now and saved.
  assert.deepEqual(parseTrialStart(String(now + 3 * DAY), now), { start: now, fixed: true });
});

test('trial start comes from the store transaction: original date first, then transaction date, else now', () => {
  const now = 5_000 * DAY;
  const t0 = now - 2 * DAY;
  // expo-iap: numbers in ms
  assert.equal(trialStartFromPurchase({ productId: 'x', transactionDate: t0 }, now), t0);
  // A restore / re-download keeps the original purchase date.
  assert.equal(trialStartFromPurchase({ transactionDate: now, originalTransactionDateIOS: t0 }, now), t0);
  // Older shapes: numeric strings, seconds, ISO strings
  assert.equal(trialStartFromPurchase({ transactionDate: String(t0) }, now), t0);
  assert.equal(trialStartFromPurchase({ transactionDate: t0 / 1000 }, now), t0);
  assert.equal(trialStartFromPurchase({ purchaseDate: new Date(t0).toISOString() }, now), t0);
  // Nothing usable, or a date far in the future: now.
  assert.equal(trialStartFromPurchase({}, now), now);
  assert.equal(trialStartFromPurchase(null, now), now);
  assert.equal(trialStartFromPurchase({ transactionDate: 'soon', originalTransactionDateIOS: 0 }, now), now);
  assert.equal(trialStartFromPurchase({ transactionDate: now + 10 * DAY }, now), now);
});

test('starters: the promised count, all beginner, spread over categories; others lock after the trial', () => {
  const s = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);
  assert.equal(s.size, STARTER_TEMPLATE_COUNT);
  const picked = TEMPLATES.filter((t) => s.has(t.id));
  assert.ok(picked.every((t) => (t.level ?? 'beginner') === 'beginner'));
  assert.ok(new Set(picked.map((t) => t.category)).size >= 10);
  const expired = accessFor(false, 0, 100 * DAY);
  const first = picked[0]!.id;
  const other = TEMPLATES.find((t) => !s.has(t.id))!.id;
  assert.equal(templateLocked(expired, s, first), false);
  assert.equal(templateLocked(expired, s, other), true);
  assert.equal(templateLocked(accessFor(true, 0, 100 * DAY), s, other), false);
  assert.equal(outlineLocked(expired), true);
  assert.equal(outlineLocked(accessFor(false, 0, 0)), false);
});

test('starters are unchanged by the trial change (same 24 ids, deterministic)', () => {
  const a = [...starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT)];
  const b = [...starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT)];
  assert.deepEqual(a, b);
  assert.equal(a.length, 24);
});

// fb-1023b: the 24 starters promised in the release (docs/OWNER_1022D.md) must not move when templates are added.
const RELEASE_STARTERS = ['tulip', 'cat-sitting', 'fish', 'owl', 'smiling-face', 'hello-block-letters', 'perspective-cube', 'mandala-8-petal', 'orn-snowflake-simple', 'scn-gift-box', 'scn-moon-stars', 'scn-simple-house', 'cute-cat-loaf', 'hero-star-shield', 'game-pixel-heart', 'movie-retro-rocket', 'fairy-crown', 'kids-woodland-fox', 'daisy', 'snail', 'wild-whale', 'wild-ladybird', 'profile-face', 'alphabet-a-e'];

test('starters are pinned to the 1.0 release set', () => {
  assert.deepEqual([...starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT)].sort(), [...RELEASE_STARTERS].sort());
});

test('fb-1023b C2: Trade & workshop is paid only — never a starter, open in the trial and with Plus, locked after', () => {
  const trade = TEMPLATES.filter((t) => t.category === 'trade');
  const s = starterIds(TEMPLATES, STARTER_TEMPLATE_COUNT);
  assert.ok(trade.every((t) => isPaidOnly(t)));
  assert.deepEqual(trade.filter((t) => s.has(t.id)).map((t) => t.id), []);
  // even a catalogue of only trade templates yields no starters
  const fake = [{ id: 'trade-x', name: 'x', category: 'trade' as const, viewBox: '0 0 400 400', paths: ['M 0 0'] }];
  assert.equal(starterIds(fake, STARTER_TEMPLATE_COUNT).size, 0);
  const ids = trade.length ? trade.map((t) => t.id) : ['trade-x'];
  const trial = accessFor(false, 0, 3 * DAY);
  const expired = accessFor(false, 0, 100 * DAY);
  const owned = accessFor(true, 0, 100 * DAY);
  for (const id of ids) {
    assert.equal(templateLocked(trial, s, id), false, `${id} open in trial`);
    assert.equal(templateLocked(owned, s, id), false, `${id} open with Plus`);
    assert.equal(templateLocked(expired, s, id), true, `${id} locked after trial`);
  }
});
