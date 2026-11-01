import { X509Certificate, generateKeyPairSync, sign } from 'node:crypto';
import { fromBase64 } from '../../crypto/bytes';
import { pairingHash } from './pairing';
import {
  assembleCertificate,
  buildTbsCertificate,
  certificatePublicKey,
  clientCertValidity,
  derOid,
  derTime,
  derUnsignedInteger,
  encodeRsaPublicKey,
  parseRsaPublicKey,
  readDer,
  rsaSpki,
  sameRsaKey,
  toPem,
} from './x509';

const hex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('DER primitives', () => {
  it('encodes OIDs', () => {
    expect(hex(derOid('1.2.840.113549.1.1.11'))).toBe('06092a864886f70d01010b');
    expect(hex(derOid('2.5.4.3'))).toBe('0603550403');
  });

  it('encodes unsigned integers with a sign byte only when needed', () => {
    expect(hex(derUnsignedInteger(Uint8Array.of(0x01, 0x00, 0x01)))).toBe('0203010001');
    expect(hex(derUnsignedInteger(Uint8Array.of(0x00, 0x00, 0x80)))).toBe('02020080');
    expect(hex(derUnsignedInteger(Uint8Array.of()))).toBe('020100');
  });

  it('uses UTCTime before 2050 and GeneralizedTime from 2050', () => {
    expect(new TextDecoder().decode(derTime(new Date(Date.UTC(2026, 10, 1, 9, 5, 7))).slice(2))).toBe('261101090507Z');
    const g = derTime(new Date(Date.UTC(2051, 0, 2, 3, 4, 5)));
    expect(g[0]).toBe(0x18);
    expect(new TextDecoder().decode(g.slice(2))).toBe('20510102030405Z');
  });

  it('rejects truncated input', () => {
    expect(() => readDer(Uint8Array.of(0x30, 0x05, 0x01))).toThrow();
    expect(() => parseRsaPublicKey(Uint8Array.of(0x30))).toThrow();
  });
});

describe('client certificate (built in TS, signed by the key)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 65537 });
  const pkcs1 = new Uint8Array(publicKey.export({ type: 'pkcs1', format: 'der' }));
  const now = new Date(Date.UTC(2026, 10, 1, 12, 0, 0));
  const { notBefore, notAfter } = clientCertValidity(now);
  const tbs = buildTbsCertificate({ publicKeyPkcs1: pkcs1, serial: Uint8Array.from([0xff, 1, 2, 3, 4, 5, 6, 7]), notBefore, notAfter });
  const signature = new Uint8Array(sign('sha256', tbs, privateKey));
  const cert = assembleCertificate(tbs, signature);

  it('parses as a self-signed X.509 v3 certificate for CN=Couch that verifies with the key', () => {
    const x = new X509Certificate(Buffer.from(cert));
    expect(x.subject).toBe('CN=Couch');
    expect(x.issuer).toBe('CN=Couch');
    expect(x.verify(publicKey)).toBe(true);
    expect(x.ca).toBe(false);
    expect(x.keyUsage).toEqual(expect.arrayContaining(['1.3.6.1.5.5.7.3.2']));
    expect(new Date(x.validFrom).getTime()).toBe(notBefore.getTime());
    expect(new Date(x.validTo).getUTCFullYear()).toBe(2051);
    // positive serial (top bit cleared)
    expect(parseInt(x.serialNumber.slice(0, 2), 16)).toBeLessThan(0x80);
  });

  it('PEM round-trips', () => {
    const pem = toPem(cert);
    expect(pem.startsWith('-----BEGIN CERTIFICATE-----\n')).toBe(true);
    expect(pem.split('\n').every((l) => l.length <= 64)).toBe(true);
    expect(new X509Certificate(pem).subject).toBe('CN=Couch');
  });

  it('reads the public key back from the certificate, PKCS#1 and SPKI', () => {
    const fromCert = certificatePublicKey(cert);
    const fromPkcs1 = parseRsaPublicKey(pkcs1);
    const fromSpki = parseRsaPublicKey(new Uint8Array(publicKey.export({ type: 'spki', format: 'der' })));
    expect(sameRsaKey(fromCert, fromPkcs1)).toBe(true);
    expect(sameRsaKey(fromSpki, fromPkcs1)).toBe(true);
    const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string };
    const b64u = (s: string) => fromBase64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    expect(sameRsaKey(fromPkcs1, { modulus: b64u(jwk.n), exponent: b64u(jwk.e) })).toBe(true);
    // re-encoding gives the exact PKCS#1 bytes, and the SPKI matches node's
    expect(hex(encodeRsaPublicKey(fromPkcs1))).toBe(hex(pkcs1));
    expect(hex(rsaSpki(pkcs1))).toBe(hex(new Uint8Array(publicKey.export({ type: 'spki', format: 'der' }))));
  });

  it('feeds the pairing hash the same numbers as the raw key (sign byte stripped)', () => {
    const k = parseRsaPublicKey(pkcs1);
    expect(k.modulus[0]).toBe(0); // DER sign byte present in the content...
    const a = pairingHash(k, k, 'AB12CD');
    const b = pairingHash({ modulus: k.modulus.slice(1), exponent: k.exponent }, k, 'AB12CD');
    expect(hex(a)).toBe(hex(b)); // ...and ignored by the hash
  });

  it('a different key does not match', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
    const k2 = parseRsaPublicKey(new Uint8Array(other.export({ type: 'pkcs1', format: 'der' })));
    expect(sameRsaKey(certificatePublicKey(cert), k2)).toBe(false);
  });
});
