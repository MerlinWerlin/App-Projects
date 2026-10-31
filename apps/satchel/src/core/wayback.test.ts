import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { addPlace, savedPlaces } from './places.ts';
import {
  accuracyNote,
  arrived,
  canFindWayBack,
  cardinal,
  cardinalKey,
  distanceTo,
  dropPin,
  focusTrip,
  hotelKey,
  hotelTargets,
  initialBearing,
  needsCalibration,
  nextRotation,
  normDeg,
  parsePins,
  pickHeading,
  pinKey,
  pinName,
  PINS_MAX,
  pinToPlace,
  placeKey,
  relativeAngle,
  removePin,
  renamePin,
  resolveTarget,
  walkTime,
  waybackTargets,
  type WaybackPin,
} from './wayback.ts';

const near = (a: number | null, b: number, eps = 0.5) => {
  assert.ok(a != null, `expected ${b}, got null`);
  assert.ok(Math.abs(a - b) <= eps, `expected ~${b}, got ${a}`);
};

test('normDeg wraps any angle into [0, 360)', () => {
  assert.equal(normDeg(0), 0);
  assert.equal(normDeg(360), 0);
  assert.equal(normDeg(720), 0);
  assert.equal(normDeg(-1), 359);
  assert.equal(normDeg(-360), 0);
  assert.equal(normDeg(-0), 0);
  assert.equal(normDeg(361.5), 1.5);
  assert.ok(Number.isNaN(normDeg(Number.NaN)));
  assert.ok(Number.isNaN(normDeg(Infinity)));
});

test('initialBearing: the four cardinal directions and a diagonal', () => {
  const o = { lat: 0, lon: 0 };
  near(initialBearing(o, { lat: 1, lon: 0 }), 0);
  near(initialBearing(o, { lat: 0, lon: 1 }), 90);
  near(initialBearing(o, { lat: -1, lon: 0 }), 180);
  near(initialBearing(o, { lat: 0, lon: -1 }), 270);
  near(initialBearing(o, { lat: 1, lon: 1 }), 45, 0.1);
  // Real pair: Asakusa to Tokyo Skytree is roughly east.
  near(initialBearing({ lat: 35.7148, lon: 139.7967 }, { lat: 35.7101, lon: 139.8107 }), 112, 3);
});

test('initialBearing: just west of north stays near 360, never 360 itself', () => {
  const b = initialBearing({ lat: 0, lon: 0 }, { lat: 1, lon: -1e-7 });
  assert.ok(b != null && b > 359.99 && b < 360, String(b));
  const n = initialBearing({ lat: 10, lon: 20 }, { lat: 11, lon: 20 });
  assert.ok(n != null && n >= 0 && n < 360);
});

test('initialBearing: across the antimeridian takes the short way', () => {
  near(initialBearing({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }), 90);
  near(initialBearing({ lat: 0, lon: -179.9 }, { lat: 0, lon: 179.9 }), 270);
  near(initialBearing({ lat: -17.7, lon: 179.95 }, { lat: -17.6, lon: -179.95 }), 45, 2);
  const d = distanceTo({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 });
  assert.ok(d != null && d < 25_000, `short distance across the line, got ${d}`);
});

test('initialBearing: near and on the poles', () => {
  assert.equal(initialBearing({ lat: 90, lon: 0 }, { lat: 80, lon: 123 }), 180);
  assert.equal(initialBearing({ lat: -90, lon: 45 }, { lat: -80, lon: -10 }), 0);
  near(initialBearing({ lat: 89.9, lon: 0 }, { lat: 89.9, lon: 180 }), 0, 0.01); // over the top
  near(initialBearing({ lat: 80, lon: 10 }, { lat: 90, lon: 0 }), 0, 0.01); // to the pole is due north
  const b = initialBearing({ lat: 89.999, lon: 0 }, { lat: 89.999, lon: 90 });
  assert.ok(b != null && b >= 0 && b < 360);
});

