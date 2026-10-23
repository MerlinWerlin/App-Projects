/**
 * MediaServer over a local media-server Expo module (modules/media-server, T76). That module does
 * not exist yet: it needs a dev build (a small native HTTP file server). It is loaded lazily by a
 * guarded require inside a function (D4-1), so in Expo Go, web and tests loadMediaServer() returns
 * UNAVAILABLE_MEDIA_SERVER and casting says it needs the full app. Never throws at load time.
 *
 * The URL the TV gets is built here from the phone's Wi-Fi IPv4 (expo-network via ./network) and
 * the port + token the native server returns, and is checked by src/core/cast/mediaServer.ts:
 * RFC 1918 host, port >= 1024, token of at least 128 bits. Not tested on a device.
 */
import {
  UNAVAILABLE_MEDIA_SERVER,
  extensionForMime,
  servedUrl,
  type MediaServer,
  type ServedFile,
} from '../core/cast/mediaServer';
import { driverError } from '../core/drivers/errors';
import { loadPhoneIp } from './network';

/** Minimal slice of the planned modules/media-server API (kept local so a missing module cannot break types). */
export interface MediaServerModule {
  /** Starts serving `uri` (once), returns the listening port and a random URL token. */
  serve(uri: string, mime: string): Promise<{ id: string; port: number; token: string }>;
  stop(id: string): Promise<void>;
  stopAll(): Promise<void>;
}

declare const require: (id: string) => unknown;

function defaultLoadModule(): MediaServerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../modules/media-server') as { default?: Partial<MediaServerModule> | null } | null;
    const m = mod?.default ?? null;
    if (!m || typeof m.serve !== 'function' || typeof m.stop !== 'function' || typeof m.stopAll !== 'function') {
      return null;
    }
    return m as MediaServerModule;
  } catch {
    return null;
  }
}

export interface MediaServerDeps {
  loadModule: () => MediaServerModule | null;
  loadPhoneIp: () => (() => Promise<string | null>) | null;
}

const DEFAULT_DEPS: MediaServerDeps = { loadModule: defaultLoadModule, loadPhoneIp };
let deps: MediaServerDeps = DEFAULT_DEPS;

/** Test hook: override some or all dependencies; call with no argument to restore the defaults. */
export function _setMediaServerDeps(override?: Partial<MediaServerDeps>): void {
  deps = override ? { ...DEFAULT_DEPS, ...override } : DEFAULT_DEPS;
}

/** The native media server, or UNAVAILABLE_MEDIA_SERVER when the module or Wi-Fi IP is missing. */
export function loadMediaServer(): MediaServer {
  let mod: MediaServerModule | null = null;
  let ip: (() => Promise<string | null>) | null = null;
  try {
    mod = deps.loadModule();
    ip = mod ? deps.loadPhoneIp() : null;
  } catch {
    return UNAVAILABLE_MEDIA_SERVER;
  }
  if (!mod || !ip) return UNAVAILABLE_MEDIA_SERVER;
  const native = mod;
  const phoneIp = ip;
  return {
    available: true,
    async serve(req): Promise<ServedFile> {
      const addr = await phoneIp();
      if (!addr) throw driverError('network', 'core.driver.common.unreachable');
      let started: { id: string; port: number; token: string };
      try {
        started = await native.serve(req.uri, req.mime);
      } catch {
        throw driverError('network', 'core.driver.cast.serveFailed');
      }
      const url = servedUrl(addr, started.port, started.token, extensionForMime(req.mime));
      if (!url) {
        await native.stop(started.id).catch(() => undefined);
        throw driverError('network', 'core.driver.cast.serveFailed');
      }
      return { url, stop: () => native.stop(started.id).catch(() => undefined) };
    },
    stopAll: () => native.stopAll().catch(() => undefined),
  };
}

export function hasMediaServer(): boolean {
  return loadMediaServer().available;
}
