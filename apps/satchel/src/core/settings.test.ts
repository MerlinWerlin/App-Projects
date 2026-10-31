import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_THRESHOLD, MIN_THRESHOLD } from './battery.ts';
import { APPEARANCES, DEFAULT_APP_PREFS, formatPercent, isAppearance, normaliseAppPrefs, resolveScheme, stepThreshold, thresholdLimits } from './settings.ts';

test('threshold steps by 0.05 and stays between 0.05 and 0.5', () => {
  assert.equal(stepThreshold(0.2, 1), 0.25);
  assert.equal(stepThreshold(0.2, -1), 0.15);
  assert.equal(stepThreshold(MAX_THRESHOLD, 1), MAX_THRESHOLD);
  assert.equal(stepThreshold(MIN_THRESHOLD, -1), MIN_THRESHOLD);
  assert.equal(stepThreshold(0.1, -1), 0.05);
  assert.equal(stepThreshold(0.45, 1), 0.5);
});

test('repeated steps never drift off the grid', () => {
  let v = 0.05;
  for (let i = 0; i < 20; i++) v = stepThreshold(v, 1);
  assert.equal(v, 0.5);
  for (let i = 0; i < 3; i++) v = stepThreshold(v, -1);
  assert.equal(v, 0.35);
});

test('odd stored values snap to the grid; junk falls back to the default', () => {
  assert.equal(stepThreshold(0.23, 1), 0.3);
  assert.equal(stepThreshold(0.99, -1), 0.45);
  assert.equal(stepThreshold('x', 1), 0.25);
  assert.equal(stepThreshold(Number.NaN, -1), 0.15);
});

test('stepper limits at each end', () => {
  assert.deepEqual(thresholdLimits(0.2), { canLower: true, canRaise: true });
  assert.deepEqual(thresholdLimits(MIN_THRESHOLD), { canLower: false, canRaise: true });
  assert.deepEqual(thresholdLimits(MAX_THRESHOLD), { canLower: true, canRaise: false });
  assert.deepEqual(thresholdLimits(0.01), { canLower: false, canRaise: true });
});

test('formatPercent shows a whole percent in the locale', () => {
  assert.equal(formatPercent(0.2, 'en'), '20%');
  assert.equal(formatPercent(0.05, 'en'), '5%');
  assert.equal(formatPercent(0.9, 'en'), '50%');
  assert.match(formatPercent(0.2, 'de'), /^20\s?%$/);
});

test('appearance: System follows the phone, Light and Dark override it', () => {
  assert.equal(resolveScheme('system', 'dark'), 'dark');
  assert.equal(resolveScheme('system', 'light'), 'light');
  assert.equal(resolveScheme('system', null), 'light');
  assert.equal(resolveScheme('light', 'dark'), 'light');
  assert.equal(resolveScheme('dark', 'light'), 'dark');
  assert.equal(resolveScheme('sepia', 'dark'), 'dark');
  assert.equal(resolveScheme(undefined, undefined), 'light');
});

test('stored prefs from older builds gain the appearance default; junk is replaced', () => {
  assert.deepEqual(normaliseAppPrefs({ haptics: false }), { haptics: false, appearance: 'system', language: 'system', languageHintSeen: false, sleepBed: '23:00', sleepWake: '07:00' });
  assert.deepEqual(normaliseAppPrefs({ haptics: true, appearance: 'dark' }), { haptics: true, appearance: 'dark', language: 'system', languageHintSeen: false, sleepBed: '23:00', sleepWake: '07:00' });
  assert.deepEqual(normaliseAppPrefs({ haptics: 'no', appearance: 'blue' }), DEFAULT_APP_PREFS);
  assert.deepEqual(normaliseAppPrefs(null), DEFAULT_APP_PREFS);
  assert.deepEqual(normaliseAppPrefs([1]), DEFAULT_APP_PREFS);
  assert.ok(APPEARANCES.every(isAppearance));
});
