import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_EGGS_WAITING,
  care,
  completeFocus,
  hatch,
  localDay,
  newGame,
  renamePet,
  restore,
  setBuddy,
  syncSteps,
  tick,
} from './game.ts';
import { DAILY_SPARK_CAP, EGG_COST, STAGE_XP, addXp, decayedHappiness, moodFor, stageForXp } from './growth.ts';
import { PITY_LIMIT, RARITY_ODDS, allVariantKeys, hatchPet, isRareOrBetter, petPalette, petParts, rollRarity, variantKey } from './pet.ts';
import { regionForCountry } from './region.ts';
import { hashString, makeRng } from './rng.ts';
import { SPECIES, getSpecies } from './species.ts';

const T0 = Date.UTC(2026, 10, 1, 0, 0, 0);
const DAY = '2026-11-01';

test('rng is deterministic per seed', () => {
  const a = makeRng(42), b = makeRng(42), c = makeRng(43);
  const xa = [a(), a(), a()], xb = [b(), b(), b()], xc = [c(), c(), c()];
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xc);
  for (const v of xa) assert.ok(v >= 0 && v < 1);
  assert.equal(hashString('roam'), hashString('roam'));
});

test('catalogue: 12 species, unique ids and palette ids, two mods each', () => {
  assert.equal(SPECIES.length, 12);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, 12);
  const pal = SPECIES.flatMap((s) => Object.values(s.palettes).map((p) => p.id));
  assert.equal(new Set(pal).size, pal.length);
  for (const s of SPECIES) {
    assert.equal(s.mods.length, 2, s.id);
    for (const m of s.mods) assert.notEqual((s.parts as unknown as Record<string, string>)[m.slot], m.value, `${s.id} mod must change the part`);
    for (const p of Object.values(s.palettes)) for (const c of [p.body, p.belly, p.accent, p.line]) assert.match(c, /^#[0-9A-F]{6}$/i);
  }
});

