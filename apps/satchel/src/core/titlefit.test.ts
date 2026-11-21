import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brokeMidWord, nextTitleScale, TITLE_MIN_SCALE } from './titlefit.ts';

test('brokeMidWord: a word split across lines is caught; breaks between words are fine', () => {
  assert.equal(brokeMidWord(['Emergenc', 'y']), true);
  assert.equal(brokeMidWord(['Da', 'y 2 ', 'of ', '9']), true);
  assert.equal(brokeMidWord(['Day 2 of 9 ', 'in Tokyo']), false);
  assert.equal(brokeMidWord(['Tokyo & ', 'Kyoto']), false);
  assert.equal(brokeMidWord(['Show-', 'a-local']), false);
  assert.equal(brokeMidWord(['Emergency']), false);
  assert.equal(brokeMidWord([]), false);
});

test('nextTitleScale: shrinks a step while split, holds once whole, never below the floor', () => {
  assert.equal(nextTitleScale(1, ['Emergenc', 'y']), 0.9);
  assert.equal(nextTitleScale(0.9, ['Emergency']), 0.9);
  assert.equal(nextTitleScale(TITLE_MIN_SCALE, ['Emergenc', 'y']), TITLE_MIN_SCALE);
});
