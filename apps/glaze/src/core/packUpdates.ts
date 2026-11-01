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

// ------------------------------------------------------------ T225: persisted retry wait + summary
// T225: the retry wait of a failed background update survives an app restart. The failure record
// and its next-allowed-check time (`nextAt`) are saved next to the cache index, in
// documentDirectory/packs/update-state.json (the same file-system storage the pack code already
// uses; src/native/packs.ts does the I/O, this is the pure format). Before T225 a restart forgot
// the failure, so a pack whose update kept failing was retried on every launch.
//
// T225 DECISION (overseer): packs already on the phone keep updating in the background whether or
// not Glaze Plus is owned. An update only refreshes art the person already has and unlocks nothing
// new, so no Plus gating is added to the background runner (packUpdatePlan never reads the
// entitlement, and src/core must not). The manual Update button on the theme page keeps its
// existing check (src/plus/usePackUpdate.ts). No pack's plus flag, price or paywall copy changes
// (directive D211-1).

/** On-disk format version of update-state.json. */
export const PACK_UPDATE_STORE_VERSION = 1;
/** "Updated N packs" shows in Settings › Storage for this long after the last successful update. */
export const PACK_UPDATE_RECENT_MS = 24 * 60 * 60 * 1000;

/** Packs updated recently: how many, and when the latest one finished. */
export type PackUpdatedRecently = { at: number; count: number };

export type PackUpdateStore = {
  failures: Record<string, PackUpdateFailure>;
  updated: PackUpdatedRecently | null;
};

/** The earliest time a background update may try `failure.toVersion` again. */
export function nextUpdateCheckAt(failure: PackUpdateFailure): number {
  return failure.at + updateBackoffMs(failure.attempts);
}

function finiteNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/**
 * Tolerant read of update-state.json. Anything broken gives the empty store; a broken entry is
 * dropped (that pack is simply due again). A saved next-check time further away than the longest
 * backoff (clock moved backwards, hand-edited file) is not honoured: the entry is dropped so an
 * update can never get stuck.
 */
export function parsePackUpdateStore(raw: string | null | undefined, now: number): PackUpdateStore {
  const empty = (): PackUpdateStore => ({ failures: {}, updated: null });
  if (!raw) return empty();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return empty();
  const d = data as Record<string, unknown>;
  if (d.v !== PACK_UPDATE_STORE_VERSION) return empty();
  const failures: Record<string, PackUpdateFailure> = {};
  const rawFailures = d.failures;
  if (rawFailures && typeof rawFailures === 'object' && !Array.isArray(rawFailures)) {
    for (const [id, f] of Object.entries(rawFailures as Record<string, unknown>)) {
      if (!id || !f || typeof f !== 'object') continue;
      const r = f as Record<string, unknown>;
      if (!finiteNum(r.at) || !posInt(r.attempts) || !posInt(r.toVersion)) continue;
      const failure: PackUpdateFailure = { at: r.at, attempts: Math.min(r.attempts, 1000), toVersion: r.toVersion };
      const nextAt = finiteNum(r.nextAt) ? r.nextAt : nextUpdateCheckAt(failure);
      if (nextAt - now > PACK_UPDATE_RETRY_MAX_MS) continue;
      if (failure.at > now) continue;
      failures[id] = failure;
    }
  }
  let updated: PackUpdatedRecently | null = null;
  const u = d.updated;
  if (u && typeof u === 'object') {
    const r = u as Record<string, unknown>;
    if (finiteNum(r.at) && posInt(r.count)) updated = { at: r.at, count: r.count };
  }
  return { failures, updated };
}

/** update-state.json content; each failure carries its next-allowed-check time (`nextAt`). */
export function serializePackUpdateStore(s: PackUpdateStore): string {
  const failures: Record<string, PackUpdateFailure & { nextAt: number }> = {};
  for (const id of Object.keys(s.failures).sort()) {
    const f = s.failures[id];
    failures[id] = { at: f.at, attempts: f.attempts, toVersion: f.toVersion, nextAt: nextUpdateCheckAt(f) };
  }
  return JSON.stringify({ v: PACK_UPDATE_STORE_VERSION, failures, updated: s.updated ? { at: s.updated.at, count: s.updated.count } : null });
}

/**
 * Failure records still worth keeping: the pack is on the phone and has not reached the version
 * the failed attempt aimed at (removed or since-updated packs drop their record).
 */
export function prunePackUpdateFailures(
  failures: Readonly<Record<string, PackUpdateFailure>>,
  versions: Readonly<Record<string, number | null | undefined>>,
): Record<string, PackUpdateFailure> {
  const out: Record<string, PackUpdateFailure> = {};
  for (const [id, f] of Object.entries(failures)) {
    const have = versions[id];
    if (!posInt(have) || have >= f.toVersion) continue;
    out[id] = f;
  }
  return out;
}

/** After a pack updated successfully: one more within the recent window, else a fresh count of 1. */
export function recordPackUpdated(prev: PackUpdatedRecently | null | undefined, now: number): PackUpdatedRecently {
  if (prev && now >= prev.at && now - prev.at < PACK_UPDATE_RECENT_MS) return { at: now, count: prev.count + 1 };
  return { at: now, count: 1 };
}

/**
 * The one-line pack update status in Settings › Storage:
 *  - none: no downloaded remote packs (or no catalogue yet): the line is hidden;
 *  - updating: `count` downloaded packs are updating right now;
 *  - failed: `count` updates failed (old versions keep working, tried again later);
 *  - available: `count` packs have a newer version waiting for the background update;
 *  - updated: every pack is current and `count` were updated in the last 24 h ("Updated 2 packs");
 *  - upToDate: every downloaded pack is the catalogue's current version ("All packs up to date").
 */
export type PackUpdateSummary =
  | { kind: 'none' }
  | { kind: 'updating'; count: number }
  | { kind: 'failed'; count: number }
  | { kind: 'available'; count: number }
  | { kind: 'updated'; count: number }
  | { kind: 'upToDate' };

export function packUpdateSummary(i: {
  catalog: Pick<Catalog, 'packs'> | null;
  versions: Readonly<Record<string, number | null | undefined>>;
  busy?: Readonly<Record<string, unknown>>;
  failures?: Readonly<Record<string, PackUpdateFailure | undefined>>;
  updated?: PackUpdatedRecently | null;
  now: number;
}): PackUpdateSummary {
  if (!i.catalog) return { kind: 'none' };
  let downloaded = 0;
  let updating = 0;
  let failed = 0;
  let available = 0;
  const seen = new Set<string>();
  for (const p of i.catalog.packs) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const state = packUpdateState(p.packVersion, i.versions[p.id]);
    if (state === 'not-downloaded') continue;
    downloaded++;
    if (state !== 'needs-update') continue;
    if (i.busy && p.id in i.busy) updating++;
    else if (i.failures?.[p.id]?.toVersion === p.packVersion) failed++;
    else available++;
  }
  if (downloaded === 0) return { kind: 'none' };
  if (updating > 0) return { kind: 'updating', count: updating };
  if (failed > 0) return { kind: 'failed', count: failed };
  if (available > 0) return { kind: 'available', count: available };
  const u = i.updated;
  if (u && posInt(u.count) && i.now >= u.at && i.now - u.at < PACK_UPDATE_RECENT_MS) return { kind: 'updated', count: u.count };
  return { kind: 'upToDate' };
}