test('rarity odds add up to 100 and roughly hold over many rolls', () => {
  const total = Object.values(RARITY_ODDS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
  const rng = makeRng(7);
  const counts: Record<string, number> = {};
  const N = 50000;
  for (let i = 0; i < N; i++) {
    const r = rollRarity(rng, 0);
    counts[r] = (counts[r] ?? 0) + 1;
  }
  assert.ok(Math.abs((counts.common ?? 0) / N - 0.7) < 0.02);
  assert.ok(Math.abs((counts.uncommon ?? 0) / N - 0.22) < 0.02);
  assert.ok((counts.shimmer ?? 0) / N < 0.02);
});

test('pity guarantees rare or better', () => {
  const rng = makeRng(1);
  for (let i = 0; i < 500; i++) assert.ok(isRareOrBetter(rollRarity(rng, PITY_LIMIT - 1)));
});

test('hatchPet is reproducible from its seed and consistent with its rarity', () => {
  for (let seed = 1; seed < 400; seed++) {
    const a = hatchPet({ seed, region: 'oceania', pity: 0, now: T0, id: 'x' });
    const b = hatchPet({ seed, region: 'oceania', pity: 0, now: T0, id: 'x' });
    assert.deepEqual(a, b);
    const s = getSpecies(a.speciesId);
    if (a.rarity === 'common') assert.equal(a.paletteId, s.palettes.common.id);
    if (a.rarity === 'uncommon') assert.equal(a.paletteId, s.palettes.uncommon.id);
    if (a.rarity === 'mythic') assert.ok(a.mod && a.paletteId === s.palettes.shimmer.id);
    if (a.mod) assert.notEqual((s.parts as unknown as Record<string, string>)[a.mod.slot], (petParts(a) as unknown as Record<string, string>)[a.mod.slot]);
    assert.equal(petPalette(a).id, a.paletteId);
    assert.ok(allVariantKeys(a.speciesId).includes(variantKey(a)), `${a.rarity} variant must be listed in the dex`);
  }
});

test('growth stages and branching evolution', () => {
  assert.equal(stageForXp(0), 0);
  assert.equal(stageForXp(STAGE_XP[0]), 1);
  assert.equal(stageForXp(STAGE_XP[1]), 2);
  let pet = hatchPet({ seed: 9, region: 'wilds', pity: 0, now: T0, id: 'g' });
  let r = addXp(pet, 'scholarly', STAGE_XP[0], 50);
  assert.equal(r.evolved, true);
  assert.equal(r.pet.stage, 1);
  pet = r.pet;
  r = addXp(pet, 'swift', 100, 50);
  pet = r.pet;
  r = addXp(pet, 'scholarly', STAGE_XP[1], 50);
  assert.equal(r.pet.stage, 2);
  assert.equal(r.pet.branch, 'scholarly');
  // Branch is fixed once Grown.
  r = addXp(r.pet, 'swift', 100000, 50);
  assert.equal(r.pet.branch, 'scholarly');
  // Happy pets grow faster.
  const fresh = hatchPet({ seed: 9, region: 'wilds', pity: 0, now: T0, id: 'g' });
  assert.ok(addXp(fresh, 'cozy', 100, 95).pet.xp > addXp(fresh, 'cozy', 100, 50).pet.xp);
});

test('happiness decays to a floor and never below', () => {
  assert.equal(decayedHappiness(80, T0, T0), 80);
  assert.equal(decayedHappiness(80, T0, T0 + 5 * 3600_000), 60);
  assert.equal(decayedHappiness(80, T0, T0 + 100 * 3600_000), 10);
  assert.equal(moodFor(10), 'sleepy');
  assert.equal(moodFor(95), 'joyful');
});

test('first launch has a starter egg; hatching makes the first pet the buddy and fills the dex', () => {
  const g = newGame(T0, DAY, 'oceania');
  assert.equal(g.eggsReady, 1);
  const r = hatch(g, T0 + 1000, DAY);
  assert.equal(r.state.pets.length, 1);
  assert.equal(r.state.eggsReady, 0);
  assert.equal(r.state.buddyId, r.state.pets[0]!.id);
  assert.equal(r.state.dex.length, 1);
  assert.equal(r.state.pets[0]!.region, 'oceania');
  assert.ok(r.events.some((e) => e.kind === 'hatched' && e.newVariant));
  // No egg, no hatch.
  assert.equal(hatch(r.state, T0 + 2000, DAY).state.pets.length, 1);
});

test('steps turn into spark and eggs, counted once, capped per day', () => {
  let g = hatch(newGame(T0, DAY, 'oceania'), T0, DAY).state;
  let r = syncSteps(g, 5000, T0 + 1, DAY);
  assert.equal(r.state.sparkToday, 50);
  r = syncSteps(r.state, 5000, T0 + 2, DAY); // same total again: nothing new
  assert.equal(r.state.sparkToday, 50);
  r = syncSteps(r.state, 12000, T0 + 3, DAY);
  assert.equal(r.state.sparkToday, 120);
  assert.equal(r.state.eggsReady, 1);
  assert.equal(r.state.eggSpark, 120 - EGG_COST);
  assert.ok(r.events.some((e) => e.kind === 'egg'));
  // Buddy gained Swift XP.
  assert.ok(r.state.pets[0]!.branchXp.swift > 0);
  // Cap.
  r = syncSteps(r.state, 100000, T0 + 4, DAY);
  assert.equal(r.state.sparkToday, DAILY_SPARK_CAP);
  assert.ok(r.events.some((e) => e.kind === 'spark' && e.capped));
  // Eggs waiting never pass the max.
  assert.ok(r.state.eggsReady <= MAX_EGGS_WAITING);
  // New day resets the counters.
  g = tick(r.state, T0 + 86400_000, '2026-11-02');
  assert.equal(g.sparkToday, 0);
  assert.equal(g.stepsCounted, 0);
});

test('focus sessions give spark and scholarly xp', () => {
  const g = hatch(newGame(T0, DAY, 'oceania'), T0, DAY).state;
  const r = completeFocus(g, 50, T0 + 10, DAY);
  assert.equal(r.state.sparkToday, 20);
  assert.ok(r.state.pets[0]!.branchXp.scholarly > 0);
  assert.equal(completeFocus(g, 10, T0 + 10, DAY).state.sparkToday, 0);
});

test('care raises happiness, has cooldowns, builds a streak and caps care spark', () => {
  let g = hatch(newGame(T0, DAY, 'oceania'), T0, DAY).state;
  g = { ...g, happiness: 40, happinessAt: T0 };
  let r = care(g, 'feed', T0, DAY);
  assert.equal(r.state.happiness, 65);
  assert.equal(r.state.streak.count, 1);
  const again = care(r.state, 'feed', T0 + 1000, DAY);
  assert.ok(again.events.some((e) => e.kind === 'cooldown'));
  assert.ok(again.state.happiness <= r.state.happiness && again.state.happiness > r.state.happiness - 0.01);
  // Petting many times: care spark stops at the cap.
  let s = r.state;
  for (let i = 1; i <= 20; i++) s = care(s, 'pet', T0 + i * 61_000, DAY).state;
  assert.equal(s.careSparkToday, 12);
  // Next day continues the streak.
  r = care(s, 'pet', T0 + 86400_000, '2026-11-02');
  assert.equal(r.state.streak.count, 2);
  // Skipping a day restarts it.
  r = care(r.state, 'pet', T0 + 3 * 86400_000, '2026-11-04');
  assert.equal(r.state.streak.count, 1);
});

test('tick returns the same object when nothing changed (no render loops)', () => {
  const g = newGame(T0, DAY, 'wilds');
  assert.equal(tick(g, T0 + 5_000, DAY), g);
  assert.notEqual(tick(g, T0 + 61_000, DAY), g);
  assert.notEqual(tick(g, T0 + 5_000, '2026-11-02'), g);
});

test('no care without a pet', () => {
  const g = newGame(T0, DAY, 'oceania');
  assert.deepEqual(care(g, 'pet', T0, DAY).state.lastCare, g.lastCare);
});

test('buddy and rename', () => {
  let g = newGame(T0, DAY, 'wilds');
  g = { ...g, eggsReady: 2 };
  g = hatch(g, T0, DAY, 'a').state;
  g = hatch(g, T0 + 1, DAY, 'b').state;
  const second = g.pets[1]!.id;
  assert.equal(setBuddy(g, second).buddyId, second);
  assert.equal(setBuddy(g, 'nope').buddyId, g.buddyId);
  assert.equal(renamePet(g, second, '  Biscuit  ').pets[1]!.nickname, 'Biscuit');
  assert.equal(renamePet(g, second, '   ').pets[1]!.nickname, null);
});

test('restore falls back to a fresh game on bad data and keeps good data', () => {
  assert.equal(restore(null, T0, DAY, 'wilds').eggsReady, 1);
  assert.equal(restore({ version: 9 }, T0, DAY, 'wilds').pets.length, 0);
  const g = hatch(newGame(T0, DAY, 'wilds'), T0, DAY).state;
  const back = restore(JSON.parse(JSON.stringify(g)), T0, DAY, 'wilds');
  assert.equal(back.pets.length, 1);
});

test('regions from country codes', () => {
  assert.equal(regionForCountry('AU'), 'oceania');
  assert.equal(regionForCountry('gb'), 'uk-ie');
  assert.equal(regionForCountry('ZZ'), 'wilds');
  assert.equal(regionForCountry(null), 'wilds');
});

test('localDay formats the phone-local date', () => {
  assert.equal(localDay(new Date(2026, 0, 5, 12)), '2026-01-05');
});
