import { formatInches, formatLength, parseLength, formatFeetInches, lengthToInput } from './units';
import { simpleOffset, rollingOffset, offsetMultiplier, angleForRun } from './offset';
import { cutLength, takeoff } from './cut';
import { fall, gradeFromDrop, gradeN } from './fall';
import { flow, volume } from './flow';
import { cutList, barNeed } from './cutlist';

const ok = <T,>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};

describe('units', () => {
  test('metric parsing', () => {
    expect(parseLength('1250', 'metric')).toEqual({ ok: true, value: 1250 });
    expect(parseLength('1.25m', 'metric')).toEqual({ ok: true, value: 1250 });
    expect(parseLength(' 12,5 ', 'metric')).toEqual({ ok: true, value: 12.5 });
    expect(parseLength('.5', 'metric')).toEqual({ ok: true, value: 0.5 });
    expect(parseLength('', 'metric').ok).toBe(false);
    expect(parseLength('-5', 'metric').ok).toBe(false);
    expect(parseLength('abc', 'metric').ok).toBe(false);
    expect(parseLength('1..2', 'metric').ok).toBe(false);
  });
  test('imperial parsing (1 in = 25.4 mm exactly)', () => {
    expect(ok(parseLength('12', 'imperial'))).toBeCloseTo(304.8, 9);
    expect(ok(parseLength('12 3/8', 'imperial'))).toBeCloseTo(12.375 * 25.4, 9);
    expect(ok(parseLength('3/8', 'imperial'))).toBeCloseTo(9.525, 9);
    expect(ok(parseLength("4' 2 1/2", 'imperial'))).toBeCloseTo(50.5 * 25.4, 9);
    expect(ok(parseLength("4'", 'imperial'))).toBeCloseTo(1219.2, 9);
    expect(ok(parseLength('4ft 2in', 'imperial'))).toBeCloseTo(50 * 25.4, 9);
    expect(ok(parseLength('10"', 'imperial'))).toBeCloseTo(254, 9);
    expect(parseLength('1/0', 'imperial').ok).toBe(false);
    expect(parseLength('12.5 3/8', 'imperial').ok).toBe(false);
    expect(parseLength("'", 'imperial').ok).toBe(false);
    expect(parseLength('x', 'imperial').ok).toBe(false);
  });
  test('inch formatting to the nearest 1/16 and reduced', () => {
    expect(formatInches(12.375)).toBe('12 3/8″');
    expect(formatInches(0.5)).toBe('1/2″');
    expect(formatInches(7)).toBe('7″');
    expect(formatInches(6.99)).toBe('7″'); // 6.99 rounds to 7 0/16
    expect(formatInches(1.03125)).toBe('1 1/16″'); // 1 1/32 rounds half up to 1/16
    expect(formatFeetInches(1600.2)).toBe('5′ 3″');
    expect(formatFeetInches(3657.6)).toBe('12′'); // a 12 ft stock length
    expect(formatLength(1600.2, 'imperial')).toBe('5′ 3″');
    expect(formatLength(254, 'imperial')).toBe('10″');
  });
  test('metric formatting', () => {
    expect(formatLength(1414.2136, 'metric')).toBe('1 414 mm');
    expect(formatLength(12.5, 'metric')).toBe('12.5 mm');
    expect(formatLength(2500, 'metric', { metres: true })).toBe('2.5 m');
    expect(formatLength(6000, 'metric', { metres: true })).toBe('6 m');
    expect(formatLength(12345.6, 'metric', { metres: true })).toBe('12.346 m');
    expect(formatLength(-0.2, 'metric')).toBe('-0.2 mm');
    expect(formatLength(NaN, 'metric')).toBe('—');
    expect(lengthToInput(1250, 'metric')).toBe('1250');
    expect(lengthToInput(9.525, 'imperial')).toBe('3/8');
  });
});

