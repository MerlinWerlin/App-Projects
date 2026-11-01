// T116 (run-98 follow-ups, offline parts): source guards for the faster in-flight tick (full screen only, timed
// tween, paused when not focused), the Call home entry on I'm safe, and the Ionicons names in the run-98 screens.
// The Call home day-zone override and the per-day cache are tested with the core in callhome.test.ts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('in-flight: the full screen ticks every 10 s while focused, the cards keep 1 min, timed tween only', () => {
  const card = read('src/ui/InflightCard.tsx');
  const screen = read('app/inflight/[itemId].tsx');
  assert.match(card, /export const CARD_TICK_MS = 60_000;/);
  assert.match(card, /export const FULL_TICK_MS = 10_000;/);
  // Cards use the default (card) tick; only the screen passes FULL_TICK_MS, and 0 while not focused.
  assert.match(card, /useInflightWith\(\(o\) => inflightForTrips\(trips, o\), \[trips\]\)/);
  assert.match(card, /useInflightWith\(\(o\) => inflightView\(trip, o\), \[trip\]\)/);
  assert.match(screen, /useFocusEffect\(/);
  assert.match(screen, /useInflightForItem\(itemId \?\? '', focused \? FULL_TICK_MS : 0\)/);
  // A paused ticker sets no interval.
  assert.match(card, /if \(!\(ms > 0\)\) return;/);
  // The plane moves with the timed tween from theme/motion, never a spring.
  assert.doesNotMatch(card + screen, /Animated\.spring|\bspring\(/);
  assert.match(card, /timed\(x, tx, duration\.slow\)/);
});

test("Call home opens from I'm safe (the trip on now, else the phone's clock)", () => {
  const safe = read('app/safe.tsx');
  assert.match(safe, /label=\{t\('f98\.safe\.callhome'\)\}/);
  assert.match(safe, /pathname: '\/callhome', params: \{ tripId: trip\.id \}/);
  assert.match(safe, /: '\/callhome'\)/);
});

/** Ionicons 7 names (@expo/vector-icons 15) used by the run-98 screens, each checked by hand against the set. */
const CHECKED = new Set([
  'information-circle-outline', 'search-outline', 'alert-circle-outline', 'people-outline', 'chatbubbles-outline',
  'water-outline', 'home-outline', 'shirt-outline', 'camera-outline', 'hand-left-outline', 'walk-outline',
  'flask-outline', 'bulb-outline', 'refresh-outline', 'globe-outline', 'person-outline', 'create-outline', 'checkmark',
  'trash-outline', 'sunny-outline', 'person-add-outline', 'calendar-outline', 'remove', 'add', 'call', 'chatbubble',
  'videocam', 'call-outline', 'chevron-forward', 'ticket-outline', 'time-outline', 'checkmark-done-outline',
  'moon-outline', 'list-outline', 'airplane-outline', 'earth-outline', 'bed-outline', 'car-outline', 'cash-outline',
  'map-outline', 'male-female-outline', 'cellular-outline', 'location-outline', 'locate-outline',
  'chatbubble-ellipses-outline', 'medkit-outline', 'add-outline', 'send-outline', 'chatbox-outline', 'share-outline',
  'checkbox', 'square-outline',
]);

function iconNames(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/\b(?:name|icon)=["']([a-z0-9-]+)["']/g)) out.add(m[1]);
  for (const m of src.matchAll(/\b(?:name|icon)=\{[^}]*\}/g)) for (const q of m[0].matchAll(/'([a-z][a-z0-9-]*)'/g)) out.add(q[1]);
  for (const m of src.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) out.add(m[1]);
  for (const m of src.matchAll(/_ICONS?\b[^=]*=\s*\{([^}]*)\}/g)) for (const q of m[1].matchAll(/:\s*'([a-z0-9-]+)'/g)) out.add(q[1]);
  return [...out];
}

test('Ionicons: customs (hand-left-outline, shirt-outline), call home, in-flight and I’m safe use checked names', () => {
  const files = ['app/customs/[iso2].tsx', 'app/callhome.tsx', 'src/ui/callhome.tsx', 'app/inflight/[itemId].tsx', 'src/ui/InflightCard.tsx', 'app/safe.tsx'];
  const unknown: string[] = [];
  let seen = 0;
  for (const f of files) {
    for (const n of iconNames(read(f))) {
      seen += 1;
      if (!CHECKED.has(n)) unknown.push(`${f}: ${n}`);
    }
  }
  assert.deepEqual(unknown, [], 'names not checked against the Ionicons 7 set');
  assert.ok(seen > 40);
  const customs = iconNames(read('app/customs/[iso2].tsx'));
  assert.ok(customs.includes('hand-left-outline') && customs.includes('shirt-outline'));
});
