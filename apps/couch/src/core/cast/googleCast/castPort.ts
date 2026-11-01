/**
 * Google Cast port lookup (owner 1 Nov 2026: the TCL C7K Google TV refused the cast connection on the
 * standard port 8009 — "Connection refused"). Google TVs announce their real Cast port over Bonjour
 * (_googlecast._tcp). This wraps the TLS socket factory so a Cast connection to 8009 first asks the
 * lookup for the TV's advertised port, tries that, and falls back to 8009.
 * Pure TS: the Bonjour browse is injected (src/native/bonjour.ts in the app, fakes in tests).
 */
import type { TcpFactory } from '../../driver';
import type { MdnsRecord } from '../../discovery';
import type { MdnsLike } from '../../discoveryService';

export const CAST_DEFAULT_PORT = 8009;
export const CAST_SERVICE = '_googlecast._tcp';
export const CAST_PORT_LOOKUP_MS = 3000;

export type CastPortLookup = (host: string) => Promise<number | null>;

/** Browses _googlecast._tcp for up to `ms` and returns the port advertised for `host` (first match). */
export function bonjourCastPortLookup(mdns: MdnsLike, ms = CAST_PORT_LOOKUP_MS, wait: (ms: number) => Promise<void> = (t) => new Promise((r) => setTimeout(r, t))): CastPortLookup {
  const cache = new Map<string, number>();
  return async (host) => {
    const hit = cache.get(host);
    if (hit !== undefined) return hit;
    let found: number | null = null;
    let done!: () => void;
    const matched = new Promise<void>((r) => {
      done = r;
    });
    const matches = (rec: MdnsRecord): boolean =>
      rec.host === host || (rec.addresses ?? []).includes(host);
    let stop: (() => void) | null = null;
    try {
      stop = mdns.browse([CAST_SERVICE], (rec) => {
        if (found !== null || !matches(rec)) return;
        const p = rec.port;
        if (typeof p === 'number' && Number.isInteger(p) && p > 0 && p <= 65535) {
          found = p;
          done();
        }
      });
    } catch {
      return null;
    }
    await Promise.race([matched, wait(ms)]);
    try {
      stop?.();
    } catch {
      // ignore
    }
    if (found !== null) cache.set(host, found);
    return found;
  };
}

/**
 * A TcpFactory that, for Cast connections on 8009, tries the looked-up port first and keeps 8009 as
 * the fallback. Other ports pass straight through. When both fail, the 8009 error is thrown (and,
 * if that is the only failure, the looked-up port's error).
 */
export function withCastPortLookup(tcp: TcpFactory, lookup: CastPortLookup): TcpFactory {
  const tagged = (p: number, e: unknown): Error => new Error(`port ${p}: ${e instanceof Error ? e.message : String(e)}`);
  return async (host, port, opts) => {
    if (port !== CAST_DEFAULT_PORT) return tcp(host, port, opts);
    const advertised = await lookup(host).catch(() => null);
    if (advertised !== null && advertised !== port) {
      try {
        return await tcp(host, advertised, opts);
      } catch (e) {
        try {
          return await tcp(host, port, opts);
        } catch {
          throw tagged(advertised, e);
        }
      }
    }
    try {
      return await tcp(host, port, opts);
    } catch (e) {
      // Say whether the TV announced a Cast port at all, up front, so a shortened on-screen reason keeps it.
      const note = advertised === null ? 'no Cast service announced' : `Cast announced on ${advertised}`;
      throw new Error(`port ${port} (${note}): ${e instanceof Error ? e.message : String(e)}`);
    }
  };
}
