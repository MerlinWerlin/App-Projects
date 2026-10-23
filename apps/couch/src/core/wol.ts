/**
 * Wake-on-LAN: builds the standard "magic packet" (6 x 0xFF followed by the target MAC 16 times)
 * and sends it as a UDP broadcast over an injected socket. Packet bytes are unit-tested; whether a
 * given TV wakes depends on its own settings (tested against fakes, not hardware).
 */
import { t } from '../i18n/core';
import type { UdpLike } from './driver';
import { isRfc1918Host } from './lanHost';

export const WOL_PACKET_LENGTH = 102;
export const WOL_DEFAULT_PORT = 9;
export const WOL_DEFAULT_BROADCAST = '255.255.255.255';

/** Parses "AA:BB:CC:DD:EE:FF", "aa-bb-cc-dd-ee-ff" or "aabbccddeeff" into 6 bytes; null if invalid. */
export function parseMac(input: string): Uint8Array | null {
  const s = input.trim();
  let hex: string;
  if (/^[0-9a-fA-F]{2}([:-])[0-9a-fA-F]{2}(\1[0-9a-fA-F]{2}){4}$/.test(s)) hex = s.replace(/[:-]/g, '');
  else if (/^[0-9a-fA-F]{12}$/.test(s)) hex = s;
  else return null;
  const out = new Uint8Array(6);
  for (let i = 0; i < 6; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Normalised "aa:bb:cc:dd:ee:ff" form, or null if invalid. */
export function formatMac(input: string): string | null {
  const b = parseMac(input);
  if (!b) return null;
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(':');
}

/** 102-byte magic packet for `mac`. Throws on an invalid MAC. */
export function buildMagicPacket(mac: string): Uint8Array {
  const bytes = parseMac(mac);
  if (!bytes) throw new Error(`Invalid MAC address: ${mac}`);
  const pkt = new Uint8Array(WOL_PACKET_LENGTH);
  pkt.fill(0xff, 0, 6);
  for (let i = 0; i < 16; i++) pkt.set(bytes, 6 + i * 6);
  return pkt;
}

export interface WolOptions {
  broadcast?: string;
  port?: number;
}

/** Sends the magic packet once over a fresh socket from `udpFactory`, then closes it. */
export async function sendWol(udpFactory: () => Promise<UdpLike>, mac: string, opts: WolOptions = {}): Promise<void> {
  const pkt = buildMagicPacket(mac);
  const socket = await udpFactory();
  try {
    await socket.send(pkt, opts.port ?? WOL_DEFAULT_PORT, opts.broadcast ?? WOL_DEFAULT_BROADCAST);
  } finally {
    socket.close();
  }
}

/**
 * Directed broadcast for the phone's /24 ("192.168.1.40" -> "192.168.1.255"). Falls back to the
 * limited broadcast 255.255.255.255 when the phone IP is unknown or not a private LAN address.
 */
export function broadcastFor(phoneIp: string | null | undefined): string {
  if (!phoneIp || !isRfc1918Host(phoneIp)) return WOL_DEFAULT_BROADCAST;
  const p = phoneIp.split('.');
  return `${p[0]}.${p[1]}.${p[2]}.255`;
}

/** Wake is offered for a saved network TV with a valid MAC, when a UDP sender is available. */
export function canWake(tv: { mac?: string; platform?: string }, hasUdpSender: boolean): boolean {
  if (!hasUdpSender) return false;
  if (tv.platform === 'ir') return false;
  return typeof tv.mac === 'string' && parseMac(tv.mac) !== null;
}

/** Where the Wake button sends the magic packet: the /24 directed broadcast, then 255.255.255.255. */
export function wakeTargets(phoneIp: string | null | undefined): string[] {
  const directed = broadcastFor(phoneIp);
  return directed === WOL_DEFAULT_BROADCAST ? [WOL_DEFAULT_BROADCAST] : [directed, WOL_DEFAULT_BROADCAST];
}

export type WakeResult = { ok: boolean; note: string };

/**
 * The Wake button's action. Sends the magic packet to every wakeTargets() address (a socket each) and
 * succeeds if at least one send went out. Never throws: problems come back as a short note.
 */
export async function wakeTv(
  udpFactory: (() => Promise<UdpLike>) | null | undefined,
  mac: string | undefined,
  opts: { phoneIp?: string | null; port?: number } = {},
): Promise<WakeResult> {
  if (!udpFactory) return { ok: false, note: t('core.wol.needsApp') };
  if (!mac || parseMac(mac) === null) return { ok: false, note: t('core.wol.noMac') };
  let sent = 0;
  for (const broadcast of wakeTargets(opts.phoneIp)) {
    try {
      const o: WolOptions = { broadcast };
      if (opts.port !== undefined) o.port = opts.port;
      await sendWol(udpFactory, mac, o);
      sent++;
    } catch {
      // try the next address
    }
  }
  return sent > 0
    ? { ok: true, note: t('core.wol.sent') }
    : { ok: false, note: t('core.wol.failed') };
}