test('initialBearing / distanceTo: invalid coordinates and identical points give null', () => {
  const ok = { lat: 35, lon: 139 };
  assert.equal(initialBearing(ok, ok), null);
  assert.equal(initialBearing(ok, { lat: 35 + 1e-9, lon: 139 }), null);
  assert.equal(initialBearing(ok, { lat: 91, lon: 0 }), null);
  assert.equal(initialBearing({ lat: 0, lon: 181 }, ok), null);
  assert.equal(initialBearing({ lat: Number.NaN, lon: 0 }, ok), null);
  assert.equal(initialBearing(null as unknown as { lat: number; lon: number }, ok), null);
  assert.equal(initialBearing({ lat: '1', lon: 2 } as unknown as { lat: number; lon: number }, ok), null);
  assert.equal(distanceTo(ok, { lat: Infinity, lon: 0 }), null);
  assert.equal(distanceTo(ok, ok), 0);
  // Same spot on the pole at different longitudes is the same point.
  assert.equal(initialBearing({ lat: 90, lon: 0 }, { lat: 90, lon: 100 }), null);
});

test('relativeAngle: shortest signed turn, wraps at 0/360', () => {
  assert.equal(relativeAngle(10, 350), 20);
  assert.equal(relativeAngle(350, 10), -20);
  assert.equal(relativeAngle(0, 0), 0);
  assert.equal(relativeAngle(360, 0), 0);
  assert.equal(relativeAngle(180, 0), 180);
  assert.equal(relativeAngle(0, 180), 180, 'exactly behind is +180, never -180');
  assert.equal(relativeAngle(90, 270), 180);
  assert.equal(relativeAngle(-90, 0), -90);
  assert.equal(relativeAngle(720 + 45, 0), 45);
  assert.equal(relativeAngle(null, 10), null);
  assert.equal(relativeAngle(10, null), null);
  assert.equal(relativeAngle(Number.NaN, 0), null);
});

test('nextRotation never spins the long way round', () => {
  assert.equal(nextRotation(359, 1), 361);
  assert.equal(nextRotation(1, 359), -1);
  assert.equal(nextRotation(720, 10), 730);
  assert.equal(nextRotation(-10, 350), -10);
  assert.equal(nextRotation(0, 180), 180);
  assert.equal(nextRotation(Number.NaN, 370), 10);
  assert.equal(nextRotation(42, Number.NaN), 42);
  // A long walk of small steps through north keeps going the same way.
  let r = 350;
  for (const t of [355, 0, 5, 10]) r = nextRotation(r, t);
  assert.equal(r, 370);
});

test('pickHeading: trueHeading when known, else magHeading, else null', () => {
  assert.equal(pickHeading({ trueHeading: 12, magHeading: 20, accuracy: 3 }), 12);
  assert.equal(pickHeading({ trueHeading: -1, magHeading: 20, accuracy: 3 }), 20);
  assert.equal(pickHeading({ trueHeading: 0, magHeading: 20 }), 0, 'true north 0 is a real heading');
  assert.equal(pickHeading({ trueHeading: 360, magHeading: 1 }), 0);
  assert.equal(pickHeading({ trueHeading: -1, magHeading: -1 }), null);
  assert.equal(pickHeading({ trueHeading: Number.NaN, magHeading: null }), null);
  assert.equal(pickHeading(null), null);
  assert.equal(pickHeading(undefined), null);
});

test('needsCalibration at low accuracy levels only when there is a heading', () => {
  assert.equal(needsCalibration({ trueHeading: 10, magHeading: 10, accuracy: 3 }), false);
  assert.equal(needsCalibration({ trueHeading: 10, magHeading: 10, accuracy: 2 }), false);
  assert.equal(needsCalibration({ trueHeading: 10, magHeading: 10, accuracy: 1 }), true);
  assert.equal(needsCalibration({ trueHeading: -1, magHeading: 10, accuracy: 0 }), true);
  assert.equal(needsCalibration({ trueHeading: -1, magHeading: -1, accuracy: 0 }), false);
  assert.equal(needsCalibration({ trueHeading: 10 }), false);
  assert.equal(needsCalibration(null), false);
});

