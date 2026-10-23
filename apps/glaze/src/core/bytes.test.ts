import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { Sha256, base64Decode, base64Encode, concatBytes, isSha256Hex, sha256Hex, utf8Decode, utf8Encode } from './bytes.ts';
import { crc32, gunzip } from './inflate.ts';

const SIZES = [0, 1, 55, 56, 63, 64, 65, 1000, 70000];

test('sha256 matches node:crypto at block-boundary sizes and known vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for (const n of SIZES) {
    const b = randomBytes(n);
    assert.equal(sha256Hex(b), createHash('sha256').update(b).digest('hex'), `${n} bytes`);
  }
  // Incremental updates give the same digest as one shot.
  const b = randomBytes(5000);
  const h = new Sha256();
  for (let i = 0; i < b.length; i += 333) h.update(b.subarray(i, i + 333));
  assert.equal(h.hex(), sha256Hex(b));
  assert.ok(isSha256Hex(sha256Hex('x')));
  assert.ok(!isSha256Hex('ABC'));
});

test('base64 and utf-8 round trip and match Buffer', () => {
  for (const n of SIZES) {
    const b = randomBytes(n);
    assert.equal(base64Encode(b), b.toString('base64'), `${n}`);
    assert.deepEqual(Buffer.from(base64Decode(b.toString('base64'))), b);
  }
  const s = 'héllo 🌸 日本 مرحبا';
  assert.equal(utf8Decode(utf8Encode(s)), s);
  assert.equal(Buffer.from(utf8Encode(s)).toString('utf8'), s);
  assert.deepEqual(concatBytes([Uint8Array.of(1), Uint8Array.of(2, 3)]), Uint8Array.of(1, 2, 3));
});

test('gunzip decodes node:zlib output at every level (stored, fixed, dynamic blocks)', () => {
  for (const n of SIZES) {
    const rand = randomBytes(n);
    const text = Buffer.from(JSON.stringify({ d: 'M10 20L30 40Z'.repeat(n % 300), n }).repeat(4));
    for (const level of [0, 1, 6, 9]) {
      assert.deepEqual(Buffer.from(gunzip(gzipSync(rand, { level }))), rand, `random ${n} @${level}`);
      assert.deepEqual(Buffer.from(gunzip(gzipSync(text, { level }))), text, `text ${n} @${level}`);
    }
  }
  assert.equal(crc32(utf8Encode('123456789')), 0xcbf43926);
});

test('gunzip rejects junk, truncation and corruption', () => {
  const z = gzipSync(Buffer.from('a theme pack '.repeat(50)));
  assert.throws(() => gunzip(Uint8Array.of(1, 2, 3)));
  assert.throws(() => gunzip(z.subarray(0, z.length - 4)));
  const bad = Buffer.from(z);
  bad[bad.length - 6] ^= 0xff; // CRC byte
  assert.throws(() => gunzip(bad), /checksum/);
});
