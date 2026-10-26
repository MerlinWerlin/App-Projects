/**
 * TcpFactory over the lan-wss module's raw TLS socket (modules/lan-wss, T106): used by the Google
 * Cast route (src/core/cast/googleCast), which talks CASTV2 over TLS on port 8009.
 *
 * Cast devices present a self-signed certificate. The native side accepts it ONLY for literal
 * RFC 1918 IPv4 hosts; this adapter refuses every other host before native code is called
 * (src/core/lanHost.ts), so the rule is enforced twice.
 *
 * The module only exists in a native build that includes the TLS socket, so it is loaded lazily
 * inside try/catch and loadLanTls() returns null in Expo Go, web, tests and builds whose lan-wss
 * predates tlsConnect. Bytes cross the bridge as base64 (src/core/crypto/bytes.ts, no Buffer).
 * Not compiled or tested on a device yet.
 */
import { fromBase64, toBase64 } from '../core/crypto/bytes';
import type { TcpFactory, TcpLike } from '../core/driver';
import { isRfc1918Host } from '../core/lanHost';

interface Subscription {
  remove(): void;
}

/** Minimal slice of modules/lan-wss/index.ts that we use (kept local so a missing module cannot break types). */
export interface LanTlsModule {
  tlsConnect(id: string, host: string, port: number, timeoutMs: number): Promise<void>;
  tlsWrite(id: string, base64: string): boolean;
  tlsClose(id: string): void;
  addListener(event: 'onTlsData', cb: (e: { id: string; base64: string }) => void): Subscription;
  addListener(event: 'onTlsClose', cb: (e: { id: string; message: string }) => void): Subscription;
}

declare const require: (id: string) => unknown;

export const LAN_TLS_CONNECT_TIMEOUT_MS = 8000;

function loadModule(): LanTlsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/lan-wss') as { default?: LanTlsModule | null } | null;
    const m = mod?.default ?? null;
    return m && typeof m.tlsConnect === 'function' && typeof m.tlsWrite === 'function' ? m : null;
  } catch {
    return null;
  }
}

let seq = 0;

/** Wraps a lan-wss module (real or fake) as a TLS-only TcpFactory. Exported for tests. */
export function lanTlsFromModule(mod: LanTlsModule, connectTimeoutMs = LAN_TLS_CONNECT_TIMEOUT_MS): TcpFactory {
  return async (host, port, opts) => {
    if (opts?.tls !== true) throw new Error('Only TLS sockets are available.');
    if (!isRfc1918Host(host)) throw new Error('Only local network addresses are allowed.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
    seq += 1;
    const id = `tls${Date.now().toString(36)}-${seq}`;

    const buffered: Uint8Array[] = [];
    const dataCbs: ((d: Uint8Array) => void)[] = [];
    const closeCbs: ((err?: Error) => void)[] = [];
    let closed = false;
    let closeError: Error | undefined;

    const dataSub = mod.addListener('onTlsData', (e) => {
      if (e.id !== id || closed) return;
      const bytes = fromBase64(e.base64);
      if (dataCbs.length === 0) buffered.push(bytes);
      else for (const cb of dataCbs) cb(bytes);
    });
    const closeSub = mod.addListener('onTlsClose', (e) => {
      if (e.id !== id || closed) return;
      closed = true;
      closeError = e.message ? new Error(e.message) : undefined;
      dataSub.remove();
      closeSub.remove();
      for (const cb of closeCbs.splice(0)) cb(closeError);
    });

    try {
      await mod.tlsConnect(id, host, port, connectTimeoutMs);
    } catch (e) {
      closed = true;
      dataSub.remove();
      closeSub.remove();
      throw e instanceof Error ? e : new Error(String(e));
    }

    const sock: TcpLike = {
      write: (data) => {
        if (closed || !mod.tlsWrite(id, toBase64(data))) throw new Error('Socket is closed');
      },
      close: () => {
        try {
          mod.tlsClose(id);
        } catch {
          // already closed
        }
      },
      onData: (cb) => {
        dataCbs.push(cb);
        if (dataCbs.length === 1 && buffered.length > 0) {
          const pending = buffered.splice(0);
          for (const d of pending) cb(d);
        }
      },
      onClose: (cb) => {
        if (closed) cb(closeError);
        else closeCbs.push(cb);
      },
    };
    return sock;
  };
}

/** Returns a TLS TcpFactory for LAN hosts, or null when the native TLS socket is not compiled in. */
export function loadLanTls(): TcpFactory | null {
  const mod = loadModule();
  return mod ? lanTlsFromModule(mod) : null;
}

export function hasLanTls(): boolean {
  return loadModule() !== null;
}