test('cardinal: 8 and 16 points, sectors centred, wraps at 360', () => {
  assert.equal(cardinal(0), 'n');
  assert.equal(cardinal(359.9), 'n');
  assert.equal(cardinal(22.4), 'n');
  assert.equal(cardinal(22.6), 'ne');
  assert.equal(cardinal(45), 'ne');
  assert.equal(cardinal(90), 'e');
  assert.equal(cardinal(225), 'sw');
  assert.equal(cardinal(337.6), 'n');
  assert.equal(cardinal(-45), 'nw');
  assert.equal(cardinal(720 + 180), 's');
  assert.equal(cardinal(0, 16), 'n');
  assert.equal(cardinal(11.3, 16), 'nne');
  assert.equal(cardinal(67.5, 16), 'ene');
  assert.equal(cardinal(348.8, 16), 'n');
  assert.equal(cardinal(348.7, 16), 'nnw');
  assert.equal(cardinal(Number.NaN), null);
  assert.equal(cardinalKey('ne'), 'wayback.dir.ne');
});

test('walkTime: rough minutes with a street detour, split into hours', () => {
  assert.deepEqual(walkTime(0), { minutes: 1, h: 0, m: 1 });
  assert.deepEqual(walkTime(400), { minutes: 7, h: 0, m: 7 }); // 520 m of street at 80 m/min
  assert.deepEqual(walkTime(5000), { minutes: 81, h: 1, m: 21 });
  assert.equal(walkTime(-5), null);
  assert.equal(walkTime(Number.NaN), null);
  assert.equal(walkTime(null), null);
});

test('accuracyNote and arrived', () => {
  assert.equal(accuracyNote(8), 'none');
  assert.equal(accuracyNote(50), 'none');
  assert.equal(accuracyNote(51), 'poor');
  assert.equal(accuracyNote(null), 'unknown');
  assert.equal(accuracyNote(-1), 'unknown');
  assert.equal(arrived(10), true);
  assert.equal(arrived(30), false);
  assert.equal(arrived(30, 40), true, 'inside the GPS uncertainty');
  assert.equal(arrived(90, 500), false, 'uncertainty is capped');
  assert.equal(arrived(null), false);
});

const NOW = '2026-11-04T10:00:00Z';

test('dropPin: presets, custom labels, rounding, newest first, capped', () => {
  const a = dropPin([], { preset: 'parked', lat: 35.71234567, lon: 139.79654321, accuracy: 12.4 }, '2026-11-04T10:00:00Z', 'pin_a');
  assert.ok(a.ok);
  assert.deepEqual(a.pin, { id: 'pin_a', preset: 'parked', lat: 35.712346, lon: 139.796543, droppedAt: '2026-11-04T10:00:00Z', accuracy: 12 });
  const b = dropPin(a.pins, { preset: 'custom', label: '  Blue   door  ', lat: 35, lon: 139 }, '2026-11-04T11:00:00Z', 'pin_b');
  assert.ok(b.ok);
  assert.deepEqual(b.pins.map((p) => p.id), ['pin_b', 'pin_a']);
  assert.equal(b.pin.label, 'Blue door');
  assert.deepEqual(dropPin([], { preset: 'custom', label: '  ', lat: 35, lon: 139 }), { ok: false, errors: ['label'] });
  assert.deepEqual(dropPin([], { preset: 'meeting', lat: 95, lon: 139 }), { ok: false, errors: ['position'] });
  let list: WaybackPin[] = [];
  for (let i = 0; i < PINS_MAX + 5; i++) {
    const r = dropPin(list, { preset: 'meeting', lat: 1, lon: i }, `2026-11-04T10:${String(i).padStart(2, '0')}:00Z`, `p${i}`);
    assert.ok(r.ok);
    list = r.pins;
  }
  assert.equal(list.length, PINS_MAX);
  assert.equal(list[0].id, `p${PINS_MAX + 4}`);
  assert.ok(!list.some((p) => p.id === 'p0'), 'oldest dropped');
});

