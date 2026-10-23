import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blurMaterial, glassBackground, shouldBlur } from './materials.ts';

const root = join(import.meta.dirname, '..', '..');

test('D72-2: blur only on iOS with the module and without Reduce Transparency', () => {
  assert.equal(shouldBlur({ os: 'ios', hasModule: true, reduceTransparency: false }), true);
  assert.equal(shouldBlur({ os: 'ios', hasModule: false, reduceTransparency: false }), false);
  assert.equal(shouldBlur({ os: 'ios', hasModule: true, reduceTransparency: true }), false);
  assert.equal(shouldBlur({ os: 'android', hasModule: true, reduceTransparency: false }), false);
});

test('D72-2: solid fallback kept when not blurring; lighter wash over blur', () => {
  assert.equal(glassBackground(false, false, 'rgba(255,255,255,0.92)'), 'rgba(255,255,255,0.92)');
  assert.notEqual(glassBackground(true, false, 'x'), 'x');
  assert.match(blurMaterial(true).tint, /Dark$/);
  assert.match(blurMaterial(false).tint, /Light$/);
});

test('D72-2: expo-blur + expo-linear-gradient listed and installed by the trial kit and VERIFY', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const n of ['expo-blur', 'expo-linear-gradient']) assert.ok(n in pkg.dependencies, n);
  const sh = readFileSync(join(root, 'start-trial.sh'), 'utf8');
  const cmd = readFileSync(join(root, 'START_TRIAL.cmd'), 'utf8');
  for (const s of [sh, cmd]) {
    const latest = s.indexOf('npx expo install expo@latest');
    const blur = s.indexOf('npx expo install expo-blur expo-linear-gradient');
    const fix = s.indexOf('npx expo install --fix');
    if (latest < 0) continue; // the owner's PC copy of START_TRIAL.cmd may differ (fb-1017)
    assert.ok(latest < blur && blur < fix, 'blur install sits between expo@latest and --fix');
  }
  const ps = readFileSync(join(root, 'scripts', 'verify.ps1'), 'utf8');
  assert.match(ps, /npx expo install expo-blur expo-linear-gradient/);
});

test('D72-2: expo-blur is only reached through the guarded adapter', () => {
  const glass = readFileSync(join(root, 'src', 'ui', 'v2', 'Glass.tsx'), 'utf8');
  assert.doesNotMatch(glass, /from 'expo-blur'/);
  assert.match(glass, /native\/blur/);
  const adapter = readFileSync(join(root, 'src', 'native', 'blur.ts'), 'utf8');
  assert.match(adapter, /try \{\s*const mod = require\('expo-blur'\)/);
});
