// T87: Code 128 and QR encoders checked against published vectors and the spec's own tables.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { barRuns, code128Checksum, code128Encodable, code128Values, encodeCode128, PATTERNS, QUIET_ZONE, START_B, START_C, STOP } from './code128.ts';
import {
  buildMatrix,
  chooseVersion,
  dataCapacity,
  dataCodewords,
  encodeQr,
  formatBits,
  gfLog,
  interleave,
  MASKS,
  penalty,
  placementOrder,
  qrMode,
  rawDataModules,
  rsGenerator,
  rsRemainder,
  totalCodewords,
  versionBits,
} from './qr.ts';

// ---------------------------------------------------------------- Code 128

test('Code 128 pattern table: 106 symbols of 11 modules, even bar parity, all distinct; stop is 13 modules', () => {
  assert.equal(PATTERNS.length, 107);
  const sum = (p: string) => [...p].reduce((n, c) => n + Number(c), 0);
  for (let v = 0; v < 106; v++) {
    const p = PATTERNS[v];
    assert.equal(p.length, 6, `value ${v}`);
    assert.equal(sum(p), 11, `value ${v}`);
    // Bars are elements 1, 3, 5: their modules add up to an even number in every Code 128 symbol character.
    assert.equal((Number(p[0]) + Number(p[2]) + Number(p[4])) % 2, 0, `bar parity ${v}`);
  }
  assert.equal(new Set(PATTERNS).size, 107);
  assert.equal(PATTERNS[STOP], '2331112');
  assert.equal(sum(PATTERNS[STOP]), 13);
  assert.equal(PATTERNS[103], '211412'); // Start A
  assert.equal(PATTERNS[START_B], '211214');
  assert.equal(PATTERNS[START_C], '211232');
});

test('Code 128 checksum, worked example "PJJ123C" (set B)', () => {
  // Start B 104; P=48 J=42 J=42 1=17 2=18 3=19 C=35.
  // 104 + 48*1 + 42*2 + 42*3 + 17*4 + 18*5 + 19*6 + 35*7 = 879; 879 mod 103 = 55.
  const v = code128Values('PJJ123C')!;
  assert.deepEqual(v, [104, 48, 42, 42, 17, 18, 19, 35]);
  assert.equal(code128Checksum(v), 55);
  const c = encodeCode128('PJJ123C')!;
  assert.equal(c.checksum, 55);
  assert.deepEqual(c.values.slice(-2), [55, STOP]);
});

test('Code 128 checksum, worked example "Wikipedia" (set B, every product shown)', () => {
  // Start B 104, W=55 i=73 k=75 i=73 p=80 e=69 d=68 i=73 a=65.
  // 104 + 55 + 146 + 225 + 292 + 400 + 414 + 476 + 584 + 585 = 3281; 3281 mod 103 = 88.
  const c = encodeCode128('Wikipedia')!;
  assert.deepEqual(c.values, [104, 55, 73, 75, 73, 80, 69, 68, 73, 65, 88, 106]);
});

test('Code 128 picks set C for digits and switches between B and C', () => {
  // "1234": Start C, 12, 34; (105 + 12 + 34*2) mod 103 = 185 mod 103 = 82.
  assert.deepEqual(encodeCode128('1234')!.values, [105, 12, 34, 82, 106]);
  // An odd all-digit run of 5: C pairs then the last digit in B.
  assert.deepEqual(code128Values('12345'), [105, 12, 34, 100, 21]);
  // Short digit runs stay in B; long inner runs go to C (odd run keeps one digit in B first).
  assert.deepEqual(code128Values('AB12CD'), [104, 33, 34, 17, 18, 35, 36]);
  assert.deepEqual(code128Values('AB1234567CD'), [104, 33, 34, 17, 99, 23, 45, 67, 100, 35, 36]);
  // A trailing run of 4 goes to C.
  assert.deepEqual(code128Values('X1234'), [104, 56, 99, 12, 34]);
  // A leading run of 4+ starts in C.
  assert.deepEqual(code128Values('123456AB'), [105, 12, 34, 56, 100, 33, 34]);
});

