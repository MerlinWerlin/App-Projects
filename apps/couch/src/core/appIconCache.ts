import type { TvDriver } from './driver';
import { isRfc1918Host, urlHost } from './lanHost';
import type { TvApp } from './types';

/**
 * Cache for app icons exactly as the TV supplies them (TvDriver.appIcon: a LAN http(s) URL or a
 * data: URI). Pure TS, no React Native.
 *
 * - Keyed by TV id + app id, so icons survive reconnects and new driver instances for the same TV.
 * - Concurrent requests for one key share a single fetch.
 * - Failures (the TV gave no icon, the call threw or timed out, or the UI reported that the image
 *   would not load) are remembered and retried only after `retryAfterMs`.
 * - Size-bounded LRU: at most `maxEntries` entries and `maxChars` characters of stored URIs (data:
 *   URIs from Samsung can be tens of KB each). Least recently used entries go first.
 * - Fetcher and clock are injected per call / per instance so tests run without timers or a TV.
 *
 * The bytes are never touched: the UI shows the image as the TV served it (RN Image does its own
 * HTTP caching for URLs; data: URIs are kept here in memory only).
 */

/** data:image/<type>;base64,<body> — the inline form Samsung icons arrive in. */
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/i;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/**
 * True for a URI an Image can show and that is safe to hand it: an inline base64 image data: URI,
 * or a plain http(s) URL. Anything else (file:, javascript:, content:, non-image data:, relative
 * paths, whitespace) is treated as "the TV gave no icon".
 */
export function isDisplayableIconUri(uri: string): boolean {
  return DATA_IMAGE.test(uri) || HTTP_URL.test(uri);
}

/**
 * True when an icon really comes from the TV: an inline data: image, or an http(s) URL served by
 * the TV itself (same host as the TV) or by another literal RFC 1918 address on the LAN. Cloud /
 * CDN URLs never qualify, so Couch makes no request outside the local network for an icon.
 */
export function isTvSuppliedIcon(uri: string, tvHost?: string): boolean {
  if (DATA_IMAGE.test(uri)) return true;
  if (!HTTP_URL.test(uri)) return false;
  const host = urlHost(uri);
  if (host === null) return false;
  if (tvHost !== undefined && tvHost !== '' && host.toLowerCase() === tvHost.toLowerCase()) return true;
  return isRfc1918Host(host);
}

export type IconFetch = (app: TvApp) => Promise<string | null>;

export interface AppIconCacheOptions {
  /** Clock in ms; inject for tests. */
  now?: () => number;
  /** Resolves after ms; used for the fetch timeout. Inject for tests. Default setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Retry a failed key after this long (default 5 minutes). */
  retryAfterMs?: number;
  /** Give up on a fetch after this long and treat it as a failure (default 8 s; 0 = never). */
  timeoutMs?: number;
  /** Most entries kept (default 300). */
  maxEntries?: number;
  /** Most characters of URIs kept across all entries (default 4,000,000). */
  maxChars?: number;
}

type Entry = { kind: 'ok'; uri: string } | { kind: 'failed'; at: number };

const TIMED_OUT = Symbol('timeout');
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function iconCacheKey(tvId: string, appId: string): string {
  return `${tvId.length}:${tvId}|${appId}`;
}

/** The icon fetcher for a driver, or null when it cannot supply icons (no method or capability). */
export function driverIconFetch(driver: TvDriver | null | undefined): IconFetch | null {
  if (!driver || typeof driver.appIcon !== 'function' || !driver.capabilities.has('appIcons')) return null;
  return driver.appIcon.bind(driver);
}

export class AppIconCache {
  private readonly entries = new Map<string, Entry>();
  private readonly pending = new Map<string, Promise<string | null>>();
  private chars = 0;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  readonly retryAfterMs: number;
  private readonly timeoutMs: number;
  private readonly maxEntries: number;
  private readonly maxChars: number;

