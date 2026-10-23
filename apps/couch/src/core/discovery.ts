/**
 * Discovery parsing: SSDP M-SEARCH builder + response parser, mDNS record mapping, dedupe.
 * Pure TypeScript (no native imports). Tested against reconstructed sample payloads in
 * src/core/drivers/__fixtures__/ssdp/ — not against real hardware.
 */
import type { Platform } from './types';

export type DiscoverySource = 'ssdp' | 'mdns' | 'probe' | 'manual';

export interface TvCandidate {
  platform: Platform;
  /** IPv4 address of the TV on the LAN. */
  host: string;
  /** Port the TV announced (SSDP LOCATION port, mDNS SRV port, or probed port). A hint, not the control port. */
  port?: number;
  /** SSDP LOCATION URL (device description), when known. */
  location?: string;
  /** SSDP USN or other unique id (Roku serial, Samsung uuid, mDNS full name). */
  usn?: string;
  /** Friendly name, when the record carries one. */
  name?: string;
  model?: string;
  /** SSDP SERVER header, kept for diagnostics. */
  server?: string;
  source: DiscoverySource;
}

export const SSDP_ADDRESS = '239.255.255.250';
export const SSDP_PORT = 1900;

/** SSDP search targets per platform. */
export const SEARCH_TARGETS = {
  roku: 'roku:ecp',
  samsung: 'urn:samsung.com:device:RemoteControlReceiver:1',
  webos: 'urn:lge-com:service:webos-second-screen:1',
  sony: 'urn:schemas-sony-com:service:ScalarWebAPI:1',
} as const satisfies Partial<Record<Platform, string>>;

export type SsdpPlatform = keyof typeof SEARCH_TARGETS;

