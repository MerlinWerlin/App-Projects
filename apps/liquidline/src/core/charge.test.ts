import { test } from 'node:test';
import assert from 'node:assert/strict';
import { additionalCharge, fixedOrificeTargetK, subcooling, superheat, targetLiquidLineC } from './charge.ts';
import { satPressure } from './pt.ts';

const metric = { pressure: 'kPa' as const, temp: 'C' as const, gauge: true, atmKpa: 101.325 };
const imperial = { pressure: 'psi' as const, temp: 'F' as const, gauge: true, atmKpa: 101.325 };

test('worked example: R32 superheat, kPa gauge and °C', () => {
  // R32 saturates at 5 °C at NIST 951.1 kPa abs → 849.8 kPa gauge. Line at 12 °C → 7 K superheat.
  const g = satPressure('R32', 5)! - 101.325;
  const r = superheat('R32', g, 12, metric);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok(Math.abs(r.satC - 5) < 0.01, `sat ${r.satC}`);
  assert.ok(Math.abs(r.valueK - 7) < 0.01, `sh ${r.valueK}`);
  assert.ok(r.steps.some((s) => s.label.includes('atmosphere')));
  assert.ok(r.steps.some((s) => s.label.startsWith('Superheat = 12.0 − 5.0')));
});

test('worked example: R410A subcooling in psig / °F uses the bubble point', () => {
  // Published Arkema chart: R410A 100 °F → 318.6 psig (liquid). Line at 90 °F → 10 °F subcooling.
  const r = subcooling('R410A', 318.6, 90, imperial);
  assert.ok(r.ok);
  if (!r.ok) return;
  const satF = (r.satC * 9) / 5 + 32;
  assert.ok(Math.abs(satF - 100) < 0.3, `sat ${satF} °F`);
  const scF = (r.valueK * 9) / 5;
  assert.ok(Math.abs(scF - 10) < 0.3, `sc ${scF} °F`);
});

test('zeotrope: R407C superheat uses dew, subcooling uses bubble (glide matters)', () => {
  const p = 500 - 101.325; // 500 kPa abs as gauge
  const sh = superheat('R407C', p, 10, metric);
  const sc = subcooling('R407C', p, -10, metric);
  assert.ok(sh.ok && sc.ok);
  if (!sh.ok || !sc.ok) return;
  assert.ok(sh.satC - sc.satC > 5, `dew ${sh.satC} should be well above bubble ${sc.satC}`);
});

test('absolute mode adds no atmosphere', () => {
  const abs = { ...metric, gauge: false };
  const r = superheat('R32', satPressure('R32', 0)!, 5, abs);
  assert.ok(r.ok && Math.abs(r.satC) < 0.01 && Math.abs(r.valueK - 5) < 0.01);
});

test('altitude: a lower atmosphere gives a lower absolute pressure and saturation', () => {
  const sea = superheat('R32', 800, 10, metric);
  const high = superheat('R32', 800, 10, { ...metric, atmKpa: 85 });
  assert.ok(sea.ok && high.ok);
  if (sea.ok && high.ok) assert.ok(high.satC < sea.satC);
});

test('targets give verdicts and notes', () => {
  const g = satPressure('R32', 5)! - 101.325;
  const ok = superheat('R32', g, 11, metric, 6);
  assert.ok(ok.ok && ok.verdict === 'ok');
  const low = subcooling('R32', satPressure('R32', 40)! - 101.325, 39, metric, 5);
  assert.ok(low.ok && low.verdict === 'low' && /undercharge/.test(low.note ?? ''));
  const high = subcooling('R32', satPressure('R32', 40)! - 101.325, 30, metric, 5);
  assert.ok(high.ok && high.verdict === 'high');
});

test('edge cases: negative superheat warns, bad inputs explain, vacuum readings refused', () => {
  const g = satPressure('R32', 5)! - 101.325;
  const neg = superheat('R32', g, 2, metric);
  assert.ok(neg.ok && neg.verdict === 'warn' && neg.valueK < 0);
  const nan = superheat('R32', Number.NaN, 10, metric);
  assert.ok(!nan.ok && /Enter/.test(nan.error));
  const below = superheat('R32', -200, 10, metric);
  assert.ok(!below.ok && /vacuum/.test(below.error));
  const out = subcooling('R32', 99999, 10, metric);
  assert.ok(!out.ok && /outside/.test(out.error));
  const unknown = superheat('R999', 500, 10, metric);
  assert.ok(!unknown.ok);
});

test('fixed-orifice target superheat follows the published chart formula', () => {
  // 67 °F WB indoor, 85 °F DB outdoor → (201 − 80 − 85) / 2 = 18 °F = 10 K.
  const k = fixedOrificeTargetK(((67 - 32) * 5) / 9, ((85 - 32) * 5) / 9)!;
  assert.ok(Math.abs(k - 10) < 0.01, `${k}`);
  // Hot outside, dry inside → too low to charge by superheat.
  assert.equal(fixedOrificeTargetK(((57 - 32) * 5) / 9, ((105 - 32) * 5) / 9), null);
  assert.equal(fixedOrificeTargetK(Number.NaN, 30), null);
});

test('additional charge: worked examples in metric and imperial', () => {
  const a = additionalCharge(25, 10, 20);
  assert.ok(a.ok && a.extraG === 300 && a.extraLengthM === 15);
  // 50 ft run, pre-charged for 15 ft, 0.6 oz/ft (55.8 g/m) → 21 oz.
  const ft = 0.3048;
  const b = additionalCharge(50 * ft, 15 * ft, (0.6 * 28.349523125) / ft, null, { length: 'ft', mass: 'oz' });
  assert.ok(b.ok);
  if (b.ok) {
    assert.ok(Math.abs(b.extraG / 28.349523125 - 21) < 0.01);
    assert.ok(b.steps.some((s) => s.value.includes('oz')) && b.steps.some((s) => s.value.includes('ft')));
  }
  const short = additionalCharge(5, 10, 20);
  assert.ok(short.ok && short.extraG === 0 && /Shorter/.test(short.note ?? ''));
  const long = additionalCharge(60, 10, 20, 50);
  assert.ok(long.ok && /maximum/.test(long.note ?? ''));
  assert.ok(!additionalCharge(-1, 10, 20).ok);
  assert.ok(!additionalCharge(Number.NaN, 10, 20).ok);
});

test('target liquid line temperature', () => {
  const t = targetLiquidLineC('R32', satPressure('R32', 40)!, 5)!;
  assert.ok(Math.abs(t - 35) < 0.01);
  assert.equal(targetLiquidLineC('R32', -1, 5), null);
});
