import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as U from './units.ts';
import { btuhToW } from './units.ts';
import { judgeDecay, checklistFor, EVAC_CHECKLIST } from './evac.ts';
import { estimateLoad, nextSizeBtu, nextSizeKw } from './load.ts';
import { neededLength, planCoils } from './lineset.ts';
import { addReading, jobText, newJob, parseJobs, removeReading, upsertJob } from './jobs.ts';
import { countryFromRegion, defaultsFor, parseSettings, withCountry, atmKpa } from './settings.ts';
import { COUNTRIES, profileFor, chargeDefault } from './countries.ts';
import { REFRIGERANTS, isFlammable, safetyNote } from './refrigerants.ts';
import { PT_TABLES } from '../data/ptTables.ts';
import { typicalPair, FLARE_TORQUE } from './flare.ts';
import { accessOf, fromTransactions, mergeEntitlements, parseAccessCache, trialDaysLeft, unlockButton, TRIAL_SKU, UNLOCK_SKU, DAY_MS } from './access.ts';

const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);

test('units: pressure, temperature, deltas, vacuum, rates round-trip', () => {
  near(U.pressureToKpa(U.pressureFromKpa(812.3, 'psi'), 'psi'), 812.3);
  near(U.pressureFromKpa(100, 'bar'), 1);
  near(U.pressureFromKpa(6.894757293168361, 'psi'), 1);
  near(U.cToF(0), 32); near(U.cToF(100), 212); near(U.fToC(-40), -40);
  near(U.deltaFromK(5, 'F'), 9); near(U.deltaToK(9, 'F'), 5);
  near(U.vacuumFromPa(U.vacuumToPa(500, 'micron'), 'Pa'), 66.661, 0.001);
  near(U.vacuumFromPa(133.322368, 'Torr'), 1);
  near(U.rateFromGPerM(55.8, 'oz'), 0.6, 0.001);
  near(U.wToTons(3516.8528), 1, 1e-6);
  near(U.gaugeToAbsKpa(0, 'kPa'), 101.325);
  near(U.absKpaToGauge(101.325, 'psi'), 0);
});

test('units: altitude atmosphere follows the standard atmosphere', () => {
  near(U.atmAtAltitude(0), 101.325);
  near(U.atmAtAltitude(1609), 83.4, 0.2); // Denver, ~ 12.1 psia
  near(U.atmAtAltitude(Number.NaN), 101.325);
  assert.ok(U.atmAtAltitude(99999) > 40);
});

test('units: parsing typed numbers and formatting', () => {
  assert.equal(U.parseNum('4,5'), 4.5);
  assert.equal(U.parseNum(' -12.5 '), -12.5);
  assert.equal(U.parseNum('.5'), 0.5);
  assert.ok(Number.isNaN(U.parseNum('')));
  assert.ok(Number.isNaN(U.parseNum('-')));
  assert.ok(Number.isNaN(U.parseNum('1.2.3')));
  assert.ok(Number.isNaN(U.parseNum('abc')));
  assert.equal(U.fmt(-0.04, 1), '0.0');
  assert.equal(U.fmt(Number.NaN, 1), '–');
});

test('evacuation decay verdicts judge the trend, not just the last reading', () => {
  assert.equal(judgeDecay([]).verdict, 'need-more');
  assert.equal(judgeDecay([{ minute: 0, micron: 800 }, { minute: 10, micron: 900 }]).verdict, 'not-deep');
  assert.equal(judgeDecay([{ minute: 0, micron: 350 }, { minute: 4, micron: 500 }]).verdict, 'need-more');
  assert.equal(judgeDecay([{ minute: 0, micron: 350 }, { minute: 10, micron: 700 }]).verdict, 'need-more', 'two readings cannot show a trend');
  // Levels off under the limit: pass.
  assert.equal(judgeDecay([{ minute: 0, micron: 350 }, { minute: 3, micron: 600 }, { minute: 7, micron: 680 }, { minute: 10, micron: 690 }]).verdict, 'pass');
  // Steady climb that is still under 1000 at 10 min: a leak, not a pass (review finding).
  assert.equal(judgeDecay([{ minute: 0, micron: 450 }, { minute: 5, micron: 700 }, { minute: 10, micron: 950 }]).verdict, 'leak');
  assert.equal(judgeDecay([{ minute: 0, micron: 400 }, { minute: 5, micron: 1400 }, { minute: 10, micron: 2400 }]).verdict, 'leak');
  // Fast early rise that flattens above the limit: moisture.
  assert.equal(judgeDecay([{ minute: 0, micron: 400 }, { minute: 3, micron: 1300 }, { minute: 7, micron: 1450 }, { minute: 10, micron: 1480 }]).verdict, 'moisture');
  assert.equal(judgeDecay([{ minute: 0, micron: 300 }, { minute: 2, micron: 2500 }]).verdict, 'leak');
});

