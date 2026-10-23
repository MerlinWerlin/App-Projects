/**
 * HTTP Digest access authentication (RFC 2617 / RFC 7616, MD5 only), client side.
 * Minimal: algorithm MD5 (or MD5-sess) and qop "auth" or none; no auth-int, no SHA-256.
 */
import { md5Hex } from './md5';

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

/** Parse a `WWW-Authenticate: Digest ...` header value. Returns null when it is not a Digest challenge. */
export function parseDigestChallenge(header: string | null | undefined): DigestChallenge | null {
  if (!header) return null;
  const m = /Digest\s+(.*)$/i.exec(header);
  if (!m || m[1] === undefined) return null;
  const params: Record<string, string> = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]*))/g;
  let p: RegExpExecArray | null;
  while ((p = re.exec(m[1])) !== null) {
    params[(p[1] ?? '').toLowerCase()] = p[2] !== undefined ? p[2].replace(/\\(.)/g, '$1') : (p[3] ?? '');
  }
  if (params.nonce === undefined) return null;
  return {
    realm: params.realm ?? '',
    nonce: params.nonce,
    qop: params.qop,
    opaque: params.opaque,
    algorithm: params.algorithm,
  };
}

export interface DigestInput {
  username: string;
  password: string;
  method: string;
  /** Request-URI as sent (path + query). */
  uri: string;
  challenge: DigestChallenge;
  /** Nonce count, 1-based. */
  nc: number;
  cnonce: string;
}

/** Build the `Authorization` header value. */
export function digestAuthorization(i: DigestInput): string {
  const { challenge: c } = i;
  const qops = (c.qop ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const qop = qops.length === 0 ? undefined : qops.includes('auth') ? 'auth' : undefined;
  if (qops.length > 0 && !qop) throw new Error(`Unsupported digest qop: ${c.qop}`);
  const alg = (c.algorithm ?? 'MD5').toUpperCase();
  if (alg !== 'MD5' && alg !== 'MD5-SESS') throw new Error(`Unsupported digest algorithm: ${c.algorithm}`);
  const nc = i.nc.toString(16).padStart(8, '0');
  let ha1 = md5Hex(`${i.username}:${c.realm}:${i.password}`);
  if (alg === 'MD5-SESS') ha1 = md5Hex(`${ha1}:${c.nonce}:${i.cnonce}`);
  const ha2 = md5Hex(`${i.method.toUpperCase()}:${i.uri}`);
  const response = qop
    ? md5Hex(`${ha1}:${c.nonce}:${nc}:${i.cnonce}:${qop}:${ha2}`)
    : md5Hex(`${ha1}:${c.nonce}:${ha2}`);
  const parts = [
    `username="${i.username}"`,
    `realm="${c.realm}"`,
    `nonce="${c.nonce}"`,
    `uri="${i.uri}"`,
  ];
  if (c.algorithm) parts.push(`algorithm=${c.algorithm}`);
  parts.push(`response="${response}"`);
  if (c.opaque !== undefined) parts.push(`opaque="${c.opaque}"`);
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${i.cnonce}"`);
  return `Digest ${parts.join(', ')}`;
}
