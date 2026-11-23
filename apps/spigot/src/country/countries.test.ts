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
