/**
 * Direct renderer probe of a KNOWN TV host (cast-1024, T89), for when multicast SSDP is not
 * available (the iOS multicast entitlement is still pending). Two ways, both unicast:
 *
 * 1. GET a short list of well-known MediaRenderer description URLs on that host, parse each with
 *    fetchRenderer; the first in list order that has an AVTransport wins.
 * 2. When a UDP socket factory is given and (1) found nothing, a unicast SSDP M-SEARCH to
 *    <host>:1900; a reply whose LOCATION is on that same host is fetched and parsed.
 *
 * The description URLs come from public integration docs and are UNVERIFIED by this project; the
 * list is deliberately short (other brands use random ports, which only SSDP can find). Only literal RFC 1918 hosts are probed.
 */
import type { FetchLike, UdpLike } from '../driver';
import { SSDP_PORT } from '../discovery';
import { decodeAscii, encodeAscii } from '../discoveryService';
import { isRfc1918Host } from '../lanHost';
import { fetchRenderer, type CastRenderer } from './description';
import { SYSTEM_TIMER, type CastTimer } from './session';
import { MEDIA_RENDERER_ST, parseRendererResponse } from './ssdp';

/** Well-known MediaRenderer description locations (port + path), from public docs, unverified. */
export const KNOWN_RENDERER_PATHS: readonly { port: number; path: string; note: string }[] = [
  { port: 9197, path: '/dmr', note: 'Samsung TVs (DMR)' },
  { port: 52323, path: '/dmr.xml', note: 'Sony Bravia TVs' },
];

export function knownRendererUrls(host: string): string[] {
  return KNOWN_RENDERER_PATHS.map((p) => `http://${host}:${p.port}${p.path}`);
}

/** Unicast M-SEARCH (UDA 1.1: HOST is the device, no MX). */
export function buildUnicastMSearch(host: string, st = MEDIA_RENDERER_ST): string {
  return `M-SEARCH * HTTP/1.1\r\nHOST: ${host}:${SSDP_PORT}\r\nMAN: "ssdp:discover"\r\nST: ${st}\r\n\r\n`;
}

export interface ProbeDeps {
  fetch: FetchLike;
  udp?: (() => Promise<UdpLike>) | null;
  /** Per-request timeout, and the wait for an M-SEARCH reply. Default 2000 ms. */
  timeoutMs?: number;
  /** Used for the M-SEARCH reply wait (tests inject a fake). */
  timer?: CastTimer;
}

/** One-shot wait on a CastTimer (which only has intervals). */
export function timerSleep(timer: CastTimer, ms: number): { promise: Promise<void>; cancel: () => void } {
  let handle: unknown = null;
  let done: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    done = resolve;
    handle = timer.setInterval(() => {
      timer.clearInterval(handle);
      resolve();
    }, ms);
  });
  return {
    promise,
    cancel: () => {
      timer.clearInterval(handle);
      done();
    },
  };
}

async function unicastSearch(host: string, deps: ProbeDeps, timeoutMs: number): Promise<CastRenderer | null> {
  if (!deps.udp) return null;
  let socket: UdpLike;
  try {
    socket = await deps.udp();
  } catch {
    return null;
  }
  if (!socket.onMessage) {
    socket.close();
    return null;
  }
  const wait = timerSleep(deps.timer ?? SYSTEM_TIMER, timeoutMs);
  let location: string | null = null;
  socket.onMessage((data, from) => {
    if (location) return;
    const hit = parseRendererResponse(decodeAscii(data), from.address);
    // Only follow a LOCATION on the host we asked: a reply must not point the phone elsewhere.
    if (!hit || hit.host !== host) return;
    location = hit.location;
    wait.cancel();
  });
  try {
    await socket.send(encodeAscii(buildUnicastMSearch(host)), SSDP_PORT, host);
    await wait.promise;
  } catch {
    wait.cancel();
  } finally {
    socket.close();
  }
  if (!location) return null;
  try {
    return await fetchRenderer(deps.fetch, location, timeoutMs);
  } catch {
    return null;
  }
}

/**
 * Finds a MediaRenderer on `host`, or null (not on the LAN, nothing answers, or no AVTransport).
 * Never throws.
 */
export async function probeRenderer(host: string, deps: ProbeDeps): Promise<CastRenderer | null> {
  if (!isRfc1918Host(host)) return null;
  const timeoutMs = deps.timeoutMs ?? 2000;
  const results = await Promise.all(
    knownRendererUrls(host).map(async (url) => {
      try {
        return await fetchRenderer(deps.fetch, url, timeoutMs);
      } catch {
        return null;
      }
    }),
  );
  const direct = results.find((r): r is CastRenderer => r !== null);
  if (direct) return direct;
  return unicastSearch(host, deps, timeoutMs);
}
