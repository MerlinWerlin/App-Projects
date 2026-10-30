import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOGUE,
  CATEGORIES,
  GLYPHS,
  getById,
  byCategory,
  search,
  normalize,
  editDistance,
  support,
  SUPPORT_LABELS,
  CATEGORY_GROUPS,
} from './catalogue.ts';
import { isKnownGlyph } from './glyphnames.ts';

// Brand glyphs that exist in Feather but must never be used (no brand logos).
const BRAND_GLYPHS = [
  'instagram', 'facebook', 'twitter', 'youtube', 'slack', 'github', 'gitlab', 'linkedin', 'twitch',
  'chrome', 'figma', 'codepen', 'dribbble', 'trello', 'framer', 'pocket', 'codesandbox',
];

// Competitor names (ops/CONVENTIONS.md), ROT13-encoded so the names never appear in the repo.
const rot13 = (s: string) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
const COMPETITORS = ['gurzvsl', 'vpba gurzre', 'zlfperra', 'fperraxvg', 'jvqtrgfzvgu', 'vagbyvir', 'ybbcl', 'ybpxvb'].map(rot13);

test('catalogue has ~560 entries with unique ids (T170 widened it from ~380)', () => {
  assert.ok(CATALOGUE.length >= 460 && CATALOGUE.length <= 700, `${CATALOGUE.length} entries`);
  const ids = CATALOGUE.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, id);
  const names = CATALOGUE.map((e) => normalize(e.name));
  assert.equal(new Set(names).size, names.length, 'duplicate names');
});

test('url schemes end with ":" or "://" and verified implies a scheme', () => {
  for (const e of CATALOGUE) {
    if (e.urlScheme === null) {
      assert.equal(e.verified, false, `${e.id} verified without a scheme`);
      continue;
    }
    assert.ok(e.urlScheme.endsWith('://') || /^[A-Za-z][A-Za-z0-9+.-]*:$/.test(e.urlScheme), `${e.id}: ${e.urlScheme}`);
    assert.match(e.urlScheme, /^[A-Za-z][A-Za-z0-9+.-]*:(\/\/)?$/, `${e.id}: ${e.urlScheme}`);
  }
  assert.ok(CATALOGUE.some((e) => e.verified));
  assert.ok(CATALOGUE.some((e) => e.urlScheme !== null && !e.verified));
  assert.ok(CATALOGUE.some((e) => e.urlScheme === null));
});

test('well-known schemes are present and verified', () => {
  const expect: Record<string, string> = {
    spotify: 'spotify:',
    instagram: 'instagram://',
    whatsapp: 'whatsapp://',
    youtube: 'youtube://',
    facebook: 'fb://',
    x: 'twitter://',
    messages: 'sms:',
    phone: 'tel:',
    maps: 'maps://',
    music: 'music://',
    photos: 'photos-redirect://',
    calendar: 'calshow:',
    notes: 'mobilenotes://',
  };
  for (const [id, scheme] of Object.entries(expect)) {
    const e = getById(id);
    assert.ok(e, id);
    assert.equal(e.urlScheme, scheme, id);
    assert.equal(e.verified, true, id);
  }
  assert.equal(getById('settings')?.urlScheme, 'App-prefs:');
});

test('system apps are included', () => {
  for (const id of ['camera', 'photos', 'settings', 'messages', 'phone', 'mail', 'safari', 'maps', 'music', 'calendar', 'notes', 'clock', 'weather']) {
    assert.equal(getById(id)?.category, 'System', id);
  }
});

test('categories and glyphs are valid, generic and exported', () => {
  const cats = new Set<string>(CATEGORIES);
  for (const e of CATALOGUE) {
    assert.ok(cats.has(e.category), `${e.id}: ${e.category}`);
    assert.ok(isKnownGlyph(e.glyph), `${e.id}: unknown glyph ${e.glyph}`);
    assert.ok(!BRAND_GLYPHS.includes(e.glyph), `${e.id}: brand glyph ${e.glyph}`);
    assert.ok(Array.isArray(e.aliases));
  }
  for (const c of CATEGORIES) assert.ok(byCategory(c).length > 0, `empty category ${c}`);
  assert.deepEqual([...GLYPHS], [...new Set(CATALOGUE.map((e) => e.glyph))].sort());
  const total = CATEGORIES.reduce((n, c) => n + byCategory(c).length, 0);
  assert.equal(total, CATALOGUE.length);
});

