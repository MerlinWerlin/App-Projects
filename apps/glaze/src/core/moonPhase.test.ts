import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOON_PHASES, REFERENCE_NEW_MOON_MS, SYNODIC_DAYS, daysToFull, moonInfo } from './moonPhase.ts';

test('known new and full moons land in the right bucket', () => {
  // Published dates (UTC): new moon 2024-04-08 18:21, full moon 2024-04-23 23:49,
  // full moon 2025-11-05 13:19, new moon 2026-01-18 19:52.
  assert.equal(moonInfo(new Date(Date.UTC(2024, 3, 8, 18, 21))).phase, 'new');
  assert.equal(moonInfo(new Date(Date.UTC(2024, 3, 23, 23, 49))).phase, 'full');
  assert.equal(moonInfo(new Date(Date.UTC(2025, 10, 5, 13, 19))).phase, 'full');
  assert.equal(moonInfo(new Date(Date.UTC(2026, 0, 18, 19, 52))).phase, 'new');
});

test('illumination is near 0 at new and near 1 at full', () => {
  assert.ok(moonInfo(new Date(Date.UTC(2024, 3, 8, 18, 21))).illumination < 0.03);
  assert.ok(moonInfo(new Date(Date.UTC(2024, 3, 23, 23, 49))).illumination > 0.97);
});

test('age is always inside one cycle, before and after the reference', () => {
  for (const ms of [REFERENCE_NEW_MOON_MS - 5e11, REFERENCE_NEW_MOON_MS, Date.UTC(2030, 5, 1)]) {
    const m = moonInfo(new Date(ms));
    assert.ok(m.age >= 0 && m.age < SYNODIC_DAYS);
    assert.ok(MOON_PHASES.includes(m.phase));
    assert.equal(m.labelKey, `widgets.moon.${m.phase}`);
  }
});

test('days to full is 0..30', () => {
  for (let i = 0; i < 40; i++) {
    const d = daysToFull(new Date(Date.UTC(2026, 10, 1 + i)));
    assert.ok(d >= 0 && d <= 30, String(d));
  }
});

test('Swift MoonPhase uses the same constants', () => {
  const swift = readFileSync('targets/widget/MoonPhase.swift', 'utf8');
  assert.match(swift, /29\.530588853/);
  assert.match(swift, /947182440/); // REFERENCE_NEW_MOON_MS / 1000
  assert.equal(REFERENCE_NEW_MOON_MS / 1000, 947182440);
});
