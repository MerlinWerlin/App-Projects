/**
 * Minimal DER / X.509 helpers for the Android TV Remote v2 client identity (pure TS, no Buffer).
 *
 * The phone's RSA-2048 key pair lives in the iOS Keychain (modules/lan-wss, LanAtv.swift); the
 * private key never leaves it. To get a certificate for that key the JS side builds the
 * TBSCertificate here (self-signed X.509 v3, CN "Couch"), native signs those bytes with the key
 * (RSA PKCS#1 v1.5 + SHA-256), and assembleCertificate() wraps tbs + signature into the final DER,
 * which native stores next to the key so the Keychain can form a SecIdentity for mutual TLS.
 *
 * Also parses RSA public keys (PKCS#1 RSAPublicKey, or SubjectPublicKeyInfo) and the public key
 * inside a certificate, for the pairing hash (pairing.ts).
 */
import { concatBytes, toBase64, utf8 } from '../../crypto/bytes';
import type { RsaPublicKey } from './pairing';

// ---------------------------------------------------------------- DER encoding

export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

function derLength(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  let v = n;
  while (v > 0) {
    bytes.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return Uint8Array.from([0x80 | bytes.length, ...bytes]);
}

/** One TLV. */
export function der(tag: number, ...content: Uint8Array[]): Uint8Array {
  const body = concatBytes(...content);
  return concatBytes(Uint8Array.of(tag), derLength(body.length), body);
}

export const seq = (...items: Uint8Array[]): Uint8Array => der(TAG.SEQUENCE, ...items);

/** Unsigned big-endian integer as a DER INTEGER (leading zeros stripped, sign byte added). */
export function derUnsignedInteger(b: Uint8Array): Uint8Array {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  let v: Uint8Array = b.length === 0 ? Uint8Array.of(0) : b.slice(i);
  if ((v[0] ?? 0) & 0x80) v = concatBytes(Uint8Array.of(0), v);
  return der(TAG.INTEGER, v);
}

/** Dotted OID ("1.2.840.113549.1.1.11") as a DER OBJECT IDENTIFIER. */
export function derOid(dotted: string): Uint8Array {
  const parts = dotted.split('.').map((p) => Number(p));
  if (parts.length < 2 || parts.some((p) => !Number.isInteger(p) || p < 0)) throw new Error(`bad OID ${dotted}`);
  const out: number[] = [parts[0]! * 40 + parts[1]!];
  for (const p of parts.slice(2)) {
    const chunk: number[] = [p & 0x7f];
    let v = Math.floor(p / 128);
    while (v > 0) {
      chunk.unshift(0x80 | (v & 0x7f));
      v = Math.floor(v / 128);
    }
    out.push(...chunk);
  }
  return der(TAG.OID, Uint8Array.from(out));
}

const derNull = (): Uint8Array => Uint8Array.of(TAG.NULL, 0);
const bitString = (b: Uint8Array, unusedBits = 0): Uint8Array => der(TAG.BIT_STRING, Uint8Array.of(unusedBits), b);

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** RFC 5280: UTCTime for 1950-2049, GeneralizedTime otherwise; always UTC with seconds and "Z". */
export function derTime(d: Date): Uint8Array {
  const y = d.getUTCFullYear();
  const rest = `${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
  if (y >= 1950 && y < 2050) return der(TAG.UTC_TIME, utf8(`${pad2(y % 100)}${rest}`));
  return der(TAG.GENERALIZED_TIME, utf8(`${String(y).padStart(4, '0')}${rest}`));
}

// ---------------------------------------------------------------- DER decoding

export interface DerNode {
  tag: number;
  /** Offset of the tag byte in the input. */
  start: number;
  /** Offset of the content. */
  contentStart: number;
  /** Offset just past the content. */
  end: number;
}

/** Reads one TLV at `at`. Throws on truncated or unsupported (indefinite / >4-byte) lengths. */
export function readDer(b: Uint8Array, at = 0): DerNode {
  if (at + 2 > b.length) throw new Error('DER: truncated');
  const tag = b[at]!;
  let len = b[at + 1]!;
  let p = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error('DER: unsupported length');
    if (p + n > b.length) throw new Error('DER: truncated');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + b[p + i]!;
    p += n;
  }
  if (p + len > b.length) throw new Error('DER: truncated');
  return { tag, start: at, contentStart: p, end: p + len };
}

/** The direct children of a constructed node. */
export function derChildren(b: Uint8Array, node: DerNode): DerNode[] {
  const out: DerNode[] = [];
  let p = node.contentStart;
  while (p < node.end) {
    const c = readDer(b, p);
    if (c.end > node.end) throw new Error('DER: child overruns parent');
    out.push(c);
    p = c.end;
  }
  return out;
}

const content = (b: Uint8Array, n: DerNode): Uint8Array => b.slice(n.contentStart, n.end);

function expectTag(n: DerNode | undefined, tag: number, what: string): DerNode {
  if (!n || n.tag !== tag) throw new Error(`DER: expected ${what}`);
  return n;
}

const RSA_ENCRYPTION_OID = derOid('1.2.840.113549.1.1.1');
const SHA256_WITH_RSA_OID = derOid('1.2.840.113549.1.1.11');

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * RSA public key from DER: either PKCS#1 RSAPublicKey (SEQUENCE { n, e }), which is what
 * SecKeyCopyExternalRepresentation returns on iOS, or SubjectPublicKeyInfo. The integers are
 * returned as their raw big-endian content bytes (a DER sign byte may lead; pairing.ts strips it).
 */
export function parseRsaPublicKey(b: Uint8Array): RsaPublicKey {
  const top = expectTag(readDer(b, 0), TAG.SEQUENCE, 'SEQUENCE');
  const kids = derChildren(b, top);
  if (kids[0]?.tag === TAG.SEQUENCE && kids[1]?.tag === TAG.BIT_STRING) {
    // SubjectPublicKeyInfo { AlgorithmIdentifier, BIT STRING (0x00 || RSAPublicKey) }
    const alg = derChildren(b, kids[0]);
    if (!alg[0] || alg[0].tag !== TAG.OID || !sameBytes(b.slice(alg[0].start, alg[0].end), RSA_ENCRYPTION_OID)) {
      throw new Error('DER: not an RSA key');
    }
    const bits = content(b, kids[1]);
    if (bits[0] !== 0) throw new Error('DER: unexpected unused bits');
    return parseRsaPublicKey(bits.slice(1));
  }
  const n = expectTag(kids[0], TAG.INTEGER, 'modulus');
  const e = expectTag(kids[1], TAG.INTEGER, 'exponent');
  return { modulus: content(b, n), exponent: content(b, e) };
}

/** PKCS#1 RSAPublicKey DER for a key. */
export function encodeRsaPublicKey(k: RsaPublicKey): Uint8Array {
  return seq(derUnsignedInteger(k.modulus), derUnsignedInteger(k.exponent));
}

/** The SubjectPublicKeyInfo DER for a PKCS#1 RSAPublicKey. */
export function rsaSpki(pkcs1: Uint8Array): Uint8Array {
  return seq(seq(RSA_ENCRYPTION_OID, derNull()), bitString(pkcs1));
}

/** The RSA public key inside an X.509 certificate (DER). */
export function certificatePublicKey(cert: Uint8Array): RsaPublicKey {
  const top = expectTag(readDer(cert, 0), TAG.SEQUENCE, 'Certificate');
  const tbs = expectTag(derChildren(cert, top)[0], TAG.SEQUENCE, 'TBSCertificate');
  const f = derChildren(cert, tbs);
  // [0] version is optional; then serial, signature, issuer, validity, subject, spki
  const i = f[0]?.tag === 0xa0 ? 1 : 0;
  const spki = expectTag(f[i + 5], TAG.SEQUENCE, 'SubjectPublicKeyInfo');
  return parseRsaPublicKey(cert.slice(spki.start, spki.end));
}

/** True when two RSA keys are the same number pair (leading zero bytes ignored). */
export function sameRsaKey(a: RsaPublicKey, b: RsaPublicKey): boolean {
  const strip = (x: Uint8Array): Uint8Array => {
    let i = 0;
    while (i < x.length - 1 && x[i] === 0) i++;
    return x.slice(i);
  };
  return sameBytes(strip(a.modulus), strip(b.modulus)) && sameBytes(strip(a.exponent), strip(b.exponent));
}

// ---------------------------------------------------------------- certificate

export const CLIENT_CERT_COMMON_NAME = 'Couch';
/** Validity of the client certificate: the TV pins it after pairing, so it must outlive the app. */
export const CLIENT_CERT_YEARS = 25;

export interface TbsOptions {
  /** PKCS#1 RSAPublicKey DER of the key the certificate is for. */
  publicKeyPkcs1: Uint8Array;
  /** Positive serial number bytes (big-endian); 8-20 random bytes recommended. */
  serial: Uint8Array;
  notBefore: Date;
  notAfter: Date;
  commonName?: string;
}

function name(cn: string): Uint8Array {
  return seq(der(TAG.SET, seq(derOid('2.5.4.3'), der(TAG.UTF8_STRING, utf8(cn)))));
}

function extension(oid: string, critical: boolean, value: Uint8Array): Uint8Array {
  return critical
    ? seq(derOid(oid), der(TAG.BOOLEAN, Uint8Array.of(0xff)), der(TAG.OCTET_STRING, value))
    : seq(derOid(oid), der(TAG.OCTET_STRING, value));
}

/**
 * TBSCertificate of a self-signed X.509 v3 certificate (issuer = subject = CN), signed with
 * sha256WithRSAEncryption. Extensions: basicConstraints CA:FALSE (critical), keyUsage
 * digitalSignature + keyEncipherment (critical), extKeyUsage clientAuth + serverAuth.
 */
export function buildTbsCertificate(o: TbsOptions): Uint8Array {
  const cn = o.commonName ?? CLIENT_CERT_COMMON_NAME;
  // Serial must be positive and non-zero: force the top bit off and at least one bit on.
  const serial = o.serial.length > 0 ? o.serial.slice(0, 20) : Uint8Array.of(1);
  serial[0] = (serial[0]! & 0x7f) | 0x01;
  const algId = seq(SHA256_WITH_RSA_OID, derNull());
  const exts = seq(
    extension('2.5.29.19', true, seq()),
    // BIT STRING, 5 unused bits: digitalSignature (bit 0) + keyEncipherment (bit 2) = 1010 0000
    extension('2.5.29.15', true, bitString(Uint8Array.of(0xa0), 5)),
    extension('2.5.29.37', false, seq(derOid('1.3.6.1.5.5.7.3.2'), derOid('1.3.6.1.5.5.7.3.1'))),
  );
  return seq(
    der(0xa0, der(TAG.INTEGER, Uint8Array.of(2))), // [0] EXPLICIT version v3
    der(TAG.INTEGER, serial),
    algId,
    name(cn),
    seq(derTime(o.notBefore), derTime(o.notAfter)),
    name(cn),
    rsaSpki(o.publicKeyPkcs1),
    der(0xa3, exts), // [3] EXPLICIT extensions
  );
}

/** Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue BIT STRING }. */
export function assembleCertificate(tbs: Uint8Array, signature: Uint8Array): Uint8Array {
  return seq(tbs, seq(SHA256_WITH_RSA_OID, derNull()), bitString(signature));
}

/** Validity window for a new client certificate: from yesterday (clock skew) for CLIENT_CERT_YEARS. */
export function clientCertValidity(now: Date): { notBefore: Date; notAfter: Date } {
  const notBefore = new Date(now.getTime() - 24 * 3600 * 1000);
  const notAfter = new Date(now.getTime());
  notAfter.setUTCFullYear(notAfter.getUTCFullYear() + CLIENT_CERT_YEARS);
  return { notBefore, notAfter };
}

/** PEM armour ("-----BEGIN CERTIFICATE-----", 64-character lines). */
export function toPem(derBytes: Uint8Array, label = 'CERTIFICATE'): string {
  const b64 = toBase64(derBytes);
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}
