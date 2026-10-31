import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  chipsFor,
  cleanInput,
  convertSize,
  convertUnit,
  decimalMark,
  defaultDirection,
  defaultSystem,
  findPair,
  findSizes,
  formatPlain,
  formatResult,
  homeSizeSystem,
  lookupSize,
  normaliseSizeChart,
  normaliseUnitsTab,
  pairsFor,
  parseNumber,
  resultDigits,
  roundTo,
  SIZE_CHART_IDS,
  SIZE_CHARTS,
  sizeOptions,
  swapUnits,
  toggleSign,
  UNIT_IDS,
  UNIT_PAIRS,
  UNIT_TABS,
  UNITS,
  valueToInput,
} from './units.ts';

const near = (a: number | null, b: number, eps = 1e-9) => {
  assert.ok(a != null, 'expected a number');
  assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
};

test('temperature: fixed points and round trip', () => {
  near(convertUnit(0, 'c', 'f'), 32);
  near(convertUnit(100, 'c', 'f'), 212);
  near(convertUnit(-40, 'c', 'f'), -40);
  near(convertUnit(98.6, 'f', 'c'), 37);
  near(convertUnit(-273.15, 'c', 'f'), -459.67);
  for (const x of [-50, -17.5, 0, 21.3, 37, 1000]) near(convertUnit(convertUnit(x, 'c', 'f') as number, 'f', 'c'), x);
});

test('linear units: known values', () => {
  near(convertUnit(1, 'mi', 'km'), 1.609344);
  near(convertUnit(1, 'ft', 'm'), 0.3048);
  near(convertUnit(1, 'in', 'cm'), 2.54);
  near(convertUnit(100, 'kmh', 'mph'), 62.13711922373339);
  near(convertUnit(1, 'lb', 'kg'), 0.45359237);
  near(convertUnit(16, 'oz', 'lb'), 1);
  near(convertUnit(23, 'kg', 'lb'), 50.70632030242089);
  near(convertUnit(1, 'usgal', 'l'), 3.785411784);
  near(convertUnit(1, 'ukgal', 'l'), 4.54609);
  near(convertUnit(128, 'floz', 'usgal'), 1);
  near(convertUnit(100, 'ml', 'floz'), 3.3814022701843, 1e-12);
  near(convertUnit(1, 'km', 'm'), 1000);
});

test('every pair round-trips every quick pick and the edges', () => {
  for (const p of UNIT_PAIRS) {
    for (const x of [...p.chipsA, 0, 1e-6, 1e9]) near(convertUnit(convertUnit(x, p.a, p.b) as number, p.b, p.a), x, 1e-9);
    for (const x of p.chipsB) near(convertUnit(convertUnit(x, p.b, p.a) as number, p.a, p.b), x, 1e-9);
    assert.equal(UNITS[p.a].dim, UNITS[p.b].dim, p.id);
    assert.equal(UNITS[p.a].system, 'metric', p.id);
    assert.equal(UNITS[p.b].system, 'imperial', p.id);
  }
});

test('convertUnit refuses mixed dimensions and non-finite values', () => {
  assert.equal(convertUnit(1, 'km', 'kg'), null);
  assert.equal(convertUnit(1, 'c', 'km'), null);
  assert.equal(convertUnit(1, 'kmh', 'km'), null);
  assert.equal(convertUnit(Number.NaN, 'km', 'mi'), null);
  assert.equal(convertUnit(Number.POSITIVE_INFINITY, 'c', 'f'), null);
  assert.equal(convertUnit(5, 'km', 'km'), 5);
  near(convertUnit(-5, 'km', 'mi'), -3.1068559611866697);
});

test('tabs and pairs: every tab but sizes has pairs, every unit is used', () => {
  for (const tab of UNIT_TABS) assert.equal(pairsFor(tab).length > 0, tab !== 'sizes', tab);
  const used = new Set(UNIT_PAIRS.flatMap((p) => [p.a, p.b]));
  for (const u of UNIT_IDS) assert.ok(used.has(u), u);
  assert.equal(new Set(UNIT_PAIRS.map((p) => p.id)).size, UNIT_PAIRS.length);
  assert.equal(findPair('km-mi')?.b, 'mi');
  assert.equal(findPair('nope'), null);
  assert.equal(findPair(null), null);
});

test('remembered tab and size chart are normalised', () => {
  assert.equal(normaliseUnitsTab('weight'), 'weight');
  assert.equal(normaliseUnitsTab('bogus'), 'temp');
  assert.equal(normaliseUnitsTab(null), 'temp');
  assert.equal(normaliseUnitsTab(3), 'temp');
  assert.equal(normaliseSizeChart('menShoes'), 'menShoes');
  assert.equal(normaliseSizeChart({}), 'womenTops');
});

