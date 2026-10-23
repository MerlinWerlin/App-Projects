/**
 * App-level glue for adding and saving TVs: the fetch adapter (global fetch + AbortController
 * timeout -> FetchLike), the saved-TV store, and `addTv` which puts a new TV in the session.
 * No React imports; storage is reached only through the guarded src/native/kv.ts, so it runs in Expo Go.
 */
import type { FetchLike, TvDriver } from '../core/driver';
import type { RemoteSession } from '../core/session';
import { MemoryKv, SavedTvStore } from '../core/store';
import type { Tv } from '../core/types';
import { t } from '../i18n/core';
import { loadPersistentKv } from '../native/kv';

/** Wraps the global fetch into FetchLike, enforcing `timeoutMs` with an AbortController. */
export const fetchAdapter: FetchLike = async (url, init = {}) => {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 3000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const req: RequestInit = { method: init.method ?? 'GET', signal: controller.signal };
    if (init.headers) req.headers = init.headers;
    if (init.body !== undefined) req.body = init.body;
    const res = await fetch(url, req);
    return { status: res.status, ok: res.ok, text: () => res.text() };
  } catch (e) {
    if (controller.signal.aborted) {
      const err = new Error(t('ui.tvs.timedOut', { ms: String(timeoutMs) }));
      err.name = 'TimeoutError';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Saved TVs (and pins, last used). Persisted with AsyncStorage via src/native/kv.ts (guarded
 * require); falls back to an in-memory KV where that is unavailable (tests).
 */
export const savedTvStore = new SavedTvStore(loadPersistentKv() ?? new MemoryKv());

/**
 * Appends a TV + driver to the session and selects it. A real TV added while the demo TVs are
 * showing replaces them (demo mode ends), so the demo note never sits next to a real TV.
 */
export function addTv(session: RemoteSession, tv: Tv, driver: TvDriver): void {
  if (session.getSnapshot().demo && tv.platform !== 'mock') session.load([], new Map(), { demo: false });
  session.add(tv, driver);
}