test('no competitor names anywhere in the catalogue', () => {
  const blob = normalize(JSON.stringify(CATALOGUE));
  for (const c of COMPETITORS) assert.ok(!blob.includes(c), c);
});

test('getById and byCategory', () => {
  assert.equal(getById('spotify')?.name, 'Spotify');
  assert.equal(getById('nope'), undefined);
  const sys = byCategory('System');
  const sorted = [...sys].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  assert.deepEqual(sys.map((e) => e.id), sorted.map((e) => e.id));
  assert.deepEqual(byCategory('Nope'), []);
});

test('empty query returns everything sorted by name; limit applies', () => {
  const all = search('');
  assert.equal(all.length, CATALOGUE.length);
  for (let i = 1; i < all.length; i++) {
    assert.ok(all[i - 1].name.localeCompare(all[i].name, 'en', { sensitivity: 'base' }) <= 0);
  }
  assert.equal(search('   ', 5).length, 5);
  assert.equal(search('a', 3).length, 3);
  assert.deepEqual(search('a', 0), []);
});

test('search ranks exact > name prefix > word prefix > alias > substring', () => {
  // exact beats prefix ("Maps" before "Google Maps"; "Mail" before "Gmail")
  assert.equal(search('maps')[0].id, 'maps');
  assert.equal(search('mail')[0].id, 'mail');
  // name prefix first
  assert.equal(search('spo')[0].id, 'spotify');
  const insta = search('insta').map((e) => e.id);
  assert.deepEqual(insta.slice(0, 2).sort(), ['instacart', 'instagram']);
  // all name-prefix matches come before any non-prefix match
  const g = search('goo');
  const firstNonPrefix = g.findIndex((e) => !normalize(e.name).startsWith('goo'));
  const lastPrefix = g.map((e) => normalize(e.name).startsWith('goo')).lastIndexOf(true);
  assert.ok(firstNonPrefix === -1 || lastPrefix < firstNonPrefix, 'prefix matches must lead');
  // word prefix ("music" -> Music exact, then YouTube Music / Amazon Music by word)
  const music = search('music').map((e) => e.id);
  assert.equal(music[0], 'music');
  assert.ok(music.indexOf('youtube-music') > 0);
  assert.ok(music.indexOf('youtube-music') < music.indexOf('spotify') || !music.includes('spotify'));
  // alias
  assert.equal(search('twitter')[0].id, 'x');
  assert.equal(search('ig')[0].id, 'instagram');
  assert.equal(search('woolies')[0].id, 'woolworths');
  // substring of name
  assert.ok(search('tube').map((e) => e.id).includes('youtube'));
});

test('search is case and diacritic insensitive', () => {
  assert.equal(search('SPOTIFY')[0].id, 'spotify');
  assert.equal(search('pokemon')[0].id, 'pokemon-go');
  assert.equal(search('Pokémon')[0].id, 'pokemon-go');
  assert.equal(search('facetime')[0].id, 'facetime');
  assert.equal(search('disney plus')[0].id, 'disney-plus');
  assert.equal(search('disney+')[0].id, 'disney-plus');
  assert.equal(search('mcdonalds')[0].id, 'mcdonalds');
});

test('fuzzy search tolerates typos and subsequences', () => {
  assert.equal(search('spotfy')[0].id, 'spotify');
  assert.equal(search('whatsap')[0].id, 'whatsapp');
  assert.equal(search('instgram')[0].id, 'instagram');
  assert.equal(search('netlfix')[0].id, 'netflix'); // transposition
  assert.equal(search('ytm')[0].id, 'youtube-music');
  assert.deepEqual(search('zzzzqqqq'), []);
});