test('removePin, renamePin and parsePins are defensive', () => {
  const r = dropPin([], { preset: 'parked', lat: 1, lon: 2 }, NOW, 'x');
  assert.ok(r.ok);
  assert.deepEqual(removePin(r.pins, 'x'), []);
  assert.deepEqual(removePin(r.pins, 'nope'), r.pins);
  const renamed = renamePin(r.pins, 'x', 'Level 3, bay 41');
  assert.equal(renamed[0].label, 'Level 3, bay 41');
  assert.equal(renamed[0].preset, 'custom');
  assert.deepEqual(renamePin(r.pins, 'x', '   '), r.pins);
  assert.deepEqual(parsePins(null), []);
  assert.deepEqual(parsePins('[]'), []);
  const parsed = parsePins([
    null,
    { id: 'ok', preset: 'meeting', lat: 1, lon: 2, droppedAt: NOW },
    { id: 'ok', preset: 'parked', lat: 3, lon: 4, droppedAt: NOW },
    { id: 'bad', preset: 'parked', lat: 100, lon: 2 },
    { id: 'nolabel', preset: 'custom', lat: 1, lon: 2 },
    { id: 'odd', preset: 'weird', label: 'Kept', lat: 1, lon: 2, accuracy: -3 },
  ]);
  assert.deepEqual(parsed.map((p) => p.id), ['ok', 'odd']);
  assert.equal(parsed[1].preset, 'custom');
  assert.equal(parsed[1].accuracy, undefined);
});

test('pinName and pinToPlace: a pin can be kept as a trip saved place', () => {
  const r = dropPin([], { preset: 'parked', lat: 35.7, lon: 139.8 }, NOW, 'car');
  assert.ok(r.ok);
  assert.deepEqual(pinName(r.pin), { key: 'wayback.preset.parked' });
  assert.deepEqual(pinName({ ...r.pin, label: 'Car' }), { text: 'Car' });
  const trip = demoTrip('2026-11-03', NOW);
  const saved = addPlace(trip, pinToPlace(r.pin, 'I parked here'), NOW, 'place_car');
  assert.ok(saved.ok);
  assert.deepEqual(savedPlaces(saved.trip).map((p) => [p.name, p.lat, p.lon]), [['I parked here', 35.7, 139.8]]);
  assert.equal(pinToPlace(r.pin, '  ').name, '');
});

test('targets: the trip on today’s hotels (current stay first), saved places, then pins; resolve by key', () => {
  const trip = demoTrip('2026-11-03', NOW);
  const withPlace = addPlace(trip, { name: 'Ramen corner', lat: 35.71, lon: 139.79 }, NOW, 'place_r');
  assert.ok(withPlace.ok);
  const trips = [withPlace.trip];
  assert.equal(focusTrip(trips, '2026-11-08')?.id, trip.id);
  assert.equal(focusTrip([], '2026-11-08'), null);
  const kyotoDay = hotelTargets(trip, '2026-11-08');
  assert.deepEqual(kyotoDay.map((h) => h.key), [hotelKey('demo-h2'), hotelKey('demo-h1')]);
  assert.equal(kyotoDay[0].name, 'Gion Garden Inn (demo)');
  const pins = dropPin([], { preset: 'meeting', lat: 35.0, lon: 135.7 }, NOW, 'm1');
  assert.ok(pins.ok);
  const label = () => 'Meeting point';
  const all = waybackTargets(trips, '2026-11-04', pins.pins, label);
  assert.deepEqual(all.map((t) => t.kind), ['hotel', 'hotel', 'place', 'pin']);
  assert.equal(all[0].key, hotelKey('demo-h1'));
  assert.equal(resolveTarget(hotelKey('demo-h2'), trips, [], label)?.name, 'Gion Garden Inn (demo)');
  assert.equal(resolveTarget(placeKey(trip.id, 'place_r'), trips, [], label)?.name, 'Ramen corner');
  assert.equal(resolveTarget(pinKey('m1'), trips, pins.pins, label)?.name, 'Meeting point');
  assert.equal(resolveTarget(hotelKey('demo-a1'), trips, [], label)?.kind, 'hotel'); // any item with a position
  assert.equal(resolveTarget(hotelKey('nope'), trips, [], label), null);
  assert.equal(resolveTarget(pinKey('gone'), trips, pins.pins, label), null);
  assert.equal(resolveTarget('', trips, [], label), null);
  assert.equal(resolveTarget(undefined, trips, [], label), null);
  assert.equal(resolveTarget('weird:1', trips, [], label), null);
});

test('canFindWayBack needs a real position', () => {
  assert.equal(canFindWayBack({ lat: 35, lon: 139 }), true);
  assert.equal(canFindWayBack({ lat: 35 }), false);
  assert.equal(canFindWayBack({ lat: 135, lon: 0 }), false);
  assert.equal(canFindWayBack(undefined), false);
});
