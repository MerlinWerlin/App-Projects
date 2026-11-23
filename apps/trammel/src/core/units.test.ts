import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFeetInches, formatInches, formatLength, formatMm, parseLength, parseMixedNumber, parseNumber, toInchFraction } from './units.ts';

const near = (a: number | null, b: number, tol = 1e-6) => assert.ok(a != null && Math.abs(a - b) <= tol, `${a} != ${b}`);

test('metric parsing', () => {
  near(parseLength('2400', 'metric'), 2400);
  near(parseLength('2,400', 'metric'), 2400);
  near(parseLength('2400mm', 'metric'), 2400);
  near(parseLength('240 cm', 'metric'), 2400);
  near(parseLength('2.4m', 'metric'), 2400);
  near(parseLength('2.4 M', 'metric'), 2400);
  near(parseLength('.5m', 'metric'), 500);
  near(parseLength('12.5', 'metric'), 12.5);
});

test('imperial parsing: inches, fractions, feet and inches', () => {
  near(parseLength('54 1/2', 'imperial'), 54.5 * 25.4);
  near(parseLength('54-1/2"', 'imperial'), 54.5 * 25.4);
  near(parseLength('3/4in', 'metric'), 19.05);
  near(parseLength(`4' 6 1/2"`, 'imperial'), 1384.3);
  near(parseLength('4ft 6in', 'metric'), 1371.6);
  near(parseLength(`4'`, 'metric'), 1219.2);
  near(parseLength(`4’ 6”`, 'metric'), 1371.6);
  near(parseLength('1 ft', 'metric'), 304.8);
});

test('parsing rejects nonsense', () => {
  for (const s of ['', '  ', 'abc', '-5', '1/0', '5 1/0', '2.4.5', '4\' x"', '12kg']) assert.equal(parseLength(s, 'metric'), null, s);
  assert.equal(parseMixedNumber('1/0'), null);
  assert.equal(parseNumber('45°'), 45);
  assert.equal(parseNumber('22,5'), 22.5);
  assert.equal(parseNumber('x'), null);
});

test('fractions round to the nearest tick and reduce', () => {
  assert.deepEqual({ ...toInchFraction(1384.3, 16), errorMm: 0 }, { whole: 54, num: 1, den: 2, errorMm: 0 });
  const f = toInchFraction(10, 16); // 0.3937 in -> 6/16 = 3/8
  assert.equal(f.whole, 0);
  assert.equal(f.num, 3);
  assert.equal(f.den, 8);
  assert.ok(Math.abs(f.errorMm - (0.375 * 25.4 - 10)) < 1e-9);
  const g = toInchFraction(10, 32); // 12.6/32 -> 13/32
  assert.equal(`${g.num}/${g.den}`, '13/32');
  assert.equal(toInchFraction(25.4 * 2.999, 16).whole, 3); // rounds up to a whole inch
  assert.equal(toInchFraction(25.4 * 2.999, 16).num, 0);
});

test('formatting', () => {
  assert.equal(formatInches(54.5 * 25.4), '54 1/2"');
  assert.equal(formatInches(25.4 * 3 / 16), '3/16"');
  assert.equal(formatInches(0), '0"');
  assert.equal(formatFeetInches(1384.3), `4' 6 1/2"`);
  assert.equal(formatFeetInches(304.8), `1' 0"`);
  assert.equal(formatFeetInches(25.4 * 6.5), '6 1/2"');
  assert.equal(formatMm(2400), '2,400 mm');
  assert.equal(formatMm(1234567.4), '1,234,567 mm');
  assert.equal(formatMm(12.345, 1), '12.3 mm');
  assert.equal(formatMm(-45), '-45 mm');
  assert.equal(formatMm(NaN), '-');
  assert.equal(formatLength(2400, 'metric'), '2,400 mm');
  assert.equal(formatLength(2400, 'imperial'), `7' 10 1/2"`);
  assert.equal(formatLength(100, 'imperial', 8), '3 7/8"'); // 3.937 in is nearer 3 7/8 than 4
});

test('limits round the safe way: a 220 mm minimum is never shown as 8 5/8 in', async () => {
  const { formatLimit } = await import('./units.ts');
  assert.equal(formatLimit(220, 'imperial', 8, 'min'), '8 3/4"'); // 8.661 in -> up to 8 3/4
  assert.equal(formatLimit(355, 'imperial', 8, 'max'), '13 7/8"'); // 13.976 in -> down to 13 7/8
  assert.equal(formatLimit(239.2, 'metric', 16, 'min'), '240 mm');
  assert.equal(formatLimit(340.8, 'metric', 16, 'max'), '340 mm');
});