test('editDistance', () => {
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('abc', 'abc'), 0);
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('ab', 'ba'), 1);
});

// ---------------------------------------------------------------- T28: coverage + support status

test('categories come from the fixed list and the owner groups are well covered', () => {
  assert.deepEqual([...CATEGORIES], [
    'System', 'Social', 'Messaging', 'Music & Audio', 'Video & TV', 'Photo & Design', 'Productivity', 'Finance',
    'Shopping', 'Food & Drink', 'Travel & Transport', 'Health & Fitness', 'News & Reading', 'Utilities', 'Education', 'Games',
  ]);
  const count = (c: string) => byCategory(c).length;
  // Games were thin (7) before T28; the owner asked for emphasis there.
  assert.ok(count('Games') >= 50, `games: ${count('Games')}`);
  assert.ok(count('Social') + count('Messaging') >= 35, 'social & messaging');
  assert.ok(count('Video & TV') + count('Music & Audio') >= 45, 'entertainment & streaming');
  assert.ok(count('Productivity') + count('Education') >= 50, 'productivity & education');
  assert.ok(count('Utilities') + count('System') >= 50, 'utilities');
  for (const c of CATEGORIES) assert.ok(count(c) >= 5, `${c}: ${count(c)}`);
});

test('CATEGORY_GROUPS covers every category exactly once', () => {
  const seen: string[] = CATEGORY_GROUPS.flatMap((g) => [...g.categories]);
  assert.equal(new Set(seen).size, seen.length, 'a category is in two groups');
  assert.deepEqual([...seen].sort(), [...CATEGORIES].sort());
  assert.equal(new Set(CATEGORY_GROUPS.map((g) => g.id)).size, CATEGORY_GROUPS.length);
});

test('support(): verified scheme, unverified scheme or Shortcuts only', () => {
  assert.equal(support({ urlScheme: 'spotify:', verified: true }), 'verified');
  assert.equal(support({ urlScheme: 'snssdk1233://', verified: false }), 'unverified');
  assert.equal(support({ urlScheme: 'myapp://' }), 'unverified'); // user-added apps are never verified
  assert.equal(support({ urlScheme: null, verified: true }), 'shortcuts');
  assert.equal(support({ urlScheme: '   ' }), 'shortcuts');
  assert.equal(support(getById('spotify')!), 'verified');
  assert.equal(support(getById('tiktok')!), 'unverified');
  assert.equal(support(getById('camera')!), 'shortcuts');
  for (const e of CATALOGUE) {
    const s = support(e);
    assert.equal(s === 'shortcuts', e.urlScheme === null, e.id);
    assert.equal(s === 'verified', e.verified, e.id);
  }
  const all = new Set(CATALOGUE.map(support));
  assert.deepEqual([...all].sort(), ['shortcuts', 'unverified', 'verified']);
  assert.equal(SUPPORT_LABELS.shortcuts, 'Shortcuts only');
});

test('apps added in T28 claim no verified schemes (nothing invented)', () => {
  const start = CATALOGUE.findIndex((e) => e.id === 'among-us');
  assert.ok(start > 0);
  // T170 rows (from 'weibo' on) have their own check in catalogueT170.test.ts.
  const end = CATALOGUE.findIndex((e) => e.id === 'weibo');
  assert.ok(end > start);
  for (const e of CATALOGUE.slice(start, end)) {
    assert.equal(e.verified, false, e.id);
    assert.equal(e.urlScheme, null, e.id);
  }
  // The verified count is unchanged by T28.
  assert.equal(CATALOGUE.filter((e) => e.verified).length, CATALOGUE.slice(0, start).filter((e) => e.verified).length);
});

test('new games are searchable by name and alias', () => {
  assert.equal(search('among us')[0].id, 'among-us');
  assert.equal(search('wordle')[0].id, 'nyt-games');
  assert.equal(search('cod')[0].id, 'call-of-duty-mobile');
  assert.equal(search('clash of')[0].id, 'clash-of-clans');
  assert.equal(search('Genshn')[0].id, 'genshin-impact');
});
