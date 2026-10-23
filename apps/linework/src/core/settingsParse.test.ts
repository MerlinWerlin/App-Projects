import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settingsParse.ts';

test('T64: focusLock defaults to on', () => {
  assert.equal(DEFAULT_SETTINGS.focusLock, true);
  assert.equal(sanitizeSettings(undefined).focusLock, true);
  assert.equal(sanitizeSettings(null).focusLock, true);
  assert.equal(sanitizeSettings({}).focusLock, true);
  // Settings saved before T64 (no focusLock field) get the default.
  assert.equal(sanitizeSettings({ defaultOpacity: 0.3, haptics: false, keepAwake: true, gridDefault: '3x3' }).focusLock, true);
});

test('T64: focusLock parses booleans only', () => {
  assert.equal(sanitizeSettings({ focusLock: false }).focusLock, false);
  assert.equal(sanitizeSettings({ focusLock: true }).focusLock, true);
  for (const bad of ['false', 0, 1, null, {}, []]) assert.equal(sanitizeSettings({ focusLock: bad }).focusLock, true);
});

test('settings parser keeps the other fields', () => {
  const s = sanitizeSettings({ defaultOpacity: 5, haptics: false, keepAwake: false, gridDefault: '4x4', focusLock: false });
  assert.deepEqual(s, { defaultOpacity: 1, haptics: false, keepAwake: false, gridDefault: '4x4', focusLock: false, outlineStyle: 'classic' });
  assert.equal(sanitizeSettings({ defaultOpacity: 0 }).defaultOpacity, 0.05);
  assert.equal(sanitizeSettings({ gridDefault: '5x5' }).gridDefault, 'off');
  assert.deepEqual(sanitizeSettings('junk'), DEFAULT_SETTINGS);
  assert.notEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test('T54 / D72-1: outlineStyle defaults to classic (Best match) and parses valid styles only', () => {
  assert.equal(DEFAULT_SETTINGS.outlineStyle, 'classic');
  assert.equal(sanitizeSettings({}).outlineStyle, 'classic');
  // Settings saved before T54 keep the old default.
  assert.equal(sanitizeSettings({ defaultOpacity: 0.3, focusLock: false }).outlineStyle, 'classic');
  for (const s of ['classic', 'sketch', 'lineart', 'bold'] as const) assert.equal(sanitizeSettings({ outlineStyle: s }).outlineStyle, s);
  for (const bad of ['boldlines', 'Sketch', '', 3, null, true, ['sketch']]) {
    assert.equal(sanitizeSettings({ outlineStyle: bad }).outlineStyle, 'classic');
  }
});
