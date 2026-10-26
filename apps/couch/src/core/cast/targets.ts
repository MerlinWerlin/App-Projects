/**
 * Cast target list + driver factory (cast-1024, T89).
 *
 * findCastTargets() turns the saved TVs (and, when UDP is available, a multicast SSDP search) into
 * CastTargets: the demo TV for mock TVs, the Roku media player for Roku TVs, and a DLNA renderer
 * wherever a probe or the search finds one. createCastDriver() builds the driver for a target; DLNA
 * renderers found by findCastTargets are remembered by target id so the screen only needs the
 * target.
 *
 * Google Cast (T106): every saved Android TV / Google TV on the LAN also gets a `gcast:<host>`
 * target, listed before its DLNA renderer, when a TLS TcpFactory is available (`env.tcp`, from the
 * lan-wss native module; absent in Expo Go and older builds). No network probe at search time.
 */
import type { FetchLike, TcpFactory, UdpLike } from '../driver';
import { driverError } from '../drivers/errors';
import { isRfc1918Host } from '../lanHost';
import type { Tv } from '../types';
import type { CastRenderer } from './description';
import { discoverRenderers } from './discover';
import type { CastDriver, CastTarget } from './driver';
import { createDlnaDriver } from './dlnaDriver';
import { createGoogleCast } from './googleCast/googleCastDriver';
import { MOCK_CAST_TARGET, createMockCast } from './mockCast';
import { probeRenderer, timerSleep } from './probe';
import { createRokuCast } from './rokuCast';
import { SYSTEM_TIMER, type CastTimer } from './session';

export interface CastEnv {
  fetch: FetchLike;
  udp?: (() => Promise<UdpLike>) | null;
  timer?: CastTimer;
  /** TLS-capable TCP sockets (Google Cast, T106). null / absent: no Google Cast targets. */
  tcp?: TcpFactory | null;
}

const renderers = new Map<string, CastRenderer>();

/** The renderer behind a DLNA target found earlier, if any. */
export function rendererFor(targetId: string): CastRenderer | undefined {
  return renderers.get(targetId);
}

/** Forgets every remembered renderer (tests). */
export function clearCastRenderers(): void {
  renderers.clear();
}

export function dlnaTarget(renderer: CastRenderer, tv?: Tv): CastTarget {
  const t: CastTarget = {
    id: `dlna:${renderer.udn ?? renderer.location}`,
    name: tv?.name ?? renderer.name,
    kind: 'dlna',
    host: renderer.host,
    accepts: { photo: true, video: true },
  };
  if (tv) t.tvId = tv.id;
  return t;
}

export function rokuTarget(tv: Tv): CastTarget {
  return {
    id: `roku:${tv.host}`,
    name: tv.name,
    kind: 'roku',
    host: tv.host,
    accepts: { photo: true, video: true },
    tvId: tv.id,
  };
}

/**
 * Saved TVs that could take a Google Cast (Chromecast built-in) cast: Android TV / Google TV on a
 * literal RFC 1918 address. Lets the screen explain that casting to them needs the next app build
 * when `env.tcp` is missing.
 */
export function googleCastCandidates(tvs: readonly Tv[]): Tv[] {
  return tvs.filter((tv) => tv.platform === 'androidtv' && isRfc1918Host(tv.host));
}

export function googleCastTarget(tv: Tv): CastTarget {
  return {
    id: `gcast:${tv.host}`,
    name: tv.name,
    kind: 'googlecast',
    host: tv.host,
    accepts: { photo: true, video: true },
    tvId: tv.id,
  };
}

export async function findCastTargets(env: CastEnv, tvs: readonly Tv[]): Promise<CastTarget[]> {
  const timer = env.timer ?? SYSTEM_TIMER;
  const out: CastTarget[] = [];
  const seenUdn = new Set<string>();
  const seenDlnaHost = new Set<string>();
  const tvByHost = new Map<string, Tv>();

  const addDlna = (r: CastRenderer, tv?: Tv): void => {
    const udn = r.udn?.toLowerCase();
    if ((udn && seenUdn.has(udn)) || seenDlnaHost.has(r.host)) return;
    if (udn) seenUdn.add(udn);
    seenDlnaHost.add(r.host);
    const t = dlnaTarget(r, tv);
    renderers.set(t.id, r);
    out.push(t);
  };

  let mockAdded = false;
  const probes: Promise<{ tv: Tv; r: CastRenderer | null }>[] = [];
  for (const tv of tvs) {
    if (tv.platform === 'mock') {
      if (!mockAdded) out.push({ ...MOCK_CAST_TARGET, tvId: tv.id });
      mockAdded = true;
      continue;
    }
    if (tv.platform === 'ir' || !isRfc1918Host(tv.host)) continue;
    if (!tvByHost.has(tv.host)) tvByHost.set(tv.host, tv);
    else continue;
    if (tv.platform === 'roku') out.push(rokuTarget(tv));
    if (tv.platform === 'androidtv' && env.tcp) out.push(googleCastTarget(tv));
    probes.push(probeRenderer(tv.host, { fetch: env.fetch, udp: env.udp ?? null, timer }).then((r) => ({ tv, r })));
  }

  const search = env.udp
    ? discoverRenderers({
        udp: env.udp,
        fetch: env.fetch,
        sleep: (ms) => timerSleep(timer, ms).promise,
      }).catch(() => ({ renderers: [] as CastRenderer[], errors: [] }))
    : Promise.resolve({ renderers: [] as CastRenderer[], errors: [] });

  const [probed, found] = await Promise.all([Promise.all(probes), search]);
  for (const { tv, r } of probed) if (r) addDlna(r, tv);
  for (const r of found.renderers) addDlna(r, tvByHost.get(r.host));
  return out;
}

/**
 * The driver for `target`. A DLNA target needs its renderer: pass it, or let findCastTargets have
 * found it. Throws a translated DriverError ('unsupported') when a DLNA renderer is unknown, or
 * for a Google Cast target when there is no TLS TcpFactory (`env.tcp`).
 */
export function createCastDriver(target: CastTarget, env: CastEnv, renderer?: CastRenderer): CastDriver {
  switch (target.kind) {
    case 'mock':
      return createMockCast(target, env.timer);
    case 'roku':
      return createRokuCast(target, env.fetch, env.timer);
    case 'googlecast':
      if (!env.tcp) throw driverError('unsupported', 'core.driver.cast.needsFullApp');
      return createGoogleCast(target, env.tcp, env.timer);
    case 'dlna': {
      const r = renderer ?? renderers.get(target.id);
      if (!r) throw driverError('unsupported', 'core.driver.cast.noRenderer');
      return createDlnaDriver(target, r, env.fetch, env.timer);
    }
  }
}