test('evacuation checklist adds the ignition step only for flammables', () => {
  assert.ok(checklistFor(true).some((c) => c.id === 'ignition'));
  assert.ok(!checklistFor(false).some((c) => c.id === 'ignition'));
  assert.equal(checklistFor(true).length, EVAC_CHECKLIST.length);
});

test('load estimate: worked example and edge cases', () => {
  const r = estimateLoad({ areaM2: 25, heightM: 2.4, insulation: 'average', sun: 'some', coolClimate: 'warm', heatClimate: 'cool', people: 2, extraW: 0, bigGlass: false, topFloorOrUnderRoof: false });
  assert.ok(!('error' in r));
  if ('error' in r) return;
  near(r.coolW, 25 * 2.4 * 42); // 2520 W
  near(r.heatW, 25 * 2.4 * 40); // 2400 W
  assert.equal(nextSizeKw(r.coolW), 3.5, '2.52 kW never rounds down to 2.5');
  assert.equal(nextSizeKw(2500), 2.5);
  assert.equal(nextSizeBtu(btuhToW(12070)), 18000);
  const busy = estimateLoad({ areaM2: 25, heightM: 2.4, insulation: 'poor', sun: 'full', coolClimate: 'hot', heatClimate: 'cold', people: 6, extraW: 500, bigGlass: true, topFloorOrUnderRoof: true });
  assert.ok(!('error' in busy) && busy.coolW > r.coolW * 2);
  assert.ok('error' in estimateLoad({ areaM2: 0, heightM: 2.4, insulation: 'good', sun: 'some', coolClimate: 'mild', heatClimate: 'mild', people: 1, extraW: 0, bigGlass: false, topFloorOrUnderRoof: false }));
  assert.ok('error' in estimateLoad({ areaM2: 5000, heightM: 2.4, insulation: 'good', sun: 'some', coolClimate: 'mild', heatClimate: 'mild', people: 1, extraW: 0, bigGlass: false, topFloorOrUnderRoof: false }));
  assert.equal(nextSizeKw(99000), null);
  assert.equal(nextSizeBtu(2520), 9000);
  assert.equal(nextSizeBtu(5000), 18000);
  assert.equal(nextSizeBtu(99000), null);
});

test('line set planner picks one coil when it can and joins only when it must', () => {
  near(neededLength(8, 0.5, 10), 9.8);
  assert.equal(neededLength(0, 1, 10), 0);
  const au = profileFor('AU').lineSets;
  const one = planCoils(9.8, au.lengths, 'm')!;
  assert.deepEqual(one.coils, [10]);
  assert.equal(one.joins, 0);
  const two = planCoils(31, au.lengths, 'm')!;
  assert.ok(two.total >= 31 && two.joins >= 1);
  const us = planCoils(40, profileFor('US').lineSets.lengths, 'ft')!;
  assert.deepEqual(us.coils, [50]);
  const veryLong = planCoils(130, [20], 'm')!;
  assert.equal(veryLong.total, 140);
  assert.equal(planCoils(10, [], 'm'), null);
  assert.equal(planCoils(0, [20], 'm'), null);
});

test('typical pipe pairs by capacity', () => {
  assert.deepEqual(typicalPair(2.5), { liquid: '1/4"', suction: '3/8"' });
  assert.deepEqual(typicalPair(7.1), { liquid: '1/4"', suction: '5/8"' });
  assert.deepEqual(typicalPair(9.5), { liquid: '3/8"', suction: '5/8"' });
  assert.equal(typicalPair(30), null);
  assert.equal(typicalPair(0), null);
  for (const t of FLARE_TORQUE) assert.ok(t.maxNm > t.minNm);
});

