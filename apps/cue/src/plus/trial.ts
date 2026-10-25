/**
 * 7-day Plus trial: every Plus feature is free for 7 days from the first launch, then locks unless
 * Plus is bought. No auto-charge, no popups; the app only shows a calm "N days left" line.
 *
 * The first-launch time is kept in two places: the normal kv store and the iOS Keychain
 * (src/native/secureStore.ts). Keychain items survive deleting the app on iOS, so delete-and-reinstall
 * does not restart the trial. On launch the EARLIEST valid stamp wins and is written back to both.
 * Pure TS (no React Native imports) so it runs in the Node tests.
 */
import type { KvStore } from '../core/library';

export const TRIAL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
/** Same key in kv and the Keychain (secure-store keys allow letters, digits, ".", "-" and "_"). */
export const FIRST_LAUNCH_KEY = 'cue.firstLaunch.v1';
/** Small allowance for clock jitter / timezone changes before a stamp in the future counts as a rollback. */
const CLOCK_SLACK_MS = DAY_MS;

export interface TrialState {
  active: boolean;
  /** Whole days left, rounded up (6.2 days -> 7). 0 once the trial is over. */
  daysLeft: number;
  endsAt: number;
}

/** A stored stamp is a positive integer of ms since epoch; anything else is ignored. */
export function parseStamp(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Earliest valid stamp, or `nowMs` when there is none (this is the first launch). */
export function earliestStamp(stamps: (number | null | undefined)[], nowMs: number): number {
  const valid = stamps.filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0);
  return valid.length ? Math.min(...valid) : nowMs;
}

export function trialState(firstLaunchMs: number, nowMs: number, days = TRIAL_DAYS): TrialState {
  const endsAt = firstLaunchMs + days * DAY_MS;
  // Clock moved back well before the first launch: don't hand out a fresh trial.
  if (nowMs < firstLaunchMs - CLOCK_SLACK_MS) return { active: false, daysLeft: 0, endsAt };
  const left = endsAt - Math.max(nowMs, firstLaunchMs);
  if (left <= 0) return { active: false, daysLeft: 0, endsAt };
  return { active: true, daysLeft: Math.min(days, Math.ceil(left / DAY_MS)), endsAt };
}

/**
 * Reads the stamp from kv and (when given) the secure store, picks the earliest, and writes it back to
 * whichever store is missing it or holds a later value. Never throws: a store that fails is skipped.
 */
export async function resolveFirstLaunch(kv: KvStore, secure: KvStore | null, nowMs: number): Promise<number> {
  const read = async (s: KvStore | null) => {
    if (!s) return null;
    try {
      return parseStamp(await s.getItem(FIRST_LAUNCH_KEY));
    } catch {
      return null;
    }
  };
  const [fromKv, fromSecure] = await Promise.all([read(kv), read(secure)]);
  const first = earliestStamp([fromKv, fromSecure], nowMs);
  const write = async (s: KvStore | null, cur: number | null) => {
    if (!s || cur === first) return;
    try {
      await s.setItem(FIRST_LAUNCH_KEY, String(first));
    } catch {
      /* best effort */
    }
  };
  await Promise.all([write(kv, fromKv), write(secure, fromSecure)]);
  return first;
}

/** i18n key + params for the calm "Plus trial: N days left" line (null when there is nothing to show). */
export function trialLabel(trial: TrialState): { key: 'plus.trial.left' | 'plus.trial.leftOne'; n: number } | null {
  if (!trial.active || trial.daysLeft <= 0) return null;
  return trial.daysLeft === 1 ? { key: 'plus.trial.leftOne', n: 1 } : { key: 'plus.trial.left', n: trial.daysLeft };
}
