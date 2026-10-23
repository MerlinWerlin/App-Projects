import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OUTLINE_STYLE,
  OUTLINE_STYLES,
  STYLE_OPTIONS,
  isOutlineStyle,
  parseStyleParam,
  presetForStyle,
} from './outlineStyleParam.ts';
import { PRESETS, presetSettings } from './outlinePresets.ts';

test('T54: default style is classic (Best match), unchanged', () => {
  assert.equal(DEFAULT_OUTLINE_STYLE, 'classic');
  assert.equal(presetForStyle(DEFAULT_OUTLINE_STYLE), 'best');
});

test('T54: parseStyleParam accepts the four styles only', () => {
  for (const s of OUTLINE_STYLES) assert.equal(parseStyleParam(s), s);
  assert.equal(parseStyleParam(' Sketch '), 'sketch');
  assert.equal(parseStyleParam(['lineart', 'bold']), 'lineart');
  for (const bad of [undefined, null, '', 'undefined', 'boldlines', 'best', 'xdog', 1, {}, [], [3]]) {
    assert.equal(parseStyleParam(bad), undefined, String(bad));
  }
  assert.equal(isOutlineStyle('bold'), true);
  assert.equal(isOutlineStyle('Bold'), false);
});

test('T54: each style starts a preset that uses that engine', () => {
  for (const s of OUTLINE_STYLES) {
    const id = presetForStyle(s);
    assert.ok(PRESETS.some((p) => p.id === id), id);
    assert.equal(presetSettings(id).style, s);
  }
  assert.deepEqual(STYLE_OPTIONS.map((o) => o.preset), ['best', 'sketch', 'lineart', 'boldlines']);
});