test('jobs: create, add and remove readings, survive bad storage', () => {
  let j = newJob('R32', 1000, 'Smith lounge');
  j = addReading(j, { kind: 'superheat', title: 'SH', result: '6 K', steps: [{ label: 'a', value: 'b' }] }, 2000);
  assert.equal(j.readings.length, 1);
  assert.equal(j.updatedAt, 2000);
  const txt = jobText(j, () => 'today');
  assert.ok(txt.includes('Smith lounge') && txt.includes('SH: 6 K') && txt.includes('licensed technicians'));
  const back = parseJobs(JSON.stringify([j]));
  assert.deepEqual(back[0], j);
  j = removeReading(j, j.readings[0].id, 3000);
  assert.equal(j.readings.length, 0);
  assert.deepEqual(parseJobs('not json'), []);
  assert.deepEqual(parseJobs('{"a":1}'), []);
  assert.equal(parseJobs(JSON.stringify([{ id: 'x', readings: [{ id: 'r', kind: 'bogus' }, 7] }]))[0].readings.length, 0);
  const list = upsertJob(upsertJob([], newJob('R32', 1)), newJob('R410A', 5));
  assert.equal(list[0].refrigerant, 'R410A');
});

test('settings: device region picks the country, bad storage falls back, country change resets units', () => {
  assert.equal(countryFromRegion('AU'), 'AU');
  assert.equal(countryFromRegion('uk'), 'GB');
  assert.equal(countryFromRegion('DE'), 'OTHER');
  assert.equal(countryFromRegion(null), 'OTHER');
  const us = defaultsFor('US');
  assert.equal(us.units.pressure, 'psi');
  assert.equal(us.units.temp, 'F');
  assert.equal(us.refrigerant, 'R454B');
  assert.equal(parseSettings('garbage', 'NZ').country, 'NZ');
  const s = parseSettings(JSON.stringify({ country: 'GB', units: { pressure: 'nope' }, altitudeM: 99999, onboarded: true }), 'AU');
  assert.equal(s.country, 'GB');
  assert.equal(s.units.pressure, 'bar');
  assert.equal(s.altitudeM, 6000);
  assert.equal(s.onboarded, true);
  const moved = withCountry(defaultsFor('AU'), 'US');
  assert.equal(moved.units.length, 'ft');
  assert.equal(moved.refrigerant, 'R32', 'keeps a refrigerant that is also common there');
  assert.equal(withCountry(defaultsFor('US'), 'AU').refrigerant, 'R32', 'R454B is not common in AU: switch to R32');
  near(atmKpa(defaultsFor('AU')), 101.325);
});

test('every country path: complete profile, units, refrigerants with tables, line sets, charge defaults', () => {
  const codes = COUNTRIES.map((c) => c.code);
  for (const code of ['AU', 'NZ', 'GB', 'IE', 'US', 'CA']) {
    const c = profileFor(code);
    assert.equal(c.code, code);
    assert.ok(c.guided, `${code} guided`);
    assert.ok(c.licence.length && c.standards.length, `${code} rules`);
  }
  assert.ok(codes.includes('OTHER') && !profileFor('OTHER').guided);
  assert.equal(profileFor('ZZ').code, 'OTHER');
  for (const c of COUNTRIES) {
    assert.ok(c.refrigerants.length === REFRIGERANTS.length, `${c.code} lists every refrigerant once`);
    assert.equal(new Set(c.refrigerants).size, c.refrigerants.length);
    for (const r of c.refrigerants) assert.ok(PT_TABLES[r], `${c.code} ${r} has a table`);
    assert.ok(c.commonCount <= c.refrigerants.length);
    assert.ok(c.lineSets.pairs.length >= 4 && c.lineSets.lengths.length >= 2, `${c.code} line sets`);
    assert.ok(c.lineSets.lengths.every((l) => l > 0));
    assert.ok(c.flammableStandard.length > 3);
    assert.ok(safetyNote('R32', c.flammableStandard)!.includes(c.flammableStandard));
    for (const liq of ['1/4"', '3/8"']) {
      const d = chargeDefault(c, liq);
      assert.ok(d.gPerM > 0 && d.prechargedM > 0, `${c.code} ${liq}`);
    }
  }
  // Imperial countries in feet and ounces; metric in metres and grams.
  for (const code of ['US', 'CA']) assert.deepEqual([profileFor(code).units.length, profileFor(code).units.mass, profileFor(code).lineSets.unit], ['ft', 'oz', 'ft']);
  for (const code of ['AU', 'NZ', 'GB', 'IE']) assert.deepEqual([profileFor(code).units.length, profileFor(code).units.mass, profileFor(code).lineSets.unit], ['m', 'g', 'm']);
  assert.equal(profileFor('AU').units.pressure, 'kPa');
  assert.equal(profileFor('GB').units.pressure, 'bar');
  assert.equal(profileFor('IE').currency.code, 'EUR');
  assert.equal(profileFor('GB').currency.symbol, '£');
  // R32 is first in AU / NZ / UK / IE; R454B first in the US (AIM Act).
  for (const code of ['AU', 'NZ', 'GB', 'IE']) assert.equal(profileFor(code).refrigerants[0], 'R32');
  assert.equal(profileFor('US').refrigerants[0], 'R454B');
});

