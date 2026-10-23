/**
 * Restore saved TVs into the session on app start (T20). Pure TS: the store and transport are
 * injected, so tests run in Node with a fake KV and a fake transport.
 *
 * Rules:
 * - Order: the last-used TV first, then the rest in saved order.
 * - Each TV gets its driver from driverFor(tv, transport). A TV with no driver on this build
 *   (e.g. Samsung without the lan-wss module, an IR TV on a phone without an emitter, a platform
 *   that is "coming soon") is SKIPPED for this session: the session only holds TVs it can control.
 *   It is never removed from the store, so it comes back on a build that has the transport.
 * - Never throws: a store that fails to read restores nothing (the app then shows demo mode).
 * - Drivers are returned unconnected; call connectRestored() (best effort, not awaited by the UI)
 *   so an offline TV never delays start-up.
 */
import { driverFor } from './addTv';
import type { Transport, TvDriver } from './driver';
import type { MockTvOptions } from './drivers/mock';
import type { SavedTv, SavedTvStore } from './store';
import type { Tv } from './types';

export interface RestoreResult {
  /** TVs that have a driver, last used first. */
  tvs: Tv[];
  drivers: Map<string, TvDriver>;
  /** Saved TVs left out of this session because no driver exists for them on this build. */
  skipped: SavedTv[];
}

/** Last-used TV first, the rest keep their saved order. */
export function orderSaved<T extends { id: string }>(tvs: readonly T[], lastUsedId: string | null): T[] {
  const i = lastUsedId === null ? -1 : tvs.findIndex((t) => t.id === lastUsedId);
  if (i <= 0) return [...tvs];
  return [tvs[i]!, ...tvs.slice(0, i), ...tvs.slice(i + 1)];
}

function toTv(saved: SavedTv): Tv {
  const tv: Tv & { addedAt?: number } = { ...saved };
  delete tv.addedAt;
  return tv;
}

export async function restoreSaved(
  store: Pick<SavedTvStore, 'list' | 'lastUsedId'>,
  transport: Transport,
  opts: { mock?: MockTvOptions } = {},
): Promise<RestoreResult> {
  const out: RestoreResult = { tvs: [], drivers: new Map(), skipped: [] };
  let saved: SavedTv[];
  let lastUsed: string | null;
  try {
    saved = await store.list();
    lastUsed = await store.lastUsedId();
  } catch {
    return out;
  }
  for (const s of orderSaved(saved, lastUsed)) {
    let driver: TvDriver | null = null;
    try {
      driver = driverFor(s, transport, opts.mock ? { mock: opts.mock } : {});
    } catch {
      driver = null;
    }
    if (!driver) {
      out.skipped.push(s);
      continue;
    }
    out.tvs.push(toTv(s));
    out.drivers.set(s.id, driver);
  }
  return out;
}

/** Connects every restored driver in the background; failures are ignored (the remote shows them). */
export async function connectRestored(drivers: ReadonlyMap<string, TvDriver>): Promise<void> {
  await Promise.all(
    [...drivers.values()].map(async (d) => {
      try {
        await d.connect();
      } catch {
        // Offline or asleep: the driver reports its state, the remote shows the error on use.
      }
    }),
  );
}
