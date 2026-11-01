import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AA_LARGE, contrast } from '../theme/contrast.ts';
import { dark, light } from '../theme/tokens.ts';
import { POI_PIN_STYLES } from './poipins.ts';
import { isWheelchairToilet, TOILET_PIN_STYLES, toiletLegend, toiletPinStyle, type ToiletPinTone } from './toiletpins.ts';

test('accessible toilets get their own glyph and colour, distinct from ordinary toilets', () => {
  const a = TOILET_PIN_STYLES.accessible;
  const o = TOILET_PIN_STYLES.toilet;
  assert.notEqual(a.icon, o.icon);
  assert.notEqual(a.tone, o.tone);
  for (const th of [light, dark]) assert.notEqual(th[a.tone], th[o.tone], `${th.dark ? 'dark' : 'light'}: different colours`);
  // Ordinary toilets keep the Map tab's toilet glyph; the accessible glyph is not used by any Map place kind.
  assert.equal(o.icon, POI_PIN_STYLES.toilets.icon);
  assert.ok(!Object.values(POI_PIN_STYLES).some((s) => s.icon === a.icon));
  for (const s of [a, o]) assert.match(s.icon, /^[a-z]+(-[a-z]+)*$/);
});

test('only a clear wheelchair yes (or designated) makes the accessible pin', () => {
  for (const v of ['yes', 'Yes', ' designated ']) assert.ok(isWheelchairToilet({ wheelchair: v }), v);
  for (const v of [undefined, '', 'limited', 'no', 'maybe']) assert.ok(!isWheelchairToilet({ wheelchair: v }), String(v));
  assert.deepEqual(toiletPinStyle({ wheelchair: 'yes' }), { kind: 'accessible', icon: 'accessibility', tone: 'sea' });
  assert.deepEqual(toiletPinStyle({ wheelchair: 'limited' }), { kind: 'toilet', icon: 'male-female', tone: 'ok' });
  assert.deepEqual(toiletPinStyle({}), { kind: 'toilet', icon: 'male-female', tone: 'ok' });
});

test('saved and closed keep their old colours but the accessible glyph stays', () => {
  assert.deepEqual(toiletPinStyle({ wheelchair: 'yes' }, { saved: true }), { kind: 'accessible', icon: 'accessibility', tone: 'warn' });
  assert.deepEqual(toiletPinStyle({ wheelchair: 'yes' }, { closed: true }), { kind: 'accessible', icon: 'accessibility', tone: 'muted' });
  assert.deepEqual(toiletPinStyle({}, { saved: true, closed: true }), { kind: 'toilet', icon: 'male-female', tone: 'warn' });
  assert.deepEqual(toiletPinStyle({}, { closed: true }).tone, 'muted');
});

test('legend lists only the kinds on the map, accessible first', () => {
  assert.deepEqual(toiletLegend([]), []);
  assert.deepEqual(toiletLegend([{}, { wheelchair: 'no' }]), ['toilet']);
  assert.deepEqual(toiletLegend([{}, { wheelchair: 'yes' }]), ['accessible', 'toilet']);
  assert.deepEqual(toiletLegend([{ wheelchair: 'designated' }]), ['accessible']);
});

/** Hue of a #RRGGBB colour in degrees, and the smaller gap between two hues. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}

// A typical map ground (system map paper), as in poipins.test.ts and src/theme/contrast.test.ts.
const GROUND = { light: ['#F5F2EC', '#FFFFFF', '#E8E4DA'], dark: ['#242733', '#1B1E27', '#30333D'] } as const;

test('toilet pin colours read on the map and the page, and the card-coloured glyph reads on them (light + dark)', () => {
  const tones: ToiletPinTone[] = ['sea', 'ok', 'warn', 'muted'];
  const fails: string[] = [];
  for (const th of [light, dark]) {
    const name = th.dark ? 'dark' : 'light';
    for (const tone of tones) {
      const fill = th[tone];
      for (const bg of [th.paper, th.card, ...GROUND[name]]) {
        const r = contrast(fill, bg);
        if (r < AA_LARGE) fails.push(`${name} ${tone} pin on ${bg}: ${r.toFixed(2)}`);
      }
      const glyph = contrast(th.card, fill);
      if (glyph < AA_LARGE) fails.push(`${name} ${tone} glyph: ${glyph.toFixed(2)}`);
    }
    // The two kinds must also differ in colour at rest (not only by glyph): hues at least 45 degrees apart.
    const apart = hueGap(th[TOILET_PIN_STYLES.accessible.tone], th[TOILET_PIN_STYLES.toilet.tone]);
    if (apart < 45) fails.push(`${name} accessible vs ordinary hues too close: ${apart.toFixed(0)}`);
  }
  assert.deepEqual(fails, []);
});
