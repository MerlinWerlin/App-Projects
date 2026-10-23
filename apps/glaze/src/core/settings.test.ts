import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  defaultSettings,
  parseSettings,
  patchSettings,
  sanitizeSettings,
  serializeSettings,
  shouldReduceMotion,
} from './settings.ts';

test('storage key is versioned', () => {
  assert.equal(SETTINGS_KEY, 'glaze.settings.v1');
});

test('defaults: haptics on, reduce motion follows the system', () => {
  assert.deepEqual(defaultSettings(), { haptics: true, reduceMotion: 'system' });
  assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
  const d = defaultSettings();
  d.haptics = false;
  assert.equal(DEFAULT_SETTINGS.haptics, true, 'defaultSettings returns a copy');
});

test('parseSettings falls back on missing or broken JSON', () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings(''), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('{not json'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('[]'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('42'), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings('null'), DEFAULT_SETTINGS);
});

test('sanitizeSettings keeps valid fields and repairs bad ones individually', () => {
  assert.deepEqual(sanitizeSettings({ haptics: false, reduceMotion: 'on' }), { haptics: false, reduceMotion: 'on' });
  assert.deepEqual(sanitizeSettings({ haptics: 'no', reduceMotion: 'off' }), { haptics: true, reduceMotion: 'off' });
  assert.deepEqual(sanitizeSettings({ haptics: false, reduceMotion: 'sometimes' }), { haptics: false, reduceMotion: 'system' });
  assert.deepEqual(sanitizeSettings({ haptics: false, extra: 1 }), { haptics: false, reduceMotion: 'system' });
});

test('serialize/parse round-trips and drops unknown fields', () => {
  const s = { haptics: false, reduceMotion: 'off' as const };
  assert.deepEqual(parseSettings(serializeSettings(s)), s);
  const withExtra = { ...s, junk: true } as unknown as typeof s;
  assert.deepEqual(JSON.parse(serializeSettings(withExtra)), { haptics: false, reduceMotion: 'off' });
});

test('patchSettings applies a partial change and sanitizes it', () => {
  const base = defaultSettings();
  assert.deepEqual(patchSettings(base, { haptics: false }), { haptics: false, reduceMotion: 'system' });
  const bad = patchSettings(base, { reduceMotion: 'nope' as unknown as 'on' });
  assert.equal(bad.reduceMotion, 'system');
  assert.equal(base.haptics, true, 'input is not mutated');
});

test('shouldReduceMotion honours an explicit choice, else the OS', () => {
  const s = defaultSettings();
  assert.equal(shouldReduceMotion(s, true), true);
  assert.equal(shouldReduceMotion(s, false), false);
  assert.equal(shouldReduceMotion({ ...s, reduceMotion: 'on' }, false), true);
  assert.equal(shouldReduceMotion({ ...s, reduceMotion: 'off' }, true), false);
});
