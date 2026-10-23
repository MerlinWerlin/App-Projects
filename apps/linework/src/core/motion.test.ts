import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { crossedDetent, duration, focusHidden, percentLabel, spring, staggerDelay } from './motion.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('motion tokens match the polish spec', () => {
  assert.equal(duration.fast, 120);
  assert.equal(duration.base, 200);
  assert.equal(duration.slow, 320);
  assert.ok(spring.damping >= 16 && spring.damping <= 20);
  assert.ok(spring.stiffness >= 200 && spring.stiffness <= 240);
});

test('staggerDelay: 30 ms steps, first 8 items only', () => {
  assert.equal(staggerDelay(0), 0);
  assert.equal(staggerDelay(3), 90);
  assert.equal(staggerDelay(7), 210);
  assert.equal(staggerDelay(8), null);
  assert.equal(staggerDelay(-1), null);
  assert.equal(staggerDelay(NaN), null);
});

test('crossedDetent ticks on 25/50/75/100 both ways', () => {
  assert.equal(crossedDetent(20, 30), 25);
  assert.equal(crossedDetent(30, 20), 25);
  assert.equal(crossedDetent(40, 50), 50);
  assert.equal(crossedDetent(50, 55), null, 'leaving a detent does not tick');
  assert.equal(crossedDetent(10, 80), 75, 'fast drag reports the furthest detent');
  assert.equal(crossedDetent(90, 10), 25);
  assert.equal(crossedDetent(60, 70), null);
  assert.equal(crossedDetent(99, 100), 100);
  assert.equal(crossedDetent(5, 5), null);
});

test('percentLabel clamps and rounds', () => {
  assert.equal(percentLabel(0.504), '50%');
  assert.equal(percentLabel(1.2), '100%');
  assert.equal(percentLabel(-1), '0%');
  assert.equal(percentLabel(NaN), '0%');
});

test('focusHidden: only after idle, never while holding or disabled', () => {
  assert.equal(focusHidden({ enabled: true, holding: false, lastTouchAt: 0, now: 2999 }), false);
  assert.equal(focusHidden({ enabled: true, holding: false, lastTouchAt: 0, now: 3000 }), true);
  assert.equal(focusHidden({ enabled: true, holding: true, lastTouchAt: 0, now: 9000 }), false);
  assert.equal(focusHidden({ enabled: false, holding: false, lastTouchAt: 0, now: 9000 }), false);
});

test('polish adds no new native dependency (docs/POLISH.md; expo-blur/linear-gradient allowed by D72-2)', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const name of ['lottie-react-native', 'moti']) {
    assert.ok(!(name in pkg.dependencies), `${name} must not be added without a lockfile/PC verification`);
  }
});

test('theme motion module re-exports the core tokens', () => {
  const src = readFileSync(join(root, 'src', 'theme', 'motion.ts'), 'utf8');
  assert.match(src, /from '\.\.\/core\/motion'/);
  assert.match(src, /useReduceMotion/);
});
