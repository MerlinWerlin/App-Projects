/**
 * Unicast fallback for when multicast is unavailable (iOS before the multicast entitlement,
 * Expo Go, guest Wi-Fi): walk the subnet with plain HTTP requests, plus manual-IP validation.
 * Transport is injected (FetchLike). Tested with a fake fetch and sample payloads, not hardware.
 */
import { t } from '../i18n/core';
import type { FetchLike } from './driver';
import type { TvCandidate } from './discovery';
import { isIpv4 } from './discovery';

export const ROKU_ECP_PORT = 8060;
export const SAMSUNG_API_PORT = 8001;
/** Sony Bravia REST API (port 80): /sony/system getInterfaceInformation answers without a key. */
export const SONY_API_PORT = 80;
/** Chromecast built-in / Google TV local setup API (plain HTTP on older firmware). */
export const CAST_SETUP_PORT = 8008;
/** LG webOS SSAP plain WebSocket port; a plain HTTP GET there answers "Hello world". */
export const WEBOS_PROBE_PORT = 3000;
export const DEFAULT_PROBE_TIMEOUT_MS = 800;

function toInt(ip: string): number | null {
  if (!isIpv4(ip)) return null;
  return ip.split('.').reduce((acc, o) => acc * 256 + Number(o), 0);
}

function toIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

/** True for a contiguous netmask such as 255.255.255.0. */
function maskBits(mask: string): number | null {
  const m = toInt(mask);
  if (m === null) return null;
  const inv = ~m >>> 0;
  if (((inv + 1) & inv) !== 0) return null; // not contiguous
  let bits = 0;
  for (let b = 31; b >= 0; b--) if ((m >>> b) & 1) bits++;
  return bits;
}

/**
 * Host addresses in `ip`'s subnet, excluding the network address, broadcast and `ip` itself.
 * Subnets larger than `maxHosts` are narrowed to the /24 around `ip` (a /16 walk is too slow to be useful).
 */
export function subnetHosts(ip: string, mask = '255.255.255.0', opts: { maxHosts?: number } = {}): string[] {
  const self = toInt(ip);
  let bits = maskBits(mask);
  if (self === null || bits === null) return [];
  if (bits >= 31) return [];
  const maxHosts = opts.maxHosts ?? 1022;
  if (2 ** (32 - bits) - 2 > maxHosts) bits = 24;
  const size = 2 ** (32 - bits);
  const network = Math.floor(self / size) * size;
  const out: string[] = [];
  for (let n = network + 1; n < network + size - 1; n++) if (n !== self) out.push(toIp(n));
  return out;
}

/** RFC 1918 private ranges: 10/8, 172.16/12, 192.168/16. */
export function isPrivateLanIp(ip: string): boolean {
  const n = toInt(ip);
  if (n === null) return false;
  const a = n >>> 24;
  const b = (n >>> 16) & 255;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export type ManualIpResult = { ok: true; host: string; port?: number } | { ok: false; error: string };

/**
 * Validates the "Enter IP address" field. Accepts "192.168.1.40", "192.168.1.40:8060" and a pasted
 * "http://192.168.1.40:8060/". Only private LAN addresses are allowed (no calls outside the local network).
 */
export function parseManualIp(input: string): ManualIpResult {
  let s = input.trim();
  if (s === '') return { ok: false, error: t('core.probe.empty') };
  s = s.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '');
  let port: number | undefined;
  const pm = /^(.*):(\d{1,5})$/.exec(s);
  if (pm && pm[1] !== undefined && pm[2] !== undefined) {
    s = pm[1];
    port = Number(pm[2]);
    if (port < 1 || port > 65535) return { ok: false, error: t('core.probe.badPort') };
  }
  if (!isIpv4(s)) return { ok: false, error: t('core.probe.notIp', { example: '192.168.1.40' }) };
  if (!isPrivateLanIp(s)) return { ok: false, error: t('core.probe.notLan') };
  return port === undefined ? { ok: true, host: s } : { ok: true, host: s, port };
}

