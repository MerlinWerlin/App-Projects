// Free trial + one-time unlock (owner decision 22 Oct 2026, docs/OWNER_1022D.md). Pure TypeScript, tested in Node.
// - Everything is unlocked for TRIAL_DAYS from the first launch.
// - After that, without Linework Plus: tracing your own photos with every tracing tool and the starter templates
//   stay free; the rest of the template library and outline mode need Plus (A$2.99 one-time).
// - The trial start lives only on the phone. No account, no server.
import type { Template } from '../core/templates';

export const TRIAL_DAYS = 14;
export const TRIAL_KEY = 'linework.trial.v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessReason = 'owned' | 'trial' | 'expired';
export type Access = { full: boolean; reason: AccessReason; daysLeft: number };

/** Reads the stored trial start; missing, garbage or a start in the future (clock changed) restarts it at `now`. */
export function parseTrialStart(raw: string | null, now: number): { start: number; fresh: boolean } {
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > now + DAY_MS) return { start: now, fresh: true };
  return { start: n, fresh: false };
}

export function accessFor(owned: boolean, trialStart: number, now: number, days: number = TRIAL_DAYS): Access {
  if (owned) return { full: true, reason: 'owned', daysLeft: 0 };
  const left = Math.ceil((trialStart + days * DAY_MS - now) / DAY_MS);
  if (left > 0) return { full: true, reason: 'trial', daysLeft: Math.min(days, left) };
  return { full: false, reason: 'expired', daysLeft: 0 };
}

/** While loading: unlocked, so nothing flashes a lock on first paint. */
export const LOADING_ACCESS: Access = { full: true, reason: 'trial', daysLeft: TRIAL_DAYS };

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
