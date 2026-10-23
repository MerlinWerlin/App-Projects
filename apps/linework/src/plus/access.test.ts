import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../core/templates.ts';
import { STARTER_TEMPLATE_COUNT } from './entitlement.ts';
import { accessFor, outlineLocked, parseTrialStart, starterIds, templateLocked, TRIAL_DAYS } from './access.ts';

const DAY = 24 * 60 * 60 * 1000;

test('trial: 14 days full access from first launch, then expired', () => {
  const start = 1_000 * DAY;
  assert.deepEqual(accessFor(false, start, start), { full: true, reason: 'trial', daysLeft: TRIAL_DAYS });
  assert.equal(accessFor(false, start, start + 13.5 * DAY).daysLeft, 1);
  assert.deepEqual(accessFor(false, start, start + 14 * DAY), { full: false, reason: 'expired', daysLeft: 0 });
  assert.deepEqual(accessFor(true, start, start + 400 * DAY), { full: true, reason: 'owned', daysLeft: 0 });
});

test('trial start: missing, garbage or future values restart now', () => {
  const now = 5_000 * DAY;
  assert.deepEqual(parseTrialStart(null, now), { start: now, fresh: true });
  assert.deepEqual(parseTrialStart('x', now), { start: now, fresh: true });
  assert.deepEqual(parseTrialStart(String(now + 3 * DAY), now), { start: now, fresh: true });
  assert.deepEqual(parseTrialStart(String(now - DAY), now), { start: now - DAY, fresh: false });
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
});