function xmlTag(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i').exec(xml);
  const v = m?.[1]?.trim();
  return v ? v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"') : undefined;
}

/** Maps a Roku ECP /query/device-info XML body to a candidate. */
export function parseRokuDeviceInfo(xml: string, host: string): TvCandidate | null {
  if (!/<device-info>/i.test(xml)) return null;
  const c: TvCandidate = { platform: 'roku', host, port: ROKU_ECP_PORT, source: 'probe' };
  const name = xmlTag(xml, 'user-device-name') ?? xmlTag(xml, 'friendly-device-name') ?? xmlTag(xml, 'default-device-name');
  if (name) c.name = name;
  const model = xmlTag(xml, 'friendly-model-name') ?? xmlTag(xml, 'model-name');
  if (model) c.model = model;
  const serial = xmlTag(xml, 'serial-number') ?? xmlTag(xml, 'udn');
  if (serial) c.usn = serial;
  c.location = `http://${host}:${ROKU_ECP_PORT}/`;
  return c;
}

/** Maps a Samsung Tizen GET :8001/api/v2/ JSON body to a candidate. */
export function parseSamsungApiV2(body: string, host: string): TvCandidate | null {
  let j: unknown;
  try {
    j = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof j !== 'object' || j === null) return null;
  const root = j as Record<string, unknown>;
  const dev = (typeof root['device'] === 'object' && root['device'] !== null ? root['device'] : {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  const type = str(dev['type']) ?? str(root['type']) ?? '';
  if (!/samsung/i.test(type) && !str(dev['modelName'])) return null;
  const c: TvCandidate = { platform: 'samsung', host, port: SAMSUNG_API_PORT, source: 'probe' };
  const name = str(dev['name']) ?? str(root['name']);
  if (name) c.name = safeDecodeHtml(name);
  const model = str(dev['modelName']);
  if (model) c.model = model;
  const id = str(dev['id']) ?? str(root['id']);
  if (id) c.usn = id;
  c.location = `http://${host}:${SAMSUNG_API_PORT}/api/v2/`;
  return c;
}

/** Maps a Sony Bravia /sony/system getInterfaceInformation JSON body to a candidate. */
export function parseSonyInterfaceInfo(body: string, host: string): TvCandidate | null {
  let j: unknown;
  try {
    j = JSON.parse(body);
  } catch {
    return null;
  }
  const result = (j as { result?: unknown })?.result;
  const info = Array.isArray(result) ? (result[0] as Record<string, unknown> | undefined) : undefined;
  if (!info || typeof info !== 'object') return null;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  const category = str(info['productCategory']) ?? '';
  if (!/tv/i.test(category)) return null;
  const c: TvCandidate = { platform: 'sony', host, port: SONY_API_PORT, source: 'probe' };
  const model = str(info['modelName']);
  if (model) c.model = model;
  const name = str(info['productName']);
  if (name) c.name = name;
  c.location = `http://${host}/sony/system`;
  return c;
}

/** Maps a Chromecast built-in GET :8008/setup/eureka_info JSON body to a Google TV candidate. */
export function parseCastEurekaInfo(body: string, host: string): TvCandidate | null {
  let j: unknown;
  try {
    j = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof j !== 'object' || j === null) return null;
  const root = j as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  // Only devices that look like a Cast receiver (a build or cast revision field, or a ssdp_udn).
  if (!str(root['cast_build_revision']) && !str(root['build_version']) && !str(root['ssdp_udn']) && typeof root['build_info'] !== 'object') return null;
  const c: TvCandidate = { platform: 'androidtv', host, port: CAST_SETUP_PORT, source: 'probe' };
  const name = str(root['name']);
  if (name) c.name = name;
  const deviceInfo = (typeof root['device_info'] === 'object' && root['device_info'] !== null ? root['device_info'] : {}) as Record<string, unknown>;
  const model = str(deviceInfo['model_name']) ?? str(root['model_name']);
  if (model) c.model = model;
  const udn = str(root['ssdp_udn']);
  if (udn) c.usn = udn;
  c.location = `http://${host}:${CAST_SETUP_PORT}/setup/eureka_info`;
  return c;
}

/** LG webOS answers a plain HTTP GET on its SSAP port with "Hello world". */
export function parseWebosHello(body: string, host: string): TvCandidate | null {
  if (!/hello world/i.test(body)) return null;
  return { platform: 'webos', host, port: WEBOS_PROBE_PORT, source: 'probe', location: `http://${host}:${WEBOS_PROBE_PORT}/` };
}

function safeDecodeHtml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

async function tryGet(fetch: FetchLike, url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'GET', timeoutMs });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function tryPostJson(fetch: FetchLike, url: string, body: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, timeoutMs });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const SONY_INTERFACE_INFO = JSON.stringify({ method: 'getInterfaceInformation', id: 33, params: [], version: '1.0' });