test('Code 128 modules: quiet zones of 10 and total width 11 per symbol + 13 stop + 20', () => {
  const c = encodeCode128('1234')!;
  assert.equal(c.modules.length, QUIET_ZONE * 2 + 11 * 4 + 13);
  assert.ok(c.modules.slice(0, QUIET_ZONE).every((m) => !m));
  assert.ok(c.modules.slice(-QUIET_ZONE).every((m) => !m));
  assert.equal(c.modules[QUIET_ZONE], true); // every symbol starts with a bar
  // Start C 211232 -> bar 2, space 1, bar 1, space 2, bar 3, space 2.
  assert.deepEqual(c.modules.slice(QUIET_ZONE, QUIET_ZONE + 11), [true, true, false, true, false, false, true, true, true, false, false]);
  // The stop ends with a 2-module bar right before the quiet zone.
  assert.deepEqual(c.modules.slice(-QUIET_ZONE - 3, -QUIET_ZONE), [false, true, true]);
  const runs = barRuns(c.modules);
  assert.equal(runs[0][0], QUIET_ZONE);
  assert.equal(runs[0][1], 2);
});

test('Code 128 refuses empty text and characters outside printable ASCII', () => {
  assert.equal(encodeCode128(''), null);
  assert.equal(encodeCode128('Café'), null);
  assert.equal(encodeCode128('a\tb'), null);
  assert.equal(code128Encodable('AB 12-34/x~'), true);
});

// ---------------------------------------------------------------- QR: tables

test('QR level M capacities match the spec (data codewords per version 1-10, totals from the module count)', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(dataCapacity),
    [16, 28, 44, 64, 86, 108, 124, 154, 182, 216],
  );
  for (let v = 1; v <= 10; v++) assert.equal(totalCodewords(v), Math.floor(rawDataModules(v) / 8), `v${v}`);
  assert.deepEqual([1, 2, 7].map(totalCodewords), [26, 44, 196]);
});

test('Reed-Solomon generator polynomials (ISO 18004 Annex A), as powers of alpha', () => {
  const asExp = (deg: number) => rsGenerator(deg).map(gfLog);
  assert.deepEqual(asExp(7), [0, 87, 229, 146, 149, 238, 102, 21]);
  assert.deepEqual(asExp(10), [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45]);
  // (x - 1)(x - a) = x^2 + (1 ^ a) x + a = x^2 + 3x + 2.
  assert.deepEqual(rsGenerator(2), [1, 3, 2]);
});