test('unit system from the home country', () => {
  assert.equal(defaultSystem('US'), 'imperial');
  assert.equal(defaultSystem('lr'), 'imperial');
  assert.equal(defaultSystem('MM'), 'imperial');
  assert.equal(defaultSystem('AU'), 'metric');
  assert.equal(defaultSystem('GB'), 'metric');
  assert.equal(defaultSystem(null), 'metric');
  assert.equal(defaultSystem(null, 'f'), 'imperial');
  assert.equal(defaultSystem('DE', 'f'), 'metric', 'a set home country wins over the weather setting');
  assert.equal(defaultSystem('  ', 'c'), 'metric');
});

test('default direction gives results in the home system; swap flips', () => {
  const p = findPair('km-mi')!;
  assert.deepEqual(defaultDirection(p, 'imperial'), { from: 'km', to: 'mi' });
  assert.deepEqual(defaultDirection(p, 'metric'), { from: 'mi', to: 'km' });
  assert.deepEqual(swapUnits({ from: 'km', to: 'mi' }), { from: 'mi', to: 'km' });
  assert.deepEqual(swapUnits(swapUnits({ from: 'c', to: 'f' })), { from: 'c', to: 'f' });
  assert.deepEqual(chipsFor(p, 'km'), p.chipsA);
  assert.deepEqual(chipsFor(p, 'mi'), p.chipsB);
});

test('parseNumber: decimal point and decimal comma', () => {
  assert.equal(parseNumber('12.5'), 12.5);
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber('12,5', ','), 12.5);
  assert.equal(parseNumber(' 0,75 '), 0.75);
  assert.equal(parseNumber(',5'), 0.5);
  assert.equal(parseNumber('.5'), 0.5);
  assert.equal(parseNumber('12,'), 12, 'a trailing mark while typing');
  assert.equal(parseNumber('12.'), 12);
  assert.equal(parseNumber('0,500'), 0.5);
});

test('parseNumber: grouping, signs and the three-digit case', () => {
  assert.equal(parseNumber('1,500'), 1500, 'English: comma then three digits is grouping');
  assert.equal(parseNumber('1,500', ','), 1.5, 'German: comma is the decimal');
  assert.equal(parseNumber('1.500', ','), 1500);
  assert.equal(parseNumber('1.500'), 1.5);
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber('1,234.5'), 1234.5);
  assert.equal(parseNumber('1,234,567'), 1234567);
  assert.equal(parseNumber('1.234.567'), 1234567);
  assert.equal(parseNumber('1 234,5'), 1234.5);
  assert.equal(parseNumber("1'234.5"), 1234.5);
  assert.equal(parseNumber('-12'), -12);
  assert.equal(parseNumber('−12,5'), -12.5, 'typographic minus');
  assert.equal(parseNumber('+3'), 3);
  assert.equal(parseNumber('-0'), 0);
  assert.ok(!Object.is(parseNumber('-0'), -0));
});

test('parseNumber: junk is null', () => {
  for (const bad of ['', ' ', '-', '.', ',', 'abc', '12a', '1.2.3,4', '1,2,3', '1..2', '--1', '1-2', '١٢']) assert.equal(parseNumber(bad), null, bad);
  assert.equal(parseNumber(undefined), null);
  assert.equal(parseNumber(12 as unknown), null);
  assert.equal(parseNumber('9'.repeat(40)), null);
});

test('input helpers', () => {
  assert.equal(cleanInput('12abc,5°'), '12,5');
  assert.equal(cleanInput('1'.repeat(30)).length, 16);
  assert.equal(toggleSign('12'), '-12');
  assert.equal(toggleSign('-12'), '12');
  assert.equal(toggleSign(''), '-');
  assert.equal(toggleSign('-'), '');
  assert.equal(valueToInput(21.1, ','), '21,1');
  assert.equal(valueToInput(21.1, '.'), '21.1');
  assert.equal(valueToInput(98.6, ','), '98,6');
  assert.equal(valueToInput(-10, '.'), '-10');
});

test('decimal mark per language', () => {
  assert.equal(decimalMark('en'), '.');
  assert.equal(decimalMark('de'), ',');
  assert.equal(decimalMark('fr'), ',');
  assert.equal(decimalMark('ja'), '.');
  assert.equal(decimalMark('not a tag!!'), '.');
});

test('results: digits, rounding and locale format', () => {
  assert.equal(resultDigits(3.2, 'km'), 3);
  assert.equal(resultDigits(32, 'km'), 2);
  assert.equal(resultDigits(320, 'km'), 1);
  assert.equal(resultDigits(3200, 'km'), 0);
  assert.equal(resultDigits(3200, 'f'), 1);
  assert.equal(roundTo(-0.0001, 2), 0);
  assert.ok(!Object.is(roundTo(-0.0001, 2), -0));
  assert.equal(formatResult(62.137119, 'mph', 'en'), '62.14');
  assert.equal(formatResult(62.137119, 'mph', 'de'), '62,14');
  assert.equal(formatResult(1609.344, 'm', 'en'), '1,609');
  assert.equal(formatResult(212, 'f', 'en'), '212');
  assert.equal(formatResult(-17.7778, 'c', 'en'), '-17.8');
  assert.equal(formatResult(-0.01, 'c', 'en'), '0');
  assert.equal(formatResult(0.0001, 'kg', 'en'), '0');
});