describe('simple offset', () => {
  test('multipliers match the published tables', () => {
    expect(offsetMultiplier(45)).toBeCloseTo(1.4142, 4);
    expect(offsetMultiplier(60)).toBeCloseTo(1.1547, 4);
    expect(offsetMultiplier(22.5)).toBeCloseTo(2.6131, 4);
    expect(offsetMultiplier(11.25)).toBeCloseTo(5.1258, 4);
    expect(offsetMultiplier(30)).toBeCloseTo(2, 9);
    expect(offsetMultiplier(90)).toBeCloseTo(1, 9);
  });
  test('worked example: 300 mm offset with 45° fittings', () => {
    const r = ok(simpleOffset({ offset: 300, angle: 45 }));
    expect(r.travel).toBeCloseTo(424.26, 2); // 300 × 1.41421
    expect(r.run).toBeCloseTo(300, 9); // tan 45° = 1
  });
  test('worked example: 10 in offset with 22.5° fittings (US table: travel 26.13 in, run 24.14 in)', () => {
    const r = ok(simpleOffset({ offset: 254, angle: 22.5 }));
    expect(r.travel / 25.4).toBeCloseTo(26.131, 3);
    expect(r.run / 25.4).toBeCloseTo(24.142, 3);
  });
  test('60° fittings and 90° (straight up) edge', () => {
    const r60 = ok(simpleOffset({ offset: 200, angle: 60 }));
    expect(r60.travel).toBeCloseTo(230.94, 2);
    expect(r60.run).toBeCloseTo(115.47, 2);
    const r90 = ok(simpleOffset({ offset: 200, angle: 90 }));
    expect(r90.travel).toBeCloseTo(200, 9);
    expect(r90.run).toBe(0);
  });
  test('cut length subtracts both take-offs', () => {
    const r = ok(simpleOffset({ offset: 300, angle: 45, takeoffA: 20, takeoffB: 25 }));
    expect(r.cut).toBeCloseTo(424.264 - 45, 2);
  });
  test('fittings that overlap give a warning', () => {
    const r = simpleOffset({ offset: 20, angle: 45, takeoffA: 30, takeoffB: 30 });
    expect(r.ok && r.warnings.length).toBe(1);
  });
  test('invalid input', () => {
    expect(simpleOffset({ offset: 0, angle: 45 }).ok).toBe(false);
    expect(simpleOffset({ offset: -1, angle: 45 }).ok).toBe(false);
    expect(simpleOffset({ offset: NaN, angle: 45 }).ok).toBe(false);
    expect(simpleOffset({ offset: 100, angle: 0 }).ok).toBe(false);
    expect(simpleOffset({ offset: 100, angle: 95 }).ok).toBe(false);
    expect(simpleOffset({ offset: 100, angle: 45, takeoffA: -1 }).ok).toBe(false);
  });
  test('angle for a given run', () => {
    const r = ok(angleForRun(300, 300));
    expect(r.angle).toBeCloseTo(45, 9);
    expect(r.travel).toBeCloseTo(424.264, 3);
    expect(angleForRun(0, 10).ok).toBe(false);
  });
});

describe('rolling offset', () => {
  test('worked example: rise 300, roll 400, 45° (3-4-5 triangle)', () => {
    const r = ok(rollingOffset({ rise: 300, roll: 400, angle: 45 }));
    expect(r.trueOffset).toBeCloseTo(500, 9);
    expect(r.travel).toBeCloseTo(707.107, 3);
    expect(r.run).toBeCloseTo(500, 9);
    expect(r.rollAngle).toBeCloseTo(53.130, 3);
  });
  test('no roll is the same as a simple offset', () => {
    const r = ok(rollingOffset({ rise: 250, roll: 0, angle: 60 }));
    const s = ok(simpleOffset({ offset: 250, angle: 60 }));
    expect(r.travel).toBeCloseTo(s.travel, 9);
    expect(r.rollAngle).toBe(0);
  });
  test('invalid input', () => {
    expect(rollingOffset({ rise: 0, roll: 0, angle: 45 }).ok).toBe(false);
    expect(rollingOffset({ rise: -1, roll: 10, angle: 45 }).ok).toBe(false);
    expect(rollingOffset({ rise: 10, roll: 10, angle: 120 }).ok).toBe(false);
  });
});

