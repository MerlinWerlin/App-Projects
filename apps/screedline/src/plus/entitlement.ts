/**
 * Full Unlock: one-time non-consumable, no subscription. Free forever: slab volume, ordering (trucks and bags),
 * falls, tonnes ↔ m³ and the pour-day checklist, plus one saved job. Full Unlock (or the free 7-day Trial)
 * opens every other tool, unlimited jobs and job sheets.
 */
export const FULL_PRODUCT_ID = 'com.jared797.screedline.full';
export const TRIAL_PRODUCT_ID = 'com.jared797.screedline.trial7';
/** Australian price, kept in line with store/listing.json. Used only when the store reports AU with a foreign currency. */
export const FULL_AUSTRALIA_PRICE = 'A$4.99';
export const FREE_JOB_LIMIT = 1;
export const TRIAL_DAYS = 7;
export const DAY_MS = 86_400_000;

export interface Access { full: boolean; trialStart: number | null }

export interface TrialState { active: boolean; daysLeft: number; endsAt: number; started: boolean }

export function trialState(start: number | null, now: number): TrialState {
  if (start === null) return { active: false, daysLeft: 0, endsAt: 0, started: false };
  const endsAt = start + TRIAL_DAYS * DAY_MS;
  // A clock set more than a day before the start never extends the trial.
  const left = now < start - DAY_MS ? 0 : endsAt - Math.max(now, start);
  return { active: left > 0, daysLeft: Math.max(0, Math.min(TRIAL_DAYS, Math.ceil(left / DAY_MS))), endsAt, started: true };
}

/** Everything is open while Full Unlock is owned or the trial is running. */
export function unlocked(a: Access, now: number): boolean {
  return a.full || trialState(a.trialStart, now).active;
}

/** Original transaction date of the trial item; a missing date never restarts an old trial. */
export function trialStartFromPurchase(purchase: Record<string, unknown>, now: number): number | null {
  for (const key of ['originalTransactionDateIOS', 'originalTransactionDate', 'originalPurchaseDate', 'transactionDate', 'purchaseTime', 'purchaseDate']) {
    const value = purchase[key];
    let ms = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isNaN(ms) && typeof value === 'string') ms = Date.parse(value);
    if (ms > 0 && ms < 100_000_000_000) ms *= 1000; // seconds → ms
    if (Number.isFinite(ms) && ms > 0 && ms <= now + DAY_MS) return Math.floor(ms);
  }
  return null;
}

/** What to tell someone after Restore or Start trial, from the access the store actually returned. */
export function accessMessage(a: Access, now: number): { title: string; body: string } {
  if (a.full) return { title: 'Unlocked', body: 'Full Unlock is on this phone. Every tool is open.' };
  const t = trialState(a.trialStart, now);
  if (t.active) return { title: 'Trial active', body: `Every tool is open for ${t.daysLeft} more ${t.daysLeft === 1 ? 'day' : 'days'}. Nothing is charged when it ends.` };
  if (t.started) return { title: 'Trial ended', body: 'Your free trial has ended. Full Unlock opens every tool again.' };
  return { title: 'Nothing to restore', body: 'No purchases found for this Apple ID.' };
}

export function parseStamp(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}

export function parseAccess(raw: string | null | undefined): Access {
  try {
    const d = raw ? (JSON.parse(raw) as Partial<Access>) : null;
    return { full: d?.full === true, trialStart: typeof d?.trialStart === 'number' && d.trialStart > 0 ? d.trialStart : null };
  } catch {
    return { full: false, trialStart: null };
  }
}
