/**
 * Who may use the remote and casting (owner decision 7 Nov 2026). Pure TypeScript, tested in Node.
 *
 * The TV remote (every key, the d-pad, touchpad, keyboard, voice, numbers, inputs and launching apps) and
 * casting are the paid part of Couch, unlocked by one one-time purchase, Couch Plus (A$3.99, non-consumable).
 * Adding and finding TVs, the TVs list, settings and themes stay free for everyone.
 *
 * - 'grandfathered': Couch 1.0.3 shipped free; anyone who had it keeps full access forever (src/plus/grandfather.ts).
 * - 'owned': Couch Plus was bought (or restored).
 * - 'trial': TRIAL_DAYS from the free "7-day Trial" transaction (App Store Review Guideline 3.1.1, the same
 *   pattern as Linework: a free non-consumable the person starts on purpose; src/plus/iapStore.ts).
 * - 'expired': the trial ended without Plus. 'none': the trial was never started.
 * - 'loading': storage is still being read (a few milliseconds at launch). Treated as allowed so nobody,
 *   grandfathered people above all, ever sees the paywall flash; nothing can be pressed that early anyway.
 */
export const TRIAL_DAYS = 7;
export const TRIAL_KEY = 'couch.trial.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessReason = 'grandfathered' | 'owned' | 'trial' | 'expired' | 'none' | 'loading';
export type Access = { full: boolean; reason: AccessReason; daysLeft: number };

export const LOADING_ACCESS: Access = { full: true, reason: 'loading', daysLeft: 0 };

/**
 * Reads the stored trial start. Missing or garbage: not started (`start: null`). A start more than a day in the
 * future (clock changed) is pulled back to `now` and marked `fixed` so the caller saves it.
 */
export function parseTrialStart(raw: string | null, now: number): { start: number | null; fixed: boolean } {
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { start: null, fixed: false };
  if (n > now + DAY_MS) return { start: now, fixed: true };
  return { start: n, fixed: false };
}

export interface AccessInput {
  owned: boolean;
  grandfathered: boolean;
  /** Null: the trial was never started. */
  trialStart: number | null;
  now: number;
  days?: number;
}

export function accessFor({ owned, grandfathered, trialStart, now, days = TRIAL_DAYS }: AccessInput): Access {
  if (grandfathered) return { full: true, reason: 'grandfathered', daysLeft: 0 };
  if (owned) return { full: true, reason: 'owned', daysLeft: 0 };
  if (trialStart === null) return { full: false, reason: 'none', daysLeft: 0 };
  const left = Math.ceil((trialStart + days * DAY_MS - now) / DAY_MS);
  if (left > 0) return { full: true, reason: 'trial', daysLeft: Math.min(days, left) };
  return { full: false, reason: 'expired', daysLeft: 0 };
}

/** The "Start 7-day free trial" button only shows to someone who never started it and has no access otherwise. */
export function canStartTrial(access: Access): boolean {
  return access.reason === 'none';
}

/** The paywall shows Buy / Restore unless access is already for good. */
export function needsPurchase(access: Access): boolean {
  return access.reason === 'none' || access.reason === 'trial' || access.reason === 'expired';
}

/** One date field of a store purchase as epoch ms: numbers, numeric strings (ms or seconds) and ISO strings. */
function toMs(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '') n = /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : Date.parse(v);
  else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e11 ? n * 1000 : n; // seconds -> ms (1e11 ms is 1973; 1e11 s is far in the future)
}

/**
 * The trial start from the App Store transaction: the original purchase date first (a restore of the free
 * "7-day Trial" brings the first date back), then the transaction date, else `now`. Dates in the future (beyond a
 * day of clock skew) are ignored. Field names differ between expo-iap versions.
 */
export function trialStartFromPurchase(p: Record<string, unknown> | null | undefined, now: number): number {
  if (p) {
    for (const k of ['originalTransactionDateIOS', 'originalTransactionDate', 'originalPurchaseDate', 'transactionDate', 'purchaseTime', 'purchaseDate']) {
      const ms = toMs(p[k]);
      if (ms !== null && ms <= now + DAY_MS) return ms;
    }
  }
  return now;
}
