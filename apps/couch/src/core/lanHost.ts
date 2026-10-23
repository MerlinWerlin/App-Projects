/**
 * Shared "is this a private LAN host" rule. The native lan-wss module (modules/lan-wss) applies the
 * same rule in Swift and Kotlin before it accepts a self-signed TLS certificate; keep them in sync.
 *
 * Only literal dotted-quad IPv4 addresses in RFC 1918 ranges qualify:
 *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
 * Hostnames (even ".local"), IPv6, loopback, link-local and anything with leading zeros or extra
 * characters are rejected: a hostname can resolve anywhere, so it never earns the relaxed TLS rule.
 */

/** Parses a strict dotted-quad IPv4 address (no leading zeros, 0-255 per octet). */
export function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out.push(n);
  }
  return [out[0]!, out[1]!, out[2]!, out[3]!];
}

/** True only for a literal RFC 1918 IPv4 address. */
export function isRfc1918Host(host: string): boolean {
  const ip = parseIpv4(host);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Host part of a ws:// / wss:// / http(s):// URL, or null. IPv4 only (no brackets / userinfo). */
export function urlHost(url: string): string | null {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(url);
  return m?.[1] ?? null;
}

/** True when the URL's host is a literal RFC 1918 IPv4 address. */
export function isRfc1918Url(url: string): boolean {
  const h = urlHost(url);
  return h !== null && isRfc1918Host(h);
}