test('no retailer or brand names in anything the UI shows from the profiles', () => {
  const banned = /Reece|Actrol|Kirby|Bunnings|Mueller|Lowe|Ferguson|Daikin|Mitsubishi|Carrier|Goodman|Lennox|Fujitsu|Panasonic|MRCOOL|Lawton|Orion|Heatcraft|Chemours|Arkema|Honeywell|RSL|Great Lakes|Totaline|Freddox/i;
  for (const c of COUNTRIES) {
    const shown = JSON.stringify({ ...c });
    assert.ok(!banned.test(shown), `${c.code}: ${shown.match(banned)?.[0]}`);
  }
  for (const r of REFRIGERANTS) assert.ok(!banned.test(JSON.stringify(r)), r.id);
});

test('refrigerant flags', () => {
  assert.ok(isFlammable('R32') && isFlammable('R290') && isFlammable('R454B') && isFlammable('R717'));
  assert.ok(!isFlammable('R410A') && !isFlammable('R744'));
  assert.equal(safetyNote('R410A', 'X'), null);
  assert.ok(safetyNote('R290', 'X')!.startsWith('Highly flammable (A3)'));
});

test('access: trial, unlock, expiry, refunds, cache', () => {
  const now = 100 * DAY_MS;
  assert.equal(trialDaysLeft(now, now), 7);
  assert.equal(trialDaysLeft(now - 6.5 * DAY_MS, now), 1);
  assert.equal(trialDaysLeft(now - 8 * DAY_MS, now), 0);
  assert.equal(trialDaysLeft(null, now), 0);
  assert.deepEqual(accessOf('stub', { unlocked: false, trialStart: null }, now), { state: 'stub', daysLeft: 0, canCalc: true });
  assert.equal(accessOf('store', { unlocked: false, trialStart: null }, now).canCalc, false);
  assert.equal(accessOf('store', { unlocked: false, trialStart: now - DAY_MS }, now).state, 'trial');
  assert.equal(accessOf('store', { unlocked: false, trialStart: now - 9 * DAY_MS }, now).state, 'expired');
  assert.equal(accessOf('store', { unlocked: true, trialStart: null }, now).canCalc, true);
  const e = fromTransactions([{ productId: TRIAL_SKU, purchaseDate: 5 }, { productId: UNLOCK_SKU, revoked: true }, null, 'x']);
  assert.deepEqual(e, { unlocked: false, trialStart: 5 });
  assert.deepEqual(fromTransactions('nope'), { unlocked: false, trialStart: null });
  assert.equal(parseAccessCache('{bad'), null);
  const cache = parseAccessCache(JSON.stringify({ unlocked: true, trialStart: 3, checkedAt: 9 }))!;
  assert.deepEqual(mergeEntitlements(null, cache), { unlocked: true, trialStart: 3 });
  assert.deepEqual(mergeEntitlements({ unlocked: false, trialStart: null }, cache), { unlocked: false, trialStart: null });
  assert.deepEqual(unlockButton(' A$4.99 '), { enabled: true, price: 'A$4.99' });
  assert.deepEqual(unlockButton(''), { enabled: false, price: null });
});
