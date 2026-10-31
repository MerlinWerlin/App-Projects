// T99 bags: default bags, assignment and moves, Carry-on only, weight tally in kg / lb with the home units, hint
// rules, cleaning junk, and .satchel round trips (old files without bags still load).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addBag,
  assignBag,
  bagHints,
  bagOfItem,
  bagsOf,
  bagSummaries,
  CARRY_ID,
  CHECKED_ID,
  cleanBagData,
  DEFAULT_BAGS,
  editBag,
  filterItems,
  formatWeight,
  isCabin,
  isLiquidItem,
  MAX_BAGS,
  moveItems,
  NO_BAG,
  parseWeight,
  PERSONAL_ID,
  removeBag,
  setCarryOnOnly,
  setItemWeight,
  sortIntoBags,
  suggestBag,
  tallyItems,
  validFilter,
  visibleBags,
  weightInput,
  weightUnit,
} from './bags.ts';
import { defaultSystem } from './units.ts';
import type { PackItem, PackList } from './packing.ts';
import { buildTripFile, importTripFile, parseTripFile, parseTripFileText } from './tripfile.ts';
import type { Trip } from './model.ts';
import { en } from '../i18n/en.ts';
import { bags as bagStrings } from '../i18n/en/bags.ts';

const item = (id: string, label: string, category: string, extra: Partial<PackItem> = {}): PackItem => ({ id, label, done: false, category, ...extra });
const base = (): PackList => ({
  tripId: 't1',
  items: [
    item('a', 'Passport or ID', 'documents'),
    item('b', 'Power bank', 'tech'),
    item('c', 'Socks', 'clothes', { qty: 4 }),
    item('d', 'Personal medication', 'health'),
    item('e', 'Toothbrush and toothpaste', 'toiletries'),
    item('f', 'Wallet and payment cards', 'money'),
  ],
});

test('default bags: carry-on, personal item and checked, always present and first', () => {
  assert.deepEqual(bagsOf(null).map((b) => b.id), ['carry', 'personal', 'checked']);
  assert.deepEqual(bagsOf(base()).map((b) => b.kind), ['carry', 'personal', 'checked']);
  assert.ok(isCabin(DEFAULT_BAGS[0]) && isCabin(DEFAULT_BAGS[1]) && !isCabin(DEFAULT_BAGS[2]));
  // A list whose bags lost a built-in one gets it back; junk bags are dropped; own bags follow.
  const l = { ...base(), bags: [{ id: 'own1', kind: 'own', name: ' Camera   bag ', colour: 'plum' }, { id: 'x', kind: 'carry', colour: 'sea' }, 7, { id: 'own2', kind: 'own', name: '' }] } as unknown as PackList;
  const bags = bagsOf(l);
  assert.deepEqual(bags.map((b) => b.id), ['carry', 'personal', 'checked', 'own1']);
  assert.equal(bags[3].name, 'Camera bag');
  // An unknown colour falls back to the bag's own default.
  assert.equal(bagsOf({ bags: [{ id: 'checked', kind: 'checked', colour: 'neon' }] } as unknown as PackList)[2].colour, 'rust');
});

test('a list with no bag data is untouched by cleaning (old lists and old files)', () => {
  const l = base();
  assert.equal(cleanBagData(l), l);
  assert.equal(bagOfItem(l, l.items[0]), null);
  assert.deepEqual(filterItems(l, NO_BAG).length, 6);
});

test('suggestBag and sortIntoBags: papers and money in the personal item, tech / meds / power banks in the carry-on, the rest checked', () => {
  const l = base();
  assert.equal(suggestBag(l, l.items[0]), PERSONAL_ID);
  assert.equal(suggestBag(l, l.items[1]), CARRY_ID);
  assert.equal(suggestBag(l, l.items[2]), CHECKED_ID);
  assert.equal(suggestBag(l, l.items[3]), CARRY_ID);
  assert.equal(suggestBag(l, item('z', 'Spare batteries', 'misc')), CARRY_ID);
  const r = sortIntoBags(assignBag(l, 'c', PERSONAL_ID));
  assert.equal(r.sorted, 5);
  assert.deepEqual(r.list.items.map((i) => i.bag), ['personal', 'carry', 'personal', 'carry', 'checked', 'personal']);
  assert.equal(sortIntoBags(r.list).sorted, 0);
  assert.equal(sortIntoBags(r.list).list, r.list, 'nothing to sort: same list');
});

