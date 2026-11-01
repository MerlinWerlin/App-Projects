/**
 * mDNS adapter over the lan-wss module's Bonjour browser (modules/lan-wss/ios/LanBonjour.swift,
 * Network.framework NWBrowser). iOS lets an app browse the service types listed in NSBonjourServices
 * (app.json) without the multicast entitlement, so this is how store builds find Google TVs (Cast
 * built in, `_googlecast._tcp`), Android TV remotes, Fire TVs and Vizios.
 *
 * browse(types, onService): one native browse session for all types; each found service (type +
 * instance name + TXT) is resolved natively to an IPv4 host + port (bonjourResolve) before
 * onService gets an MdnsRecord. Each service is resolved once; a later TXT update for a resolved
 * service is delivered again with the same address. Resolves already in flight when the returned
 * stop function runs still deliver (they are bounded by resolveMs): discovery keeps collecting
 * while its subnet probe runs, so a slow resolve is not lost.
 *
 * The module only exists in a native build that includes LanBonjour, so it is loaded lazily inside
 * try/catch and loadBonjour() returns null in Expo Go, web, tests, Android, builds whose lan-wss
 * predates it, and when BONJOUR_NATIVE_ON is false. Not compiled or tested on a device yet.
 */
import { BONJOUR_NATIVE_ON } from '../core/bonjour/switch';
import { isIpv4, type MdnsRecord } from '../core/discovery';
import type { MdnsLike } from '../core/discoveryService';

interface Subscription {
  remove(): void;
}

export interface BonjourServiceEvent {
  id: string;
  type: string;
  name: string;
  txt?: Record<string, unknown> | null;
}

/** Minimal slice of modules/lan-wss/index.ts that we use (kept local so a missing module cannot break types). */
export interface LanBonjourModule {
  bonjourBrowse(id: string, types: string[], timeoutMs: number): boolean;
  bonjourStop(id: string): void;
  bonjourResolve(type: string, name: string, timeoutMs: number): Promise<{ host?: unknown; port?: unknown } | null>;
  addListener(event: 'onBonjourService', cb: (e: BonjourServiceEvent) => void): Subscription;
}

export interface BonjourOptions {
  /** Native safety stop for the browse session (discovery normally stops it sooner). */
  browseMs?: number;
  /** Per-service resolve timeout. */
  resolveMs?: number;
  /** Most services resolved per browse session. */
  maxResolves?: number;
}

export const BONJOUR_BROWSE_MS = 15000;
export const BONJOUR_RESOLVE_MS = 2500;
export const BONJOUR_MAX_RESOLVES = 32;

declare const require: (id: string) => unknown;

const FUNCTIONS = ['bonjourBrowse', 'bonjourStop', 'bonjourResolve', 'addListener'] as const;

function loadModule(): LanBonjourModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/lan-wss') as { default?: Partial<LanBonjourModule> | null } | null;
    const m = mod?.default ?? null;
    if (!m) return null;
    for (const f of FUNCTIONS) if (typeof m[f] !== 'function') return null;
    return m as LanBonjourModule;
  } catch {
    return null;
  }
}

/** TXT as plain strings; anything odd from the bridge is dropped. */
function cleanTxt(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k && typeof v === 'string') out[k] = v;
  }
  return out;
}

function cleanAddress(r: unknown): { host: string; port: number } | null {
  if (!r || typeof r !== 'object') return null;
  const { host, port } = r as { host?: unknown; port?: unknown };
  if (typeof host !== 'string' || !isIpv4(host)) return null;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

interface Entry {
  txt: Record<string, string>;
  /** undefined while resolving, null when it failed. */
  address: { host: string; port: number } | null | undefined;
}

let seq = 0;

/** Wraps a lan-wss module (real or fake) as an MdnsLike. Exported for tests. */
export function bonjourFromModule(mod: LanBonjourModule, opts: BonjourOptions = {}): MdnsLike {
  const browseMs = opts.browseMs ?? BONJOUR_BROWSE_MS;
  const resolveMs = opts.resolveMs ?? BONJOUR_RESOLVE_MS;
  const maxResolves = opts.maxResolves ?? BONJOUR_MAX_RESOLVES;
  return {
    browse(types, onService) {
      seq += 1;
      const id = `bonjour${Date.now().toString(36)}-${seq}`;
      const entries = new Map<string, Entry>();
      let resolves = 0;
      let stopped = false;

      const deliver = (type: string, name: string, e: Entry): void => {
        const a = e.address;
        if (!a) return;
        const rec: MdnsRecord = { type, name, fullName: `${name}.${type}.local.`, host: a.host, addresses: [a.host], port: a.port, txt: { ...e.txt } };
        try {
          onService(rec);
        } catch {
          // a consumer error must not break the browser
        }
      };

      let sub: Subscription;
      try {
        sub = mod.addListener('onBonjourService', (ev) => {
          if (stopped || !ev || ev.id !== id) return;
          const { type, name } = ev;
          if (typeof type !== 'string' || !type || typeof name !== 'string' || !name) return;
          const key = `${type}\n${name}`;
          const txt = cleanTxt(ev.txt);
          const known = entries.get(key);
          if (known) {
            known.txt = txt;
            deliver(type, name, known);
            return;
          }
          if (resolves >= maxResolves) return;
          resolves += 1;
          const entry: Entry = { txt, address: undefined };
          entries.set(key, entry);
          let pending: Promise<unknown>;
          try {
            pending = Promise.resolve(mod.bonjourResolve(type, name, resolveMs));
          } catch {
            entry.address = null;
            return;
          }
          pending.then(
            (r) => {
              entry.address = cleanAddress(r);
              deliver(type, name, entry);
            },
            () => {
              entry.address = null;
            },
          );
        });
      } catch {
        return () => undefined;
      }

      let started = false;
      try {
        started = mod.bonjourBrowse(id, [...types], browseMs) === true;
      } catch {
        started = false;
      }
      if (!started) {
        stopped = true;
        try {
          sub.remove();
        } catch {
          // ignore
        }
        return () => undefined;
      }

      return () => {
        if (stopped) return;
        stopped = true;
        try {
          sub.remove();
        } catch {
          // ignore
        }
        try {
          mod.bonjourStop(id);
        } catch {
          // ignore
        }
      };
    },
  };
}

/** Returns the Bonjour browser, or null when the native code is absent or switched off. */
export function loadBonjour(opts: BonjourOptions = {}): MdnsLike | null {
  if (!BONJOUR_NATIVE_ON) return null;
  const mod = loadModule();
  return mod ? bonjourFromModule(mod, opts) : null;
}

export function hasBonjour(): boolean {
  return BONJOUR_NATIVE_ON && loadModule() !== null;
}