describe('cut length', () => {
  const ell = { centreToEnd: 30, engagement: 12 }; // take-off 18
  test('take-off is centre-to-end minus socket depth', () => {
    expect(takeoff(ell)).toBe(18);
  });
  test('centre to centre: minus both take-offs', () => {
    const r = ok(cutLength({ measured: 1000, a: { ref: 'centre', fitting: ell }, b: { ref: 'centre', fitting: ell } }));
    expect(r.cut).toBe(964);
  });
  test('face to face: plus both socket depths', () => {
    const r = ok(cutLength({ measured: 1000, a: { ref: 'face', fitting: ell }, b: { ref: 'face', fitting: ell } }));
    expect(r.cut).toBe(1024);
  });
  test('centre to an open end, with quantity', () => {
    const r = ok(cutLength({ measured: 500, a: { ref: 'centre', fitting: ell }, b: { ref: 'none' }, qty: 3 }));
    expect(r.cut).toBe(482);
    expect(r.total).toBe(1446);
  });
  test('invalid input', () => {
    expect(cutLength({ measured: 0, a: { ref: 'none' }, b: { ref: 'none' } }).ok).toBe(false);
    expect(cutLength({ measured: 100, a: { ref: 'centre' }, b: { ref: 'none' } }).ok).toBe(false);
    expect(cutLength({ measured: 100, a: { ref: 'centre', fitting: { centreToEnd: 10, engagement: 20 } }, b: { ref: 'none' } }).ok).toBe(false);
    expect(cutLength({ measured: 30, a: { ref: 'centre', fitting: ell }, b: { ref: 'centre', fitting: ell } }).ok).toBe(false);
    expect(cutLength({ measured: 100, a: { ref: 'none' }, b: { ref: 'none' }, qty: 1.5 }).ok).toBe(false);
  });
});

describe('fall', () => {
  test('1:40 over 12 m is 300 mm (2.5 %)', () => {
    const r = ok(fall({ length: 12000, grade: { kind: 'ratio', n: 40 } }));
    expect(r.drop).toBe(300);
    expect(r.percent).toBe(2.5);
    expect(r.mmPerMetre).toBe(25);
  });
  test('1:60 over 9 m is 150 mm, and invert levels', () => {
    const r = ok(fall({ length: 9000, grade: { kind: 'ratio', n: 60 }, startLevel: 10.5 }));
    expect(r.drop).toBeCloseTo(150, 9);
    expect(r.endLevel).toBeCloseTo(10.35, 9);
  });
  test('percent and mm/m inputs give the same grade', () => {
    expect(gradeN({ kind: 'percent', pct: 2.5 })).toBe(40);
    expect(gradeN({ kind: 'mmPerM', mm: 20 })).toBe(50);
    expect(gradeN({ kind: 'inPerFt', inches: 0.25 })).toBe(48);
    expect(ok(fall({ length: 6000, grade: { kind: 'percent', pct: 1.65 } })).drop).toBeCloseTo(99, 9);
  });
  test('grade from a measured drop', () => {
    const r = ok(gradeFromDrop(6000, 100));
    expect(r.n).toBe(60);
    expect(r.percent).toBeCloseTo(1.6667, 4);
  });
  test('invalid input', () => {
    expect(fall({ length: 0, grade: { kind: 'ratio', n: 40 } }).ok).toBe(false);
    expect(fall({ length: 100, grade: { kind: 'ratio', n: 0 } }).ok).toBe(false);
    expect(fall({ length: 100, grade: { kind: 'percent', pct: 0 } }).ok).toBe(false);
    expect(fall({ length: 100, grade: { kind: 'ratio', n: 0.5 } }).ok).toBe(false);
    expect(fall({ length: 100, grade: { kind: 'ratio', n: 40 }, startLevel: NaN }).ok).toBe(false);
    expect(gradeFromDrop(100, 0).ok).toBe(false);
  });
});

