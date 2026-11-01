// T222 (owner-1101e): downloaded remote art packs follow the catalogue. When catalog.json lists a
// newer packVersion than the copy on the phone (v1 manifest with 3 widget pieces vs the v2 one with
// the full widget art list), the app re-downloads the pack in the background, one pack at a time,
// into a staging folder and swaps it in only once every file is verified (src/core/packDownloader.ts
// downloadRemoteArtPack). A failed update keeps the old pack working and is retried later with a
// backoff; the theme page shows a small "Update" note with a manual button meanwhile.
// This file is the pure decision part (node:test tested in packUpdates.test.ts); src/native/packs.ts
// does the I/O. Pure TS, no React Native / Expo imports. Entitlement is never read here.

import type { Catalog } from './packCatalog.ts';

/** First retry of a failed background update after this long; doubles per failure. */
export const PACK_UPDATE_RETRY_MS = 15 * 60 * 1000;
/** The backoff never grows past this (a failed update is tried again at least every 6 h). */
export const PACK_UPDATE_RETRY_MAX_MS = 6 * 60 * 60 * 1000;

/** Per theme: is the downloaded copy the catalogue's current version? */
export type PackUpdateState = 'not-downloaded' | 'up-to-date' | 'needs-update';

function posInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x > 0;
}

/**
 * The pack version of a downloaded pack. Recorded in the cache index since T222; an older index
 * entry has none, so it is back-filled from the stored manifest's packVersion, else counts as 1
 * (every pack downloaded before T222 was v1 or carries its version in its manifest).
 * Null when the pack is not downloaded (no index entry and no manifest).
 */
export function downloadedPackVersion(
  entry: { packVersion?: unknown } | null | undefined,
  manifest?: { packVersion?: unknown } | null,
): number | null {
  if (!entry && !manifest) return null;
  if (entry && posInt(entry.packVersion)) return entry.packVersion;
  if (manifest && posInt(manifest.packVersion)) return manifest.packVersion;
  return 1;
}

/**
 * Up to date, needs an update (catalogue packVersion greater than the downloaded one), or not
 * downloaded. A catalogue that lists an OLDER version (rolled back) or no version at all never
 * triggers an update: the phone keeps what it has.
 */
export function packUpdateState(catalogVersion: number | null | undefined, downloadedVersion: number | null | undefined): PackUpdateState {
  if (!posInt(downloadedVersion)) return 'not-downloaded';
  if (posInt(catalogVersion) && catalogVersion > downloadedVersion) return 'needs-update';
  return 'up-to-date';
}

/** A failed update attempt, remembered for the backoff (session memory is enough). */
export type PackUpdateFailure = { at: number; attempts: number; toVersion: number };

/** Wait before the next attempt after `attempts` failures. */
export function updateBackoffMs(attempts: number): number {
  const n = Math.max(1, Math.floor(attempts));
  return Math.min(PACK_UPDATE_RETRY_MAX_MS, PACK_UPDATE_RETRY_MS * 2 ** Math.min(10, n - 1));
}

/**
 * Whether a background update to `toVersion` may run now: always when it never failed, or when
 * the catalogue moved on to another version since; otherwise once the backoff has passed (or the
 * clock went backwards). A manual Update tap ignores this.
 */
export function updateRetryDue(failure: PackUpdateFailure | null | undefined, now: number, toVersion: number): boolean {
  if (!failure) return true;
  if (failure.toVersion !== toVersion) return true;
  const age = now - failure.at;
  return age < 0 || age >= updateBackoffMs(failure.attempts);
}

/** The failure record after another failed attempt to reach `toVersion`. */
export function recordUpdateFailure(prev: PackUpdateFailure | null | undefined, now: number, toVersion: number): PackUpdateFailure {
  const attempts = prev && prev.toVersion === toVersion ? prev.attempts + 1 : 1;
  return { at: now, attempts, toVersion };
}

export type PackUpdatePlanInput = {
  catalog: Pick<Catalog, 'packs'> | null;
  /** Downloaded pack version per pack id (downloadedPackVersion); missing / null = not downloaded. */
  versions: Readonly<Record<string, number | null | undefined>>;
  /** Pack ids downloading or updating right now (skipped). */
  busy?: Readonly<Record<string, unknown>>;
  failures?: Readonly<Record<string, PackUpdateFailure | undefined>>;
  now: number;
};

export type PackUpdateTask = { id: string; from: number; to: number };

/**
 * Downloaded packs to update now, in catalogue order (the runner does them one at a time):
 * catalogue version newer than the phone's, not busy, and not inside a failure backoff.
 */
export function packUpdatePlan(i: PackUpdatePlanInput): PackUpdateTask[] {
  if (!i.catalog) return [];
  const out: PackUpdateTask[] = [];
  const seen = new Set<string>();
  for (const p of i.catalog.packs) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const have = i.versions[p.id];
    if (packUpdateState(p.packVersion, have) !== 'needs-update') continue;
    if (i.busy && p.id in i.busy) continue;
    if (!updateRetryDue(i.failures?.[p.id], i.now, p.packVersion)) continue;
    out.push({ id: p.id, from: have as number, to: p.packVersion });
  }
  return out;
}

/**
 * The theme page's small update note for a downloaded remote pack:
 *  - none: up to date (or not downloaded: the normal Download flow applies);
 *  - updating: the new version is downloading (old art stays in use until the swap);
 *  - pending: a newer version is listed and will download in the background (manual Update offered);
 *  - failed: the last attempt failed; the old version keeps working (manual Update = try again).
 */
export type PackUpdateView =
  | { kind: 'none' }
  | { kind: 'updating'; percent: number }
  | { kind: 'pending'; toVersion: number }
  | { kind: 'failed'; toVersion: number };

export function packUpdateView(i: {
  catalogVersion: number | null | undefined;
  downloadedVersion: number | null | undefined;
  /** 0..1 while this pack is downloading, undefined otherwise. */
  progress?: number | null;
  failure?: PackUpdateFailure | null;
}): PackUpdateView {
  if (packUpdateState(i.catalogVersion, i.downloadedVersion) !== 'needs-update') return { kind: 'none' };
  const to = i.catalogVersion as number;
  if (typeof i.progress === 'number') {
    const p = Number.isFinite(i.progress) ? Math.min(1, Math.max(0, i.progress)) : 0;
    return { kind: 'updating', percent: Math.min(99, Math.floor(p * 100)) };
  }
  if (i.failure && i.failure.toVersion === to) return { kind: 'failed', toVersion: to };
  return { kind: 'pending', toVersion: to };
}