test('assignBag and moveItems: put in, move, take out; unknown bags and rows are ignored', () => {
  let l = assignBag(base(), 'c', CHECKED_ID);
  assert.equal(l.items[2].bag, 'checked');
  assert.ok(l.bags, 'bags written once used');
  l = assignBag(l, 'c', CARRY_ID);
  assert.equal(l.items[2].bag, 'carry');
  assert.equal(assignBag(l, 'c', 'nope'), l);
  assert.equal(assignBag(l, 'nope', CARRY_ID), l);
  assert.equal(assignBag(l, 'c', CARRY_ID), l, 'no change: same list');
  l = assignBag(l, 'c', null);
  assert.equal('bag' in l.items[2], false);
  l = moveItems(l, ['a', 'b'], CHECKED_ID);
  assert.deepEqual(filterItems(l, CHECKED_ID).map((i) => i.id), ['a', 'b']);
  assert.deepEqual(filterItems(l, NO_BAG).map((i) => i.id), ['c', 'd', 'e', 'f']);
  assert.equal(filterItems(l, 'all').length, 6);
});

test('own bags: add, rename, recolour, cabin or hold, limit, remove (its rows lose their bag, nothing deleted)', () => {
  let r = addBag(base(), { name: 'Camera bag', colour: 'forest', hold: false }, 'bag1');
  assert.equal(r.error, undefined);
  let l = r.list;
  assert.equal(addBag(l, { name: ' camera  BAG! ', colour: 'sea', hold: false }, 'bag2').error, 'duplicate');
  assert.equal(addBag(l, { name: '  ', colour: 'sea', hold: false }, 'bag2').error, 'empty');
  l = assignBag(l, 'b', 'bag1');
  assert.ok(isCabin(bagsOf(l)[3]));
  r = editBag(l, 'bag1', { name: 'Photo kit', colour: 'amber', hold: true, limitG: 5000 });
  l = r.list;
  assert.deepEqual(bagsOf(l)[3], { id: 'bag1', kind: 'own', name: 'Photo kit', colour: 'amber', hold: true, limitG: 5000 });
  assert.equal(editBag(l, 'bag1', { name: '' }).error, 'empty');
  // Built-in bags take a colour and a limit only.
  l = editBag(l, 'carry', { name: 'Mine', hold: true, colour: 'navy', limitG: 7000 }).list;
  assert.deepEqual(bagsOf(l)[0], { id: 'carry', kind: 'carry', colour: 'navy', limitG: 7000 });
  l = editBag(l, 'carry', { limitG: null }).list;
  assert.equal(bagsOf(l)[0].limitG, undefined);
  assert.equal(removeBag(l, 'carry'), l, 'built-in bags stay');
  l = removeBag(l, 'bag1');
  assert.equal(bagsOf(l).length, 3);
  assert.equal(l.items.length, 6);
  assert.equal(l.items[1].bag, undefined);
  // At most MAX_BAGS bags.
  let full = base();
  for (let n = 0; n < MAX_BAGS + 2; n++) full = addBag(full, { name: `Bag ${n}`, colour: 'slate', hold: false }, `b${n}`).list;
  assert.equal(bagsOf(full).length, MAX_BAGS);
  assert.equal(addBag(full, { name: 'More', colour: 'slate', hold: false }, 'more').error, 'full');
});

