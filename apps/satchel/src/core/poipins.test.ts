import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AA_LARGE, contrast } from '../theme/contrast.ts';
import { dark, light } from '../theme/tokens.ts';
import { OFFERED_POI_CATEGORIES } from './packpois.ts';
import { POI_PIN_FALLBACK, POI_PIN_STYLES, poiPinStyle } from './poipins.ts';

test('every offered category has its own glyph and a theme tone', () => {
  const icons = OFFERED_POI_CATEGORIES.map((c) => POI_PIN_STYLES[c].icon);
  assert.equal(new Set(icons).size, icons.length, 'no two categories share a glyph');
  for (const c of OFFERED_POI_CATEGORIES) {
    const s = poiPinStyle(c);
    assert.match(s.icon, /^[a-z]+(-[a-z]+)*$/, c);
    assert.ok(s.tone in light && s.tone in dark, `${c}: ${s.tone} is a token`);
  }
  assert.ok(!icons.includes(POI_PIN_FALLBACK.icon));
});

test('unknown categories fall back to the plain sea pin', () => {
  assert.deepEqual(poiPinStyle('wifi_hotspot'), POI_PIN_FALLBACK);
  assert.deepEqual(poiPinStyle(''), POI_PIN_FALLBACK);
  assert.deepEqual(poiPinStyle('__proto__'), POI_PIN_FALLBACK);
});

// A typical map ground (system map paper), as in src/theme/contrast.test.ts.
const GROUND = { light: ['#F5F2EC', '#FFFFFF', '#E8E4DA'], dark: ['#242733', '#1B1E27', '#30333D'] } as const;

test('pin colours read on the map and the page, and the card-coloured glyph reads on them (light + dark)', () => {
  const fails: string[] = [];
  for (const th of [light, dark]) {
    const name = th.dark ? 'dark' : 'light';
    for (const c of OFFERED_POI_CATEGORIES) {
      const fill = th[POI_PIN_STYLES[c].tone];
      for (const bg of [th.paper, th.card, ...GROUND[name]]) {
        const r = contrast(fill, bg);
        if (r < AA_LARGE) fails.push(`${name} ${c} pin on ${bg}: ${r.toFixed(2)}`);
      }
      const glyph = contrast(th.card, fill);
      if (glyph < AA_LARGE) fails.push(`${name} ${c} glyph: ${glyph.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails, []);
});
