import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PET_SETTINGS, EAT_MS, MINUTE, PET_CAPTIONS, PET_FRAMES, PET_LIFE_STATES, PLAY_MS, REACTION_MS, SPOTS,
  activityChanged, activityStateFor, cleanPetName, clockLabel, legacyPose, lifeInputFor, mealStarts, parsePetSettings, petDisplayName,
  petFrameAt, petLife, shiftQuiet, withCare, type PetLifeInput,
} from './petLife.ts';
import { PET_COPY } from '../i18n/pets.ts';

// A fixed local day: 1 Nov 2026 in Sydney (UTC+11). `at(h, m)` is that local wall-clock time.
const OFFSET = 11 * 60;
const MIDNIGHT = Date.UTC(2026, 10, 1) - OFFSET * MINUTE;
const at = (h: number, m = 0) => MIDNIGHT + (h * 60 + m) * MINUTE;
const life = (now: number, extra: Partial<PetLifeInput> = {}) => petLife({ pet: 'cat', now, offsetMin: OFFSET, ...extra });

test('sleeps in quiet hours, wakes with a stretch, eats around meals', () => {
  assert.equal(life(at(2)).state, 'sleeping');
  assert.equal(life(at(23, 30)).state, 'sleeping');
  assert.equal(life(at(2)).mood, 'sleepy');
  assert.equal(life(at(2)).frames, 'sleep');
  assert.equal(life(at(7, 5)).state, 'waking');
  assert.equal(life(at(7, 5)).frames, 'stretch');
  assert.equal(life(at(7, 45)).state, 'eating'); // breakfast 40 min after wake-up
  assert.equal(life(at(12, 40)).state, 'eating');
  assert.equal(life(at(18, 35)).state, 'eating');
  assert.deepEqual(mealStarts(22 * 60, 7 * 60), [7 * 60 + 40, 12 * 60 + 30, 18 * 60 + 30]);
});

test('custom quiet hours move sleep and skip meals inside them', () => {
  const owl = { quietStart: 2 * 60, quietEnd: 10 * 60 };
  assert.equal(life(at(23, 30), owl).state === 'sleeping', false);
  assert.equal(life(at(9), owl).state, 'sleeping');
  assert.equal(life(at(10, 10), owl).state, 'waking');
  // A late sleeper whose breakfast would run into lunch keeps only one of them.
  const late = mealStarts(22 * 60, 12 * 60);
  assert.ok(late.every((s, i) => late.every((o, j) => i === j || Math.abs(s - o) >= 30)));
  assert.ok(!mealStarts(17 * 60, 7 * 60).includes(18 * 60 + 30), 'dinner skipped while asleep');
});

test('daytime is deterministic and the next change is a real boundary', () => {
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 7, 29, 31, 53]) {
      const a = life(at(h, m));
      assert.deepEqual(life(at(h, m)), a, 'same input, same answer');
      assert.ok(a.until > at(h, m), 'until is in the future');
      assert.ok(a.until - at(h, m) <= 24 * 60 * MINUTE);
      assert.ok(PET_LIFE_STATES.includes(a.state));
      assert.ok(a.spot >= 0 && a.spot < SPOTS);
      assert.equal(a.frames, PET_FRAMES[a.state]);
      // Nothing changes before `until`, and something does at `until`.
      const before = life(a.until - 1);
      assert.deepEqual([before.state, before.mood, before.spot], [a.state, a.mood, a.spot]);
      const after = life(a.until);
      assert.deepEqual({ state: after.state, mood: after.mood, spot: after.spot, caption: after.caption, frames: after.frames }, a.next);
      assert.ok(after.state !== a.state || after.mood !== a.mood || after.spot !== a.spot || after.caption !== a.caption);
    }
  }
});

test('updates are sparse: at most ~50 boundaries a day', () => {
  for (const pet of ['cat', 'fox', 'bunny'] as const) {
    let t = at(0);
    let n = 0;
    while (t < at(24)) { t = petLife({ pet, now: t, offsetMin: OFFSET }).until; n++; }
    assert.ok(n >= 6 && n <= 60, `${pet}: ${n} changes`);
    // The whole night is one sleeping stretch (one update in, one out).
    assert.ok(petLife({ pet, now: at(22, 1), offsetMin: OFFSET }).until >= at(23, 0) + 7 * 60 * MINUTE);
  }
});