test('"HELLO WORLD" 1-M: data and error correction codewords match the well-known worked example', () => {
  assert.equal(qrMode('HELLO WORLD'), 'alphanumeric');
  const data = dataCodewords('HELLO WORLD', 1)!;
  assert.deepEqual(data, [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]);
  assert.deepEqual(rsRemainder(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  assert.equal(chooseVersion('HELLO WORLD'), 1);
});

test('numeric mode: "01234567" 1-M data codewords (ISO 18004 worked example)', () => {
  // 0001 | 0000001000 | 0000001100 0101011001 1000011 | 0000 then padding.
  const data = dataCodewords('01234567', 1)!;
  assert.deepEqual(data.slice(0, 6), [0b00010000, 0b00100000, 0b00001100, 0b01010110, 0b01100001, 0b10000000]);
  assert.deepEqual(data.slice(6), [236, 17, 236, 17, 236, 17, 236, 17, 236, 17]);
});

test('byte mode: header, UTF-8 payload and padding reasoned by hand', () => {
  // "ab": 0100 | 00000010 | 01100001 01100010 | 0000 -> 0x40 0x26 0x16 0x20, then 0xEC 0x11 ...
  assert.equal(qrMode('ab'), 'byte');
  assert.deepEqual(dataCodewords('ab', 1)!.slice(0, 6), [0x40, 0x26, 0x16, 0x20, 0xec, 0x11]);
  // "é" is two UTF-8 bytes C3 A9: 0100 00000010 11000011 10101001 0000.
  assert.deepEqual(dataCodewords('é', 1)!.slice(0, 4), [0x40, 0x2c, 0x3a, 0x90]);
});

test('format info at level M for every mask matches the spec table', () => {
  const table = ['101010000010010', '101000100100101', '101111001111100', '101101101001011', '100010111111001', '100000011001110', '100111110010111', '100101010100000'];
  for (let mask = 0; mask < 8; mask++) assert.equal(formatBits(mask).toString(2).padStart(15, '0'), table[mask], `mask ${mask}`);
});

test('version info BCH(18,6): v7 = 000111110010010100, v8 and v10 from the spec table', () => {
  assert.equal(versionBits(7).toString(2).padStart(18, '0'), '000111110010010100');
  assert.equal(versionBits(8).toString(2).padStart(18, '0'), '001000010110111100');
  assert.equal(versionBits(10).toString(2).padStart(18, '0'), '001010010011010011');
});

// ---------------------------------------------------------------- QR: the symbol

const finderAt = (m: boolean[][], x0: number, y0: number) => {
  for (let dy = 0; dy < 7; dy++)
    for (let dx = 0; dx < 7; dx++) {
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (m[y0 + dy][x0 + dx] !== (d !== 2)) return false;
    }
  return true;
};

/** Reads the 15 format bits from the copy around the top-left finder. */
const readFormatTopLeft = (m: boolean[][]) => {
  let bits = 0;
  const at = (x: number, y: number, i: number) => (bits |= (m[y][x] ? 1 : 0) << i);
  for (let i = 0; i <= 5; i++) at(8, i, i);
  at(8, 7, 6);
  at(8, 8, 7);
  at(7, 8, 8);
  for (let i = 9; i < 15; i++) at(14 - i, 8, i);
  return bits;
};
const readFormatSplit = (m: boolean[][]) => {
  const s = m.length;
  let bits = 0;
  for (let i = 0; i < 8; i++) bits |= (m[8][s - 1 - i] ? 1 : 0) << i;
  for (let i = 8; i < 15; i++) bits |= (m[s - 15 + i][8] ? 1 : 0) << i;
  return bits;
};

test('a QR symbol has finders, separators, timing, the dark module and both format copies', () => {
  const qr = encodeQr('HELLO WORLD')!;
  assert.equal(qr.version, 1);
  assert.equal(qr.size, 21);
  const m = qr.modules;
  assert.ok(finderAt(m, 0, 0) && finderAt(m, 14, 0) && finderAt(m, 0, 14));
  for (let i = 0; i < 8; i++) {
    assert.equal(m[7][i], false, 'separator');
    assert.equal(m[i][7], false, 'separator');
  }
  for (let i = 8; i <= 12; i++) {
    assert.equal(m[6][i], i % 2 === 0, `timing row ${i}`);
    assert.equal(m[i][6], i % 2 === 0, `timing col ${i}`);
  }
  assert.equal(m[21 - 8][8], true, 'dark module');
  assert.equal(readFormatTopLeft(m), formatBits(qr.mask));
  assert.equal(readFormatSplit(m), formatBits(qr.mask));
});

test('the codewords read back from the matrix (unmasked, in placement order) are the interleaved data + EC', () => {
  for (const [text, want] of [
    ['HELLO WORLD', 1],
    ['MEMBER 1234 5678 9012', 2],
    ['Sky club · Gold · 00123456789', 3],
    ['x'.repeat(100), 6],
    ['9'.repeat(300), 8],
    ['membership-'.repeat(17), 10],
  ] as const) {
    const qr = encodeQr(text)!;
    assert.equal(qr.version, want, text);
    const expect = interleave(dataCodewords(text, qr.version)!, qr.version);
    const order = placementOrder(qr.version);
    assert.ok(order.length >= expect.length * 8);
    const got: number[] = [];
    for (let i = 0; i < expect.length * 8; i++) {
      const [x, y] = order[i];
      const b = qr.modules[y][x] !== MASKS[qr.mask](x, y);
      if (i % 8 === 0) got.push(0);
      got[got.length - 1] = (got[got.length - 1] << 1) | (b ? 1 : 0);
    }
    assert.deepEqual(got, expect, text);
  }
});

test('version 7+ carries both version info blocks', () => {
  const qr = encodeQr('8'.repeat(350))!;
  assert.ok(qr.version >= 7);
  const s = qr.size;
  const v = versionBits(qr.version);
  for (let i = 0; i < 18; i++) {
    const a = s - 11 + (i % 3);
    const b = Math.floor(i / 3);
    const want = ((v >>> i) & 1) === 1;
    assert.equal(qr.modules[b][a], want);
    assert.equal(qr.modules[a][b], want);
  }
});

test('the chosen mask has the lowest penalty of the eight', () => {
  const text = 'MEMBER 1234 5678 9012';
  const qr = encodeQr(text)!;
  const data = dataCodewords(text, qr.version)!;
  const scores = MASKS.map((_, mask) => penalty(buildMatrix(data, qr.version, mask)));
  assert.equal(scores[qr.mask], Math.min(...scores));
});

test('penalty rules on small hand-made grids', () => {
  // 5x5 all light: N1 = 5 rows + 5 cols of run 5 -> 10 * 3 = 30; N2 = 16 blocks * 3 = 48; N4 = 0% dark -> 10 * 10 = 100.
  const light = Array.from({ length: 5 }, () => new Array<boolean>(5).fill(false));
  assert.equal(penalty(light), 30 + 48 + 100);
});

test('QR refuses empty text and text longer than version 10 holds', () => {
  assert.equal(encodeQr(''), null);
  assert.equal(encodeQr('x'.repeat(214)), null); // byte capacity at 10-M is 213
  assert.ok(encodeQr('x'.repeat(213)));
});
