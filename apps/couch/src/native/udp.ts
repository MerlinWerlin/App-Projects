/**
 * UDP adapter over react-native-udp. The module is NOT a dependency yet (needs a dev build), so it is
 * loaded lazily inside try/catch: in Expo Go this returns null and discovery falls back to the
 * unicast probe. Metro treats a require inside try/catch as an optional dependency, so a missing
 * package does not break the bundle. Not tested on a device yet.
 */
import type { UdpLike } from '../core/driver';

type Rinfo = { address: string; port: number };

/** Minimal slice of the react-native-udp socket API that we use. */
interface RnUdpSocket {
  bind(port: number, cb?: () => void): void;
  send(msg: Uint8Array, offset: number, length: number, port: number, address: string, cb?: (err?: unknown) => void): void;
  on(event: 'message', cb: (msg: Uint8Array, rinfo: Rinfo) => void): void;
  on(event: 'error', cb: (err: unknown) => void): void;
  close(): void;
}

interface RnUdpModule {
  createSocket(opts: { type: 'udp4'; reusePort?: boolean }): RnUdpSocket;
}

declare const require: (id: string) => unknown;

function loadModule(): RnUdpModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-udp') as { default?: RnUdpModule } & Partial<RnUdpModule>;
    const m = (mod.default ?? mod) as Partial<RnUdpModule>;
    return typeof m.createSocket === 'function' ? (m as RnUdpModule) : null;
  } catch {
    return null;
  }
}

/** Returns a socket factory, or null when react-native-udp is unavailable (Expo Go, web, tests). */
export function loadUdpFactory(): (() => Promise<UdpLike>) | null {
  const mod = loadModule();
  if (!mod) return null;
  return () =>
    new Promise<UdpLike>((resolve, reject) => {
      let sock: RnUdpSocket;
      try {
        sock = mod.createSocket({ type: 'udp4', reusePort: true });
      } catch (e) {
        reject(e);
        return;
      }
      const listeners: ((data: Uint8Array, from: Rinfo) => void)[] = [];
      sock.on('message', (msg, rinfo) => {
        for (const l of listeners) l(msg, { address: rinfo.address, port: rinfo.port });
      });
      sock.on('error', () => {
        // Errors surface through send(); swallow here so an unhandled event does not crash the app.
      });
      const adapter: UdpLike = {
        send: (data, port, host) =>
          new Promise<void>((res, rej) => {
            sock.send(data, 0, data.length, port, host, (err) => (err ? rej(err) : res()));
          }),
        close: () => {
          try {
            sock.close();
          } catch {
            // already closed
          }
        },
        onMessage: (cb) => {
          listeners.push(cb);
        },
      };
      try {
        sock.bind(0, () => resolve(adapter));
      } catch (e) {
        reject(e);
      }
    });
}

export function hasUdp(): boolean {
  return loadModule() !== null;
}
