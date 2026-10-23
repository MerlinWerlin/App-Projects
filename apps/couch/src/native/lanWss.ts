/**
 * WsFactory over the local lan-wss Expo module (modules/lan-wss). The module only exists in a dev
 * build, so it is loaded lazily inside try/catch and this returns null in Expo Go, web and tests.
 * Not tested on a device yet.
 *
 * The relaxed TLS rule is enforced twice: here (allowSelfSignedLan is dropped unless the URL host is
 * a literal RFC 1918 IPv4 address, src/core/lanHost.ts) and again natively.
 *
 * Frames that arrive before the driver registers onMessage are buffered, so a handshake event sent
 * right after the socket opens is never lost.
 */
import type { WsFactory, WsLike } from '../core/driver';
import { isRfc1918Url } from '../core/lanHost';

interface Subscription {
  remove(): void;
}

/** Minimal slice of modules/lan-wss/index.ts that we use (kept local so a missing module cannot break types). */
interface LanWssModule {
  connect(id: string, url: string, allowSelfSignedLan: boolean): Promise<void>;
  send(id: string, data: string): boolean;
  close(id: string): void;
  addListener(event: 'onMessage', cb: (e: { id: string; data: string }) => void): Subscription;
  addListener(event: 'onClose', cb: (e: { id: string }) => void): Subscription;
}

declare const require: (id: string) => unknown;

function loadModule(): LanWssModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/lan-wss') as { default?: LanWssModule | null } | null;
    const m = mod?.default ?? null;
    return m && typeof m.connect === 'function' ? m : null;
  } catch {
    return null;
  }
}

let seq = 0;

/** Returns a WsFactory, or null when the lan-wss native module is not compiled in. */
export function loadLanWssFactory(): WsFactory | null {
  const mod = loadModule();
  if (!mod) return null;
  return async (url, opts) => {
    seq += 1;
    const id = `ws${Date.now().toString(36)}-${seq}`;
    const allow = opts?.allowSelfSignedLan === true && isRfc1918Url(url);

    const buffered: string[] = [];
    const msgCbs: ((d: string) => void)[] = [];
    const closeCbs: (() => void)[] = [];
    let closed = false;

    const msgSub = mod.addListener('onMessage', (e) => {
      if (e.id !== id) return;
      if (msgCbs.length === 0) buffered.push(e.data);
      else for (const cb of msgCbs) cb(e.data);
    });
    const closeSub = mod.addListener('onClose', (e) => {
      if (e.id !== id || closed) return;
      closed = true;
      msgSub.remove();
      closeSub.remove();
      for (const cb of closeCbs) cb();
    });

    try {
      await mod.connect(id, url, allow);
    } catch (e) {
      closed = true;
      msgSub.remove();
      closeSub.remove();
      throw e;
    }

    const ws: WsLike = {
      send: (data) => {
        if (closed || !mod.send(id, data)) throw new Error('WebSocket is closed');
      },
      close: () => {
        try {
          mod.close(id);
        } catch {
          // already closed
        }
      },
      onMessage: (cb) => {
        msgCbs.push(cb);
        if (msgCbs.length === 1 && buffered.length > 0) {
          const pending = buffered.splice(0);
          for (const d of pending) cb(d);
        }
      },
      onClose: (cb) => {
        if (closed) cb();
        else closeCbs.push(cb);
      },
    };
    return ws;
  };
}

export function hasLanWss(): boolean {
  return loadModule() !== null;
}
