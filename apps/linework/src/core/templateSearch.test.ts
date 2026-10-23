import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, type Template } from './templates.ts';
import {
  COLLECTIONS,
  NO_FILTERS,
  RECENT_TEMPLATES_CAP,
  SCORE,
  addRecentTemplate,
  filterCounts,
  getCollection,
  hasActiveFilters,
  inCollection,
  isFavoritesParam,
  parseCollection,
  parseFavorites,
  parseLevel,
  parseQuery,
  parseRecentTemplates,
  queryTokens,
  removeRecentTemplate,
  resolveTemplateIds,
  scoreTemplate,
  searchTemplates,
  serializeFavorites,
  serializeRecentTemplates,
  toggleFavorite,
  tokenize,
  type RecentTemplate,
  type TemplateFilters,
} from './templateSearch.ts';

const tpl = (id: string, name: string, extra: Partial<Template> = {}): Template => ({
  id,
  name,
  category: 'flowers',
  viewBox: '0 0 400 400',
  paths: ['M0 0L1 1'],
  ...extra,
});

const FIX: Template[] = [
  tpl('rose', 'Rose'),
  tpl('cake', 'Birthday cake', { category: 'stilllife', tags: ['birthday', 'cute'] }),
  tpl('cat', 'Sleepy cat', { category: 'animals', tags: ['cute'] }),
  tpl('fox', 'Fox in roses', { category: 'animals', level: 'intermediate', tags: ['botanical', 'whimsical'] }),
  tpl('wreath', 'Holly wreath', { category: 'patterns', level: 'advanced', tags: ['christmas', 'botanical'] }),
  tpl('rings', 'Wedding rings', { category: 'stilllife', level: 'intermediate', tags: ['wedding', 'love'] }),
  tpl('skull', 'Floral skull', { category: 'fantasy', level: 'advanced', tags: ['gothic', 'halloween'] }),
  tpl('fern', 'Fern frond', { level: 'advanced', tags: ['botanical', 'vintage'] }),
  tpl('thanks', 'Thank you script', { category: 'lettering', level: 'intermediate', tags: ['thanks'] }),
  tpl('mandala', 'Lotus mandala', { category: 'mandalas', level: 'advanced', tags: ['ornamental', 'geometric'] }),
  tpl('cafe', 'Café front', { category: 'places', level: 'intermediate' }),
];

const f = (over: Partial<TemplateFilters> = {}): TemplateFilters => ({ ...NO_FILTERS, ...over });
const ids = (ts: readonly Template[]) => ts.map((t) => t.id);

test('tokenize lower-cases, strips accents and punctuation', () => {
  assert.deepEqual(tokenize('  Café-Front & Roses!'), ['cafe', 'front', 'roses']);
  assert.deepEqual(tokenize(''), []);
});

test('queryTokens drops stopwords unless nothing is left, applies aliases', () => {
  assert.deepEqual(queryTokens('fox and the roses'), ['fox', 'roses']);
  assert.deepEqual(queryTokens('the'), ['the']);
  assert.deepEqual(queryTokens('Xmas'), ['christmas']);
  assert.deepEqual(queryTokens('constructor'), ['constructor']);
});

test('no query and no filters returns everything in catalogue order', () => {
  assert.deepEqual(ids(searchTemplates(FIX, f())), ids(FIX));
});

test('search is case-insensitive prefix matching on name words', () => {
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'SLE' }))), ['cat']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'cafe' }))), ['cafe']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'Café' }))), ['cafe']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'zebra' }))), []);
  // Not an infix match.
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'eepy' }))), []);
});

test('plural queries find singular names', () => {
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'cakes' }))), ['cake']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'foxes' }))), ['fox']);
});

test('every token must match (AND)', () => {
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'fox rose' }))), ['fox']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'fox cake' }))), []);
});

test('ranking: name match beats tag match beats category match', () => {
  const ts = [
    tpl('cat-match', 'Peony', { category: 'animals' }), // 'animals' category label: "Animals & pets"
    tpl('tag-match', 'Tulip', { tags: ['pets'] }),
    tpl('name-match', 'Pet portrait'),
  ];
  assert.deepEqual(ids(searchTemplates(ts, f({ query: 'pet' }))), ['name-match', 'tag-match', 'cat-match']);
  assert.ok(scoreTemplate(ts[2], 'pet') > scoreTemplate(ts[1], 'pet'));
  assert.ok(scoreTemplate(ts[1], 'pet') > scoreTemplate(ts[0], 'pet'));
  assert.equal(scoreTemplate(ts[0], 'pet'), SCORE.category);
});

test('whole-word name hits rank above prefix hits; ties keep catalogue order', () => {
  const ts = [tpl('a', 'Roses'), tpl('b', 'Rose'), tpl('c', 'Rosebud'), tpl('d', 'Rose')];
  assert.deepEqual(ids(searchTemplates(ts, f({ query: 'rose' }))), ['b', 'd', 'a', 'c']);
});