describe('volume and flow', () => {
  test('a 100 mm bore holds 7.854 L per metre', () => {
    const r = ok(volume({ id: 100, length: 1000 }));
    expect(r.litresPerMetre).toBeCloseTo(7.85398, 5);
    expect(r.litres).toBeCloseTo(7.85398, 5);
  });
  test('20 m of DN18 Type B copper (13.84 mm bore) is about 3 L', () => {
    const r = ok(volume({ id: 13.84, length: 20000 }));
    expect(r.litres).toBeCloseTo(3.009, 3);
  });
  test('flow to velocity: 20 L/min in a 20 mm bore is 1.061 m/s', () => {
    const r = ok(flow({ id: 20, lpm: 20 }));
    expect(r.velocity).toBeCloseTo(1.0610, 4);
    expect(r.lps).toBeCloseTo(0.3333, 4);
  });
  test('velocity to flow, and the warning follows the country limit', () => {
    const r = flow({ id: 20, velocity: 3.5 });
    expect(r.ok && r.value.lpm).toBeCloseTo(65.97, 2);
    expect(r.ok && r.warnings.some(w => w.includes('check your local code'))).toBe(true);
    const au = flow({ id: 20, velocity: 3.5, limit: { max: 3, code: 'the NCC (B1P2)' } });
    expect(au.ok && au.warnings.some(w => w.includes('NCC'))).toBe(true);
    const slow = flow({ id: 20, velocity: 2.9, limit: { max: 3, code: 'the NCC (B1P2)' } });
    expect(slow.ok && slow.warnings).toEqual([]);
    const tight = flow({ id: 20, velocity: 2.6, limit: { max: 2.4, code: 'X' } });
    expect(tight.ok && tight.warnings.length).toBe(1);
  });
  test('Hazen–Williams agrees with the independent US-units form (psi per ft = 4.52 Q^1.85 / (C^1.85 d^4.87))', () => {
    // 100 m of 100 mm bore, Q = 0.01 m³/s (600 L/min), C 130. SI form by hand: 10.67 × 100 × 1.977e-4 / (8231 × 1.346e-5) = 1.904 m.
    const r = ok(flow({ id: 100, lpm: 600, length: 100000, c: 130 }));
    const gpm = 0.01 * 15850.32; const dIn = 100 / 25.4; const ft = 100 / 0.3048;
    const psi = (4.52 * Math.pow(gpm, 1.85)) / (Math.pow(130, 1.85) * Math.pow(dIn, 4.87)) * ft;
    const usKpa = psi * 6.894757;
    expect(r.headLoss).toBeCloseTo(1.906, 2);
    expect(Math.abs(r.kpa! - usKpa) / usKpa).toBeLessThan(0.01); // the two published coefficient sets agree within 1 %
    expect(r.kpa).toBeCloseTo(r.headLoss! * 9.80665, 9);
  });
  test('invalid input', () => {
    expect(volume({ id: 0, length: 10 }).ok).toBe(false);
    expect(volume({ id: 10, length: -1 }).ok).toBe(false);
    expect(flow({ id: 20 }).ok).toBe(false);
    expect(flow({ id: 20, lpm: 0 }).ok).toBe(false);
    expect(flow({ id: 20, lpm: 10, length: 1000 }).ok).toBe(false);
    expect(flow({ id: 20, lpm: 10, length: 1000, c: 500 }).ok).toBe(false);
  });
});

