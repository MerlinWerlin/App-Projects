import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Item, Trip } from './model.ts';
import {
  addItem,
  addTemplates,
  listTemplates,
  buildList,
  CATEGORY_ORDER,
  compareCategories,
  conditionsMet,
  dropList,
  emptyList,
  groupByCategory,
  listFor,
  normaliseLabel,
  parseTemplates,
  progress,
  putList,
  qtyFor,
  removeItem,
  renameItem,
  resetTicks,
  suggestTemplate,
  toggleItem,
  tripFacts,
  tripNights,
  type PackList,
  type Template,
} from './packing.ts';

const raw: unknown = JSON.parse(readFileSync(new URL('../content/packing_templates.json', import.meta.url), 'utf8'));
const data = parseTemplates(raw);
const tpl = (id: string) => {
  const t = data.templates.find((x) => x.id === id);
  assert.ok(t, id);
  return t;
};

const trip = (startDate: string, endDate: string, items: Partial<Item>[] = []): Trip => ({
  id: 't1',
  name: 'Trip',
  startDate,
  endDate,
  homeTz: 'Australia/Sydney',
  createdAt: '2026-10-01T00:00:00Z',
  items: items.map((i, n) => ({
    id: `i${n}`,
    tripId: 't1',
    kind: 'note',
    title: 'x',
    start: { local: `${startDate}T09:00`, tz: 'Australia/Sydney' },
    attachments: [],
    ...i,
  })),
});

test('parses the bundled templates: 11 templates of 20 items, known categories and rules', () => {
  assert.equal(data.templates.length, 11);
  for (const t of data.templates) assert.equal(t.items.length, 20, t.id);
  const cats = new Set(data.templates.flatMap((t) => t.items.map((i) => i.category)));
  for (const c of cats) assert.ok((CATEGORY_ORDER as readonly string[]).includes(c), `category ${c} has a place in the order`);
  const rules = data.templates.flatMap((t) => t.items.map((i) => i.qty_rule)).filter((r) => r !== null);
  assert.ok(rules.length > 0);
  for (const r of rules) assert.ok(r.rule === 'per_day' || r.rule === 'per_2_days');
});

test('parseTemplates drops junk and unknown qty rules', () => {
  const f = parseTemplates({
    version: 2,
    templates: [
      { id: 'a', name: 'A', trip_types: ['x', 3], items: [{ id: 'i', label: ' Hat ', category: 'clothes', qty_rule: { rule: 'per_week', max: 2 }, conditions: 'cold' }, { id: 'j' }] },
      { name: 'no id' },
    ],
  });
  assert.equal(f.version, 2);
  assert.deepEqual(f.templates, [{ id: 'a', name: 'A', trip_types: ['x'], items: [{ id: 'i', label: 'Hat', category: 'clothes', qty_rule: null, conditions: [] }] }]);
  assert.deepEqual(parseTemplates(null), { version: 0, templates: [] });
});

test('trip nights and quantity rules (capped, at least 1)', () => {
  assert.equal(tripNights(trip('2026-11-01', '2026-11-05')), 4);
  assert.equal(tripNights(trip('2026-11-05', '2026-11-05')), 0);
  assert.equal(tripNights(trip('2026-11-05', '2026-11-01')), 0);
  assert.equal(qtyFor({ rule: 'per_day', max: 7 }, 4), 4);
  assert.equal(qtyFor({ rule: 'per_day', max: 7 }, 20), 7);
  assert.equal(qtyFor({ rule: 'per_day', max: 7 }, 0), 1);
  assert.equal(qtyFor({ rule: 'per_2_days', max: 4 }, 5), 3);
  assert.equal(qtyFor({ rule: 'per_2_days', max: 4 }, 30), 4);
  assert.equal(qtyFor({ rule: 'per_2_days', max: 4 }, 0), 1);
  assert.equal(qtyFor(null, 5), undefined);
  assert.equal(qtyFor({ rule: 'per_week', max: 3 } as never, 5), undefined);
});

test('conditions: included unless known false; templates and flights make facts true', () => {
  assert.ok(conditionsMet([], {}));
  assert.ok(conditionsMet(['cold'], {}));
  assert.ok(conditionsMet(['cold'], { cold: true }));
  assert.ok(!conditionsMet(['cold', 'intl'], { cold: true, intl: false }));
  const f = tripFacts(trip('2026-11-01', '2026-11-03', [{ kind: 'flight' }]), [tpl('ski_snow'), tpl('family_kids')]);
  assert.equal(f.cold, true);
  assert.equal(f.kids, true);
  assert.equal(f.flight, true);
  assert.equal(f.intl, undefined);
  assert.deepEqual(tripFacts(null, []), {});
});