test('search matches tags, category labels and level labels', () => {
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'gothic' }))), ['skull']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'buildings' }))), ['cafe']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'advanced' }))), ['wreath', 'skull', 'fern', 'mandala']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'xmas' }))), ['wreath']);
});

test('localized names, categories and levels are searched alongside English (any script)', () => {
  const names: Record<string, string> = { rose: 'Rosa', cat: 'Gato dormilón', fox: '薔薇の中の狐', cafe: 'कैफ़े' };
  const loc = {
    name: (t: Template) => names[t.id] ?? t.name,
    category: (c: string) => (c === 'animals' ? 'Animales' : c),
    level: (l: string) => (l === 'advanced' ? 'Avanzado' : l),
  };
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'dormilon' }), [], loc)), ['cat']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: '狐' }), [], loc)), ['fox']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'कैफ़े' }), [], loc)), ['cafe']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'animales' }), [], loc)), ['cat', 'fox']);
  assert.equal(searchTemplates(FIX, f({ query: 'avanzado' }), [], loc).length, 4);
  // English still works with a localizer, and counts agree with results.
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'sleepy' }), [], loc)), ['cat']);
  assert.equal(filterCounts(FIX, f({ query: 'animales' }), [], loc).total, 2);
  // Without a localizer the translated words find nothing.
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'dormilon' }))), []);
});

test('category, level, collection and favourites filters combine', () => {
  assert.deepEqual(ids(searchTemplates(FIX, f({ category: 'animals' }))), ['cat', 'fox']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ level: 'beginner' }))), ['rose', 'cake', 'cat']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ category: 'animals', level: 'intermediate' }))), ['fox']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ collection: 'botanical' }))), ['fox', 'wreath', 'fern']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ collection: 'botanical', level: 'advanced' }))), ['wreath', 'fern']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ favoritesOnly: true }), ['fern', 'cat'])), ['cat', 'fern']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ favoritesOnly: true }), new Set(['fern']))), ['fern']);
  assert.deepEqual(ids(searchTemplates(FIX, f({ favoritesOnly: true }))), []);
  assert.deepEqual(ids(searchTemplates(FIX, f({ query: 'fern', category: 'animals' }))), []);
});

test('collections match their tags (and kids also matches beginner level)', () => {
  const by = (id: string) => ids(FIX.filter((t) => inCollection(t, getCollection(id)!)));
  assert.deepEqual(by('birthday'), ['cake']);
  assert.deepEqual(by('christmas'), ['wreath']);
  assert.deepEqual(by('wedding'), ['rings']);
  assert.deepEqual(by('thanks'), ['thanks']);
  assert.deepEqual(by('halloween'), ['skull']);
  assert.deepEqual(by('vintage'), ['skull', 'fern']);
  assert.deepEqual(by('whimsical'), ['fox']);
  assert.deepEqual(by('kids'), ['rose', 'cake', 'cat']);
  const cuteAdvanced = tpl('x', 'X', { level: 'advanced', tags: ['Cute'] });
  assert.ok(inCollection(cuteAdvanced, getCollection('kids')!));
  assert.equal(new Set(COLLECTIONS.map((c) => c.id)).size, COLLECTIONS.length);
  assert.equal(getCollection('birthday')?.label, 'Birthday cards');
});

test('filterCounts gives faceted counts holding other filters fixed', () => {
  const c = filterCounts(FIX, f({ category: 'animals' }), ['cat', 'rose']);
  assert.equal(c.total, 2);
  assert.equal(c.categories.all, FIX.length);
  assert.equal(c.categories.animals, 2);
  assert.equal(c.categories.flowers, 2);
  assert.equal(c.categories.shapes, 0);
  assert.equal(c.levels.all, 2);
  assert.equal(c.levels.beginner, 1);
  assert.equal(c.levels.intermediate, 1);
  assert.equal(c.levels.advanced, 0);
  assert.equal(c.collections.kids, 1);
  assert.equal(c.collections.botanical, 1);
  assert.equal(c.collections.birthday, 0);
  assert.equal(c.favorites, 1);

  const q = filterCounts(FIX, f({ query: 'rose' }));
  assert.equal(q.total, 2);
  assert.equal(q.categories.animals, 1);
  assert.equal(q.categories.flowers, 1);
});

test('filterCounts total always equals searchTemplates length (real catalogue too)', () => {
  const cases: Partial<TemplateFilters>[] = [{}, { query: 'r' }, { level: 'advanced' }, { collection: 'kids', category: 'animals' }];
  for (const lib of [FIX, [...TEMPLATES]]) {
    for (const over of cases) {
      assert.equal(filterCounts(lib, f(over)).total, searchTemplates(lib, f(over)).length);
    }
  }
});

