/**
 * FetchLike over the local lan-wss Expo module's `fetch` (modules/lan-wss). It trusts a TV's
 * self-signed certificate (Vizio SmartCast, Philips JointSpace) only for https:// URLs whose host is a
 * literal RFC 1918 IPv4 address; every other URL gets normal certificate validation. The rule is
 * enforced here (src/core/lanHost.ts) and again natively.
 *
 * The module only exists in a dev build, so it is loaded lazily inside try/catch and loadLanFetch()
 * returns null in Expo Go, web and tests. Not tested on a device yet.
 *
 * Responses expose `headers.get(name)` (case-insensitive), which philips.ts reads for Digest auth.
 */
import type { FetchLike } from '../core/driver';
import { isRfc1918Url } from '../core/lanHost';

/** Minimal slice of modules/lan-wss/index.ts that we use (kept local so a missing module cannot break types). */
export interface LanFetchModule {
  fetch(
    url: string,
    method: string,
    headersJson: string,
    body: string | null,
    timeoutMs: number,
    allowSelfSignedLan: boolean,
  ): Promise<{ status: number; headersJson: string; body: string }>;
}

declare const require: (id: string) => unknown;

export const LAN_FETCH_DEFAULT_TIMEOUT_MS = 10_000;

function loadModule(): LanFetchModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/lan-wss') as { default?: LanFetchModule | null } | null;
    const m = mod?.default ?? null;
    return m && typeof m.fetch === 'function' ? m : null;
  } catch {
    return null;
  }
}

function parseHeaders(json: string): Map<string, string> {
  const out = new Map<string, string>();
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return out;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    const key = k.toLowerCase();
    const prev = out.get(key);
    out.set(key, prev === undefined ? v : `${prev}, ${v}`);
  }
  return out;
}

/** True when relaxed (self-signed) trust may be requested for this URL: https:// + literal RFC 1918 host. */
export function lanTrustAllowed(url: string): boolean {
  return /^https:\/\//i.test(url) && isRfc1918Url(url);
}

/** Wraps a lan-wss module (real or fake) as a FetchLike. Exported for tests. */
export function lanFetchFromModule(mod: LanFetchModule): FetchLike {
  return async (url, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const headersJson = JSON.stringify(init?.headers ?? {});
    const body = init?.body ?? null;
    const timeoutMs = init?.timeoutMs && init.timeoutMs > 0 ? init.timeoutMs : LAN_FETCH_DEFAULT_TIMEOUT_MS;
    let res: { status: number; headersJson: string; body: string };
    try {
      res = await mod.fetch(url, method, headersJson, body, timeoutMs, lanTrustAllowed(url));
    } catch (e) {
      const code = (e as { code?: unknown } | null)?.code;
      const message = e instanceof Error ? e.message : String(e);
      const err = new Error(message || 'HTTP request failed.');
      if (code === 'ERR_LAN_FETCH_TIMEOUT') err.name = 'TimeoutError';
      throw err;
    }
    const status = Number(res.status) || 0;
    const headers = parseHeaders(typeof res.headersJson === 'string' ? res.headersJson : '{}');
    const text = typeof res.body === 'string' ? res.body : '';
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => text,
      headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    };
  };
}

/** Returns a LAN-trusting FetchLike, or null when the lan-wss native module is not compiled in. */
export function loadLanFetch(): FetchLike | null {
  const mod = loadModule();
  return mod ? lanFetchFromModule(mod) : null;
}

export function hasLanFetch(): boolean {
  return loadModule() !== null;
}
