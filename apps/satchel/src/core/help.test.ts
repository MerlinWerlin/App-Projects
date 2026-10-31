import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import {
  balancedHelp,
  countByCategory,
  filterHelp,
  firstPhone,
  HELP_CATEGORIES,
  helpChips,
  helpOverpassQuery,
  kindKey,
  nearestHelp,
  needsWider,
  packMissing,
  parseOverpassHelp,
  parsePackHelp,
  type HelpPlace,
} from './help.ts';

const HERE = { lat: 35.0, lon: 135.75 };

test('parsePackHelp: reads hospital_clinic, pharmacy (and future police) places, ignores other categories', () => {
  const pois = {
    built: '2026-10-30',
    toilets: [{ id: 'n9', lat: 35, lon: 135.75 }],
    places: [
      { id: 'w1', lat: 35.01, lon: 135.75, category: 'hospital_clinic', name: 'City Hospital' },
      { id: 'n2', lat: 35.002, lon: 135.751, category: 'pharmacy' },
      { id: 'n3', lat: 35.003, lon: 135.752, category: 'fuel', name: 'Gas' },
      { id: 'n4', lat: 35.004, lon: 135.753, category: 'police', name: 'Koban', phone: '110' },
      { id: 'n5', lat: 35.005, lon: 135.754, category: 'atm_bank' },
    ],
  };
  const out = parsePackHelp(JSON.stringify(pois));
  assert.deepEqual(
    out.map((p) => [p.id, p.category, p.kind]),
    [
      ['w1', 'medical', undefined],
      ['n2', 'pharmacy', 'pharmacy'],
      ['n4', 'police', 'police'],
    ],
  );
  assert.equal(out[0].name, 'City Hospital');
  assert.equal(out[1].name, undefined);
  assert.equal(out[2].tel, 'tel:110');
});

test('parsePackHelp: optional amenity / phone / hours / emergency fields are kept when a pack carries them', () => {
  const out = parsePackHelp({
    places: [{ id: 'w7', lat: 35.01, lon: 135.75, category: 'hospital_clinic', amenity: 'hospital', phone: '+81 75-111-2222', opening_hours: '24/7', emergency: 'yes' }],
  });
  assert.equal(out[0].kind, 'hospital');
  assert.equal(out[0].phone, '+81 75-111-2222');
  assert.equal(out[0].tel, 'tel:+81751112222');
  assert.equal(out[0].opening_hours, '24/7');
  assert.equal(out[0].emergency, true);
});

test('parsePackHelp: malformed input and rows are skipped, never thrown', () => {
  for (const bad of [null, undefined, 42, '', '{oops', '[]', { places: 'x' }, { toilets: [] }]) assert.deepEqual(parsePackHelp(bad), []);
  const out = parsePackHelp({
    places: [
      null,
      'n1',
      { id: '', lat: 35, lon: 135, category: 'pharmacy' },
      { id: 'n2', lat: 91, lon: 135, category: 'pharmacy' },
      { id: 'n3', lat: 35, lon: '135', category: 'pharmacy' },
      { id: 'n4', lat: 35, lon: 135, category: 42 },
      { id: 'n5', lat: 35, lon: 135, category: 'pharmacy', access: 'private' },
      { id: 'n6', lat: 35, lon: 135, category: 'pharmacy', name: '  ' },
      { id: 'n6', lat: 36, lon: 136, category: 'pharmacy' },
    ],
  });
  assert.deepEqual(
    out.map((p) => [p.id, p.lat, p.name]),
    [['n6', 35, undefined]],
  );
});