test('pets have different temperaments over a day', () => {
  const counts = (pet: 'cat' | 'fox' | 'bunny') => {
    const c: Record<string, number> = {};
    for (let d = 0; d < 7; d++) for (let m = 0; m < 1440; m += 30) {
      const s = petFrameAt({ pet, now: at(0) + (d * 1440 + m) * MINUTE, offsetMin: OFFSET }).state;
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  };
  const cat = counts('cat');
  const fox = counts('fox');
  assert.ok((cat.idle ?? 0) > (fox.idle ?? 0), 'the cat sits more');
  assert.ok((fox.wandering ?? 0) + (fox.playing ?? 0) > (cat.wandering ?? 0) + (cat.playing ?? 0), 'the fox moves more');
});

test('a tap gives a short reaction that decays', () => {
  const now = at(15, 2);
  const tapped = life(now, { lastTapAt: now });
  assert.equal(tapped.state, 'happy');
  assert.equal(tapped.frames, 'cheer');
  assert.equal(tapped.reacting, true);
  assert.equal(tapped.until, now + REACTION_MS);
  const later = life(now + REACTION_MS, { lastTapAt: now });
  assert.notEqual(later.state, 'happy');
  assert.equal(later.reacting, false);
  assert.equal(later.mood === 'happy' || later.mood === 'playful' || later.mood === 'sleepy' || later.mood === 'hungry', true);
  // At night a tap is only a sleepy stir.
  const night = life(at(3), { lastTapAt: at(3) });
  assert.equal(night.caption, 'lifeStir');
  assert.equal(night.canFeed, false);
  assert.equal(activityStateFor(night).state, 'sleeping');
  assert.equal(life(at(3) + REACTION_MS, { lastTapAt: at(3) }).state, 'sleeping');
});

test('feed and play are temporary and never wake a sleeping pet', () => {
  const now = at(14, 3);
  const fed = life(now, { lastFedAt: now });
  assert.equal(fed.state, 'eating');
  assert.equal(life(now + EAT_MS, { lastFedAt: now }).state === 'eating', life(now + EAT_MS).state === 'eating');
  assert.equal(life(now + 30 * MINUTE, { lastFedAt: now }).mood === 'content', false, 'still happy after a feed');
  const played = life(now, { lastPlayAt: now });
  assert.equal(played.state, 'playing');
  assert.ok(played.until <= now + PLAY_MS);
  assert.equal(life(at(1), { lastFedAt: at(1), lastPlayAt: at(1) }).state, 'sleeping');
  assert.equal(life(at(1)).canPlay, false);
  assert.equal(life(at(13)).canFeed, true);
});

test('hungry before meals unless fed, sleepy before bed', () => {
  assert.equal(life(at(12, 10)).mood, 'hungry');
  assert.notEqual(life(at(12, 10), { lastFedAt: at(11) }).mood, 'hungry');
  const dusk = life(at(21, 30));
  assert.ok(dusk.mood === 'sleepy' || dusk.state === 'playing' || dusk.state === 'wandering');
});

test('legacy poses and activity content state', () => {
  assert.equal(legacyPose('sleepy', 'idle'), 'sleepy');
  assert.equal(legacyPose('content', 'wandering'), 'playful');
  assert.equal(legacyPose('hungry', 'idle'), 'happy');
  const a = activityStateFor(life(at(10, 1)));
  const b = activityStateFor(life(at(10, 2)));
  assert.equal(activityChanged(a, b), false, 'no update between boundaries');
  assert.equal(activityChanged(null, a), true);
  const boundary = activityStateFor(life(life(at(10, 1)).until));
  assert.equal(activityChanged(a, boundary), true);
  assert.equal(boundary.state, a.nextState);
});

test('settings parse defensively; names are trimmed; care is per pet', () => {
  assert.deepEqual(parsePetSettings(null), DEFAULT_PET_SETTINGS);
  assert.deepEqual(parsePetSettings('not json'), DEFAULT_PET_SETTINGS);
  const s = parsePetSettings(JSON.stringify({
    pet: 'fox', island: true, quietStart: 1333, quietEnd: -20,
    names: { fox: '  Pip\n the  Brave  ', cat: 7, dragon: 'x' },
    care: { fox: { tapAt: 'x', fedAt: 5 }, dragon: { fedAt: 1 } },
  }));
  assert.equal(s.pet, 'fox');
  assert.equal(s.island, true);
  assert.equal(s.quietStart, 1335);
  assert.equal(s.quietEnd, 1420);
  assert.deepEqual(s.names, { fox: 'Pip the Brave' });
  assert.deepEqual(s.care, { fox: { fedAt: 5, playAt: null, tapAt: null } });
  assert.equal(parsePetSettings({ pet: 'dragon' }).pet, 'cat');
  assert.equal(cleanPetName('A very long name for a bunny'), 'A very long name');
  assert.equal(petDisplayName(s, 'fox', 'Pip'), 'Pip the Brave');
  assert.equal(petDisplayName(s, 'bunny', 'Clover'), 'Clover');
  assert.equal(clockLabel(7 * 60 + 30), '07:30');
  const tapped = withCare(s, 'bunny', 'tapAt', at(15));
  assert.equal(tapped.care.bunny?.tapAt, at(15));
  assert.equal(tapped.care.fox?.fedAt, 5);
  assert.equal(petLife(lifeInputFor(tapped, 'bunny', at(15), OFFSET)).state, 'happy');
  assert.notEqual(petLife(lifeInputFor(tapped, 'cat', at(15), OFFSET)).state, 'happy');
});

test('quiet hours move in steps and keep a sensible length', () => {
  const s = DEFAULT_PET_SETTINGS;
  assert.equal(shiftQuiet(s, 'quietStart', 30).quietStart, 22 * 60 + 30);
  assert.equal(shiftQuiet(s, 'quietEnd', -30).quietEnd, 6 * 60 + 30);
  let t = s;
  for (let i = 0; i < 40; i++) t = shiftQuiet(t, 'quietStart', 30);
  const len = (t.quietEnd - t.quietStart + 1440) % 1440;
  assert.ok(len >= 4 * 60 && len <= 20 * 60);
});

test('every caption and mood has copy in all languages', () => {
  for (const [locale, copy] of Object.entries(PET_COPY)) {
    for (const key of [...PET_CAPTIONS, 'sleepy', 'content', 'happy', 'playful', 'hungry'] as const) {
      assert.ok(copy[key] && copy[key].trim(), `${locale} ${key}`);
    }
  }
});

// Source guards (the cloud can't build Swift or mount React Native).
test('Live Activity follows Apple rules: staleDate + next state, no timers, no push', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const view = read('targets/widget/IslandPetActivity.swift');
  assert.match(view, /context\.isStale/);
  assert.match(view, /Text\(timerInterval:/);
  assert.doesNotMatch(view, /Timer\.|TimelineView|repeatForever/);
  const session = read('modules/glaze-island-pets/ios/GlazePetSession.swift');
  assert.match(session, /ActivityContent\(state: content, staleDate: until\)/);
  assert.match(session, /pushType: nil/);
  assert.doesNotMatch(session, /pushType: \.token|Timer\./);
  const screen = read('app/pets.tsx');
  assert.match(screen, /export default function PetsScreen/);
  assert.doesNotMatch(screen, /setInterval/);
  assert.match(screen, /useMotionReduced\(\)/);
});

// T192: the Island pet is synced whenever Glaze opens or returns to the foreground, one sync at a time.
test('source guard: Island pet syncs on app open and foreground, serialised', async () => {
  const { readFileSync } = await import('node:fs');
  const root = new URL('../../', import.meta.url);
  const layout = readFileSync(new URL('app/_layout.tsx', root), 'utf8');
  const store = readFileSync(new URL('src/store/pets.ts', root), 'utf8');
  assert.match(layout, /syncIslandPetOnOpen\(\)/);
  assert.match(layout, /AppState\.addEventListener\('change'/);
  assert.match(store, /export async function syncIslandPetOnOpen\(/);
  assert.match(store, /if \(!petsSupported\(\)\) return;/);
  assert.match(store, /queue = run\.catch/);
});
