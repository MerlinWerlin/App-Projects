import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hexToHsv, hsvToHex, normalizeHex, recentColors } from './colors.ts';

test('hex entry accepts shorthand and full hex, rejects incomplete and non-colours', () => {
  assert.equal(normalizeHex(' aB3 '), '#AABB33');
  assert.equal(normalizeHex('#12abef'), '#12ABEF');
  for (const v of ['', '#', '12', '#1234', 'red', '#ggffff', null, 123]) assert.equal(normalizeHex(v), null);
});
test('HSV covers primaries, wrapped hues, greys and exact RGB round trips', () => {
  for (const [h, col] of [[0, '#FF0000'], [60, '#FFFF00'], [120, '#00FF00'], [180, '#00FFFF'], [240, '#0000FF'], [300, '#FF00FF'], [360, '#FF0000'], [-60, '#FF00FF']] as const) {
    assert.equal(hsvToHex({ h, s: 1, v: 1 }), col);
  }
  assert.equal(hsvToHex({ h: 200, s: 0, v: 0.5 }), '#808080');
  assert.equal(hsvToHex({ h: 50, s: 2, v: -1 }), '#000000');
  for (const c of ['#000000', '#FFFFFF', '#B5523B', '#010203', '#E7CDA1', '#13579B']) assert.equal(hsvToHex(hexToHsv(c)), c);
});
test('recent colours survive malformed old settings, deduplicate and retain the latest ten', () => {
  assert.deepEqual(recentColors(null), []);
  assert.deepEqual(recentColors(['#abc', '#AABBCC', false, '#000000'], 'aabbcc'), ['#AABBCC', '#000000']);
  const history = Array.from({ length: 14 }, (_, i) => `#${i.toString(16).padStart(6, '0')}`);
  assert.equal(recentColors(history).length, 10);
  assert.equal(recentColors(history, '#FFFFFF')[0], '#FFFFFF');
});
