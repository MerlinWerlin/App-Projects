/**
 * mDNS adapter over react-native-zeroconf. Not a dependency yet (needs a dev build): loaded lazily
 * inside try/catch (a Metro optional dependency) and returns null when unavailable, so Expo Go never
 * crashes. Service types are scanned one at a time in rotation because the native browser is shared.
 * Not tested on a device yet.
 */
import type { MdnsRecord } from '../core/discovery';
import type { MdnsLike } from '../core/discoveryService';

interface ZeroconfService {
  name?: string;
  fullName?: string;
  host?: string;
  addresses?: string[];
  port?: number;
  txt?: Record<string, string>;
}

/** Minimal slice of the react-native-zeroconf class we use. */
interface ZeroconfInstance {
  scan(type: string, protocol: string, domain: string): void;
  stop(): void;
  on(event: 'resolved', cb: (s: ZeroconfService) => void): void;
  on(event: 'error', cb: (e: unknown) => void): void;
  removeDeviceListeners(): void;
}

type ZeroconfCtor = new () => ZeroconfInstance;

declare const require: (id: string) => unknown;

function loadCtor(): ZeroconfCtor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-zeroconf') as { default?: ZeroconfCtor } | ZeroconfCtor;
    const ctor = typeof mod === 'function' ? mod : mod.default;
    return typeof ctor === 'function' ? ctor : null;
  } catch {
    return null;
  }
}

/** "_androidtvremote2._tcp" -> ["androidtvremote2", "tcp"] */
function splitType(t: string): [string, string] {
  const parts = t.replace(/\.$/, '').split('.');
  return [(parts[0] ?? '').replace(/^_/, ''), (parts[1] ?? '_tcp').replace(/^_/, '')];
}

/** Returns an mDNS browser, or null when react-native-zeroconf is unavailable. */
export function loadZeroconf(opts: { dwellMs?: number } = {}): MdnsLike | null {
  const Ctor = loadCtor();
  if (!Ctor) return null;
  const dwellMs = opts.dwellMs ?? 1500;
  return {
    browse(types, onService) {
      let zc: ZeroconfInstance;
      try {
        zc = new Ctor();
      } catch {
        return () => undefined;
      }
      let idx = 0;
      let current = types[0] ?? '';
      let stopped = false;
      zc.on('resolved', (s) => {
        const rec: MdnsRecord = { type: current };
        if (s.name !== undefined) rec.name = s.name;
        if (s.fullName !== undefined) rec.fullName = s.fullName;
        if (s.host !== undefined) rec.host = s.host;
        if (s.addresses !== undefined) rec.addresses = s.addresses;
        if (s.port !== undefined) rec.port = s.port;
        if (s.txt !== undefined) rec.txt = s.txt;
        onService(rec);
      });
      zc.on('error', () => undefined);
      const scanNext = (): void => {
        if (stopped || types.length === 0) return;
        current = types[idx % types.length] ?? '';
        idx++;
        const [svc, proto] = splitType(current);
        try {
          zc.stop();
          zc.scan(svc, proto, 'local.');
        } catch {
          // ignore; next rotation retries
        }
      };
      scanNext();
      const timer = setInterval(scanNext, dwellMs);
      return () => {
        stopped = true;
        clearInterval(timer);
        try {
          zc.stop();
          zc.removeDeviceListeners();
        } catch {
          // ignore
        }
      };
    },
  };
}

export function hasZeroconf(): boolean {
  return loadCtor() !== null;
}