test('plain values keep up to three decimals in the language format', () => {
  assert.equal(formatPlain(98.6, 'en'), '98.6');
  assert.equal(formatPlain(21.1, 'de'), '21,1');
  assert.equal(formatPlain(35000, 'en'), '35,000');
  assert.equal(formatPlain(-10, 'en'), '-10');
  assert.equal(formatPlain(0.12345, 'en'), '0.123');
});

test('size charts: well formed', () => {
  for (const id of SIZE_CHART_IDS) {
    const c = SIZE_CHARTS[id];
    assert.equal(c.id, id);
    assert.ok(c.rows.length >= 6, id);
    for (const r of c.rows) for (const s of c.systems) assert.ok(r[s], `${id} ${s}`);
    // Numeric columns rise down the chart.
    for (const s of c.systems) {
      const vals = c.rows.map((r) => r[s] as string);
      if (!vals.every((v) => /^\d+(\.\d+)?$/.test(v))) continue;
      for (let i = 1; i < vals.length; i++) assert.ok(Number(vals[i]) > Number(vals[i - 1]), `${id} ${s} row ${i}`);
    }
  }
});

test('size lookups: exact matches across systems', () => {
  const ws = SIZE_CHARTS.womenShoes;
  assert.equal(convertSize(ws, 'eu', '38', 'us'), '7.5');
  assert.equal(convertSize(ws, 'eu', '38', 'uk'), '5');
  assert.equal(convertSize(ws, 'eu', '38', 'jp'), '24');
  assert.equal(convertSize(ws, 'us', '7,5', 'eu'), '38', 'decimal comma');
  assert.equal(convertSize(SIZE_CHARTS.menShoes, 'uk', '9', 'eu'), '43');
  assert.equal(convertSize(SIZE_CHARTS.menShoes, 'us', '10', 'jp'), '27.5');
  assert.equal(convertSize(SIZE_CHARTS.womenTops, 'uk', '12', 'eu'), '40');
  assert.equal(convertSize(SIZE_CHARTS.womenTops, 'us', '0', 'jp'), '3');
  assert.equal(convertSize(SIZE_CHARTS.menTops, 'intl', 'm', 'eu'), '48', 'letters ignore case');
  assert.equal(convertSize(SIZE_CHARTS.menTops, 'jp', '3l', 'intl'), 'XL');
  assert.equal(convertSize(SIZE_CHARTS.menTops, 'intl', 'xxxl', 'jp'), '5L');
  assert.equal(findSizes(ws, 'eu', '38.0').length, 1);
});

test('size lookups: one letter covering two rows gives a range', () => {
  assert.equal(findSizes(SIZE_CHARTS.womenTops, 'intl', 'M').length, 2);
  assert.equal(convertSize(SIZE_CHARTS.womenTops, 'intl', 'M', 'eu'), '38–40');
  assert.deepEqual(sizeOptions(SIZE_CHARTS.womenTops, 'intl'), ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']);
});

test('nearest size: between sizes, ties go up, too far is null', () => {
  const ws = SIZE_CHARTS.womenShoes;
  const half = lookupSize(ws, 'eu', '38,5');
  assert.equal(half?.exact, false);
  assert.equal(half?.size, '39', 'a tie goes up a size');
  assert.equal(lookupSize(ws, 'eu', '38.2')?.size, '38');
  assert.equal(lookupSize(ws, 'eu', '38')?.exact, true);
  assert.equal(lookupSize(ws, 'eu', '34')?.size, '35', 'just below the chart snaps to the smallest');
  assert.equal(lookupSize(ws, 'eu', '44')?.size, '43');
  assert.equal(lookupSize(ws, 'eu', '60'), null);
  assert.equal(lookupSize(ws, 'eu', '10'), null);
  assert.equal(lookupSize(ws, 'eu', ''), null);
  assert.equal(lookupSize(SIZE_CHARTS.menTops, 'intl', 'XXXXL'), null);
  assert.equal(lookupSize(SIZE_CHARTS.menTops, 'uk', '39')?.size, '40');
  assert.equal(convertSize(SIZE_CHARTS.menShoes, 'jp', '27', 'eu'), '43', '27 is as near 26.5 as 27.5: up');
});

test('home size system', () => {
  assert.equal(homeSizeSystem('US', SIZE_CHARTS.womenShoes), 'us');
  assert.equal(homeSizeSystem('gb', SIZE_CHARTS.menTops), 'uk');
  assert.equal(homeSizeSystem('JP', SIZE_CHARTS.menShoes), 'jp');
  assert.equal(homeSizeSystem('FR', SIZE_CHARTS.menShoes), 'eu');
  assert.equal(homeSizeSystem(null, SIZE_CHARTS.womenTops), 'eu');
});
