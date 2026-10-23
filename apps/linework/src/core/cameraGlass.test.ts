import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMERA_FALLBACK, CAMERA_WASH, cameraBlurMaterial, cameraGlass, cameraGlassFill } from './cameraGlass.ts';
import { contrastRatio, parseColor } from './contrast.ts';

const root = join(import.meta.dirname, '..', '..');

const alpha = (c: string) => parseColor(c).a;

test('T91: camera controls use the dark ultra-thin material', () => {
  assert.equal(cameraBlurMaterial().tint, 'systemUltraThinMaterialDark');
  assert.ok(cameraBlurMaterial().intensity > 0);
});

test('T91: no blur keeps the v1 dark-glass fills exactly', () => {
  assert.equal(cameraGlassFill(false, 'pill'), 'rgba(20,19,15,0.55)');
  assert.equal(cameraGlassFill(false, 'banner'), 'rgba(20,19,15,0.82)');
  assert.equal(cameraGlassFill(false, 'sheet'), 'rgba(20,19,15,0.94)');
});

test('T91: wash over blur is lighter than the fallback but at least 30%', () => {
  for (const k of ['pill', 'banner', 'sheet'] as const) {
    assert.equal(cameraGlassFill(true, k), CAMERA_WASH[k]);
    assert.ok(alpha(CAMERA_WASH[k]) < alpha(CAMERA_FALLBACK[k]), k);
    assert.ok(alpha(CAMERA_WASH[k]) >= 0.3, k);
  }
});

test('T91: sheet text stays AA on the solid sheet fallback over a white camera frame', () => {
  for (const fg of [cameraGlass.text, cameraGlass.muted]) {
    assert.ok(contrastRatio(fg, CAMERA_FALLBACK.sheet, '#FFFFFF') >= 4.5, fg);
  }
  assert.ok(contrastRatio(cameraGlass.onPrimary, cameraGlass.primary) >= 4.5);
});

test('T91: the camera preview and overlay layers are not wrapped in camera glass', () => {
  const src = readFileSync(join(root, 'app', 'trace.tsx'), 'utf8');
  const cam = src.indexOf('<CameraView');
  assert.ok(cam > 0);
  // The camera stays a direct child of the root view: nothing glass between the root and it.
  const before = src.slice(src.lastIndexOf('return (', cam), cam);
  assert.doesNotMatch(before, /CameraGlass|Camera(Button|Pill|Sheet)/);
});