test('builds a list from one template: all items, unticked, quantities from trip length, category order', () => {
  const l = buildList('t1', [tpl('city_break')], { nights: 4 });
  assert.equal(l.tripId, 't1');
  assert.equal(l.template, 'city_break');
  assert.deepEqual(l.templates, ['city_break']);
  assert.equal(l.items.length, 20);
  assert.ok(l.items.every((i) => !i.done));
  const by = new Map(l.items.map((i) => [i.templateItemId, i]));
  assert.equal(by.get('cb_underwear')?.qty, 4);
  assert.equal(by.get('cb_bottoms')?.qty, 2);
  assert.equal(by.get('cb_id')?.qty, undefined);
  const cats = l.items.map((i) => i.category ?? 'misc');
  for (let n = 1; n < cats.length; n++) assert.ok(compareCategories(cats[n - 1], cats[n]) <= 0, `${cats[n - 1]} before ${cats[n]}`);
  assert.equal(cats[0], 'documents');
  assert.equal(new Set(l.items.map((i) => i.id)).size, l.items.length);
});

test('merging templates de-duplicates by normalised label and keeps the larger quantity', () => {
  const a = buildList('t1', [tpl('city_break')], { nights: 10 });
  const b = buildList('t1', [tpl('beach')], { nights: 10 });
  const m = buildList('t1', [tpl('city_break'), tpl('beach')], { nights: 10 });
  const keys = new Set([...a.items, ...b.items].map((i) => normaliseLabel(i.label)));
  assert.equal(m.items.length, keys.size);
  assert.ok(m.items.length < a.items.length + b.items.length);
  const underwear = m.items.filter((i) => normaliseLabel(i.label) === 'underwear');
  assert.equal(underwear.length, 1);
  assert.equal(underwear[0].id, 'cb_underwear');
  assert.equal(underwear[0].qty, 7);
  assert.deepEqual(m.templates, ['city_break', 'beach']);
  assert.equal(new Set(m.items.map((i) => i.id)).size, m.items.length);

  const small: Template = { id: 's', name: 'S', trip_types: [], items: [{ id: 's1', label: 'UNDERWEAR!', category: 'clothes', qty_rule: { rule: 'per_day', max: 9 }, conditions: [] }] };
  const m2 = buildList('t1', [tpl('city_break'), small], { nights: 9 });
  assert.equal(m2.items.find((i) => i.id === 'cb_underwear')?.qty, 9);
  assert.equal(m2.items.length, 20);
});

test('items whose condition is known false are left out', () => {
  const l = buildList('t1', [tpl('city_break')], { nights: 3, facts: { cold: false, intl: false } });
  assert.ok(!l.items.some((i) => i.id === 'cb_coat' || i.id === 'cb_adapter'));
  assert.equal(l.items.length, 17);
});

test('an empty list and unknown categories sort after known ones, misc last', () => {
  assert.deepEqual(emptyList('t9'), { tripId: 't9', items: [] });
  assert.ok(compareCategories('documents', 'clothes') < 0);
  assert.ok(compareCategories('tech', 'zzz') < 0);
  assert.ok(compareCategories('zzz', 'misc') < 0);
  assert.equal(compareCategories('misc', 'misc'), 0);
});

test('suggests a template from the trip', () => {
  const ids = data.templates;
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-04'), ids), 'city_break');
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-20'), ids), 'longhaul_carryon');
  const longFlight = {
    kind: 'flight' as const,
    start: { local: '2026-11-01T21:00', tz: 'Australia/Sydney' },
    end: { local: '2026-11-02T05:30', tz: 'Asia/Tokyo' },
  };
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-05', [longFlight]), ids), 'longhaul_carryon');
  const shortFlight = { ...longFlight, end: { local: '2026-11-01T22:30', tz: 'Australia/Sydney' } };
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-05', [shortFlight]), ids), 'city_break');
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-05', [{ kind: 'car' }]), ids), 'road_trip');
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-05'), [tpl('beach')]), 'beach');
  assert.equal(suggestTemplate(trip('2026-11-01', '2026-11-05'), []), null);
});

test('toggle, add, remove, rename and reset are immutable', () => {
  const l0 = buildList('t1', [tpl('city_break')], { nights: 2 });
  const frozen = JSON.stringify(l0);
  const l1 = toggleItem(l0, 'cb_id');
  assert.equal(l1.items.find((i) => i.id === 'cb_id')?.done, true);
  assert.equal(toggleItem(l1, 'cb_id').items.find((i) => i.id === 'cb_id')?.done, false);
  assert.equal(toggleItem(l0, 'nope'), l0);

  const added = addItem(l1, '  Camera   charger ', 'c1');
  assert.equal(added.error, undefined);
  const mine = added.list.items.find((i) => i.id === 'c1');
  assert.deepEqual(mine, { id: 'c1', label: 'Camera charger', done: false, category: 'misc' });
  assert.equal(added.list.items[added.list.items.length - 1].id, 'c1');
  assert.equal(addItem(l1, '   ', 'c2').error, 'empty');
  assert.equal(addItem(l1, 'id or PASSPORT', 'c3').error, 'duplicate');
  assert.equal(addItem(l1, 'id or PASSPORT', 'c3').list, l1);

  const renamed = renameItem(added.list, 'c1', ' Camera battery ');
  assert.equal(renamed.items.find((i) => i.id === 'c1')?.label, 'Camera battery');
  assert.equal(renameItem(added.list, 'c1', '  '), added.list);

  const removed = removeItem(renamed, 'c1');
  assert.ok(!removed.items.some((i) => i.id === 'c1'));
  assert.equal(removeItem(removed, 'c1'), removed);

  const ticked = toggleItem(toggleItem(removed, 'cb_ticket'), 'cb_wallet');
  const reset = resetTicks(ticked);
  assert.equal(reset.items.length, ticked.items.length);
  assert.ok(reset.items.every((i) => !i.done));
  assert.equal(resetTicks(reset), reset);

  assert.equal(JSON.stringify(l0), frozen);
});

