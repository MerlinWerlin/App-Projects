import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { crc32, encodePng, samplePassportBitmap, sampleTicketBitmap, textWidth, toBase64 } from './samplePng.ts';

/** Reads back a PNG made by encodePng: checks every chunk CRC and returns the size and the raw pixel rows. */
function decode(png: Uint8Array) {
  const buf = Buffer.from(png);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let o = 8;
  const chunks: { type: string; data: Buffer }[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.subarray(o + 4, o + 8).toString('latin1');
    const data = buf.subarray(o + 8, o + 8 + len);
    assert.equal(buf.readUInt32BE(o + 8 + len), crc32(new Uint8Array(buf.subarray(o + 4, o + 8 + len))), `${type} crc`);
    chunks.push({ type, data });
    o += 12 + len;
  }
  assert.deepEqual(
    chunks.map((c) => c.type),
    ['IHDR', 'IDAT', 'IEND'],
  );
  const ihdr = chunks[0]!.data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  assert.deepEqual([...ihdr.subarray(8)], [8, 0, 0, 0, 0]);
  const raw = inflateSync(chunks[1]!.data);
  return { width, height, raw };
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('base64 matches Node for every padding case', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'Satchel sample ✈']) {
    const bytes = new TextEncoder().encode(s);
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
  }
  const bin = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) & 0xff);
  assert.equal(toBase64(bin), Buffer.from(bin).toString('base64'));
});

test('the sample images encode to valid greyscale PNGs with the same pixels', () => {
  for (const bmp of [sampleTicketBitmap(), samplePassportBitmap(), sampleTicketBitmap(30)]) {
    const { width, height, raw } = decode(encodePng(bmp));
    assert.equal(width, bmp.width);
    assert.equal(height, bmp.height);
    assert.equal(raw.length, (width + 1) * height);
    for (let y = 0; y < height; y += 7) {
      assert.equal(raw[y * (width + 1)], 0);
      assert.deepEqual([...raw.subarray(y * (width + 1) + 1, (y + 1) * (width + 1))], [...bmp.px.subarray(y * width, (y + 1) * width)]);
    }
  }
});

test('the sample ticket is drawn the same every time, with ink and a white quiet zone', () => {
  const a = sampleTicketBitmap();
  const b = sampleTicketBitmap();
  assert.deepEqual(a.px, b.px);
  assert.ok(a.px.some((v) => v < 50));
  for (let x = 0; x < a.width; x++) assert.equal(a.px[x], 255);
  assert.ok(textWidth('SAMPLE', 6) < a.width);
});
