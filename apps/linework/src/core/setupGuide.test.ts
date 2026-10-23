import test from 'node:test';
import assert from 'node:assert/strict';
import { clampStep, isLastStep, SETUP_GUIDE_STEPS, slideFrom, startGuide, stepGuide } from './setupGuide.ts';

const N = SETUP_GUIDE_STEPS.length;

test('four steps in setup order with unique ids and copy', () => {
  assert.deepEqual(
    SETUP_GUIDE_STEPS.map((s) => s.id),
    ['stand', 'pick', 'lock', 'trace'],
  );
  for (const s of SETUP_GUIDE_STEPS) {
    assert.ok(s.title.trim().length > 0 && s.body.trim().length > 0, s.id);
    assert.ok(s.title.length <= 32, `${s.id} title short enough for a heading`);
    assert.ok(s.body.length <= 200, `${s.id} body stays a quick read`);
  }
});

test('copy covers the market issues: stand height, opacity + lock, tap to bring controls back, Lightbox', () => {
  const body = (id: string) => SETUP_GUIDE_STEPS.find((s) => s.id === id)?.body ?? '';
  assert.match(body('stand'), /20–30 cm/);
  assert.match(body('stand'), /glass/);
  assert.match(body('pick'), /template/);
  assert.match(body('lock'), /opacity/);
  assert.match(body('lock'), /Lock/);
  assert.match(body('trace'), /tap once/);
  assert.match(body('trace'), /Lightbox/);
});

test('next walks forward and finishes on the last step', () => {
  let nav = startGuide();
  assert.deepEqual(nav, { index: 0, closed: false, finished: false });
  for (let i = 1; i < N; i++) {
    nav = stepGuide(nav, 'next', N);
    assert.deepEqual(nav, { index: i, closed: false, finished: false });
  }
  nav = stepGuide(nav, 'next', N);
  assert.deepEqual(nav, { index: N - 1, closed: true, finished: true });
  assert.equal(stepGuide(nav, 'back', N), nav, 'closed guide ignores actions');
});

test('back stops at the first step; skip closes without finishing', () => {
  assert.equal(stepGuide(startGuide(), 'back', N).index, 0);
  const two = stepGuide(stepGuide(startGuide(), 'next', N), 'next', N);
  assert.equal(stepGuide(two, 'back', N).index, 1);
  assert.deepEqual(stepGuide(two, 'skip', N), { index: 2, closed: true, finished: false });
});

test('clampStep and isLastStep handle odd input', () => {
  assert.equal(clampStep(-3, N), 0);
  assert.equal(clampStep(99, N), N - 1);
  assert.equal(clampStep(Number.NaN, N), 0);
  assert.equal(clampStep(2, 0), 0);
  assert.equal(isLastStep(N - 1, N), true);
  assert.equal(isLastStep(0, N), false);
  assert.equal(isLastStep(0, 0), false);
  assert.deepEqual(stepGuide({ index: 0, closed: false, finished: false }, 'next', 0), { index: 0, closed: true, finished: true });
});

test('slideFrom mirrors for right-to-left and is zero with reduced motion', () => {
  assert.equal(slideFrom(true, false, 24, false), 24);
  assert.equal(slideFrom(false, false, 24, false), -24);
  assert.equal(slideFrom(true, true, 24, false), -24);
  assert.equal(slideFrom(false, true, 24, false), 24);
  assert.equal(slideFrom(true, false, 24, true), 0);
  assert.equal(slideFrom(true, true, -24, false), -24);
});
