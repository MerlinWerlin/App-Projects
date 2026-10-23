import { isKey } from '../keys';
import { IR_BRAND_CHOICES, IR_BRANDS, IR_CODE_SETS, candidatesFor, codeFor, codeSetFor, isIrBrandChoice } from './codes';
import { encode } from './protocols';

describe('IR code sets', () => {
  it('brand grid matches the prototype', () => {
    expect(IR_BRAND_CHOICES).toEqual(['Samsung', 'LG', 'Sony', 'Hisense', 'TCL', 'Panasonic', 'Philips', 'Not sure']);
  });

  it('every brand has at least one set, every set has VOL_UP (the test key) and POWER', () => {
    for (const b of IR_BRANDS) {
      expect(IR_CODE_SETS[b].length).toBeGreaterThan(0);
      for (const s of IR_CODE_SETS[b]) {
        expect({ id: s.id, vol: s.keys.VOL_UP !== undefined, power: s.keys.POWER !== undefined }).toEqual({ id: s.id, vol: true, power: true });
      }
    }
  });

  it('every entry is a real key and encodes without error', () => {
    for (const b of IR_BRANDS) {
      for (const s of IR_CODE_SETS[b]) {
        for (const k of Object.keys(s.keys)) {
          expect(isKey(k)).toBe(true);
          const code = codeFor(s, k as never)!;
          expect(() => encode(code)).not.toThrow();
        }
      }
    }
  });

  it('keeps the widely published anchor values', () => {
    const sam = IR_CODE_SETS.Samsung[0]!;
    expect([sam.protocol, sam.address, sam.keys.POWER, sam.keys.VOL_UP, sam.keys.VOL_DOWN]).toEqual(['samsung32', 0x07, 0x02, 0x07, 0x0b]);
    const lg = IR_CODE_SETS.LG[0]!;
    expect([lg.protocol, lg.address, lg.keys.POWER, lg.keys.VOL_UP, lg.keys.VOL_DOWN]).toEqual(['nec', 0x04, 0x08, 0x02, 0x03]);
    const sony = IR_CODE_SETS.Sony[0]!;
    expect([sony.protocol, sony.address, sony.keys.POWER, sony.keys.VOL_UP, sony.keys.VOL_DOWN]).toEqual(['sirc12', 1, 21, 18, 19]);
  });

  it('"Not sure" = every set once, in brand order', () => {
    const all = candidatesFor('Not sure');
    const ids = all.map((c) => c.codeSet.id);
    expect(new Set(ids).size).toBe(ids.length);
    const expected: string[] = [];
    for (const b of IR_BRANDS) for (const s of IR_CODE_SETS[b]) if (!expected.includes(s.id)) expected.push(s.id);
    expect(ids).toEqual(expected);
    expect(all[0]).toMatchObject({ brand: 'Samsung', set: 1 });
  });

  it('a brand lists only its own sets, numbered from 1', () => {
    const lg = candidatesFor('LG');
    expect(lg.map((c) => [c.brand, c.set])).toEqual(IR_CODE_SETS.LG.map((_, i) => ['LG', i + 1]));
  });

  it('codeSetFor resolves a saved (brand, set) and rejects unknowns', () => {
    expect(codeSetFor('Sony', 1)).toBe(IR_CODE_SETS.Sony[0]);
    expect(codeSetFor('Sony', 99)).toBeNull();
    expect(codeSetFor('Acme', 1)).toBeNull();
    expect(isIrBrandChoice('Not sure')).toBe(true);
    expect(isIrBrandChoice('Acme')).toBe(false);
  });
});
