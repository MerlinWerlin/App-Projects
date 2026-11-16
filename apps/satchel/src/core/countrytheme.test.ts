import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COUNTRY_THEMES, countryThemeSpec, MOTIFS, PARTICLES, particleFor, seasonOf, THEME_LEAD_DAYS, themeCountry, themePick, tripCountry, tripPick } from './countrytheme.ts';
import { demoTrip } from './demo.ts';
import type { Trip } from './model.ts';

// The demo trip: Sydney -> Tokyo -> Kyoto, 3 Nov 2026 onwards (about a week).
const japan = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
/** The same trip moved to another zone (every non-home booking). */
const movedTo = (trip: Trip, tz: string, id = tz): Trip => ({
  ...trip,
  id,
  items: trip.items.map((i) => ({
    ...i,
    start: i.start.tz === trip.homeTz ? i.start : { ...i.start, tz },
    end: i.end ? (i.end.tz === trip.homeTz ? i.end : { ...i.end, tz }) : undefined,
  })),
});

const REQUIRED = ['JP', 'FR', 'IT', 'GB', 'US', 'AU', 'NZ', 'TH', 'ID', 'MX', 'ES', 'GR', 'KR', 'VN', 'CA'];
const EXTRA = ['PT', 'DE', 'IE', 'NL', 'CH', 'IN', 'SG', 'FJ', 'IS', 'TR'];

test('every required and extra country has a theme with a real motif and particles', () => {
  for (const iso of [...REQUIRED, ...EXTRA]) {
    const s = COUNTRY_THEMES[iso];
    assert.ok(s, iso);
    assert.equal(s.iso2, iso);
    assert.ok((MOTIFS as readonly string[]).includes(s.motif), `${iso} motif`);
    assert.ok(s.particles.all in PARTICLES, `${iso} particle`);
    for (const k of Object.values(s.particles)) assert.ok(k in PARTICLES, `${iso} ${k}`);
    for (const p of s.paints) assert.match(p, /^#[0-9A-F]{6}$/);
    assert.ok(s.accent.h >= 0 && s.accent.h < 360 && s.accent.s > 0 && s.accent.s <= 1);
  }
  // one motif per country, no two alike
  const motifs = Object.values(COUNTRY_THEMES).map((s) => s.motif);
  assert.equal(new Set(motifs).size, motifs.length);
  for (const p of Object.values(PARTICLES)) {
    assert.ok(p.shapes.length > 0 && p.paints.length > 0);
    for (const c of p.paints) assert.match(c, /^#[0-9A-F]{6}$/);
  }
});

test('country lookup takes any case; unknown countries get the default look', () => {
  assert.equal(countryThemeSpec('jp')?.iso2, 'JP');
  assert.equal(countryThemeSpec('ZZ'), null);
  assert.equal(countryThemeSpec('BR'), null, 'not themed (yet): default look');
  assert.equal(countryThemeSpec(null), null);
});

test('seasons by hemisphere; tropical places have none', () => {
  assert.equal(seasonOf(4, 'north'), 'spring');
  assert.equal(seasonOf(7, 'north'), 'summer');
  assert.equal(seasonOf(11, 'north'), 'autumn');
  assert.equal(seasonOf(1, 'north'), 'winter');
  assert.equal(seasonOf(12, 'north'), 'winter');
  assert.equal(seasonOf(10, 'south'), 'spring');
  assert.equal(seasonOf(1, 'south'), 'summer');
  assert.equal(seasonOf(4, 'south'), 'autumn');
  assert.equal(seasonOf(7, 'south'), 'winter');
  assert.equal(seasonOf(4, 'tropical'), null);
});

test('particles follow the month: Japan blossoms, fireflies, maple, snow; Australia wattle in its spring', () => {
  const jp = COUNTRY_THEMES.JP;
  assert.equal(particleFor(jp, 4), 'sakura');
  assert.equal(particleFor(jp, 7), 'firefly');
  assert.equal(particleFor(jp, 11), 'maple');
  assert.equal(particleFor(jp, 1), 'snow');
  assert.equal(particleFor(COUNTRY_THEMES.KR, 10), 'maple');
  assert.equal(particleFor(COUNTRY_THEMES.CA, 6), 'maple');
  assert.equal(particleFor(COUNTRY_THEMES.CA, 1), 'snow');
  assert.equal(particleFor(COUNTRY_THEMES.AU, 10), 'wattle');
  assert.equal(particleFor(COUNTRY_THEMES.AU, 4), 'gumleaf');
  assert.equal(particleFor(COUNTRY_THEMES.TH, 1), 'lantern');
  assert.equal(particleFor(COUNTRY_THEMES.TH, 8), 'lantern');
});

test('themeCountry: the focus trip themes the app while on and within the lead window, not before or after', () => {
  assert.equal(tripCountry(japan), 'JP');
  assert.equal(themeCountry([japan], '2026-11-05'), 'JP', 'on now');
  assert.equal(themeCountry([japan], '2026-11-03'), 'JP', 'starts today');
  assert.equal(themeCountry([japan], '2026-10-01'), 'JP', '33 days before');
  assert.equal(themeCountry([japan], '2026-09-19'), 'JP', `exactly ${THEME_LEAD_DAYS} days before`);
  assert.equal(themeCountry([japan], '2026-09-18'), null, 'too far ahead');
  assert.equal(themeCountry([japan], '2026-12-31'), null, 'over');
  assert.equal(themeCountry([], '2026-11-05'), null);
});

test('themeCountry: unknown or home-only destinations keep the default look; the trip on now wins', () => {
  assert.equal(themeCountry([movedTo(japan, 'America/Sao_Paulo')], '2026-11-05'), null);
  const home: Trip = { ...movedTo(japan, japan.homeTz), id: 'home' };
  assert.equal(themeCountry([home], '2026-11-05'), null);
  const paris = movedTo(japan, 'Europe/Paris', 'paris');
  const later = { ...paris, startDate: '2026-11-20', endDate: '2026-11-25' };
  assert.equal(themeCountry([later, japan], '2026-11-05'), 'JP');
  assert.equal(themeCountry([later, japan], '2026-11-15'), 'FR', 'next trip after Japan ends');
  assert.equal(themeCountry([movedTo(japan, 'Asia/Makassar')], '2026-11-05'), 'ID', 'Bali');
  assert.equal(themeCountry([movedTo(japan, 'Pacific/Auckland')], '2026-11-05'), 'NZ');
});

test('themePick: the particle is for the month you will be there', () => {
  assert.equal(themePick([japan], '2026-11-05')?.particle, 'maple');
  const spring = { ...japan, startDate: '2027-04-02', endDate: '2027-04-09' };
  const pick = themePick([spring], '2027-03-10');
  assert.equal(pick?.spec.iso2, 'JP');
  assert.equal(pick?.month, 4);
  assert.equal(pick?.particle, 'sakura');
  assert.equal(themePick([spring], '2026-11-05'), null);
  assert.equal(tripPick(spring)?.particle, 'sakura', 'a trip screen shows its own country whatever the date');
  assert.equal(tripPick(movedTo(japan, 'America/Sao_Paulo')), null);
});