test('Carry-on only: hold rows move to the carry-on, hold bags hide, and switching off puts them back', () => {
  let l = sortIntoBags(base()).list;
  l = addBag(l, { name: 'Duffel', colour: 'plum', hold: true }, 'duf').list;
  l = assignBag(l, 'c', 'duf');
  const on = setCarryOnOnly(l, true);
  assert.equal(on.carryOnOnly, true);
  assert.deepEqual(on.items.map((i) => [i.id, i.bag, i.movedFrom]), [
    ['a', 'personal', undefined],
    ['b', 'carry', undefined],
    ['c', 'carry', 'duf'],
    ['d', 'carry', undefined],
    ['e', 'carry', 'checked'],
    ['f', 'personal', undefined],
  ]);
  assert.deepEqual(visibleBags(on).map((b) => b.id), ['carry', 'personal']);
  assert.equal(validFilter(on, CHECKED_ID), 'all');
  assert.equal(validFilter(on, PERSONAL_ID), PERSONAL_ID);
  // Hold bags are refused while it is on; new rows sort into the carry-on.
  assert.equal(assignBag(on, 'a', CHECKED_ID), on);
  assert.equal(suggestBag(on, item('z', 'Shorts', 'clothes')), CARRY_ID);
  // A row moved by hand stays where it was put.
  const moved = assignBag(on, 'e', PERSONAL_ID);
  assert.equal(moved.items[4].movedFrom, undefined);
  const off = setCarryOnOnly(moved, false);
  assert.equal(off.carryOnOnly, undefined);
  assert.deepEqual(off.items.map((i) => i.bag), ['personal', 'carry', 'duf', 'carry', 'personal', 'personal']);
  assert.ok(off.items.every((i) => i.movedFrom === undefined));
  assert.equal(setCarryOnOnly(off, false), off);
  // An own cabin bag switched to the hold while Carry-on only is on empties into the carry-on too.
  let c = assignBag(addBag(base(), { name: 'Tote', colour: 'sea', hold: false }, 'tote').list, 'a', 'tote');
  c = setCarryOnOnly(c, true);
  c = editBag(c, 'tote', { hold: true }).list;
  assert.deepEqual([c.items[0].bag, c.items[0].movedFrom], ['carry', 'tote']);
});

test('weights: per row, multiplied by the quantity, against the typed limit', () => {
  let l = sortIntoBags(base()).list;
  l = setItemWeight(l, 'c', 60); // socks x4
  l = setItemWeight(l, 'e', 150);
  l = setItemWeight(l, 'e', null);
  assert.equal(l.items[4].weightG, undefined);
  l = setItemWeight(l, 'e', 150.4);
  assert.equal(l.items[4].weightG, 150);
  assert.equal(setItemWeight(l, 'e', -5).items[4].weightG, undefined, 'junk clears');
  l = editBag(l, CHECKED_ID, { limitG: 300 }).list;
  const qty = (i: PackItem) => i.qty;
  const s = bagSummaries(l, qty);
  const checked = s.bags.find((b) => b.bag.id === CHECKED_ID)!.tally;
  assert.deepEqual(checked, { rows: 2, done: 0, things: 5, weightG: 390, weighed: 2, unweighed: 0, limitG: 300, overG: 90, leftG: 0 });
  assert.equal(s.none, null);
  assert.equal(s.all.things, 9);
  const t = tallyItems([item('x', 'X', 'misc', { weightG: 100, done: true }), item('y', 'Y', 'misc')], undefined, 1000);
  assert.deepEqual(t, { rows: 2, done: 1, things: 2, weightG: 100, weighed: 1, unweighed: 1, limitG: 1000, overG: 0, leftG: 900 });
});