test('parseOverpassHelp: amenity -> category + kind, centres for ways/relations, English name preferred', () => {
  const json = {
    elements: [
      { type: 'node', id: 1, lat: 35.001, lon: 135.75, tags: { amenity: 'pharmacy', name: '薬局', 'name:en': 'Corner Pharmacy', opening_hours: 'Mo-Sa 09:00-20:00' } },
      { type: 'way', id: 22, center: { lat: 35.01, lon: 135.751 }, tags: { amenity: 'hospital', name: 'Red Cross Hospital', emergency: 'yes', phone: '+81 75 123 4567;+81 75 765 4321' } },
      { type: 'relation', id: 333, center: { lat: 35.02, lon: 135.752 }, tags: { amenity: 'clinic', 'contact:phone': '075-000-1111' } },
      { type: 'node', id: 4, lat: 35.003, lon: 135.749, tags: { amenity: 'police', name: 'Police Box' } },
      { type: 'node', id: 5, lat: 35.004, lon: 135.749, tags: { amenity: 'toilets' } },
      { type: 'node', id: 6, lat: 35.005, lon: 135.749, tags: { shop: 'chemist' } },
      { type: 'way', id: 7, tags: { amenity: 'hospital' } }, // no center
      { type: 'node', id: 8, lat: 35.006, lon: 135.749, tags: { amenity: 'clinic', access: 'private' } },
      { type: 'area', id: 9, lat: 35, lon: 135, tags: { amenity: 'police' } },
      { type: 'node', id: 1, lat: 35.001, lon: 135.75, tags: { amenity: 'pharmacy' } }, // duplicate
    ],
  };
  const out = parseOverpassHelp(json);
  assert.deepEqual(
    out.map((p) => [p.id, p.category, p.kind]),
    [
      ['n1', 'pharmacy', 'pharmacy'],
      ['w22', 'medical', 'hospital'],
      ['r333', 'medical', 'clinic'],
      ['n4', 'police', 'police'],
    ],
  );
  assert.equal(out[0].name, 'Corner Pharmacy');
  assert.equal(out[0].opening_hours, 'Mo-Sa 09:00-20:00');
  assert.equal(out[1].phone, '+81 75 123 4567');
  assert.equal(out[1].tel, 'tel:+81751234567');
  assert.equal(out[1].emergency, true);
  assert.equal(out[2].tel, 'tel:0750001111');
  assert.equal(out[3].emergency, undefined);
});

test('parseOverpassHelp: malformed answers give []', () => {
  for (const bad of [null, 'nope', '{"elements":5}', { elements: [null, 1, 'x', { type: 'node' }] }]) assert.deepEqual(parseOverpassHelp(bad), []);
  assert.equal(parseOverpassHelp('{"elements":[{"type":"node","id":1,"lat":1,"lon":2,"tags":{"amenity":"police"}}]}').length, 1);
});

test('firstPhone: first dialable number, null for junk', () => {
  assert.deepEqual(firstPhone('+44 20 7946 0000; +44 20 7946 0001'), { phone: '+44 20 7946 0000', tel: 'tel:+442079460000' });
  assert.deepEqual(firstPhone('0221/123456'), { phone: '0221/123456', tel: 'tel:0221123456' });
  assert.deepEqual(firstPhone('n/a, 112'), { phone: '112', tel: 'tel:112' });
  assert.equal(firstPhone(''), null);
  assert.equal(firstPhone('call us'), null);
  assert.equal(firstPhone(12345), null);
});

test('emergency=yes only marks medical places', () => {
  const out = parseOverpassHelp({ elements: [{ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'police', emergency: 'yes' } }] });
  assert.equal(out[0].emergency, undefined);
});

const P = (id: string, lat: number, category: HelpPlace['category']): HelpPlace => ({ id, lat, lon: 135.75, category });

test('nearestHelp: nearest first, ties keep order, distance / direction / minutes, radius and limit', () => {
  const places = [P('far', 35.05, 'medical'), P('near', 35.001, 'pharmacy'), P('tieA', 35.002, 'police'), P('tieB', 35.002, 'medical'), P('south', 34.99, 'police')];
  const hits = nearestHelp(places, HERE);
  assert.deepEqual(
    hits.map((h) => h.id),
    ['near', 'tieA', 'tieB', 'south', 'far'],
  );
  assert.equal(hits[0].dirKey, 'help.dir.n');
  assert.equal(hits[3].dirKey, 'help.dir.s');
  assert.ok(Math.abs(hits[0].meters - 111) < 2);
  assert.equal(hits[0].minutes, 1);
  assert.ok(hits[4].minutes > 60);
  assert.deepEqual(
    nearestHelp(places, HERE, 2).map((h) => h.id),
    ['near', 'tieA'],
  );
  assert.deepEqual(
    nearestHelp(places, HERE, 99, 500).map((h) => h.id),
    ['near', 'tieA', 'tieB'],
  );
  assert.deepEqual(nearestHelp([], HERE), []);
});