/** Builds an SSDP M-SEARCH request with exact CRLF framing (blank line terminates the headers). */
export function buildMSearch(st: string, mx = 2): string {
  const wait = Math.max(1, Math.min(5, Math.floor(mx)));
  return (
    'M-SEARCH * HTTP/1.1\r\n' +
    `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
    'MAN: "ssdp:discover"\r\n' +
    `MX: ${wait}\r\n` +
    `ST: ${st}\r\n` +
    '\r\n'
  );
}

/** Parses the start line + headers of an HTTP-over-UDP message. Header names are lower-cased. */
export function parseSsdpHeaders(text: string): { startLine: string; headers: Record<string, string> } {
  const lines = text.split(/\r?\n/);
  const startLine = (lines[0] ?? '').trim();
  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '') break;
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    if (!(name in headers)) headers[name] = line.slice(idx + 1).trim();
  }
  return { startLine, headers };
}

function platformFromSsdp(h: Record<string, string>): Platform | null {
  const st = (h['st'] ?? h['nt'] ?? '').toLowerCase();
  const usn = (h['usn'] ?? '').toLowerCase();
  const server = (h['server'] ?? '').toLowerCase();
  const hay = `${st} ${usn}`;
  if (hay.includes('roku:ecp')) return 'roku';
  if (hay.includes('urn:samsung.com:device:remotecontrolreceiver')) return 'samsung';
  if (hay.includes('urn:lge-com:service:webos-second-screen')) return 'webos';
  if (hay.includes('urn:schemas-sony-com:service:scalarwebapi')) return 'sony';
  // Fall back to SERVER hints only when the ST is generic (e.g. ssdp:all replies).
  if (/\broku\//.test(server)) return 'roku';
  if (server.includes('webos/')) return 'webos';
  if (server.includes('samsung')) return 'samsung';
  return null;
}

function parseUrlHostPort(url: string): { host: string; port?: number } | null {
  const m = /^[a-z]+:\/\/\[?([^\]/:]+)\]?(?::(\d+))?/i.exec(url.trim());
  if (!m || !m[1]) return null;
  const port = m[2] ? Number(m[2]) : undefined;
  return port !== undefined && port > 0 && port < 65536 ? { host: m[1], port } : { host: m[1] };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Maps an SSDP response (or NOTIFY) to a candidate. Returns null for non-TV or malformed messages.
 * `fromIp` is the datagram source address; it wins over the LOCATION host (which can be stale).
 */
export function parseSsdpResponse(text: string, fromIp?: string): TvCandidate | null {
  const { startLine, headers } = parseSsdpHeaders(text);
  const isResponse = /^HTTP\/1\.[01]\s+200\b/i.test(startLine);
  const isNotify = /^NOTIFY\s+\*\s+HTTP\/1\.[01]$/i.test(startLine);
  if (!isResponse && !isNotify) return null;
  if (isNotify && (headers['nts'] ?? '').toLowerCase() === 'ssdp:byebye') return null;

  const platform = platformFromSsdp(headers);
  if (!platform) return null;

  const location = headers['location'];
  const loc = location ? parseUrlHostPort(location) : null;
  const host = fromIp && fromIp.trim() !== '' ? fromIp.trim() : loc?.host;
  if (!host) return null;

  const c: TvCandidate = { platform, host, source: 'ssdp' };
  if (loc?.port !== undefined) c.port = loc.port;
  if (location) c.location = location;
  if (headers['usn']) c.usn = headers['usn'];
  if (headers['server']) c.server = headers['server'];
  // LG adds a URL-encoded friendly name header.
  const lgName = headers['dlnadevicename.lge.com'];
  if (lgName) c.name = safeDecode(lgName);
  // Sony puts the model in the SERVER product token (e.g. "KD-55X85J/1.0").
  if (platform === 'sony' && headers['server']) {
    const m = /\b([A-Z]{2,3}-\d{2}[A-Z0-9]+)\//.exec(headers['server']);
    if (m?.[1]) c.model = m[1];
    const mn = /\bmn="([^"]+)"/.exec(headers['x-av-server-info'] ?? '');
    if (mn?.[1]) c.name = mn[1];
  }
  return c;
}

/** Service record as surfaced by mDNS browsers (shape matches react-native-zeroconf's resolved service). */
export interface MdnsRecord {
  type: string;
  name?: string;
  fullName?: string;
  host?: string;
  addresses?: string[];
  port?: number;
  txt?: Record<string, string | undefined>;
}

export const MDNS_TYPES = {
  androidtv: '_androidtvremote2._tcp',
  firetv: '_amzn-wplay._tcp',
  vizio: '_viziocast._tcp',
} as const satisfies Partial<Record<Platform, string>>;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isIpv4(s: string): boolean {
  const m = IPV4.exec(s);
  if (!m) return false;
  return m.slice(1).every((o) => Number(o) <= 255 && (o === '0' || !o.startsWith('0')));
}

function normaliseType(t: string): string {
  return t.trim().toLowerCase().replace(/\.$/, '').replace(/\.local$/, '');
}

/** Maps an mDNS service record to a candidate, or null for unknown types / no usable IPv4 address. */
export function mdnsToCandidate(rec: MdnsRecord): TvCandidate | null {
  const type = normaliseType(rec.type);
  let platform: Platform | null = null;
  for (const [p, t] of Object.entries(MDNS_TYPES)) if (t === type) platform = p as Platform;
  if (!platform) return null;

  const addrs = rec.addresses ?? [];
  const host =
    addrs.find(isIpv4) ?? (rec.host && isIpv4(rec.host.replace(/\.$/, '')) ? rec.host.replace(/\.$/, '') : undefined);
  if (!host) return null;

  const c: TvCandidate = { platform, host, source: 'mdns' };
  if (rec.port !== undefined && rec.port > 0 && rec.port < 65536) c.port = rec.port;
  const txt = rec.txt ?? {};
  // TXT keys vary by device; 'n'/'fn'/'name' are best-effort (not verified on hardware).
  const name = rec.name ?? txt['fn'] ?? txt['n'] ?? txt['name'];
  if (name) c.name = name;
  const model = txt['md'] ?? txt['mdl'] ?? txt['model'];
  if (model) c.model = model;
  if (rec.fullName) c.usn = rec.fullName;
  return c;
}

function richness(c: TvCandidate): number {
  let n = 0;
  if (c.name) n += 4;
  if (c.model) n += 2;
  if (c.location) n += 1;
  if (c.usn) n += 1;
  if (c.port !== undefined) n += 1;
  if (c.source === 'manual') n -= 1;
  return n;
}

/**
 * One candidate per host. The richer record wins; missing fields are filled from the others
 * (only when they agree on platform).
 */
export function dedupeCandidates(list: readonly TvCandidate[]): TvCandidate[] {
  const byHost = new Map<string, TvCandidate>();
  for (const c of list) {
    const prev = byHost.get(c.host);
    if (!prev) {
      byHost.set(c.host, { ...c });
      continue;
    }
    const [win, lose] = richness(c) > richness(prev) ? [c, prev] : [prev, c];
    const merged: TvCandidate = { ...win };
    if (lose.platform === win.platform) {
      for (const k of ['port', 'location', 'usn', 'name', 'model', 'server'] as const) {
        if (merged[k] === undefined && lose[k] !== undefined) (merged as unknown as Record<string, unknown>)[k] = lose[k];
      }
    }
    byHost.set(c.host, merged);
  }
  return [...byHost.values()];
}
