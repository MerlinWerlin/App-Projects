import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  base64ToBytes,
  BLOCK,
  bytesToBase64,
  makeTar,
  makeTarHeader,
  nextHeaderOffset,
  paddedSize,
  parseTarHeader,
  readOctal,
  utf8Decode,
  utf8Encode,
  type TarHeader,
} from './tar.ts';

/** Walks an in-memory archive the way src/native/cityMaps.ts walks the file: header, body, next header. */
function walk(tar: Uint8Array): { name: string; type: string; body: Uint8Array }[] {
  const out: { name: string; type: string; body: Uint8Array }[] = [];
  let off = 0;
  while (off + BLOCK <= tar.length) {
    const h = parseTarHeader(tar.subarray(off, off + BLOCK));
    if (h === 'end') break;
    if (typeof h === 'string') throw new Error(`bad header at ${off}: ${h}`);
    out.push({ name: h.name, type: h.type, body: tar.slice(off + BLOCK, off + BLOCK + h.size) });
    off = nextHeaderOffset(off, h.size);
  }
  return out;
}

test('base64 round-trips every length and byte value', () => {
  for (let n = 0; n < 70; n++) {
    const b = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
    const s = bytesToBase64(b);
    assert.equal(s, Buffer.from(b).toString('base64'));
    assert.deepEqual(base64ToBytes(s), b);
  }
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual(base64ToBytes(bytesToBase64(all)), all);
});

test('base64 decode tolerates missing padding and newlines, rejects junk', () => {
  assert.deepEqual(base64ToBytes('aGk'), utf8Encode('hi'));
  assert.deepEqual(base64ToBytes('aG\nk='), utf8Encode('hi'));
  assert.equal(base64ToBytes('a$bc'), null);
  assert.equal(base64ToBytes('abcde'), null);
  assert.deepEqual(base64ToBytes(''), new Uint8Array(0));
});

test('base64 of a large buffer matches node', () => {
  const b = Uint8Array.from({ length: 100_003 }, (_, i) => (i * 7919) & 0xff);
  assert.equal(bytesToBase64(b), Buffer.from(b).toString('base64'));
});

test('utf8 encode/decode match node, malformed bytes become U+FFFD', () => {
  for (const s of ['', 'abc', '© OpenStreetMap', '京都', 'emoji 🗺️']) {
    assert.deepEqual(utf8Encode(s), new Uint8Array(Buffer.from(s, 'utf8')));
    assert.equal(utf8Decode(new Uint8Array(Buffer.from(s, 'utf8'))), s);
  }
  assert.equal(utf8Decode(Uint8Array.from([0x61, 0xff, 0x62])), 'a�b');
});

test('octal fields: plain, space/NUL padded, base-256, malformed', () => {
  const b = new Uint8Array(12);
  b.set(utf8Encode('00000001750\0'));
  assert.equal(readOctal(b, 0, 12), 1000);
  b.fill(0).set(utf8Encode('   1750 '));
  assert.equal(readOctal(b, 0, 12), 1000);
  b.fill(0);
  b[0] = 0x80;
  b[10] = 1;
  b[11] = 2;
  assert.equal(readOctal(b, 0, 12), 258);
  b.fill(0).set(utf8Encode('12x'));
  assert.ok(Number.isNaN(readOctal(b, 0, 12)));
});

test('a header we build parses back, including the ustar prefix for long names', () => {
  const h = parseTarHeader(makeTarHeader('tiles/16/58210/25803.png', 1234)) as TarHeader;
  assert.deepEqual(h, { name: 'tiles/16/58210/25803.png', size: 1234, typeflag: '0', type: 'file' });
  const long = `${'d'.repeat(80)}/${'e'.repeat(60)}/f.png`;
  assert.equal((parseTarHeader(makeTarHeader(long, 1)) as TarHeader).name, long);
  assert.equal((parseTarHeader(makeTarHeader('tiles/', 0, '5')) as TarHeader).type, 'dir');
});

test('zero block is the end marker; corrupt or short blocks are errors', () => {
  assert.equal(parseTarHeader(new Uint8Array(BLOCK)), 'end');
  assert.equal(parseTarHeader(new Uint8Array(100)), 'short');
  const h = makeTarHeader('meta.json', 10);
  h[0] = 'n'.charCodeAt(0);
  assert.equal(parseTarHeader(h), 'checksum');
  assert.equal(parseTarHeader(new Uint8Array(BLOCK).fill(0x41)), 'checksum');
});

test('padding and next-header offsets', () => {
  assert.equal(paddedSize(0), 0);
  assert.equal(paddedSize(1), 512);
  assert.equal(paddedSize(512), 512);
  assert.equal(paddedSize(513), 1024);
  assert.equal(nextHeaderOffset(0, 0), 512);
  assert.equal(nextHeaderOffset(1024, 600), 1024 + 512 + 1024);
});

test('an archive built from bytes walks back to the same entries', () => {
  const entries = [
    { name: 'meta.json', body: utf8Encode('{"id":"x"}') },
    { name: 'tiles/', body: new Uint8Array(0), typeflag: '5' },
    { name: 'tiles/10/1/2.png', body: Uint8Array.from({ length: 1500 }, (_, i) => i & 0xff) },
    { name: 'pois.json', body: new Uint8Array(0) },
  ];
  const got = walk(makeTar(entries));
  assert.deepEqual(
    got.map((e) => [e.name, e.type, e.body.length]),
    [
      ['meta.json', 'file', 10],
      ['tiles/', 'dir', 0],
      ['tiles/10/1/2.png', 'file', 1500],
      ['pois.json', 'file', 0],
    ],
  );
  assert.deepEqual(got[2].body, entries[2].body);
});

test('a real archive made by GNU tar (--format=ustar) parses, prefix field included', () => {
  const tar = new Uint8Array(readFileSync(new URL('./fixtures/tiny.tar', import.meta.url)));
  const got = walk(tar);
  const files = got.filter((e) => e.type === 'file');
  assert.deepEqual(
    files.map((e) => e.name),
    ['meta.json', 'pois.json', 'tiles/12/3639/1612.png', `${'a'.repeat(64)}/${'b'.repeat(59)}/c.png`],
  );
  assert.equal(JSON.parse(utf8Decode(files[0].body)).id, 'tiny');
  assert.deepEqual([...files[2].body.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  // the same walk over base64 slices, like reading the file with { encoding: Base64, position, length }
  const header = base64ToBytes(bytesToBase64(tar.subarray(0, BLOCK)));
  assert.ok(header);
  assert.equal((parseTarHeader(header) as TarHeader).name, 'meta.json');
});
