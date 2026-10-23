import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase64, encodeBase64 } from './base64.ts';

const bytes = (s: string) => new Uint8Array([...s].map((ch) => ch.charCodeAt(0)));

test('RFC 4648 vectors encode', () => {
  const cases: [string, string][] = [
    ['', ''],
    ['f', 'Zg=='],
    ['fo', 'Zm8='],
    ['foo', 'Zm9v'],
    ['foob', 'Zm9vYg=='],
    ['fooba', 'Zm9vYmE='],
    ['foobar', 'Zm9vYmFy'],
  ];
  for (const [plain, b64] of cases) {
    assert.equal(encodeBase64(bytes(plain)), b64);
    assert.deepEqual(decodeBase64(b64), bytes(plain));
  }
});

test('round-trips every byte value and large buffers (matches Buffer)', () => {
  for (const n of [0, 1, 2, 3, 255, 256, 257, 8191, 8192, 8193, 30000]) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = (i * 131 + 7) & 255;
    const s = encodeBase64(b);
    assert.equal(s, Buffer.from(b).toString('base64'), `encode n=${n}`);
    assert.deepEqual(decodeBase64(s), b, `decode n=${n}`);
  }
});

test('accepts Uint8ClampedArray input', () => {
  assert.equal(encodeBase64(new Uint8ClampedArray([0, 255, 128])), Buffer.from([0, 255, 128]).toString('base64'));
});

test('decode ignores whitespace and missing padding', () => {
  assert.deepEqual(decodeBase64('Zm9v\nYmE='), bytes('fooba'));
  assert.deepEqual(decodeBase64(' Zm9vYg '), bytes('foob'));
  assert.deepEqual(decodeBase64('Zm8'), bytes('fo'));
});

test('decode rejects invalid input', () => {
  assert.throws(() => decodeBase64('Zm9v!'), SyntaxError);
  assert.throws(() => decodeBase64('Z'), SyntaxError);
  assert.throws(() => decodeBase64('Zg==Zg=='), SyntaxError);
  assert.throws(() => decodeBase64('Zg='), SyntaxError);
  assert.throws(() => decodeBase64('Zm9v-_'), SyntaxError);
});
