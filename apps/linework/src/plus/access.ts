// Free trial + one-time unlock (owner decision 22 Oct 2026, docs/OWNER_1022D.md). Pure TypeScript, tested in Node.
// App Store Review Guideline 3.1.1 (docs/OWNER_1024.md): the trial is a free non-consumable in-app purchase,
// "14-day Trial" (src/plus/iapStore.ts TRIAL_SKU), that the person starts on purpose after reading what it includes.
// - Before the trial starts ('none'): the free tier only (tracing your own photos with every tool + starter templates).
// - For TRIAL_DAYS from the trial transaction's purchase date ('trial'): everything.
// - After that, without Linework Plus ('expired'): the free tier again; the rest of the template library and outline
//   mode need Plus (A$2.99 one-time). Owning Plus ('owned') unlocks everything for good.
// The start date is stored on the phone (TRIAL_KEY) and comes back from the App Store on restore, so reinstalling
// never restarts it. Testers who already have a TRIAL_KEY from the old automatic start keep it (grandfathered).
import type { Template } from '../core/templates';

export const TRIAL_DAYS = 14;
export const TRIAL_KEY = 'linework.trial.v1';
/** Set once the first-run trial offer card on Home was dismissed or acted on. */
export const TRIAL_OFFER_SEEN_KEY = 'linework.trialOffer.seen.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/** 'loading' only while the stored state is read (looks unlocked so nothing flashes a lock on first paint). */
export type AccessReason = 'owned' | 'trial' | 'expired' | 'none' | 'loading';
export type Access = { full: boolean; reason: AccessReason; daysLeft: number };

/**
 * Reads the stored trial start. Missing or garbage: the trial has not started (`start: null`). A start more than a
 * day in the future (clock changed) is pulled back to `now` and marked `fixed` so the caller saves it.
 * Any valid stored start is honoured, including one written by the old automatic first-launch trial (grandfathered).
 */
export function parseTrialStart(raw: string | null, now: number): { start: number | null; fixed: boolean } {
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { start: null, fixed: false };
  if (n > now + DAY_MS) return { start: now, fixed: true };
  return { start: n, fixed: false };
}

/** `trialStart` null means the trial was never started: free tier until it is, or until Plus is owned. */
export function accessFor(owned: boolean, trialStart: number | null, now: number, days: number = TRIAL_DAYS): Access {
  if (owned) return { full: true, reason: 'owned', daysLeft: 0 };
  if (trialStart === null) return { full: false, reason: 'none', daysLeft: 0 };
  const left = Math.ceil((trialStart + days * DAY_MS - now) / DAY_MS);
  if (left > 0) return { full: true, reason: 'trial', daysLeft: Math.min(days, left) };
  return { full: false, reason: 'expired', daysLeft: 0 };
}

/** While loading: unlocked-looking (no lock flash) but not claiming a trial; resolves within a frame or two. */
export const LOADING_ACCESS: Access = { full: true, reason: 'loading', daysLeft: 0 };

/** The trial offer is shown only to someone who has neither started the trial nor bought Plus. */
export function canStartTrial(access: Access): boolean {
  return access.reason === 'none';
}

/** One date field of a store purchase as epoch ms: numbers, numeric strings (ms or seconds) and ISO strings. */
function toMs(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.trim() !== '') n = /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : Date.parse(v);
  else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e11 ? n * 1000 : n; // seconds → ms (1e11 ms is 1973; 1e11 s is far in the future)
}

/**
 * The trial start from the App Store / Play transaction: the original purchase date first (a re-download or restore
 * of the free "14-day Trial" brings the first date back), then the transaction date, else `now`. Dates in the future
 * (beyond a day of clock skew) are ignored. Field names differ between expo-iap / react-native-iap versions.
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

/**
 * The free starter templates: beginner pieces taken round-robin across categories (catalogue order), so every
 * category keeps something free. Deterministic for a given catalogue.
 */
export function starterIds(templates: readonly Template[], count: number): Set<string> {
  const byCat = new Map<string, Template[]>();
  for (const t of templates) {
    if ((t.level ?? 'beginner') !== 'beginner') continue;
    // The Trade & workshop pack is Linework Plus only (owner 23 Oct 2026): never a free starter.
    if (t.category === 'trade') continue;
    const list = byCat.get(t.category) ?? [];
    list.push(t);
    byCat.set(t.category, list);
  }
  const lists = [...byCat.values()];
  const out = new Set<string>();
  for (let round = 0; out.size < count; round++) {
    let added = false;
    for (const l of lists) {
      const t = l[round];
      if (t && out.size < count) {
        out.add(t.id);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

export function templateLocked(access: Access, starters: ReadonlySet<string>, id: string): boolean {
  return !access.full && !starters.has(id);
}

export function outlineLocked(access: Access): boolean {
  return !access.full;
}