test('balancedHelp caps each category, keeps distance order; filter + counts', () => {
  const places = [P('p1', 35.001, 'pharmacy'), P('p2', 35.002, 'pharmacy'), P('p3', 35.003, 'pharmacy'), P('h1', 35.04, 'medical'), P('x1', 35.05, 'police')];
  const hits = balancedHelp(nearestHelp(places, HERE), 2);
  assert.deepEqual(
    hits.map((h) => h.id),
    ['p1', 'p2', 'h1', 'x1'],
  );
  assert.deepEqual(countByCategory(hits), { medical: 1, pharmacy: 2, police: 1 });
  assert.deepEqual(
    filterHelp(hits, 'pharmacy').map((h) => h.id),
    ['p1', 'p2'],
  );
  assert.equal(filterHelp(hits, 'all').length, 4);
  assert.equal(needsWider(hits), false);
  assert.equal(needsWider(filterHelp(hits, 'pharmacy')), true);
});

test('packMissing: police is reported missing for today\'s packs, not when a pack has police rows', () => {
  assert.deepEqual(packMissing([P('a', 35, 'medical')]), ['police']);
  assert.deepEqual(packMissing([P('a', 35, 'medical'), P('b', 35, 'police')]), []);
  assert.deepEqual(packMissing([]), ['police']);
});

test('helpOverpassQuery: all four amenities, clamped radius, trimmed coordinates', () => {
  assert.equal(
    helpOverpassQuery(35.0116, 135.768, 2000),
    '[out:json][timeout:25];nwr["amenity"~"^(hospital|clinic|pharmacy|police)$"](around:2000,35.0116,135.768);out center 180;',
  );
  assert.match(helpOverpassQuery(1.123456789, 2, 99999), /around:15000,1\.123457,2\)/);
  assert.match(helpOverpassQuery(1, 2, 0), /around:1,/);
  assert.match(helpOverpassQuery(1, 2, Number.NaN), /around:2000,/);
});

test('helpChips: emergency department, 24/7 or shortened hours', () => {
  assert.deepEqual(helpChips({ emergency: true, opening_hours: '24/7' }), [{ id: 'emergencyDept' }, { id: 'open247' }]);
  assert.deepEqual(helpChips({ opening_hours: 'Mo-Fr 09:00-18:00' }), [{ id: 'hours', text: 'Mo-Fr 09:00-18:00' }]);
  const long = helpChips({ opening_hours: 'Mo-Fr 09:00-12:30,14:00-18:00; Sa 09:00-13:00; PH off; Su off' });
  assert.equal(long[0].id, 'hours');
  assert.ok('text' in long[0] && long[0].text.length === 48 && long[0].text.endsWith('…'));
  assert.deepEqual(helpChips({}), []);
});

test('every key the help screen derives exists in the catalogue', () => {
  const keys = en as Record<string, string>;
  for (const d of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) assert.ok(`help.dir.${d}` in keys, d);
  for (const c of HELP_CATEGORIES) assert.ok(`help.filter.${c}` in keys, c);
  for (const p of [{ category: 'medical' }, { category: 'medical', kind: 'hospital' }, { category: 'medical', kind: 'clinic' }, { category: 'pharmacy' }, { category: 'police' }] as const)
    assert.ok(kindKey(p) in keys, kindKey(p));
  for (const id of ['emergencyDept', 'open247', 'hours']) assert.ok(`help.chip.${id}` in keys, id);
  assert.equal(keys['help.attribution'], '© OpenStreetMap contributors');
});
