/**
 * Couch Plus access (owner decision 7 Nov 2026): the remote and casting need grandfathering, Plus, or the 7-day trial.
 */
import {
  LOADING_ACCESS,
  TRIAL_DAYS,
  accessFor,
  canStartTrial,
  needsPurchase,
  parseTrialStart,
  trialStartFromPurchase,
} from './access';

const DAY = 86_400_000;
const NOW = 20_000 * DAY;
const base = { owned: false, grandfathered: false, trialStart: null as number | null, now: NOW };

describe('accessFor', () => {
  it('the trial is 7 days', () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  it('never started: no access, and the trial can start', () => {
    const a = accessFor(base);
    expect(a).toEqual({ full: false, reason: 'none', daysLeft: 0 });
    expect(canStartTrial(a)).toBe(true);
    expect(needsPurchase(a)).toBe(true);
  });

  it('trial window: full access for exactly 7 days, counting down', () => {
    expect(accessFor({ ...base, trialStart: NOW })).toEqual({ full: true, reason: 'trial', daysLeft: 7 });
    expect(accessFor({ ...base, trialStart: NOW - 1 })).toEqual({ full: true, reason: 'trial', daysLeft: 7 });
    expect(accessFor({ ...base, trialStart: NOW - DAY })).toEqual({ full: true, reason: 'trial', daysLeft: 6 });
    expect(accessFor({ ...base, trialStart: NOW - 6 * DAY - 1 })).toEqual({ full: true, reason: 'trial', daysLeft: 1 });
    expect(accessFor({ ...base, trialStart: NOW - 7 * DAY + 1 })).toEqual({ full: true, reason: 'trial', daysLeft: 1 });
    expect(accessFor({ ...base, trialStart: NOW - 7 * DAY })).toEqual({ full: false, reason: 'expired', daysLeft: 0 });
    expect(accessFor({ ...base, trialStart: NOW - 30 * DAY })).toEqual({ full: false, reason: 'expired', daysLeft: 0 });
  });

  it('a running or used trial hides the trial button but keeps Buy', () => {
    const running = accessFor({ ...base, trialStart: NOW });
    const ended = accessFor({ ...base, trialStart: NOW - 8 * DAY });
    expect(canStartTrial(running)).toBe(false);
    expect(canStartTrial(ended)).toBe(false);
    expect(needsPurchase(running)).toBe(true);
    expect(needsPurchase(ended)).toBe(true);
  });

  it('owning Plus is full access for good, trial or not', () => {
    for (const trialStart of [null, NOW, NOW - 100 * DAY]) {
      const a = accessFor({ ...base, owned: true, trialStart });
      expect(a).toEqual({ full: true, reason: 'owned', daysLeft: 0 });
      expect(needsPurchase(a)).toBe(false);
      expect(canStartTrial(a)).toBe(false);
    }
  });

  it('grandfathered (had the free Couch 1.0.3) is full access forever, never a paywall', () => {
    for (const trialStart of [null, NOW - 100 * DAY]) {
      const a = accessFor({ ...base, grandfathered: true, trialStart, now: NOW + 3650 * DAY });
      expect(a).toEqual({ full: true, reason: 'grandfathered', daysLeft: 0 });
      expect(needsPurchase(a)).toBe(false);
      expect(canStartTrial(a)).toBe(false);
    }
  });

  it('loading looks unlocked so nothing flashes a paywall', () => {
    expect(LOADING_ACCESS.full).toBe(true);
    expect(needsPurchase(LOADING_ACCESS)).toBe(false);
    expect(canStartTrial(LOADING_ACCESS)).toBe(false);
  });
});

describe('parseTrialStart', () => {
  it('missing or garbage: not started', () => {
    for (const raw of [null, '', '  ', 'x', '0', '-5', 'NaN']) expect(parseTrialStart(raw, NOW)).toEqual({ start: null, fixed: false });
  });
  it('a valid start is kept; one far in the future is pulled back to now and flagged', () => {
    expect(parseTrialStart(String(NOW - DAY), NOW)).toEqual({ start: NOW - DAY, fixed: false });
    expect(parseTrialStart(String(NOW + 2 * DAY), NOW)).toEqual({ start: NOW, fixed: true });
  });
});

describe('trialStartFromPurchase', () => {
  it('prefers the original transaction date, accepts seconds and ISO strings, ignores the future', () => {
    expect(trialStartFromPurchase({ originalTransactionDateIOS: NOW - 3 * DAY, transactionDate: NOW }, NOW)).toBe(NOW - 3 * DAY);
    expect(trialStartFromPurchase({ transactionDate: String((NOW - DAY) / 1000) }, NOW)).toBe(NOW - DAY);
    expect(trialStartFromPurchase({ purchaseDate: new Date(NOW - DAY).toISOString() }, NOW)).toBe(NOW - DAY);
    expect(trialStartFromPurchase({ transactionDate: NOW + 10 * DAY }, NOW)).toBe(NOW);
    expect(trialStartFromPurchase(null, NOW)).toBe(NOW);
  });
});
