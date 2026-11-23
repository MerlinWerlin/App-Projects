import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convertLengths, inputsInUnits, UNITS_KEY } from './inputs.ts';
import { parseLength } from './units.ts';

test('a length typed in metric keeps its size when the units switch to imperial and back', () => {
  const v = { rise: '2700', code: 'au-house', going: '' };
  const imp = convertLengths(v, ['rise', 'going'], 'metric', 'imperial', 16);
  assert.equal(imp.rise, '106 5/16"');
  assert.equal(imp.going, '');
  assert.equal(imp.code, 'au-house');
  assert.ok(Math.abs(parseLength(imp.rise, 'imperial')! - 2700) < 1);
  const back = convertLengths(imp, ['rise'], 'imperial', 'metric', 16);
  assert.ok(Math.abs(Number(back.rise) - 2700) < 1);
});

test('cut-list rows convert their lengths and keep names and quantities', () => {
  const rows = JSON.stringify([{ l: '2400', q: '8', n: 'Studs' }, { l: 'oops', q: '1' }]);
  const out = JSON.parse(convertLengths({ pieces: rows }, ['pieces'], 'metric', 'imperial', 16).pieces);
  assert.equal(out[0].l, '94 1/2"');
  assert.equal(out[0].n, 'Studs');
  assert.equal(out[0].q, '8');
  assert.equal(out[1].l, 'oops');
});

test('stored inputs without units are treated as metric; stored units are respected', () => {
  const a = inputsInUnits({ rise: '2700' }, ['rise'], 'imperial', 16);
  assert.equal(a.rise, '106 5/16"');
  assert.equal(a[UNITS_KEY], 'imperial');
  const b = inputsInUnits({ rise: '108', [UNITS_KEY]: 'imperial' }, ['rise'], 'imperial', 16);
  assert.equal(b.rise, '108');
});
