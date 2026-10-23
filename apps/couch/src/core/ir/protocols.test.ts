import { encode, encodeKaseikyo, encodeNec, encodeRc5, encodeSamsung32, encodeSirc12, patternDuration } from './protocols';

/** Pulse-distance bits from a hand-written bit string (as transmitted, left to right). */
function pd(bits: string, mark: number, zero: number, one: number): number[] {
  return bits
    .replace(/\s/g, '')
    .split('')
    .flatMap((b) => [mark, b === '1' ? one : zero]);
}

describe('NEC', () => {
  it('encodes LG power (address 0x04, command 0x08) = 0x20DF10EF', () => {
    // Bytes 0x04, 0xFB, 0x08, 0xF7, each LSB first.
    const bits = '00100000 11011111 00010000 11101111';
    const f = encodeNec(0x04, 0x08);
    expect(f.frequency).toBe(38000);
    expect(f.pattern).toEqual([9000, 4500, ...pd(bits, 560, 560, 1690), 560]);
    expect(f.pattern).toHaveLength(67);
    expect(f.pattern.slice(0, 8)).toEqual([9000, 4500, 560, 560, 560, 560, 560, 1690]);
    // 16 ones, 16 zeros: 9000+4500 + 33*560 + 16*560 + 16*1690
    expect(patternDuration(f.pattern)).toBe(9000 + 4500 + 33 * 560 + 16 * 560 + 16 * 1690);
  });

  it('extended address sends low byte then high byte instead of ~address', () => {
    // 0xC7EA -> 0xEA, 0xC7; command 0x17 -> 0x17, 0xE8.
    const bits = '01010111 11100011 11101000 00010111';
    expect(encodeNec(0xc7ea, 0x17).pattern).toEqual([9000, 4500, ...pd(bits, 560, 560, 1690), 560]);
  });

  it('rejects out-of-range values', () => {
    expect(() => encodeNec(0x10000, 1)).toThrow(RangeError);
    expect(() => encodeNec(1, 256)).toThrow(RangeError);
    expect(() => encodeNec(1, -1)).toThrow(RangeError);
  });
});

describe('Samsung32', () => {
  it('encodes volume up (address 0x07, command 0x07) = 0xE0E0E01F', () => {
    // Bytes 0x07, 0x07, 0x07, 0xF8, LSB first.
    const bits = '11100000 11100000 11100000 00011111';
    const f = encodeSamsung32(0x07, 0x07);
    expect(f.frequency).toBe(38000);
    expect(f.pattern).toEqual([4500, 4500, ...pd(bits, 560, 560, 1690), 560]);
  });

  it('encodes power (0x02) and volume down (0x0B)', () => {
    expect(encodeSamsung32(0x07, 0x02).pattern).toEqual([
      4500,
      4500,
      ...pd('11100000 11100000 01000000 10111111', 560, 560, 1690),
      560,
    ]);
    expect(encodeSamsung32(0x07, 0x0b).pattern).toEqual([
      4500,
      4500,
      ...pd('11100000 11100000 11010000 00101111', 560, 560, 1690),
      560,
    ]);
  });
});

describe('Sony SIRC 12-bit', () => {
  // Power: command 21 = 0010101 -> LSB first 1010100; address 1 -> 10000.
  const powerFrame = [
    2400, 600,
    1200, 600, 600, 600, 1200, 600, 600, 600, 1200, 600, 600, 600, 600, 600, // command
    1200, 600, 600, 600, 600, 600, 600, 600, 600, // address, no trailing space
  ];

  it('encodes one power frame at 40 kHz', () => {
    const f = encodeSirc12(1, 21, 1);
    expect(f.frequency).toBe(40000);
    expect(f.pattern).toEqual(powerFrame);
    expect(patternDuration(f.pattern)).toBe(19200);
  });

  it('repeats the frame three times on a 45 ms period by default', () => {
    const f = encodeSirc12(1, 21);
    expect(f.pattern).toEqual([...powerFrame, 25800, ...powerFrame, 25800, ...powerFrame]);
    expect(patternDuration(f.pattern)).toBe(45000 * 2 + 19200);
  });

  it('encodes volume up (18 = 0010010 -> 0100100)', () => {
    expect(encodeSirc12(1, 18, 1).pattern).toEqual([
      2400, 600,
      600, 600, 1200, 600, 600, 600, 600, 600, 1200, 600, 600, 600, 600, 600,
      1200, 600, 600, 600, 600, 600, 600, 600, 600,
    ]);
  });
});

describe('RC5', () => {
  it('encodes standby (system 0, command 12, toggle 0) at 36 kHz', () => {
    // bits 1 1 0 00000 001100, Manchester 1 = off/on, 0 = on/off, leading/trailing off dropped.
    const f = encodeRc5(0, 12);
    expect(f.frequency).toBe(36000);
    expect(f.pattern).toEqual([
      889, 889, 1778, 889,
      889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889,
      1778, 889, 889, 1778, 889, 889,
    ]);
    expect(f.pattern.length % 2).toBe(1); // starts and ends "on"
  });

  it('toggle bit changes the third bit', () => {
    // bits 1 1 1 00000 001100
    expect(encodeRc5(0, 12, { toggle: 1 }).pattern).toEqual([
      889, 889, 889, 889, 1778,
      889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889,
      1778, 889, 889, 1778, 889, 889,
    ]);
  });

  it('RC5X clears the field bit for commands 64..127', () => {
    // command 80 -> field 0, low six bits 010000. bits 1 0 0 00000 010000
    expect(encodeRc5(0, 80).pattern).toEqual([
      1778,
      889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889, 889,
      1778, 1778,
      889, 889, 889, 889, 889, 889,
    ]);
  });
});

describe('Kaseikyo (Panasonic)', () => {
  it('encodes power (address 0x008, command 0x3D) = 40 04 01 00 BC BD', () => {
    // Bytes 0x02 0x20 0x80 0x00 0x3D 0xBD, LSB first.
    const bits = '01000000 00000100 00000001 00000000 10111100 10111101';
    const f = encodeKaseikyo(0x008, 0x3d);
    expect(f.frequency).toBe(37000);
    expect(f.pattern).toEqual([3456, 1728, ...pd(bits, 432, 432, 1296), 432]);
  });
});

describe('encode()', () => {
  it('dispatches on protocol', () => {
    expect(encode({ protocol: 'nec', address: 4, command: 8 })).toEqual(encodeNec(4, 8));
    expect(encode({ protocol: 'samsung32', address: 7, command: 7 })).toEqual(encodeSamsung32(7, 7));
    expect(encode({ protocol: 'sirc12', address: 1, command: 18 })).toEqual(encodeSirc12(1, 18));
    expect(encode({ protocol: 'rc5', address: 0, command: 16 }, { toggle: 1 })).toEqual(encodeRc5(0, 16, { toggle: 1 }));
    expect(encode({ protocol: 'kaseikyo', address: 8, command: 0x20 })).toEqual(encodeKaseikyo(8, 0x20));
  });

  it('every pattern starts and ends with "on" and fits ConsumerIrManager (< 2 s)', () => {
    for (const p of ['nec', 'samsung32', 'sirc12', 'rc5', 'kaseikyo'] as const) {
      const f = encode({ protocol: p, address: 1, command: 1 });
      expect(f.pattern.length % 2).toBe(1);
      expect(f.pattern.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
      expect(patternDuration(f.pattern)).toBeLessThan(2_000_000);
    }
  });
});
