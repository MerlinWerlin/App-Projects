/** Seven-day trial starts with Apple's free non-consumable, never at first launch. */
import type { KvStore } from '../core/library';
export const TRIAL_DAYS = 7;
export const DAY_MS = 86_400_000;
export const TRIAL_PRODUCT_ID = 'com.jared797.cue.trial7';
export const TRIAL_KEY = 'cue.storeTrial.v1';
// The old cue.firstLaunch.v1 testing stamp is deliberately not a store entitlement.
export interface TrialState { active: boolean; daysLeft: number; endsAt: number; started: boolean }
export function parseStamp(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}
export function trialState(start: number | null, now: number): TrialState {
  if (start === null) return { active: false, daysLeft: 0, endsAt: 0, started: false };
  const endsAt = start + TRIAL_DAYS * DAY_MS;
  const left = now < start - DAY_MS ? 0 : endsAt - Math.max(now, start);
  return { active: left > 0, daysLeft: Math.max(0, Math.min(TRIAL_DAYS, Math.ceil(left / DAY_MS))), endsAt, started: true };
}
export function trialStartFromPurchase(purchase: Record<string, unknown>, now: number): number | null {
  for (const key of ['originalTransactionDateIOS', 'originalTransactionDate', 'originalPurchaseDate', 'transactionDate', 'purchaseTime', 'purchaseDate']) {
    const value = purchase[key];
    let ms = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    if (Number.isNaN(ms) && typeof value === 'string') ms = Date.parse(value);
    if (ms > 0 && ms < 100_000_000_000) ms *= 1000;
    if (Number.isFinite(ms) && ms > 0 && ms <= now + DAY_MS) return Math.floor(ms);
  }
  return null; // Missing transaction date must not restart an old trial.
}
export async function readStoredTrial(kv: KvStore, secure: KvStore | null): Promise<number | null> {
  const read = async (store: KvStore | null) => store ? parseStamp(await store.getItem(TRIAL_KEY).catch(() => null)) : null;
  const dates = (await Promise.all([read(kv), read(secure)])).filter((n): n is number => n !== null);
  return dates.length ? Math.min(...dates) : null;
}
export async function saveStoredTrial(kv: KvStore, secure: KvStore | null, start: number | null): Promise<void> {
  await Promise.all([kv, secure].map(store => store?.setItem(TRIAL_KEY, start === null ? '' : String(start)).catch(() => undefined)));
}
export function trialLabel(trial: TrialState): { key: 'plus.trial.left' | 'plus.trial.leftOne'; n: number } | null {
  return trial.active ? { key: trial.daysLeft === 1 ? 'plus.trial.leftOne' : 'plus.trial.left', n: trial.daysLeft } : null;
}