test('kg / lb follow the home units: imperial home in pounds, any other home in kilograms', () => {
  assert.equal(weightUnit(defaultSystem('US')), 'lb');
  assert.equal(weightUnit(defaultSystem('AU')), 'kg');
  assert.equal(weightUnit(defaultSystem(null, 'f')), 'lb');
  assert.equal(weightUnit(defaultSystem(null)), 'kg');
  assert.equal(formatWeight(23000, 'kg'), '23');
  assert.equal(formatWeight(350, 'kg'), '0.35');
  assert.equal(formatWeight(23000, 'lb'), '50.7');
  assert.equal(formatWeight(1500, 'kg', 'de'), '1,5');
  assert.equal(parseWeight('7', 'kg'), 7000);
  assert.equal(parseWeight('0,35', 'kg', 'de'), 350);
  assert.equal(parseWeight('50', 'lb'), 22680);
  assert.equal(parseWeight('', 'kg'), undefined);
  assert.equal(parseWeight('abc', 'kg'), null);
  assert.equal(parseWeight('0', 'kg'), null);
  assert.equal(parseWeight('-2', 'kg'), null);
  assert.equal(parseWeight('500', 'kg'), null, 'over 200 kg is a typo');
  assert.equal(weightInput(350, 'kg'), '0.35');
  assert.equal(weightInput(1500, 'kg', 'de'), '1,5');
  assert.equal(weightInput(undefined, 'kg'), '');
  assert.equal(parseWeight(weightInput(22680, 'lb'), 'lb'), 22680);
});

test('hints: power banks and medicines in the hold, liquids in the cabin, a bag over its limit', () => {
  assert.deepEqual(bagHints(base()), [], 'no bags yet: no hints');
  let l = moveItems(base(), ['b', 'd', 'c'], CHECKED_ID);
  l = assignBag(l, 'e', CARRY_ID);
  l = assignBag(l, 'a', PERSONAL_ID);
  l = setItemWeight(l, 'c', 2000);
  l = editBag(l, CHECKED_ID, { limitG: 1000 }).list;
  const h = bagHints(l);
  assert.deepEqual(h.map((x) => x.kind), ['battery', 'medicine', 'liquids', 'overLimit']);
  assert.deepEqual(h[0].itemIds, ['b']);
  assert.deepEqual(h[1].itemIds, ['d']);
  assert.deepEqual(h[2].itemIds, ['e']);
  assert.deepEqual([h[3].bagId, h[3].overG], [CHECKED_ID, 1000]);
  // Following the hint clears it.
  const fixed = moveItems(l, h[0].itemIds.concat(h[1].itemIds), CARRY_ID);
  assert.deepEqual(bagHints(fixed).map((x) => x.kind), ['liquids', 'overLimit']);
  // Liquids by name or toiletries; not shoes or an empty bottle.
  assert.ok(isLiquidItem({ label: 'Sunscreen', category: 'health' }));
  assert.ok(isLiquidItem({ label: 'Hand sanitiser', category: 'misc' }));
  assert.ok(!isLiquidItem({ label: 'Walking shoes', category: 'clothes' }));
  assert.ok(!isLiquidItem({ label: 'Snacks and empty water bottle', category: 'misc' }));
});

test('cleaning junk: unknown bag links, bad weights and stray moved-from links are dropped', () => {
  const l = {
    tripId: 't',
    bags: [{ id: 'carry', kind: 'carry', colour: 'sea', limitG: -1, extra: 'kept' }],
    carryOnOnly: 'yes',
    items: [
      { id: 'a', label: 'A', done: false, bag: 'gone', weightG: 'heavy', movedFrom: 'checked' },
      { id: 'b', label: 'B', done: false, bag: 'carry', weightG: 99.6, movedFrom: 'nope' },
    ],
  } as unknown as PackList;
  const c = cleanBagData(l);
  assert.deepEqual(c.items, [
    { id: 'a', label: 'A', done: false },
    { id: 'b', label: 'B', done: false, bag: 'carry', weightG: 100 },
  ]);
  assert.equal(c.carryOnOnly, undefined);
  assert.deepEqual(c.bags?.[0], { id: 'carry', kind: 'carry', colour: 'sea', extra: 'kept' });
  assert.equal(c.bags?.length, 3);
});

// ---- .satchel files ----

const trip: Trip = { id: 'trip1', name: 'Kyoto', startDate: '2027-05-01', endDate: '2027-05-05', homeTz: 'Australia/Sydney', items: [], places: [], createdAt: '2027-01-01T00:00:00.000Z' };