describe('cut list', () => {
  test('kerf rule: last piece needs no cut after it', () => {
    expect(barNeed([3000, 3000], 3)).toBe(6003);
    expect(barNeed([], 3)).toBe(0);
  });
  test('two 3 m pieces fill a 6 m length only with no kerf', () => {
    expect(ok(cutList({ stock: 6000, kerf: 0, trim: 0, pieces: [{ length: 3000, qty: 2 }] })).bars).toHaveLength(1);
    expect(ok(cutList({ stock: 6000, kerf: 3, trim: 0, pieces: [{ length: 3000, qty: 2 }] })).bars).toHaveLength(2);
  });
  test('a perfectly packable list uses the minimum (7+3, 6+4, 5+2+2+1 into 10)', () => {
    const r = ok(cutList({ stock: 10, kerf: 0, trim: 0, pieces: [7, 6, 5, 4, 3, 2, 2, 1].map(length => ({ length, qty: 1 })) }));
    expect(r.bars).toHaveLength(3);
    expect(r.optimal).toBe(true);
  });
  test('matches an exhaustive search on 300 random small lists (with kerf)', () => {
    // Brute force: try every assignment of pieces to bars and keep the fewest bars that all fit.
    const brute = (ls: number[], usable: number, kerf: number) => {
      let best = ls.length;
      const sums: number[] = []; const ks: number[] = [];
      const go = (i: number) => {
        if (sums.length >= best) return;
        if (i === ls.length) { best = sums.length; return; }
        for (let j = 0; j < sums.length; j++) {
          if (sums[j]! + ls[i]! + kerf * ks[j]! <= usable + 1e-9) { sums[j] = sums[j]! + ls[i]!; ks[j] = ks[j]! + 1; go(i + 1); sums[j] = sums[j]! - ls[i]!; ks[j] = ks[j]! - 1; }
        }
        sums.push(ls[i]!); ks.push(1); go(i + 1); sums.pop(); ks.pop();
      };
      go(0);
      return best;
    };
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rnd() * 9);
      const ls = Array.from({ length: n }, () => 100 + Math.floor(rnd() * 2900));
      const kerf = Math.floor(rnd() * 4);
      const r = ok(cutList({ stock: 3000, kerf, trim: 0, pieces: ls.map(length => ({ length, qty: 1 })) }));
      expect(r.bars).toHaveLength(brute(ls, 3000, kerf));
      expect(r.optimal).toBe(true);
    }
  });
  test('every piece is placed exactly once and no bar overflows', () => {
    const pieces = [{ length: 1450, qty: 5 }, { length: 875, qty: 7 }, { length: 2210, qty: 3 }, { length: 330, qty: 9 }];
    const r = ok(cutList({ stock: 6000, kerf: 3, trim: 10, pieces }));
    expect(r.totalPieces).toBe(24);
    expect(r.bars.reduce((s, b) => s + b.pieces.length, 0)).toBe(24);
    for (const b of r.bars) expect(barNeed(b.pieces.map(p => p.length), 3)).toBeLessThanOrEqual(5990);
    expect(r.bars.length).toBeGreaterThanOrEqual(r.lowerBound);
    expect(r.bars.length).toBeLessThanOrEqual(r.lowerBound + 1);
  });
  test('large lists use the heuristic and stay valid', () => {
    const r = ok(cutList({ stock: 6000, kerf: 3, trim: 0, pieces: [{ length: 1234, qty: 120 }, { length: 777, qty: 80 }] }));
    expect(r.totalPieces).toBe(200);
    for (const b of r.bars) expect(barNeed(b.pieces.map(p => p.length), 3)).toBeLessThanOrEqual(6000);
  });
  test('invalid input', () => {
    expect(cutList({ stock: 0, kerf: 0, trim: 0, pieces: [{ length: 1, qty: 1 }] }).ok).toBe(false);
    expect(cutList({ stock: 100, kerf: -1, trim: 0, pieces: [{ length: 1, qty: 1 }] }).ok).toBe(false);
    expect(cutList({ stock: 100, kerf: 0, trim: 100, pieces: [{ length: 1, qty: 1 }] }).ok).toBe(false);
    expect(cutList({ stock: 100, kerf: 0, trim: 0, pieces: [] }).ok).toBe(false);
    expect(cutList({ stock: 100, kerf: 0, trim: 10, pieces: [{ length: 95, qty: 1 }] }).ok).toBe(false);
    expect(cutList({ stock: 100, kerf: 0, trim: 0, pieces: [{ length: 10, qty: 0 }] }).ok).toBe(false);
  });
});

describe('imperial flow units', () => {
  const { showVol, showFlow, showVel, showPressure, inFlow, inVel, showPerLength } = require('./flowUnits');
  test('round trips and known values', () => {
    expect(showVol(3.785411784, 'imperial')).toBeCloseTo(1, 12);
    expect(showFlow(37.85411784, 'imperial')).toBeCloseTo(10, 12); // 10 gpm
    expect(showVel(0.3048, 'imperial')).toBeCloseTo(1, 12);
    expect(showPressure(6.894757293168, 'imperial')).toBeCloseTo(1, 12);
    expect(inFlow(showFlow(123, 'imperial'), 'imperial')).toBeCloseTo(123, 9);
    expect(inVel(showVel(2.5, 'imperial'), 'imperial')).toBeCloseTo(2.5, 12);
    expect(showVol(5, 'metric')).toBe(5);
    // 1 in nominal Type L copper holds about 0.0406 gal/ft (ID 1.025 in: π/4·1.025²·12 in³ ÷ 231)
    const idMm = 1.025 * 25.4; const lpm = Math.PI / 4 * (idMm / 1000) ** 2 * 1000;
    expect(showPerLength(lpm, 'imperial')).toBeCloseTo(Math.PI / 4 * 1.025 ** 2 * 12 / 231, 6);
  });
});
