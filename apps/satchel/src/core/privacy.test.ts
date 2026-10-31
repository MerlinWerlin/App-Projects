import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COVER_STATES, coverAction, coversApp } from './privacy.ts';

test('inactive and background cover; active and anything else do not', () => {
  assert.equal(coversApp('inactive'), true);
  assert.equal(coversApp('background'), true);
  for (const s of ['active', 'unknown', 'extension', '', null, undefined, 'Background']) assert.equal(coversApp(s), false, String(s));
  assert.deepEqual([...COVER_STATES].sort(), ['background', 'inactive']);
  for (const s of COVER_STATES) assert.equal(coversApp(s), true);
});

test('a private screen shows the cover at once when the app leaves the foreground', () => {
  assert.equal(coverAction(false, 'inactive', true), 'show');
  assert.equal(coverAction(false, 'background', true), 'show');
  // inactive -> background keeps it up
  assert.equal(coverAction(true, 'background', true), 'stay');
  assert.equal(coverAction(true, 'inactive', true), 'stay');
});

test('back to active fades the cover away; nothing to do if it was not up', () => {
  assert.equal(coverAction(true, 'active', true), 'fade');
  assert.equal(coverAction(false, 'active', true), 'stay');
});

test('unknown and extension states leave the cover as it is', () => {
  for (const s of ['unknown', 'extension', undefined]) {
    assert.equal(coverAction(true, s, true), 'stay');
    assert.equal(coverAction(false, s, true), 'stay');
  }
});

test('without a private screen it never shows, and an existing cover fades', () => {
  for (const s of ['inactive', 'background', 'active']) {
    assert.equal(coverAction(false, s, false), 'stay');
    assert.equal(coverAction(true, s, false), 'fade');
  }
});
