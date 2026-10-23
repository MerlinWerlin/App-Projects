// Keys the trace / prepare / lightbox screens build from core ids at runtime (tDynamic) must exist in the English
// catalogue, so a new preset, photo kind, background mode or sketch step can't silently fall back to English.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EN } from './catalogs.ts';
import { BACKGROUNDS, KINDS, PRESETS, thicknessName } from '../core/outlinePresets.ts';
import { SKETCH_STEPS } from '../core/sketchSteps.ts';
import { MIX_PRESETS } from '../core/compare.ts';

function has(key: string): void {
  assert.ok(EN[key] !== undefined, `missing English key ${key}`);
}

test('prepare: every preset, photo kind and background has catalogue text', () => {
  for (const p of PRESETS) {
    has(`prepare.preset.${p.id}.name`);
    has(`prepare.preset.${p.id}.description`);
  }
  for (const k of KINDS) {
    has(`prepare.kind.${k.id}`);
    has(`prepare.kind.${k.id}.hint`);
  }
  for (const b of BACKGROUNDS) {
    has(`prepare.background.${b.id}.name`);
    has(`prepare.background.${b.id}.hint`);
  }
  for (const px of [0.5, 1, 2, 4, 8]) has(`prepare.thickness.${thicknessName(px)}`);
});

test('trace: every sketch step and compare preset has catalogue text', () => {
  for (const s of SKETCH_STEPS) has(`trace.steps.name.${s.id}`);
  for (const p of MIX_PRESETS) has(`trace.compare.preset.${p.id}`);
});

test('English fallbacks in core match the catalogue', () => {
  for (const p of PRESETS) assert.equal(EN[`prepare.preset.${p.id}.name`], p.label);
  for (const k of KINDS) assert.equal(EN[`prepare.kind.${k.id}`], k.label);
  for (const s of SKETCH_STEPS) assert.equal(EN[`trace.steps.name.${s.id}`], s.name);
});