/**
 * Probes one host over plain HTTP for the TVs that answer without multicast: Roku ECP, Samsung API v2,
 * Sony Bravia REST, Google TV / Chromecast built-in setup info and LG webOS (owner TestFlight feedback
 * 1 Nov 2026: store builds have no SSDP / mDNS yet, so before this only Roku and Samsung could be found).
 * All run in parallel; the first match in that order wins.
 */
export async function probeHost(
  fetch: FetchLike,
  host: string,
  opts: { timeoutMs?: number } = {},
): Promise<TvCandidate | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const [roku, samsung, sony, cast, webos] = await Promise.all([
    tryGet(fetch, `http://${host}:${ROKU_ECP_PORT}/query/device-info`, timeoutMs),
    tryGet(fetch, `http://${host}:${SAMSUNG_API_PORT}/api/v2/`, timeoutMs),
    tryPostJson(fetch, `http://${host}/sony/system`, SONY_INTERFACE_INFO, timeoutMs),
    tryGet(fetch, `http://${host}:${CAST_SETUP_PORT}/setup/eureka_info`, timeoutMs),
    tryGet(fetch, `http://${host}:${WEBOS_PROBE_PORT}/`, timeoutMs),
  ]);
  return (
    (roku !== null ? parseRokuDeviceInfo(roku, host) : null) ??
    (samsung !== null ? parseSamsungApiV2(samsung, host) : null) ??
    (sony !== null ? parseSonyInterfaceInfo(sony, host) : null) ??
    (cast !== null ? parseCastEurekaInfo(cast, host) : null) ??
    (webos !== null ? parseWebosHello(webos, host) : null)
  );
}

export interface ProbeSubnetOptions {
  concurrency?: number;
  timeoutMs?: number;
  onFound?: (c: TvCandidate) => void;
  /** Checked between hosts; return true to stop early (sheet closed). */
  isCancelled?: () => boolean;
}

/** Probes hosts with a bounded worker pool. Results are returned in input order. */
export async function probeSubnet(
  fetch: FetchLike,
  hosts: readonly string[],
  opts: ProbeSubnetOptions = {},
): Promise<TvCandidate[]> {
  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? 24));
  const results: (TvCandidate | null)[] = new Array<TvCandidate | null>(hosts.length).fill(null);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < hosts.length) {
      if (opts.isCancelled?.()) return;
      const i = next++;
      const host = hosts[i];
      if (host === undefined) continue;
      const opt: { timeoutMs?: number } = {};
      if (opts.timeoutMs !== undefined) opt.timeoutMs = opts.timeoutMs;
      const c = await probeHost(fetch, host, opt);
      if (c) {
        results[i] = c;
        opts.onFound?.(c);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, hosts.length) }, worker));
  return results.filter((c): c is TvCandidate => c !== null);
}