test('.satchel round trip: bags, bag links, weights and Carry-on only travel; rows get new ids, bag ids stay', () => {
  let l = sortIntoBags({ ...base(), tripId: 'trip1' }).list;
  l = addBag(l, { name: 'Duffel', colour: 'plum', hold: true }, 'duf').list;
  l = editBag(assignBag(l, 'c', 'duf'), 'duf', { limitG: 9000 }).list;
  l = setItemWeight(l, 'c', 80);
  l = setCarryOnOnly(l, true);
  const built = buildTripFile(trip, {}, { packing: l, now: '2027-01-02T00:00:00.000Z' }).file;
  const parsed = parseTripFileText(JSON.stringify(built));
  assert.ok(parsed.ok);
  let n = 0;
  const imp = importTripFile(parsed.file, (p) => `${p}_${++n}`);
  assert.ok(imp.packing);
  const p = imp.packing;
  assert.deepEqual(p.bags, l.bags);
  assert.equal(p.carryOnOnly, true);
  assert.deepEqual(p.items.map((i) => [i.label, i.bag, i.weightG, i.movedFrom]), l.items.map((i) => [i.label, i.bag, i.weightG, i.movedFrom]));
  assert.ok(p.items.every((i, k) => i.id !== l.items[k].id));
  // Switching Carry-on only off on the imported copy puts the socks back in the duffel.
  assert.equal(setCarryOnOnly(p, false).items[2].bag, 'duf');
});

test('.satchel: an old file with no bags loads unchanged, and junk bag data never refuses a file', () => {
  // A file written before T99: packing rows with no bag, weight or bags list.
  const oldPacking = { template: 'city_break', laundry: true, items: [{ id: 'p1', label: 'Socks', done: true, category: 'clothes', qty: 3, templateItemId: 'cb_socks' }] };
  const old = { format: 'satchel-trip', version: 1, exported_at: '2026-10-01T00:00:00.000Z', trip: { id: 'o', name: 'Old', startDate: '2026-11-01', endDate: '2026-11-03', homeTz: 'UTC', createdAt: '' }, items: [], places: [], attachments: [], packing: oldPacking };
  const r = parseTripFile(structuredClone(old));
  assert.ok(r.ok);
  assert.deepEqual(r.file.packing, oldPacking);
  const imp = importTripFile(r.file, (x) => `${x}_1`);
  assert.equal(imp.packing?.bags, undefined);
  assert.equal(filterItems(imp.packing!, NO_BAG).length, 1);
  const junk = {
    format: 'satchel-trip',
    version: 1,
    exported_at: '',
    trip: { name: 'X', startDate: '2027-01-01', endDate: '2027-01-02' },
    items: [],
    places: [],
    attachments: [],
    packing: { items: [{ id: 'a', label: 'A', done: true, bag: 42, weightG: 1e9 }], bags: 'lots', carryOnOnly: 1 },
  };
  const j = parseTripFile(junk);
  assert.ok(j.ok);
  assert.deepEqual(j.file.packing?.items, [{ id: 'a', label: 'A', done: true }]);
  assert.equal(j.file.packing?.carryOnOnly, undefined);
});

test('every bags string lives in src/i18n/en/bags.ts with the bags. prefix, and en.ts carries them', () => {
  const keys = Object.keys(bagStrings);
  assert.ok(keys.length > 30);
  for (const k of keys) {
    assert.ok(k.startsWith('bags.'), k);
    assert.equal((en as Record<string, string>)[k], (bagStrings as Record<string, string>)[k]);
  }
  // The guidance strings say they are general guidance and to check with the airline.
  assert.match(bagStrings['bags.hint.verify'], /general guidance/i);
  assert.match(bagStrings['bags.hint.verify'], /airline/i);
  // Every bags.* key the screen and components use exists.
  const src = ['app/packing/[tripId].tsx', 'src/ui/bags.tsx'].map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8')).join('\n');
  const used = [...src.matchAll(/'(bags\.[\w.]+)'/g)].map((m) => m[1]);
  assert.ok(used.length > 20);
  for (const k of used) assert.ok(k in bagStrings, k);
});
