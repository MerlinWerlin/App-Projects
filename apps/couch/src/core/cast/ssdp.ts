/**
 * SSDP search for UPnP MediaRenderers (T76). Reuses the M-SEARCH builder and header parser from
 * src/core/discovery.ts; the UDP socket and timer are injected. Tested against reconstructed
 * fixtures in src/core/cast/__fixtures__/, not against real hardware.
 */
import type { UdpLike } from '../driver';
import { SSDP_ADDRESS, SSDP_PORT, buildMSearch, parseSsdpHeaders } from '../discovery';
import { decodeAscii, encodeAscii } from '../discoveryService';
import { isRfc1918Host, urlHost } from '../lanHost';

export const MEDIA_RENDERER_ST = 'urn:schemas-upnp-org:device:MediaRenderer:1';

/** Any MediaRenderer version (a :2 or :3 device also answers a :1 search). */
const RENDERER_TYPE = /^urn:schemas-upnp-org:device:MediaRenderer:\d+$/i;

export interface RendererHit {
  /** Unique service name; the dedupe key (falls back to LOCATION when a device sends none). */
  usn: string;
  st: string;
  /** Device description URL; always http:// on an RFC 1918 host. */
  location: string;
  /** Host of LOCATION (what the description fetch and control URLs are checked against). */
  host: string;
  /** Datagram source address, when known (diagnostics only). */
  fromIp?: string;
  server?: string;
}

/**
 * Maps one SSDP datagram (M-SEARCH reply or NOTIFY ssdp:alive) to a renderer hit, or null for
 * anything else: other device types, byebye, a missing LOCATION, or a LOCATION that is not plain
 * http on a private LAN address.
 */
export function parseRendererResponse(text: string, fromIp?: string): RendererHit | null {
  const { startLine, headers } = parseSsdpHeaders(text);
  const isResponse = /^HTTP\/1\.[01]\s+200\b/i.test(startLine);
  const isNotify = /^NOTIFY\s+\*\s+HTTP\/1\.[01]$/i.test(startLine);
  if (!isResponse && !isNotify) return null;
  if (isNotify && (headers['nts'] ?? '').toLowerCase() !== 'ssdp:alive') return null;

  const st = (isResponse ? headers['st'] : headers['nt']) ?? '';
  if (!RENDERER_TYPE.test(st.trim())) return null;

  const location = (headers['location'] ?? '').trim();
  if (!/^http:\/\//i.test(location)) return null;
  const host = urlHost(location);
  if (!host || !isRfc1918Host(host)) return null;

  const usn = (headers['usn'] ?? '').trim();
  const hit: RendererHit = { usn: usn !== '' ? usn : location, st: st.trim(), location, host };
  if (fromIp) hit.fromIp = fromIp;
  if (headers['server']) hit.server = headers['server'];
  return hit;
}

/** First hit per USN (case-insensitive), in arrival order. */
export function dedupeByUsn(hits: readonly RendererHit[]): RendererHit[] {
  const seen = new Set<string>();
  const out: RendererHit[] = [];
  for (const h of hits) {
    const k = h.usn.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

export interface RendererSearchDeps {
  /** Socket factory, or null when no UDP module is available (Expo Go). */
  udp: (() => Promise<UdpLike>) | null;
  sleep?: (ms: number) => Promise<void>;
}

export interface RendererSearchOptions {
  windowMs?: number;
  mx?: number;
  onFound?: (hit: RendererHit) => void;
  isCancelled?: () => boolean;
}

export interface RendererSearchResult {
  hits: RendererHit[];
  /** Non-fatal problems for diagnostics (English, never shown to users). */
  errors: string[];
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Sends the M-SEARCH twice (UDP is lossy), half a window apart, and collects replies. */
export async function searchRenderers(
  deps: RendererSearchDeps,
  opts: RendererSearchOptions = {},
): Promise<RendererSearchResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const windowMs = opts.windowMs ?? 2500;
  const errors: string[] = [];
  const hits: RendererHit[] = [];
  const seen = new Set<string>();

  if (!deps.udp) return { hits, errors: ['udp: unavailable'] };
  let socket: UdpLike;
  try {
    socket = await deps.udp();
  } catch (e) {
    return { hits, errors: [`udp: ${String(e)}`] };
  }
  if (!socket.onMessage) {
    socket.close();
    return { hits, errors: ['udp: socket cannot receive'] };
  }

  socket.onMessage((data, from) => {
    const hit = parseRendererResponse(decodeAscii(data), from.address);
    if (!hit) return;
    const k = hit.usn.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    hits.push(hit);
    opts.onFound?.(hit);
  });

  const msg = encodeAscii(buildMSearch(MEDIA_RENDERER_ST, opts.mx ?? 2));
  const send = async (): Promise<void> => {
    try {
      await socket.send(msg, SSDP_PORT, SSDP_ADDRESS);
    } catch (e) {
      errors.push(`ssdp send: ${String(e)}`);
    }
  };
  try {
    await send();
    await sleep(Math.floor(windowMs / 2));
    if (!opts.isCancelled?.()) await send();
    await sleep(windowMs - Math.floor(windowMs / 2));
  } finally {
    socket.close();
  }
  return { hits, errors };
}