test('progress counts overall and per category, in category order', () => {
  let l: PackList = buildList('t1', [tpl('city_break')], { nights: 2 });
  l = addItem(l, 'Book', 'c1').list;
  l = toggleItem(toggleItem(toggleItem(l, 'cb_id'), 'cb_ticket'), 'c1');
  const p = progress(l);
  assert.equal(p.total, 21);
  assert.equal(p.done, 3);
  assert.deepEqual(p.categories[0], { category: 'documents', done: 2, total: 3 });
  assert.equal(p.categories[p.categories.length - 1].category, 'misc');
  assert.equal(p.categories.reduce((s, c) => s + c.total, 0), 21);
  assert.deepEqual(progress(null), { done: 0, total: 0, categories: [] });
});

test('groups by category in display order', () => {
  const l = addItem(buildList('t1', [tpl('beach')], { nights: 5 }), 'Book', 'c1').list;
  const g = groupByCategory(l);
  assert.equal(g[0].category, 'documents');
  assert.equal(g[g.length - 1].category, 'misc');
  assert.ok(g[g.length - 1].items.some((i) => i.id === 'c1'));
  assert.equal(g.reduce((s, x) => s + x.items.length, 0), l.items.length);
  for (let n = 1; n < g.length; n++) assert.ok(compareCategories(g[n - 1].category, g[n].category) < 0);
});

test('store helpers read defensively and update immutably', () => {
  const l = buildList('t1', [tpl('cruise')], { nights: 3 });
  const s0 = {};
  const s1 = putList(s0, l);
  assert.deepEqual(s0, {});
  assert.equal(listFor(s1, 't1')?.items.length, 20);
  assert.equal(listFor(s1, 'other'), null);
  assert.equal(listFor(null, 't1'), null);
  assert.equal(listFor({ t1: { items: 'x' } }, 't1'), null);
  assert.deepEqual(listFor({ t1: { items: [{ id: 'a', label: 'A', done: false }, { id: 3 }] } }, 't1')?.items, [{ id: 'a', label: 'A', done: false }]);
  assert.deepEqual(dropList(s1, 't1'), {});
  assert.equal(dropList(s0, 't1'), s0);
});

test('adding a template to an existing list keeps ticks and renames, skips duplicates and avoids id clashes', () => {
  const base = buildList('t1', [tpl('city_break')], { nights: 4 });
  const first = base.items[0];
  let l: PackList = toggleItem(base, first.id);
  l = renameItem(l, l.items[1].id, 'My own name');
  l = addItem(l, 'Kite', 'pk1').list;
  const before = l.items.length;
  const r = addTemplates(l, [tpl('beach')], { nights: 4 });
  assert.ok(r.added > 0);
  assert.equal(r.list.items.length, before + r.added);
  assert.equal(r.list.items.find((i) => i.id === first.id)?.done, true);
  assert.ok(r.list.items.some((i) => i.label === 'My own name'));
  assert.equal(new Set(r.list.items.map((i) => i.id)).size, r.list.items.length);
  const labels = r.list.items.map((i) => normaliseLabel(i.label));
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(r.list.items.filter((i) => !l.items.some((x) => x.id === i.id)).every((i) => !i.done));
  assert.deepEqual(listTemplates(r.list), ['city_break', 'beach']);
  assert.equal(l.items.length, before, 'input list untouched');
});

test('adding a template already on the list adds nothing; an empty pick returns the same list', () => {
  const base = buildList('t1', [tpl('city_break')], { nights: 4 });
  const again = addTemplates(base, [tpl('city_break')], { nights: 4 });
  assert.equal(again.added, 0);
  assert.equal(again.list.items, base.items);
  assert.deepEqual(listTemplates(again.list), ['city_break']);
  assert.equal(addTemplates(base, [], { nights: 4 }).list, base);
});

test('adding a template to an empty list works and records it; id clashes get a suffix', () => {
  const r = addTemplates(emptyList('t1'), [tpl('cruise')], { nights: 3 });
  assert.equal(r.added, 20);
  assert.equal(r.list.template, 'cruise');
  const clash: PackList = { tripId: 't1', items: [{ id: tpl('beach').items[0].id, label: 'Something else entirely', done: true }] };
  const r2 = addTemplates(clash, [tpl('beach')], { nights: 3 });
  assert.equal(new Set(r2.list.items.map((i) => i.id)).size, r2.list.items.length);
  assert.ok(r2.list.items.some((i) => i.id.endsWith('~2')));
  assert.deepEqual(listTemplates({ tripId: 't', items: [], template: 'old' }), ['old']);
  assert.deepEqual(listTemplates(emptyList('t')), []);
});
