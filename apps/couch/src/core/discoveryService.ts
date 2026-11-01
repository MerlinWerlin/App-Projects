/**
 * Discovery orchestrator: SSDP over an injected UDP socket + mDNS browse, falling back to a unicast
 * subnet probe when multicast is unavailable or silent. All transports injected; tested with fakes.
 */
import type { FetchLike, UdpLike } from './driver';
import type { MdnsRecord, TvCandidate } from './discovery';
import {
  MDNS_BROWSE_TYPES,
  SEARCH_TARGETS,
  SSDP_ADDRESS,
  SSDP_PORT,
  buildMSearch,
  dedupeCandidates,
  mdnsToCandidate,
  parseSsdpResponse,
} from './discovery';
import { resolvePhoneIp, type PhoneIpProvider } from './autoProbe';
import { probeSubnet, subnetHosts, type TlsPortCheck } from './probe';

/** mDNS browser adapter. `browse` returns a stop function. */
export interface MdnsLike {
  browse(types: readonly string[], onService: (rec: MdnsRecord) => void): () => void;
}

export interface DiscoveryDeps {
  /** Returns a socket factory, or null when no UDP module is available (Expo Go). */
  udp?: (() => Promise<UdpLike> | null) | null;
  fetch: FetchLike;
  mdns?: MdnsLike | null;
  /** Phone's Wi-Fi IPv4 + mask, for the subnet probe fallback. */
  localIp?: string;
  netmask?: string;
  /**
   * Phone Wi-Fi IP provider (expo-network via src/native/network.ts). Used when `localIp` is not given;
   * the address is assumed to be on a /24. When it yields an IP the subnet probe runs automatically on
   * every scan (see DiscoveryOptions.alwaysProbe), de-duplicated against SSDP / mDNS results.
   */
  phoneIp?: PhoneIpProvider | null;
  /** Google Cast TLS port check for the subnet probe (native builds with the lan-wss TLS socket). */
  tlsCheck?: TlsPortCheck | null;
  /** Injected timer for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface DiscoveryOptions {
  /** How long to listen for SSDP / mDNS replies. */
  windowMs?: number;
  mx?: number;
  /** Probe the subnet when multicast found nothing (e.g. iOS without the multicast entitlement). Default true. */
  probeIfEmpty?: boolean;
  /**
   * Probe the subnet even when multicast found TVs (hosts already found are skipped). Default: true when
   * the IP came from deps.phoneIp (the automatic scan), false when deps.localIp was passed explicitly.
   */
  alwaysProbe?: boolean;
  probeConcurrency?: number;
  probeTimeoutMs?: number;
  onFound?: (c: TvCandidate) => void;
  isCancelled?: () => boolean;
}

export type DiscoveryMethod = 'ssdp' | 'mdns' | 'probe';

export interface DiscoveryResult {
  candidates: TvCandidate[];
  methods: DiscoveryMethod[];
  /** Non-fatal problems (socket failed, etc.) for diagnostics. */
  errors: string[];
  /** For the Add TV scan report: the phone address used, how many hosts were probed, and whether the Cast TLS check ran. */
  localIp?: string | null;
  probed?: number;
  tlsCheck?: boolean;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Datagram bytes as a Latin-1 string (SSDP headers are ASCII). Shared with src/core/cast/ssdp.ts. */
export function decodeAscii(data: Uint8Array): string {
  let s = '';
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i] ?? 0);
  return s;
}

/** ASCII string as datagram bytes. Shared with src/core/cast/ssdp.ts. */
export function encodeAscii(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export async function discoverTvs(deps: DiscoveryDeps, opts: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const windowMs = opts.windowMs ?? 3000;
  const found: TvCandidate[] = [];
  const seen = new Set<string>();
  const methods: DiscoveryMethod[] = [];
  const errors: string[] = [];
  // Ask for the phone's IP up front so it resolves while SSDP / mDNS listen. Never rejects.
  const phoneIpPending: Promise<string | null> = deps.localIp ? Promise.resolve(null) : resolvePhoneIp(deps.phoneIp);

  const add =(c: TvCandidate | null): void => {
    if (!c) return;
    found.push(c);
    if (!seen.has(c.host)) {
      seen.add(c.host);
      opts.onFound?.(c);
    }
  };

  // mDNS (independent of UDP availability).
  let stopMdns: (() => void) | null = null;
  if (deps.mdns) {
    try {
      stopMdns = deps.mdns.browse(MDNS_BROWSE_TYPES, (rec) => add(mdnsToCandidate(rec)));
      methods.push('mdns');
    } catch (e) {
      errors.push(`mdns: ${String(e)}`);
    }
  }

  // SSDP.
  let socket: UdpLike | null = null;
  try {
    const open = deps.udp ? deps.udp() : null;
    socket = open ? await open : null;
  } catch (e) {
    errors.push(`udp: ${String(e)}`);
    socket = null;
  }
  if (socket && !socket.onMessage) {
    errors.push('udp: socket cannot receive');
    socket.close();
    socket = null;
  }

  if (socket) {
    methods.push('ssdp');
    socket.onMessage?.((data, from) => add(parseSsdpResponse(decodeAscii(data), from.address)));
    const sendAll = async (): Promise<void> => {
      for (const st of Object.values(SEARCH_TARGETS)) {
        try {
          await socket?.send(encodeAscii(buildMSearch(st, opts.mx ?? 2)), SSDP_PORT, SSDP_ADDRESS);
        } catch (e) {
          errors.push(`ssdp send ${st}: ${String(e)}`);
        }
      }
    };
    // UDP is lossy: send twice, half a window apart.
    await sendAll();
    await sleep(Math.floor(windowMs / 2));
    if (!opts.isCancelled?.()) await sendAll();
    await sleep(windowMs - Math.floor(windowMs / 2));
    socket.close();
  } else if (deps.mdns) {
    await sleep(windowMs);
  }
  stopMdns?.();

  const phoneIp = await phoneIpPending;
  const localIp = deps.localIp ?? phoneIp ?? undefined;
  const netmask = deps.localIp ? (deps.netmask ?? '255.255.255.0') : '255.255.255.0';
  const alwaysProbe = opts.alwaysProbe ?? (!deps.localIp && phoneIp !== null);
  const needProbe = alwaysProbe || !socket || (found.length === 0 && opts.probeIfEmpty !== false);
  let probed = 0;
  if (needProbe && localIp && !opts.isCancelled?.()) {
    const hosts = subnetHosts(localIp, netmask).filter((h) => !seen.has(h));
    probed = hosts.length;
    if (hosts.length > 0) {
      methods.push('probe');
      const probeOpts: Parameters<typeof probeSubnet>[2] = { onFound: (c) => add(c) };
      if (opts.probeConcurrency !== undefined) probeOpts.concurrency = opts.probeConcurrency;
      if (opts.probeTimeoutMs !== undefined) probeOpts.timeoutMs = opts.probeTimeoutMs;
      if (opts.isCancelled) probeOpts.isCancelled = opts.isCancelled;
      if (deps.tlsCheck) probeOpts.tlsCheck = deps.tlsCheck;
      await probeSubnet(deps.fetch, hosts, probeOpts);
    }
  }

  return { candidates: dedupeCandidates(found), methods, errors, localIp: localIp ?? null, probed, tlsCheck: !!deps.tlsCheck };
}