test('search scales to a large library', () => {
  const big: Template[] = [];
  for (let i = 0; i < 2000; i++) big.push(tpl(`t${i}`, `Template number ${i}`, { tags: i % 2 ? ['vintage'] : ['cute'] }));
  const t0 = Date.now();
  const res = searchTemplates(big, f({ query: 'templ', collection: 'vintage' }));
  filterCounts(big, f({ query: 'templ' }));
  assert.equal(res.length, 1000);
  assert.ok(Date.now() - t0 < 1000);
});

test('route param parsers', () => {
  assert.equal(parseLevel('Advanced'), 'advanced');
  assert.equal(parseLevel(['beginner']), 'beginner');
  assert.equal(parseLevel('expert'), null);
  assert.equal(parseLevel(undefined), null);
  assert.equal(parseCollection('Birthday'), 'birthday');
  assert.equal(parseCollection('favorites'), null);
  assert.equal(parseCollection('nope'), null);
  assert.ok(isFavoritesParam('favourites'));
  assert.ok(isFavoritesParam(['favorites']));
  assert.ok(!isFavoritesParam('birthday'));
  assert.equal(parseQuery(['cat']), 'cat');
  assert.equal(parseQuery(42), '');
  assert.equal(parseQuery('x'.repeat(200)).length, 80);
});

test('hasActiveFilters', () => {
  assert.equal(hasActiveFilters(NO_FILTERS), false);
  assert.equal(hasActiveFilters(f({ query: '  ' })), false);
  assert.equal(hasActiveFilters(f({ query: 'a' })), true);
  assert.equal(hasActiveFilters(f({ favoritesOnly: true })), true);
});

test('addRecentTemplate: newest first, dedupe, cap', () => {
  let list: RecentTemplate[] = [];
  list = addRecentTemplate(list, 'a', 1);
  list = addRecentTemplate(list, 'b', 2);
  list = addRecentTemplate(list, 'a', 3);
  assert.deepEqual(list, [
    { id: 'a', usedAt: 3 },
    { id: 'b', usedAt: 2 },
  ]);
  for (let i = 0; i < 20; i++) list = addRecentTemplate(list, `t${i}`, 10 + i);
  assert.equal(list.length, RECENT_TEMPLATES_CAP);
  assert.equal(list[0].id, 't19');
  assert.deepEqual(addRecentTemplate(list, '', 99), list);
  assert.deepEqual(removeRecentTemplate([{ id: 'a', usedAt: 1 }], 'a'), []);
});

test('recent templates round-trip and tolerate bad data', () => {
  const list = [
    { id: 'b', usedAt: 2 },
    { id: 'a', usedAt: 1 },
  ];
  assert.deepEqual(parseRecentTemplates(serializeRecentTemplates(list)), list);
  assert.deepEqual(parseRecentTemplates(null), []);
  assert.deepEqual(parseRecentTemplates('not json'), []);
  assert.deepEqual(parseRecentTemplates('{"id":"a"}'), []);
  const messy = JSON.stringify([
    { id: 'a', usedAt: 1 },
    null,
    'x',
    { id: '', usedAt: 3 },
    { id: 'c', usedAt: 'soon' },
    { id: 'a', usedAt: 5 },
    { id: 'gone', usedAt: 9 },
    { id: 'b', usedAt: 4 },
  ]);
  assert.deepEqual(
    parseRecentTemplates(messy, (id) => id !== 'gone'),
    [
      { id: 'a', usedAt: 5 },
      { id: 'b', usedAt: 4 },
    ],
  );
  const many = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, usedAt: i })));
  assert.equal(parseRecentTemplates(many).length, RECENT_TEMPLATES_CAP);
});

test('toggleFavorite adds at the front and removes', () => {
  let favs: string[] = [];
  favs = toggleFavorite(favs, 'a');
  favs = toggleFavorite(favs, 'b');
  assert.deepEqual(favs, ['b', 'a']);
  favs = toggleFavorite(favs, 'a');
  assert.deepEqual(favs, ['b']);
  assert.deepEqual(toggleFavorite(favs, ''), ['b']);
});

test('favourites round-trip and tolerate bad data', () => {
  assert.deepEqual(parseFavorites(serializeFavorites(['a', 'b'])), ['a', 'b']);
  assert.deepEqual(parseFavorites(null), []);
  assert.deepEqual(parseFavorites('{'), []);
  assert.deepEqual(parseFavorites('"a"'), []);
  assert.deepEqual(parseFavorites(JSON.stringify(['a', 1, null, 'a', '', 'gone', 'b']), (id) => id !== 'gone'), ['a', 'b']);
});

test('resolveTemplateIds keeps order and skips missing ids', () => {
  assert.deepEqual(ids(resolveTemplateIds(['fern', 'missing', 'cat'], FIX)), ['fern', 'cat']);
});
