import { COUNTRY_LIST, PROFILES, countryFromRegion, profileFor } from './countries';
import { takeoff, validFitting } from '../calc/cut';
import { pipeId } from '../calc/reference';

test('device regions map to supported countries; everything else is generic', () => {
  expect(countryFromRegion('AU')).toBe('AU');
  expect(countryFromRegion('nz')).toBe('NZ');
  expect(countryFromRegion('UK')).toBe('GB');
  expect(countryFromRegion('GB')).toBe('GB');
  expect(countryFromRegion('US')).toBe('US');
  expect(countryFromRegion('FR')).toBe('OTHER');
  expect(countryFromRegion(undefined)).toBe('OTHER');
  expect(countryFromRegion('OTHER')).toBe('OTHER');
  expect(profileFor(null).code).toBe('OTHER');
});

describe.each(COUNTRY_LIST)('country %s', code => {
  const p = PROFILES[code];
  test('profile is complete and self-consistent', () => {
    expect(p.code).toBe(code);
    expect(p.name.length).toBeGreaterThan(1);
    expect(p.codeName.length).toBeGreaterThan(3);
    expect(p.checkNote).toMatch(/check/i);
    expect(['metric', 'imperial']).toContain(p.defaultUnit);
    expect(p.stockLengthMm).toBeGreaterThan(1000);
    expect(p.commonGrades.length).toBeGreaterThan(1);
    expect(() => new Intl.DateTimeFormat(p.locale)).not.toThrow();
  });
  test('limits are either sourced or absent (generic guidance)', () => {
    if (p.minGrades) {
      expect(p.minGrades.source.length).toBeGreaterThan(10);
      for (const r of p.minGrades.rules) expect(r.n).toBeGreaterThan(10);
    }
    if (p.maxVelocity) {
      expect(p.maxVelocity.source.length).toBeGreaterThan(10);
      for (const v of p.maxVelocity.rules) expect(v.max).toBeGreaterThan(0.5);
    }
  });
  test('materials catalogue has valid pipes and fittings', () => {
    expect(p.pipes.length).toBeGreaterThan(0);
    for (const pipe of p.pipes) expect(pipeId(pipe)).toBeGreaterThan(0);
    for (const f of p.fittings) { expect(validFitting(f)).toBeNull(); expect(takeoff(f)).toBeGreaterThan(0); }
    expect(p.materialsNote.length).toBeGreaterThan(10);
    if (!p.materialsVerified) expect(p.materialsNote).toMatch(/generic|not checked/i);
  });
  test('no retailer names leak into user-facing text', () => {
    const text = [p.name, p.codeName, p.checkNote, p.materialsNote, p.minGrades?.source ?? '', p.maxVelocity?.source ?? '', ...p.pipes.map(x => x.note), ...p.fittings.map(f => f.note ?? '')].join(' ');
    expect(text).not.toMatch(/bunnings|reece|tradelink|home depot|lowe'?s|screwfix|toolstation|b&q|wickes|mitre 10|placemakers|rona|home hardware|chadwicks|woodie|ferguson|plumb center|city plumbing/i);
  });
});

test('Australia: metric, NCC velocity limit and AS/NZS 3500.2 grades', () => {
  const au = PROFILES.AU;
  expect(au.defaultUnit).toBe('metric');
  expect(au.maxVelocity?.rules.find(r => /cold/i.test(r.service))?.max).toBe(3);
  expect(au.minGrades?.rules.find(r => r.size === 'DN100')?.n).toBe(60);
  expect(au.materialsVerified).toBe(true);
});

describe('country-specific values match their sources', () => {
  const grade = (code: keyof typeof PROFILES, size: string) => PROFILES[code].minGrades?.rules.find(r => r.size === size)?.n;
  test('New Zealand: G13/AS2 Table 2 drains (DN100 1:120, not 1:60), metric, no unverified velocity', () => {
    expect(grade('NZ', 'DN100 drain')).toBe(120);
    expect(grade('NZ', 'DN150 drain')).toBe(200);
    expect(grade('NZ', 'DN100 discharge pipe')).toBe(60);
    expect(PROFILES.NZ.maxVelocity).toBeNull();
    expect(PROFILES.NZ.pipes.find(p => p.id === 'nzpex-20')?.id_mm).toBe(15.2);
  });
  test('United Kingdom: ADH Table 6, 3 m stock, copper EN 1057, no fitting table', () => {
    expect(grade('GB', '100 mm')).toBe(40);
    expect(grade('GB', '100 mm (1 WC+)')).toBe(80);
    expect(PROFILES.GB.stockLengthMm).toBe(3000);
    expect(PROFILES.GB.pipes.find(p => p.id === 'en-cu-22')?.id_mm).toBeCloseTo(20.2, 9);
    expect(PROFILES.GB.fittings).toHaveLength(0);
  });
  test('Ireland: TGD H Table 6 differs from the UK', () => {
    expect(grade('IE', '100 mm (1 dwelling)')).toBe(60);
    expect(grade('IE', '150 mm (3 to 8)')).toBe(150);
    expect(PROFILES.IE.materialsVerified).toBe(false);
  });
  test('United States: imperial, IPC slopes in inches per foot, gallons, Charlotte take-offs', () => {
    const us = PROFILES.US;
    expect(us.defaultUnit).toBe('imperial');
    expect(us.terms.fall).toBe('Slope');
    expect(us.terms.centre).toBe('center');
    expect(grade('US', '2½ in or less')).toBe(48);
    expect(12 / 48).toBe(0.25); // 1:48 is 1/4 in per ft
    expect(us.gradeLabel?.(48)).toBe('¼″/ft');
    expect(us.usGallons).toBe(true);
    expect(us.maxVelocity?.rules[0]?.max).toBeCloseTo(8 * 0.3048, 2);
    const bend = us.fittings.find(f => f.id === 'us-pvc-2-14bend')!;
    expect(takeoff(bend)).toBeCloseTo(58.7, 6);
    expect(bend.engagement).toBe(19.05);
    expect(us.pipes.find(p => p.id === 'us-cuL-12')?.id_mm).toBeCloseTo(13.85, 2);
  });
  test('Canada: NPC 1 in 50 for 3 in and smaller, litres for flow, no Type K', () => {
    expect(grade('CA', '3 in or less')).toBe(50);
    expect(PROFILES.CA.usGallons).toBe(false);
    expect(PROFILES.CA.pipes.some(p => p.material === 'Copper Type K')).toBe(false);
    expect(PROFILES.CA.stockLengthMm).toBe(3658); // 12 ft
  });
  test('Somewhere else: generic everything', () => {
    expect(PROFILES.OTHER.minGrades).toBeNull();
    expect(PROFILES.OTHER.maxVelocity).toBeNull();
    expect(PROFILES.OTHER.materialsVerified).toBe(false);
  });
});
