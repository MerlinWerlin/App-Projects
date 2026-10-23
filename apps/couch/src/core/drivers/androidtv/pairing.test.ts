import { createHash } from 'crypto';
import { DriverError } from '../../types';
import { isCodeValid, normalizeBigEndian, normalizeCode, pairingHash, pairingSecret, sha256, type RsaPublicKey } from './pairing';
import { fromHex, toHex } from './proto';

const nodeSha = (...parts: Uint8Array[]): string => {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
};

describe('sha256 (pure TS)', () => {
  test('FIPS 180 vectors', () => {
    expect(toHex(sha256(new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(toHex(sha256(new Uint8Array(0)))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(toHex(sha256(new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });
  test('matches node:crypto across block boundaries and split inputs', () => {
    for (const n of [1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      const b = new Uint8Array(n).map((_, i) => (i * 31 + n) & 0xff);
      expect(toHex(sha256(b))).toBe(nodeSha(b));
      expect(toHex(sha256(b.subarray(0, 3), b.subarray(3)))).toBe(nodeSha(b));
    }
  });
});

describe('normalisation', () => {
  test('strips leading zero bytes, keeps at least one', () => {
    expect(toHex(normalizeBigEndian(fromHex('00010001')))).toBe('010001');
    expect(toHex(normalizeBigEndian(fromHex('00c0ffee')))).toBe('c0ffee');
    expect(toHex(normalizeBigEndian(fromHex('0000')))).toBe('00');
    expect(toHex(normalizeBigEndian(new Uint8Array(0)))).toBe('00');
  });
  test('code', () => {
    expect(normalizeCode(' a1b2c3 ')).toBe('A1B2C3');
    expect(normalizeCode('A1B2C')).toBeNull();
    expect(normalizeCode('A1B2CG')).toBeNull();
  });
});

// Deterministic fake 2048-bit keys: the server modulus carries a DER-style 0x00 sign byte that must
// be dropped; the client modulus does not.
const clientMod = new Uint8Array(256).map((_, i) => (i === 0 ? 0xc3 : (i * 7 + 1) & 0xff));
const serverModRaw = new Uint8Array(257).map((_, i) => (i === 0 ? 0x00 : i === 1 ? 0xb5 : (i * 13 + 5) & 0xff));
const client: RsaPublicKey = { modulus: clientMod, exponent: fromHex('010001') };
const server: RsaPublicKey = { modulus: serverModRaw, exponent: fromHex('00000003') };

function expectedHash(codeTail: string): string {
  return nodeSha(clientMod, fromHex('010001'), serverModRaw.subarray(1), fromHex('03'), fromHex(codeTail));
}

describe('pairing secret', () => {
  test('hash = SHA-256(client n, client e, server n, server e, code[2..6]) with normalised numbers', () => {
    expect(toHex(pairingHash(client, server, '0012ab'))).toBe(expectedHash('12ab'));
    // case-insensitive
    expect(toHex(pairingHash(client, server, '0012AB'))).toBe(expectedHash('12ab'));
    // padded exponent gives the same hash as the minimal one
    expect(toHex(pairingHash({ ...client, exponent: fromHex('00010001') }, server, '0012ab'))).toBe(expectedHash('12ab'));
  });

  test('accepts the code whose first byte matches, rejects others', () => {
    const tail = '4f2e';
    const first = expectedHash(tail).slice(0, 2);
    const good = `${first}${tail}`;
    expect(toHex(pairingSecret(client, server, good))).toBe(expectedHash(tail));
    expect(isCodeValid(client, server, good.toLowerCase())).toBe(true);
    const wrongFirst = ((parseInt(first, 16) + 1) & 0xff).toString(16).padStart(2, '0');
    expect(isCodeValid(client, server, `${wrongFirst}${tail}`)).toBe(false);
    expect(() => pairingSecret(client, server, `${wrongFirst}${tail}`)).toThrow(DriverError);
    expect(isCodeValid(client, server, 'xyz')).toBe(false);
  });
});