  constructor(opts: AppIconCacheOptions = {}) {
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? defaultSleep;
    this.retryAfterMs = opts.retryAfterMs ?? 5 * 60_000;
    this.timeoutMs = opts.timeoutMs ?? 8_000;
    this.maxEntries = Math.max(1, opts.maxEntries ?? 300);
    this.maxChars = Math.max(1, opts.maxChars ?? 4_000_000);
  }

  /** Number of settled entries (successes and remembered failures). */
  get size(): number {
    return this.entries.size;
  }

  /**
   * What is known without fetching: the URI, null for a remembered failure still inside its retry
   * window, undefined when unknown, loading, or a failure that is due a retry.
   */
  peek(tvId: string, appId: string): string | null | undefined {
    const key = iconCacheKey(tvId, appId);
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (e.kind === 'ok') {
      this.touch(key, e);
      return e.uri;
    }
    return this.failureFresh(e) ? null : undefined;
  }

  /**
   * The icon for (tvId, app). Never throws. Uses the cached URI, a fresh remembered failure (null),
   * or an in-flight fetch for the same key; otherwise calls `fetch` (null fetch = cannot supply).
   */
  get(tvId: string, app: TvApp, fetch: IconFetch | null): Promise<string | null> {
    const key = iconCacheKey(tvId, app.id);
    const known = this.peek(tvId, app.id);
    if (known !== undefined) return Promise.resolve(known);
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    if (!fetch) return Promise.resolve(null);
    const p = this.run(fetch, app).then((uri) => {
      // Only the fetch still registered for this key may write (invalidate() drops it).
      if (this.pending.get(key) === p) {
        this.pending.delete(key);
        this.store(key, uri === null ? { kind: 'failed', at: this.now() } : { kind: 'ok', uri });
      }
      return uri;
    });
    this.pending.set(key, p);
    return p;
  }

  /**
   * The UI could not show `uri` (image error): remember the key as failed so tiles fall back to
   * the house style until the retry window passes. Ignored when the cache now holds another URI.
   */
  markFailed(tvId: string, appId: string, uri?: string): void {
    const key = iconCacheKey(tvId, appId);
    const e = this.entries.get(key);
    if (uri !== undefined && e && e.kind === 'ok' && e.uri !== uri) return;
    this.store(key, { kind: 'failed', at: this.now() });
  }

  /** Forget one TV (e.g. removed or re-addressed) or everything. In-flight results are discarded. */
  invalidate(tvId?: string): void {
    if (tvId === undefined) {
      this.entries.clear();
      this.pending.clear();
      this.chars = 0;
      return;
    }
    const prefix = iconCacheKey(tvId, '');
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) this.delete(key);
    for (const key of [...this.pending.keys()]) if (key.startsWith(prefix)) this.pending.delete(key);
  }

  private async run(fetch: IconFetch, app: TvApp): Promise<string | null> {
    try {
      const call = Promise.resolve().then(() => fetch(app));
      const raced: unknown =
        this.timeoutMs > 0
          ? await Promise.race([call, this.sleep(this.timeoutMs).then(() => TIMED_OUT)])
          : await call;
      if (raced === TIMED_OUT) {
        call.catch(() => {});
        return null;
      }
      return typeof raced === 'string' && isDisplayableIconUri(raced) ? raced : null;
    } catch {
      return null;
    }
  }

  private failureFresh(e: { at: number }): boolean {
    return this.now() - e.at < this.retryAfterMs;
  }

  private touch(key: string, e: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, e);
  }

  private store(key: string, e: Entry): void {
    this.delete(key);
    const cost = e.kind === 'ok' ? e.uri.length : 0;
    // A single URI larger than the whole budget is not kept (it is still returned to the caller).
    if (cost > this.maxChars) return;
    this.entries.set(key, e);
    this.chars += cost;
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries && this.chars <= this.maxChars) break;
      this.delete(oldest);
    }
  }

  private delete(key: string): void {
    const old = this.entries.get(key);
    if (!old) return;
    if (old.kind === 'ok') this.chars -= old.uri.length;
    this.entries.delete(key);
  }
}
